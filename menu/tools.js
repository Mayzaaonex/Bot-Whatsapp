const { getVersion } = require("./version");

const commands = [
  { command: "sticker", description: "Ubah foto/video jadi sticker", usage: "kirim/reply foto atau video pendek lalu ketik .sticker", example: ".sticker" },
  { command: "toimg", description: "Ubah sticker jadi gambar biasa", usage: "reply sticker lalu ketik .toimg", example: ".toimg" },
  { command: "rvo", description: "Buka ulang pesan sekali-lihat (foto/video/audio)", usage: "reply pesan sekali-lihat lalu ketik .rvo", example: ".rvo" },
  { command: "shortlink", description: "Perpendek sebuah link", usage: ".shortlink <url>", example: ".shortlink https://contoh.com/link/panjang/banget" },
  { command: "ss", description: "Screenshot sebuah halaman website", usage: ".ss <url>", example: ".ss https://google.com" },
  { command: "getprofile", description: "Ambil foto profil orang yang di-tag", usage: ".getprofile @tag", example: ".getprofile @Mayzaa" },
  { command: "getpp", description: "Alias .getprofile", usage: ".getpp @tag", example: ".getpp @Mayzaa" },
  { command: "getpfp", description: "Alias .getprofile", usage: ".getpfp @tag", example: ".getpfp @Mayzaa" },
];

module.exports = {
  key: "tools",
  emoji: "🧰",
  title: "Tools",
  description: "",
  get directText() {
    const version = getVersion();
    return (
      "🧰 *Tools Commands*\n\n" +
      "• *.sticker*\n" +
      "• *.toimg*\n" +
      "• *.rvo*\n" +
      "• *.shortlink <url>*\n" +
      "• *.ss <url>*\n" +
      "• *.getprofile @tag*\n\n" +
      `> Mayzaabot-v${version}`
    );
  },
  commands,
};