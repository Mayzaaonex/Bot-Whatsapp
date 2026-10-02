const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { TEMP_DIR } = require("./tempDir");
function getFfmpegPath() {
  if (os.platform() === "win32") {
    const win = "C:\\ffmpeg\\bin\\ffmpeg.exe";
    if (fs.existsSync(win)) return win;
  }
  return "ffmpeg";
}
function runFfmpeg(args, ffmpegPath = getFfmpegPath()) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, ["-y", ...args]);
    let stderr = "";
    ff.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    ff.on("error", (err) => {
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
async function videoToAnimatedWebp(inputPath, opts = {}) {
  const fps = opts.fps ?? 15;
  const maxDuration = opts.maxDuration ?? 6;
  const ffmpegPath = opts.ffmpegPath ?? getFfmpegPath();
  const outputPath =
    opts.outputPath ||
    path.join(
      TEMP_DIR,
      `${path.basename(inputPath, path.extname(inputPath))}.webp`
    );
  const filter =
    `fps=${fps},scale=512:512:force_original_aspect_ratio=decrease,` +
    `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
  await runFfmpeg([
    "-i", inputPath,
    "-t", String(maxDuration),
    "-vf", filter,
    "-loop", "0",
    "-preset", "default",
    "-an",
    "-fps_mode", "vfr",
    "-c:v", "libwebp",
    "-quality", "75",
    outputPath,
  ], ffmpegPath);
  return outputPath;
}
async function compressVideo(inputPath, opts = {}) {
  const crf = opts.crf ?? "28";
  const ffmpegPath = opts.ffmpegPath ?? getFfmpegPath();
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
  ], ffmpegPath);
  return outputPath;
}
module.exports = { getFfmpegPath, runFfmpeg, videoToAnimatedWebp, compressVideo };
