function getVersion() {
  try {
    return require("../package.json").version;
  } catch {
    return "unknown";
  }
}

module.exports = {
  key: "search",
  emoji: "🔍",
  title: "Search",
  description: "",
  get directText() {
    const version = getVersion();
    return (
      "🔍 *Search Commands*\n\n" +
      "• *.google <kata kunci>*\n" +
      "• *.pinterest <kata kunci>*\n" +
      "• *.wallpaper <kata kunci>*\n\n" +
      `> Mayzaabot-v${version}`
    );
  },
  commands: [
    {
      command: "google",
      description: "Cari sesuatu di Google",
      usage: ".google <kata kunci>",
      example: ".google resep rendang enak",
    },
    {
      command: "pinterest",
      description: "Cari gambar dari Pinterest",
      usage: ".pinterest <kata kunci>",
      example: ".pinterest wallpaper aesthetic",
    },
    {
      command: "wallpaper",
      description: "Cari wallpaper HD",
      usage: ".wallpaper <kata kunci>",
      example: ".wallpaper anime sunset",
    },
  ],
};
