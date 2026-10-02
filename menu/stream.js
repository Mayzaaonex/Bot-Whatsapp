function getVersion() {
  try {
    return require("../package.json").version;
  } catch {
    return "unknown";
  }
}

module.exports = {
  key: "stream",
  emoji: "🎵",
  title: "Stream",
  description: "",
  get directText() {
    const version = getVersion();
    return (
      "🎵 *Stream Commands*\n\n" +
      "• *.play <judul lagu>*\n" +
      "• *.playvid <judul video>*\n" +
      "• *.lirik <judul lagu>*\n\n" +
      `> Mayzaabot-v${version}`
    );
  },
  commands: [
    {
      command: "play",
      description: "Play musik dari YouTube, dikirim jadi audio",
      usage: ".play <judul lagu>",
      example: ".play Payung Teduh - Akad",
    },
    {
      command: "playvid",
      description: "Play video dari YouTube",
      usage: ".playvid <judul video>",
      example: ".playvid tutorial masak nasi goreng",
    },
    {
      command: "lirik",
      description: "Cari lirik lagu",
      usage: ".lirik <judul lagu>",
      example: ".lirik Akad - Payung Teduh",
    },
  ],
};
