
const fs   = require("fs");
const path = require("path");


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


function makeExifBlob(packName, author) {
  const jsonMeta = JSON.stringify({
    "sticker-pack-id":        "com.mayzaabot.sticker",
    "sticker-pack-name":      packName,
    "sticker-pack-publisher": author,
    "emojis":                 ["🤖"],
  });
  const jsonBuf = Buffer.from(jsonMeta, "utf8");


  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);

  const exif = Buffer.concat([exifAttr, jsonBuf]);
  exif.writeUIntLE(jsonBuf.length, 14, 4);
  return exif;
}


function injectExifToWebp(webpBuffer, exifBlob) {

  if (
    webpBuffer.slice(0, 4).toString("ascii") !== "RIFF" ||
    webpBuffer.slice(8, 12).toString("ascii") !== "WEBP"
  ) {
    return webpBuffer;
  }


  const fourCC    = Buffer.from("EXIF", "ascii");
  const sizeLE    = Buffer.alloc(4);
  sizeLE.writeUInt32LE(exifBlob.length, 0);
  const pad       = exifBlob.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);
  const exifChunk = Buffer.concat([fourCC, sizeLE, exifBlob, pad]);

  const firstChunkFourcc = webpBuffer.slice(12, 16).toString("ascii");

  if (firstChunkFourcc === "VP8X") {

    const result = Buffer.from(webpBuffer);
    result[20] = result[20] | 0x08;


    const newRiffSize = result.length - 8 + exifChunk.length;
    result.writeUInt32LE(newRiffSize, 4);

    return Buffer.concat([result, exifChunk]);

  } else {

    const oldData    = webpBuffer.slice(12);
    const newSize    = 4 + oldData.length + exifChunk.length;
    const riffHeader = Buffer.alloc(12);
    riffHeader.write("RIFF", 0, "ascii");
    riffHeader.writeUInt32LE(newSize, 4);
    riffHeader.write("WEBP", 8, "ascii");

    return Buffer.concat([riffHeader, oldData, exifChunk]);
  }
}


function stripExifFromWebp(webpBuffer) {
  if (
    webpBuffer.slice(0, 4).toString("ascii") !== "RIFF" ||
    webpBuffer.slice(8, 12).toString("ascii") !== "WEBP"
  ) {
    return webpBuffer;
  }
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= webpBuffer.length) {
    const fourcc = webpBuffer.slice(offset, offset + 4).toString("ascii");
    const size = webpBuffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > webpBuffer.length) break;
    if (fourcc !== "EXIF") chunks.push(webpBuffer.slice(offset, end));
    offset = end;
  }
  const body = Buffer.concat([Buffer.from("WEBP", "ascii"), ...chunks]);

  if (chunks.length && chunks[0].slice(0, 4).toString("ascii") === "VP8X" && body.length > 12) {
    body[12] = body[12] & ~0x08;
  }
  const riff = Buffer.alloc(12);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(body.length, 4);
  riff.write("WEBP", 8, "ascii");
  return Buffer.concat([riff, body.slice(4)]);
}



function restampStickerMeta(webpBuffer, pack, author) {
  const exifBlob = makeExifBlob(pack, author);
  return injectExifToWebp(stripExifFromWebp(webpBuffer), exifBlob);
}


function addStickerMeta(webpBuffer) {
  try {
    const { pack, author } = getStickerMeta();
    const exifBlob = makeExifBlob(pack, author);
    return injectExifToWebp(webpBuffer, exifBlob);
  } catch (e) {
    console.error("⚠️  Gagal inject sticker meta:", e.message);
    return webpBuffer;
  }
}

module.exports = { addStickerMeta, getStickerMeta, restampStickerMeta };
