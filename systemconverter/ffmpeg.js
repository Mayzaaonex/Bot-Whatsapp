// ============================================================
//  SYSTEM / FFMPEG — convert video/gif -> animated WEBP (stiker gerak)
// ============================================================
// Dipakai buat bikin stiker gerak (animated sticker) dari video pendek
// atau gif. Gerakannya smooth karena kita jaga framerate & pakai
// libwebp lewat ffmpeg, bukan ambil 1 frame doang.

const { spawn } = require("child_process");
const path = require("path");
const { TEMP_DIR } = require("./tempDir");

/**
 * Jalanin ffmpeg sebagai child process dan tunggu sampai selesai.
 * @param {string[]} args
 * @returns {Promise<void>}
 */
function runFfmpeg(args, ffmpegPath = "ffmpeg") {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, ["-y", ...args]);
    let stderr = "";

    ff.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ff.on("error", (err) => {
      // biasanya ini kejadian kalau binary ffmpeg gak ketemu di PATH
      reject(new Error(`Gagal jalanin ffmpeg: ${err.message}`));
    });

    ff.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg keluar dengan kode ${code}\n${stderr}`));
      }
    });
  });
}

/**
 * Convert video (mp4/mov/gif/dll) jadi animated WEBP buat stiker WA.
 * Target: kanvas 512x512, durasi dipotong maksimal biar file gak kegedean,
 * fps dijaga cukup tinggi (tapi WA-friendly) supaya animasinya smooth.
 *
 * @param {string} inputPath
 * @param {object} [opts]
 * @param {string} [opts.outputPath]  default: tmp/<nama>.webp
 * @param {number} [opts.fps]         default 15 (smooth & ukuran wajar)
 * @param {number} [opts.maxDuration] detik, default 6 (batas WA ~10s)
 * @returns {Promise<string>} path file .webp hasil convert
 */
async function videoToAnimatedWebp(inputPath, opts = {}) {
  const fps = opts.fps ?? 15;
  const maxDuration = opts.maxDuration ?? 6;
  const ffmpegPath = opts.ffmpegPath ?? "ffmpeg";
  const outputPath =
    opts.outputPath ||
    path.join(
      TEMP_DIR,
      `${path.basename(inputPath, path.extname(inputPath))}.webp`
    );

  // filter chain:
  //  - fps=N            : samain framerate biar animasi rata (gak patah-patah)
  //  - scale=512:512     : pas-in ke kanvas stiker, jaga aspect ratio
  //  - force_original_aspect_ratio=decrease + pad : biar gak gepeng
  const filter =
    `fps=${fps},scale=512:512:force_original_aspect_ratio=decrease,` +
    `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;

  await runFfmpeg([
    "-i", inputPath,
    "-t", String(maxDuration),
    "-vf", filter,
    "-loop", "0",
    "-preset", "default",
    "-an", // stiker WA gak butuh audio
    "-fps_mode", "vfr", // ganti -vsync (deprecated ffmpeg >= 6.0)
    "-c:v", "libwebp",
    "-quality", "75",
    outputPath,
  ], ffmpegPath);

  return outputPath;
}

/**
 * Convert video/gif jadi mp4 pendek (kalau butuh preview/kompresi biasa,
 * bukan stiker). Berguna buat downloader (video ig/tiktok/dll) supaya
 * ukuran filenya wajar sebelum dikirim balik ke WA.
 *
 * @param {string} inputPath
 * @param {object} [opts]
 * @param {string} [opts.outputPath]
 * @param {string} [opts.crf] default "28" (makin gede makin kecil ukurannya)
 * @returns {Promise<string>}
 */
async function compressVideo(inputPath, opts = {}) {
  const crf = opts.crf ?? "28";
  const outputPath =
    opts.outputPath ||
    path.join(
      TEMP_DIR,
      `${path.basename(inputPath, path.extname(inputPath))}-compressed.mp4`
    );

  await runFfmpeg([
    "-i", inputPath,
    "-c:v", "libx264",
    "-crf", crf,
    "-preset", "veryfast",
    "-c:a", "aac",
    "-b:a", "128k",
    outputPath,
  ]);

  return outputPath;
}

module.exports = { runFfmpeg, videoToAnimatedWebp, compressVideo };
