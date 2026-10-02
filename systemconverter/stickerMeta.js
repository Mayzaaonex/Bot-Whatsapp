// ============================================================
//  SYSTEM / STICKER META — inject pack & author ke WEBP buffer
// ============================================================
// WA baca sticker metadata dari EXIF chunk di file WEBP, TAPI pakai
// struktur custom sendiri (tag 0x5741, tanpa prefix "Exif\0\0") — BUKAN
// EXIF standar (UserComment 0x9286). Lihat makeExifBlob() di bawah.
//
// Fix v2:
//  - VP8X: set bit EXIF (0x08) di flags byte VP8X chunk, lalu append EXIF
//  - VP8 / VP8L: append EXIF chunk langsung (fallback, harusnya tidak
//    terjadi setelah image.js difix supaya selalu output VP8X)
// ============================================================

const fs   = require("fs");
const path = require("path");

// ── Baca .env.sticker dari root project ─────────────────────
function getStickerMeta() {
  try {
    const envPath = path.join(__dirname, "../env/.env.sticker");
    const raw = fs.readFileSync(envPath, "utf8");
    const meta = { pack: "Bot Sticker", author: "@bot" };
    for (const line of raw.split(/\r?\n/)) {
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key === "pack")   meta.pack   = val;
      if (key === "author") meta.author = val;
    }
    return meta;
  } catch {
    return { pack: "Bot Sticker", author: "@bot" };
  }
}

// ── Bikin EXIF blob berisi JSON metadata sticker WA ─────────
// PENTING: ini BUKAN EXIF standar (UserComment 0x9286 + prefix "Exif\0\0").
// WA baca sticker metadata pakai parser custom sendiri yang expect tag
// 0x5741 dan TIDAK ada prefix "Exif\0\0" — TIFF header-nya harus persis
// di byte pertama chunk. Ini struktur yang sama dipakai di hampir semua
// bot WA (Baileys examples, wa-sticker-formatter, dll) — sengaja disamain
// byte-per-byte biar konsisten sama yang WA-nya sendiri kenali.
function makeExifBlob(packName, author) {
  const jsonMeta = JSON.stringify({
    "sticker-pack-id":        "com.mayzaabot.sticker",
    "sticker-pack-name":      packName,
    "sticker-pack-publisher": author,
    "emojis":                 ["🤖"],
  });
  const jsonBuf = Buffer.from(jsonMeta, "utf8");

  // Header TIFF + 1 IFD entry, 22 byte tetap (gak ada "next IFD" field —
  // data JSON langsung nempel setelah header ini, makanya offset-nya = 22 / 0x16):
  //   "II" (2) + magic 42 (2) + offset IFD0=8 (4) + jumlah entry=1 (2)
  //   + tag=0x5741 (2) + type=7/UNDEFINED (2) + count (4, diisi belakangan)
  //   + offset data=22 (4)
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);

  const exif = Buffer.concat([exifAttr, jsonBuf]);
  exif.writeUIntLE(jsonBuf.length, 14, 4); // isi field "count" (offset 14) = panjang json
  return exif;
}

