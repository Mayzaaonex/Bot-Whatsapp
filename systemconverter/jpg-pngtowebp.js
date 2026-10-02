// ============================================================
//  SYSTEMCONVERTER / JPG-PNG TO WEBP
// ============================================================
// Dua mode konversi ke WEBP:
//
//  bufferToWebp()     — buat gambar yang TIDAK punya alpha (foto, jpg, hasil
//                       API kayak brat). Output: WEBP dengan background PUTIH,
//                       tapi tetap pakai VP8X wrapper supaya EXIF bisa di-inject.
//                       Kenapa putih? Karena gambar sumber gak punya transparansi,
//                       kalau background transparan malah jadi invisible di WA.
//
//  bufferToWebpTransparent() — buat gambar yang SUDAH punya alpha (PNG stiker,
//                       screenshot dengan bg transparan, dll). Background: transparan.
//                       Ini yang dipakai fitur .s/.stiker saat user kirim foto PNG.
//
// Kenapa VP8X? WA cuma bisa baca EXIF metadata sticker dari WEBP tipe VP8X
// (extended). Sharp default output VP8 (simple) kalau gak ada alpha.
// Teknik composite ke canvas 1x1 transparan memaksa output VP8X.
// ============================================================

const sharp = require("sharp");
const path  = require("path");
const { TEMP_DIR } = require("./tempDir");

// ── Helper: paksa output VP8X dengan border transparan asli 1px ─────
// PENTING: libwebp otomatis MEMBUANG alpha channel kalau hasil akhirnya
// 100% opaque (gak ada piksel transparan beneran) — sekalipun sharp
// dikasih .ensureAlpha(). Makanya trik "composite pas 512x512 penuh ke
// canvas transparan" GAK cukup kalau si gambar sendiri udah nutup penuh
// 512x512-nya (kasus umum buat hasil brat yang emang persegi).
// Fix: gambar di-resize sedikit LEBIH KECIL dari canvas (510x510), terus
// ditaruh di tengah canvas 512x512 transparan → selalu ada border
// transparan asli 1px di pinggir, jadi libwebp GAK PUNYA ALASAN buang
// alpha-nya, dan output PASTI VP8X (extended, bisa dibaca WA + EXIF).
async function _toVP8X(innerBuffer, quality) {
  return sharp({
    create: { width: CANVAS_SIZE, height: CANVAS_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: innerBuffer, left: PAD, top: PAD }])
    .webp({ quality })
    .toBuffer();
}

const CANVAS_SIZE = 512;
const PAD = 1; // border transparan asli di tiap sisi
const INNER_SIZE = CANVAS_SIZE - PAD * 2; // 510 — konten asli di-resize ke ukuran ini

/**
 * Convert Buffer gambar (jpg/png/dll tanpa alpha) jadi WEBP.
 * Background: PUTIH — cocok buat foto biasa dan hasil API (brat, dll).
 * Output VP8X supaya EXIF chunk bisa di-inject.
 *
 * @param {Buffer} buffer  raw image buffer
 * @param {number} [quality=90]
 * @returns {Promise<Buffer>}
 */
async function bufferToWebp(buffer, quality = 90) {
  // 1. Resize ke INNER_SIZE (bukan penuh 512) contain, background putih
  const resized = await sharp(buffer)
    .resize(INNER_SIZE, INNER_SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 }, // putih solid
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // buang alpha channel
    .png()
    .toBuffer();

  // 2. Taruh di tengah canvas 512x512 transparan (border 1px asli) → paksa VP8X
  return _toVP8X(resized, quality);
}

/**
 * Convert Buffer gambar (PNG/WEBP yang sudah punya alpha) jadi WEBP transparan.
 * Background: transparan — cocok buat sticker yang user kirim (.s/.stiker).
 * Output VP8X.
 *
 * @param {Buffer} buffer
 * @param {number} [quality=90]
 * @returns {Promise<Buffer>}
 */
async function bufferToWebpTransparent(buffer, quality = 90) {
  // Resize ke INNER_SIZE, background transparan, jaga alpha asli si gambar
  const resized = await sharp(buffer)
    .resize(INNER_SIZE, INNER_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return _toVP8X(resized, quality);
}

/**
 * Convert file gambar jadi WEBP (dengan background putih).
 * @param {string} inputPath
 * @param {object} [opts]
 * @param {string} [opts.outputPath]
 * @param {number} [opts.quality]
 * @returns {Promise<string>} path file .webp
 */
async function jpgToWebp(inputPath, opts = {}) {
  const quality    = opts.quality ?? 90;
  const outputPath = opts.outputPath ||
    path.join(TEMP_DIR, `${path.basename(inputPath, path.extname(inputPath))}.webp`);

  const fs = require("fs");
  const buf = fs.readFileSync(inputPath);
  const webp = await bufferToWebp(buf, quality);
  fs.writeFileSync(outputPath, webp);
  return outputPath;
}

module.exports = { jpgToWebp, bufferToWebp, bufferToWebpTransparent };
