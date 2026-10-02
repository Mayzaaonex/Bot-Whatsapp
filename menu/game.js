function getVersion() {
  try {
    return require("../package.json").version;
  } catch {
    return "unknown";
  }
}

module.exports = {
  key: "game",
  emoji: "🎮",
  title: "Game",
  description: "",
  get directText() {
    const version = getVersion();
    return (
      "🎮 *Game Commands*\n\n" +
      "• *.tebakgambar*\n" +
      "• *.family100*\n" +
      "• *.suit <batu/gunting/kertas>*\n\n" +
      `> Mayzaabot-v${version}`
    );
  },
  commands: [
    {
      command: "tebakgambar",
      description: "Main tebak gambar",
      usage: ".tebakgambar",
      example: ".tebakgambar",
    },
    {
      command: "family100",
      description: "Main Family 100",
      usage: ".family100",
      example: ".family100",
    },
    {
      command: "suit",
      description: "Main suit (batu gunting kertas) lawan bot",
      usage: ".suit <batu/gunting/kertas>",
      example: ".suit batu",
    },
  ],
};
