
const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(__dirname, "..", "assets");
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];



function listMenuImages() {
  try {
    return fs
      .readdirSync(ASSETS_DIR)
      .filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .sort();
  } catch (e) {
    console.error("⚠️  Gagal baca folder /assets:", e.message);
    return [];
  }
}



function pickMenuImageBuffer() {
  const files = listMenuImages();
  if (files.length === 0) {
    console.error(
      "⚠️  Folder /assets kosong — .menu bakal jalan tanpa gambar preview. " +
        "Taruh minimal 1 file gambar (jpg/png/webp) di folder /assets."
    );
    return null;
  }

  const pick = files[Math.floor(Math.random() * files.length)];
  try {
    return fs.readFileSync(path.join(ASSETS_DIR, pick));
  } catch (e) {
    console.error(`⚠️  Gagal baca /assets/${pick}:`, e.message);
    return null;
  }
}

module.exports = { listMenuImages, pickMenuImageBuffer, ASSETS_DIR };
