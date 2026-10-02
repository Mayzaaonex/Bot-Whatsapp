function getVersion() {
  try {
    return require("../package.json").version;
  } catch {
    return "unknown";
  }
}

module.exports = {
  key: "berita",
  emoji: "📰",
  title: "Berita",
  description: "",
  get directText() {
    const version = getVersion();
    return (
      "📰 *Berita Commands*\n\n" +
      "• *.berita <kategori>*\n" +
      "• *.cuaca <nama kota>*\n\n" +
      `> Mayzaabot-v${version}`
    );
  },
  commands: [
    {
      command: "berita",
      description: "Lihat berita terbaru hari ini",
      usage: ".berita <kategori>",
      example: ".berita teknologi",
    },
    {
      command: "cuaca",
      description: "Cek cuaca di suatu kota",
      usage: ".cuaca <nama kota>",
      example: ".cuaca Kediri",
    },
  ],
};
