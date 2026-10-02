function getVersion() {
  try {
    return require("../package.json").version;
  } catch {
    return "unknown";
  }
}

module.exports = {
  key: "stalker",
  emoji: "🕵️",
  title: "Stalker",
  description: "",
  get directText() {
    const version = getVersion();
    return (
      "🕵️ *Stalker Commands*\n\n" +
      "• *.igstalk <username>*\n" +
      "• *.ttstalk <username>*\n" +
      "• *.ghstalk <username>*\n\n" +
      `> Mayzaabot-v${version}`
    );
  },
  commands: [
    {
      command: "igstalk",
      description: "Lihat info profil Instagram",
      usage: ".igstalk <username>",
      example: ".igstalk cristiano",
    },
    {
      command: "ttstalk",
      description: "Lihat info profil TikTok",
      usage: ".ttstalk <username>",
      example: ".ttstalk khaby.lame",
    },
    {
      command: "ghstalk",
      description: "Lihat info profil GitHub",
      usage: ".ghstalk <username>",
      example: ".ghstalk torvalds",
    },
  ],
};
