const config = require("../config");

function getVersion() {
  try {
    return require("../package.json").version;
  } catch {
    return "unknown";
  }
}

module.exports = {
  key: "owner",
  emoji: "👑",
  title: "Owner",
  description: "",
  get directText() {
    const p = config.prefix;
    const version = getVersion();
    return (
      "👑 *Owner Commands*\n\n" +
      `• *${p}setprefix <simbol>*\n` +
      `• *${p}setnick <nama>*\n` +
      `• *${p}useprofile*\n` +
      `• *${p}usebanner*\n` +
      `• *${p}addwl <nomor>*\n` +
      `• *${p}removewl <nomor>*\n` +
      `• *${p}listwl*\n` +
      `• *${p}idgc*\n` +
      `• *${p}setgc <idgc>*\n` +
      `• *${p}delgc <idgc>*\n` +
      `• *${p}outgc <idgc>*\n` +
      `• *${p}joingc <link>*\n` +
      `• *${p}listgc*\n` +
      `• *${p}getjid <nomor>*\n` +
      `• *${p}getnumber <jid>*\n` +
      `• *${p}addmeta*\n\n` +
      `*Bot Version:*\n` +
      `> Mayzaabot-v${version}`
    );
  },
  commands: [
    { command: "owner", description: "Lihat menu owner (cuma bisa dipake owner)", usage: ".owner", example: ".owner" },
    { command: "setprefix", description: "Ganti prefix bot (owner only)", usage: ".setprefix <simbol>", example: ".setprefix !" },
    { command: "setnick", description: "Ganti nama/nickname bot di WA (owner only)", usage: ".setnick <nama>", example: ".setnick Bot Keren" },
    { command: "useprofile", description: "Ganti foto profil bot — kirim foto + caption perintah (owner only)", usage: ".useprofile", example: ".useprofile" },
    { command: "usebanner", description: "Ganti banner WA Business — kirim foto + caption perintah (owner only)", usage: ".usebanner", example: ".usebanner" },
    { command: "addwl", description: "Tambah nomor ke whitelist (owner only)", usage: ".addwl <nomor>", example: ".addwl 628123456789" },
    { command: "removewl", description: "Hapus nomor dari whitelist (owner only)", usage: ".removewl <nomor>", example: ".removewl 628123456789" },
    { command: "listwl", description: "Lihat daftar whitelist aktif (owner only)", usage: ".listwl", example: ".listwl" },
    { command: "idgc", description: "Lihat ID grup ini, jalan di semua grup (owner only, grup only)", usage: ".idgc", example: ".idgc" },
    { command: "setgc", description: "Whitelist grup biar bot merespon di sana (owner only)", usage: ".setgc <idgc>", example: ".setgc 120363012345678901@g.us" },
    { command: "delgc", description: "Cabut grup dari whitelist (owner only)", usage: ".delgc <idgc>", example: ".delgc 120363012345678901@g.us" },
    { command: "outgc", description: "Keluar grup via nomor urut listgc lalu hapus whitelist (owner only)", usage: ".outgc <nomor listgc / idgc>", example: ".outgc 3" },
    { command: "joingc", description: "Masuk grup lewat link lalu otomatis whitelist (owner only)", usage: ".joingc <link grup>", example: ".joingc https://chat.whatsapp.com/IjAE2P1KcD4Hya3mEBCTgf" },
    { command: "listgc", description: "Lihat semua grup yang diikuti bot + nama, ID, total member (owner only)", usage: ".listgc", example: ".listgc" },
    { command: "getjid", description: "Encode nomor HP jadi JID WhatsApp (owner only)", usage: ".getjid <nomor>", example: ".getjid 089531367146" },
    { command: "getnumber", description: "Decode JID/@lid jadi nomor HP asli (owner only)", usage: ".getnumber <jid>", example: ".getnumber 129111632691455@lid" },
    { command: "addmeta", description: "Invite Meta AI ke grup ini (owner only, grup only)", usage: ".addmeta", example: ".addmeta" },
  ],
};
