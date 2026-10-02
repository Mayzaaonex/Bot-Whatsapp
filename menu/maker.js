function getVersion() {
  try {
    return require("../package.json").version;
  } catch {
    return "unknown";
  }
}

module.exports = {
  key: "maker",
  emoji: "🛠️",
  title: "Maker",
  description: "",
  get directText() {
    const version = getVersion();
    return (
      "🛠️ *Maker Commands*\n\n" +
      "• *.s / .stiker* \n" +
      "• *.brat <teks>*\n" +
      "• *.bratvid <teks>*\n" +
      "• *.wm <nama pack>* — reply sticker untuk rename\n\n" +
      `> Mayzaabot-v${version}`
    );
  },
  commands: [
    {
      command: "s",
      description: "Ubah foto atau video jadi sticker — reply atau kirim langsung",
      usage: ".s (reply foto/video)",
      example: ".s",
    },
    {
      command: "stiker",
      description: "Alias dari .s — ubah foto atau video jadi sticker",
      usage: ".stiker (reply foto/video)",
      example: ".stiker",
    },
    {
      command: "sticker",
      description: "Alias dari .s — ubah foto atau video jadi sticker",
      usage: ".sticker (reply foto/video)",
      example: ".sticker",
    },
    {
      command: "brat",
      description: "Bikin sticker gambar gaya 'brat' dari teks",
      usage: ".brat <teks>",
      example: ".brat capek banget hari ini",
    },
    {
      command: "bratvid",
      description: "Bikin animated sticker gaya 'brat' dari teks",
      usage: ".bratvid <teks>",
      example: ".bratvid aku iki tukang tambal ban",
    },
    {
      command: "wm",
      description: "Ganti nama sticker pack, author dikosongkan",
      usage: ".wm <nama pack>",
      example: ".wm Mayzaa",
    },
  ],
};
