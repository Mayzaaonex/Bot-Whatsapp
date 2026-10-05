const { getVersion } = require("./version");

const commands = [
  { command: "meme", description: "Kirim meme random", usage: ".meme", example: ".meme" },
  { command: "quote", description: "Kirim quote motivasi random", usage: ".quote", example: ".quote" },
  { command: "waifu", description: "Kirim gambar waifu random", usage: ".waifu", example: ".waifu" },
];

module.exports = {
  key: "random",
  emoji: "🎲",
  title: "Random",
  description: "",
  get directText() {
    const version = getVersion();
    return (
      "🎲 *Random Commands*\n\n" +
      "• *.meme*\n" +
      "• *.quote*\n" +
      "• *.waifu*\n\n" +
      `> Mayzaabot-v${version}`
    );
  },
  commands,
};