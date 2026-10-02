
const sharp = require("sharp");
const path  = require("path");
const { TEMP_DIR } = require("./tempDir");


async function _toVP8X(innerBuffer, quality) {
  return sharp({
    create: { width: CANVAS_SIZE, height: CANVAS_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: innerBuffer, left: PAD, top: PAD }])
    .webp({ quality })
    .toBuffer();
}

const CANVAS_SIZE = 512;
const PAD = 1;
const INNER_SIZE = CANVAS_SIZE - PAD * 2;



async function bufferToWebp(buffer, quality = 90) {

  const resized = await sharp(buffer)
    .resize(INNER_SIZE, INNER_SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();


  return _toVP8X(resized, quality);
}



async function bufferToWebpTransparent(buffer, quality = 90) {

  const resized = await sharp(buffer)
    .resize(INNER_SIZE, INNER_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return _toVP8X(resized, quality);
}



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