// ── Append EXIF chunk ke WEBP buffer ────────────────────────
// WEBP format: "RIFF" + 4-byte filesize + "WEBP" + chunks...
// Setiap chunk: 4-byte FourCC + 4-byte size + data (+ 1 pad byte kalau size ganjil)
//
// VP8X flags byte (offset 20, little-endian 24-bit):
//   bit 1 (0x02) = ICC profile
//   bit 2 (0x04) = Alpha
//   bit 3 (0x08) = EXIF metadata  ← harus di-set kalau ada EXIF chunk
//   bit 4 (0x10) = XMP metadata
//   bit 5 (0x20) = Animation
function injectExifToWebp(webpBuffer, exifBlob) {
  // Validasi: harus diawali RIFF....WEBP
  if (
    webpBuffer.slice(0, 4).toString("ascii") !== "RIFF" ||
    webpBuffer.slice(8, 12).toString("ascii") !== "WEBP"
  ) {
    return webpBuffer; // bukan WEBP valid, skip
  }

  // Bangun EXIF chunk: FourCC "EXIF" + size (4 byte LE) + data + optional pad
  const fourCC    = Buffer.from("EXIF", "ascii");
  const sizeLE    = Buffer.alloc(4);
  sizeLE.writeUInt32LE(exifBlob.length, 0);
  const pad       = exifBlob.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);
  const exifChunk = Buffer.concat([fourCC, sizeLE, exifBlob, pad]);

  const firstChunkFourcc = webpBuffer.slice(12, 16).toString("ascii");

  if (firstChunkFourcc === "VP8X") {
    // ── VP8X path (extended WEBP) ────────────────────────────
    // Set bit EXIF (0x08) di flags byte VP8X (offset 20).
    // VP8X chunk data: 4 byte flags (little-endian 24-bit + 8-bit reserved)
    //                  + 3 byte canvas width-1 + 3 byte canvas height-1
    // Offset 20 = 12 (RIFF hdr) + 4 (VP8X fourcc) + 4 (VP8X size) = 20
    const result = Buffer.from(webpBuffer); // copy buffer, jangan mutate asli
    result[20] = result[20] | 0x08;         // set EXIF flag bit

    // Update ukuran RIFF (RIFF size = total file - 8 byte "RIFF" + size field)
    const newRiffSize = result.length - 8 + exifChunk.length;
    result.writeUInt32LE(newRiffSize, 4);

    return Buffer.concat([result, exifChunk]);

  } else {
    // ── VP8 / VP8L path (simple WEBP) — fallback ────────────
    // Harusnya tidak masuk sini setelah image.js difix ke VP8X output.
    // Tapi dijaga tetap untuk robustness (mis. file webp dari sumber lain).
    // Append EXIF langsung; WA mungkin tetap baca meskipun tanpa VP8X wrapper.
    const oldData    = webpBuffer.slice(12); // semua chunk setelah "WEBP"
    const newSize    = 4 + oldData.length + exifChunk.length; // "WEBP" + chunks
    const riffHeader = Buffer.alloc(12);
    riffHeader.write("RIFF", 0, "ascii");
    riffHeader.writeUInt32LE(newSize, 4);
    riffHeader.write("WEBP", 8, "ascii");

    return Buffer.concat([riffHeader, oldData, exifChunk]);
  }
}

// ── Strip EXIF chunk lama dari WEBP (buat rename sticker) ──
// Parse chunk RIFF satu-satu, buang chunk "EXIF", clear bit EXIF di
// flags VP8X, rebuild header RIFF. Perlu karena WA baca EXIF chunk
// pertama — kalau cuma append, metadata lama yang kebaca.
function stripExifFromWebp(webpBuffer) {
  if (
    webpBuffer.slice(0, 4).toString("ascii") !== "RIFF" ||
    webpBuffer.slice(8, 12).toString("ascii") !== "WEBP"
  ) {
    return webpBuffer; // bukan WEBP valid, biarin apa adanya
  }
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= webpBuffer.length) {
    const fourcc = webpBuffer.slice(offset, offset + 4).toString("ascii");
    const size = webpBuffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2); // +1 pad byte kalau size ganjil
    if (end > webpBuffer.length) break;
    if (fourcc !== "EXIF") chunks.push(webpBuffer.slice(offset, end));
    offset = end;
  }
  const body = Buffer.concat([Buffer.from("WEBP", "ascii"), ...chunks]);
  // Clear bit EXIF (0x08) di flags VP8X — nanti di-set lagi pas inject
  if (chunks.length && chunks[0].slice(0, 4).toString("ascii") === "VP8X" && body.length > 12) {
    body[12] = body[12] & ~0x08;
  }
  const riff = Buffer.alloc(12);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(body.length, 4);
  riff.write("WEBP", 8, "ascii");
  return Buffer.concat([riff, body.slice(4)]);
}

/**
 * Ganti pack & author sticker yang sudah jadi (rename + kirim ulang).
 * @param {Buffer} webpBuffer buffer sticker/webp asli
 * @param {string} pack nama pack baru
 * @param {string} author author baru ("" = kosong)
 * @returns {Buffer} WEBP buffer dengan metadata baru
 */
function restampStickerMeta(webpBuffer, pack, author) {
  const exifBlob = makeExifBlob(pack, author);
  return injectExifToWebp(stripExifFromWebp(webpBuffer), exifBlob);
}
/**
 * Inject sticker pack & author metadata ke WEBP buffer.
 * @param {Buffer} webpBuffer
 * @returns {Buffer} WEBP buffer dengan EXIF metadata
 */
function addStickerMeta(webpBuffer) {
  try {
    const { pack, author } = getStickerMeta();
    const exifBlob = makeExifBlob(pack, author);
    return injectExifToWebp(webpBuffer, exifBlob);
  } catch (e) {
    console.error("⚠️  Gagal inject sticker meta:", e.message);
    return webpBuffer; // fallback: kirim tanpa metadata
  }
}

module.exports = { addStickerMeta, getStickerMeta, restampStickerMeta };
