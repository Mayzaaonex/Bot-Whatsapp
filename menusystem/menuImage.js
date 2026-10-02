// ============================================================
//  SYSTEM / MENU IMAGE — gambar preview .menu, FULL LOCAL
// ============================================================
// Gak lagi download dari URL (bikin delay) — semua gambar preview
// .menu diambil dari folder /assets di root project. Taruh gambar
// di situ dengan nama BEBAS (1.jpg, 2.jpg, foto-a.png, dst — gak
// harus urut angka), tiap kali .menu dipanggil bakal dipilih 1
// SECARA ACAK dari semua yang ada di folder itu. Nambah gambar baru?
// Tinggal taruh file-nya di /assets, otomatis kebaca, gak perlu
// edit kode sama sekali.

const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(__dirname, "..", "assets");
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

/**
 * List semua file gambar yang ada di /assets.
 * @returns {string[]} nama file (bukan full path), urut nama
 */
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

/**
 * Pilih 1 gambar SECARA ACAK dari /assets dan baca isinya langsung
 * (fs.readFileSync, lokal, gak ada delay jaringan sama sekali).
 * @returns {Buffer|null} isi gambar, atau null kalau /assets kosong
 */
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
