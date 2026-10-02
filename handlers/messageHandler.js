const { findCategory, findCommand } = require("../menu/mainmenu");
const {
  buildMainMenuList,
  buildMainMenuInteractive,
  buildMainMenuText,
  buildCategoryMenuList,
  buildCategoryMenuInteractive,
  buildCategoryMenuText,
  buildCommandUsage,
  buildAllMenu,
} = require("../menu/menuText");
const config = require("../config");
const {
  phoneToJid,
  normalizePhone,
  resolvePNForLid,
  getCachedPNForLid,
  jidType,
} = require("../systemconverter/jid");
const { pickMenuImageBuffer } = require("../menusystem/menuImage");
const aiProviders = require("../menusystem/ai");
const { makeBrat, makeBratVid } = require("../menusystem/maker");
const aiImage = require("../menusystem/aiimage");
const fs = require("fs");

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36";

async function shortenUrl(url) {
  try {
    const encoded = encodeURIComponent(url);
    const res = await fetch(`https://mayzaa.netlify.app/short?=${encoded}`, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return url;
    const data = await res.json();
    return data?.status && data?.result_url ? data.result_url : url;
  } catch {
    return url;
  }
}

// command bot -> fungsi provider AI yang dipanggil
const AI_HANDLERS = {
  gemini: aiProviders.gemini,
  chatgpt: aiProviders.chatgpt,
  deepai: aiProviders.deepai,
  deepseekflash: aiProviders.deepseekV4Flash,
  deepseekpro: aiProviders.deepseekV4Pro,
  gemini31pro: aiProviders.gemini31Pro,
};

// META AI bot JID resmi (dari Meta, bukan nomor biasa — makanya "@bot")
const META_AI_JID = "867051314767696@bot";

/**
 * JID buat sender dipake jadi @mention itu HARUS format personal
 * ("...@s.whatsapp.net"), sedangkan sender bisa aja "@lid". Fungsi ini
 * nyari nomor asli sender (dari cache LID kalau perlu) terus bikinin
 * JID yang valid buat di-mention di pesan WA.
 */
function toMentionJid(sender) {
  if (sender.endsWith("@lid")) {
    const number = getCachedPNForLid(sender);
    return number ? phoneToJid(number) : sender; // fallback: mention apa adanya
  }
  return sender;
}

// ── OWNER ────────────────────────────────────────────────────────────
// Nomor admin/owner diatur di config.json (root project), BUKAN di sini.
// Bisa isi lebih dari satu nomor, format 08xxx atau 628xxx dua-duanya jalan.
// Kalau JID pengirim tipe "@lid" (kayak yang dialamin owner), fungsi ini
// otomatis nge-decode ke nomor HP asli lewat sock (lihat system/jid.js).
async function isOwner(sock, jid) {
  return config.isOwnerAsync(sock, jid);
}

// ── PARSER ───────────────────────────────────────────────────────────
// Pisahin prefix + command + args dari teks mentah.
// Prefix dibaca dari config supaya dinamis.
// Contoh: "!gemini halo" → { command: "gemini", args: "halo", hasPrefix: true }
function parseCommand(rawText) {
  const text = rawText.trim();
  const p = config.prefix;

  // escape karakter regex khusus di prefix (e.g. "." jadi "\.")
  const escapedP = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixRegex = new RegExp(`^${escapedP}`);

  if (!prefixRegex.test(text)) {
    return { command: "", args: "", hasPrefix: false };
  }

  const withoutPrefix = text.replace(prefixRegex, "");
  const [command, ...rest] = withoutPrefix.split(" ");
  return {
    command: command?.toLowerCase() || "",
    args: rest.join(" ").trim(),
    hasPrefix: true,
  };
}

// List di Baileys CUMA jalan di chat pribadi
function isGroup(jid) {
  return jid.endsWith("@g.us");
}

// ── WHITELIST GUARD ───────────────────────────────────────────────────
// Chat pribadi: whitelist nomor (.addwl) — kosong → semua orang boleh.
function isAllowed(jid) {
  return config.isAllowed(jid);
}

// Grup: cuma grup yang ada di database/whitelist.json yang direspon.
// Kecuali command owner di bawah ini — jalan di SEMUA grup (biar owner
// bisa ambil ID grup & daftarin grup baru), non-owner tetap diemin.
const OWNER_ANY_GROUP_COMMANDS = ["idgc", "setgc", "delgc", "listgc", "listgrup", "listgroup", "grouplist", "outgc", "joingc"];

// "1203630...@g.us" atau cuma "1203630..." → JID grup valid (atau null)
function normalizeGroupJid(input) {
  const raw = (input || "").trim().split(/\s+/)[0];
  if (!raw) return null;
  const jid = raw.includes("@") ? raw : `${raw}@g.us`;
  return /^\d+(-\d+)?@g\.us$/.test(jid) ? jid : null;
}

function getInviteCode(input) {
  const raw = (input || "").trim().split(/\s+/)[0];
  const match = raw.match(/(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9_-]{10,})/);
  return match?.[1] || null;
}

// ── GREETING HELPER ───────────────────────────────────────────────────
// Sapaan bahasa Jepang sesuai waktu WIB (UTC+7), format jam 24 jam.
//   04:00 – 10:59  → Ohayou gozaimasu ☀️  (Selamat Pagi)
//   11:00 – 17:59  → Konnichiwa 🌤️        (Selamat Siang)
//   18:00 – 03:59  → Konbanwa 🌙           (Selamat Malam)
function getGreeting() {
  // Ambil jam sekarang dalam zona WIB (UTC+7)
  const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const hour = nowWIB.getUTCHours(); // 0–23

  if (hour >= 4 && hour < 11) {
    return "Ohayou gozaimasu ☀️"; // Pagi
  } else if (hour >= 11 && hour < 18) {
    return "Konnichiwa 🌤️";       // Siang
  } else {
    return "Konbanwa 🌙";          // Malam (18:00 – 03:59)
  }
}

// ── REACTION HELPER ───────────────────────────────────────────────────
// Kirim reaction emoji ke pesan tertentu.
// msgKey = msg.key dari event messages.upsert (berisi id, remoteJid, dll)
// emoji  = string emoji, e.g. "⏳", "✅", "❌"
async function react(sock, msgKey, emoji) {
  try {
    await sock.sendMessage(msgKey.remoteJid, {
      react: { text: emoji, key: msgKey },
    });
  } catch (e) {
    // reaction gagal (e.g. pesan terlalu lama) → cukup log, jangan crash
    console.error("⚠️  Gagal kirim reaction:", e.message);
  }
}

// ── HANDLER UTAMA ─────────────────────────────────────────────────────
// msgKey ditambahkan sebagai parameter baru (opsional, bisa undefined kalau
// dipanggil dari tempat lain yang belum nyiapin key)
async function handleMessage(sock, from, sender, rawText, quotedInfo, pushName, msgKey, msg) {
  if (!rawText?.trim()) return;

  let { command, args, hasPrefix } = parseCommand(rawText);

  // Link TikTok/Instagram/Facebook tanpa prefix → auto-download.
  if (!hasPrefix) {
    const detected = require("../menusystem/downloader").detectDownloaderUrl(rawText);
    if (detected) {
      command = detected.platform;
      args = detected.url;
      hasPrefix = true;
    }
  }
  if (!hasPrefix) return;
  if (!command) return;

  const group = isGroup(from);
  const p = config.prefix;

  // ── whitelist check ──
  // Semua penolakan di sini DIEM TOTAL: gak ada balasan, gak ada reaction.
  if (OWNER_ANY_GROUP_COMMANDS.includes(command)) {
    // .idgc / .setgc: khusus owner, jalan di grup mana aja (whitelist atau bukan)
    if (!(await isOwner(sock, sender))) return;
  } else if (group) {
    if (!config.isGroupAllowed(from)) return;
  } else if (!isAllowed(from)) {
    return;
  }

  // ── reaction: ⏳ tanda bot mulai proses ──────────────────────────
  // Kalau msgKey tersedia, langsung kasih reaction jam pasir supaya
  // user tau perintahnya ke-detect dan lagi diproses.
  if (msgKey) await react(sock, msgKey, "⏳");

  // ── menu ─────────────────────────────────────────────────────────
  if (command === "menu") {
    const mentionJid = toMentionJid(sender);
    const mentionTag = `@${mentionJid.split("@")[0]}`;
    const greeting = `${getGreeting()} 👋 ${mentionTag}\n\nSilakan pilih menu di bawah ini ya 👇`;

    // Full lokal — baca dari /assets, gak ada network call sama sekali,
    // jadi gak ada delay. Kalau /assets kosong, jalan tanpa gambar.
    const imageBuffer = pickMenuImageBuffer();

    if (group) {
      try {
        if (imageBuffer) {
          await sock.sendMessage(from, {
            ...buildMainMenuInteractive(greeting, imageBuffer),
            mentions: [mentionJid],
          });
        } else {
          await sock.sendMessage(from, {
            text: `${greeting}\n\n${buildMainMenuText()}`,
            mentions: [mentionJid],
          });
        }
      } catch {
        await sock.sendMessage(from, {
          text: `${greeting}\n\n${buildMainMenuText()}`,
          mentions: [mentionJid],
        });
      }
    } else {
      // List message di private chat gak bisa ditempelin gambar header
      // langsung (limitasi Baileys) — jadi gambar preview dikirim
      // sebagai pesan terpisah (sapaan + gambar), nyusul List-nya
      // persis di belakang.
      if (imageBuffer) {
        try {
          await sock.sendMessage(from, {
            image: imageBuffer,
            caption: greeting,
            mentions: [mentionJid],
          });
        } catch (e) {
          console.error("⚠️  Gagal kirim gambar preview menu:", e.message);
          await sock.sendMessage(from, { text: greeting, mentions: [mentionJid] });
        }
      } else {
        await sock.sendMessage(from, { text: greeting, mentions: [mentionJid] });
      }
      await sock.sendMessage(from, buildMainMenuList());
    }

    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // ── allmenu ───────────────────────────────────────────────────────
  if (command === "allmenu") {
    await sock.sendMessage(from, { text: buildAllMenu() });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // ── separator __allmenu__ dipilih dari list/interactive ───────────
  // rowId-nya ".__allmenu__" → ditangkap sebagai kategori,
  // tapi kita handle khusus di sini
  if (command === "__allmenu__") {
    await sock.sendMessage(from, { text: buildAllMenu() });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // ── owner commands ────────────────────────────────────────────────

  // .owner — menu khusus owner. Kalau bukan owner: DIEMIN, gak dibales
  // sama sekali — biar orang lain gak tau menu ini eksis/isinya apa.
  // Teks menu diambil dari menu/mainmenu/owner.js (directText) — edit di sana.
  if (command === "owner") {
    if (!(await isOwner(sock, sender))) {
      if (msgKey) await react(sock, msgKey, "");
      return;
    }

    const mentionJid = toMentionJid(sender);
    const mentionTag = `@${mentionJid.split("@")[0]}`;
    const ownerCategory = findCategory("owner");
    const menuText = ownerCategory?.directText || `${p}owner`;

    await sock.sendMessage(from, {
      text: `${getGreeting()} ${mentionTag}\n\n${menuText}`,
      mentions: [mentionJid],
    });
    if (msgKey) await react(sock, msgKey, "\u2705");
    return;
  }

  // .idgc — lihat ID grup ini (owner only, jalan di semua grup).
  // Gate owner-nya udah dicek di whitelist check atas (non-owner diemin).
  if (command === "idgc") {
    if (!group) {
      await sock.sendMessage(from, {
        text: "❌ Command ini cuma bisa dipakai di dalam grup.",
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    const status = config.isGroupAllowed(from)
      ? "✅ sudah di-whitelist"
      : "❌ belum di-whitelist";
    await sock.sendMessage(from, {
      text:
        `🆔 *ID Grup*\n${from}\n\n` +
        `Status: ${status}\n\n` +
        `Buat whitelist: *${p}setgc ${from}*`,
    });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // .setgc <idgc> — whitelist grup (owner only, bisa dari chat mana aja)
  if (command === "setgc") {
    if (!args) {
      await sock.sendMessage(from, {
        text:
          `❌ Kasih ID grupnya dulu.\nContoh: *${p}setgc 120363012345678901@g.us*\n\n` +
          `ID grup bisa dilihat pakai *${p}idgc* di dalam grupnya.`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    const groupJid = normalizeGroupJid(args);
    if (!groupJid) {
      await sock.sendMessage(from, {
        text: `❌ Format ID grup gak valid.\nHarus kayak: *120363012345678901@g.us*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    const added = config.addGroup(groupJid);
    await sock.sendMessage(from, {
      text: added
        ? `✅ Grup *${groupJid}* berhasil di-whitelist.\nSekarang bot merespon command di grup itu.`
        : `ℹ️ Grup *${groupJid}* sudah ada di whitelist.`,
    });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // .delgc <idgc> — cabut grup dari whitelist (owner only, bisa dari chat mana aja)
  if (command === "delgc") {
    if (!args) {
      await sock.sendMessage(from, {
        text: `❌ Kasih ID grupnya dulu.\nContoh: *${p}delgc 120363012345678901@g.us*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    const groupJid = normalizeGroupJid(args);
    if (!groupJid) {
      await sock.sendMessage(from, {
        text: `❌ Format ID grup gak valid.\nHarus kayak: *120363012345678901@g.us*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    const removed = config.removeGroup(groupJid);
    await sock.sendMessage(from, {
      text: removed
        ? `✅ Grup *${groupJid}* dihapus dari whitelist.\nBot gak akan merespon lagi di grup itu.`
        : `ℹ️ Grup *${groupJid}* emang gak ada di whitelist.`,
    });
    if (msgKey) await react(sock, msgKey, removed ? "✅" : "❌");
    return;
  }

  // .listgc — list semua grup yang diikuti bot (nama + ID + total member)
  // Owner only, bisa dikirim dari chat mana aja (pribadi / grup).
  if (["listgc", "listgrup", "listgroup", "grouplist"].includes(command)) {
    try {
      const allGroups = await sock.groupFetchAllParticipating();
      const entries = Object.values(allGroups);

      if (entries.length === 0) {
        await sock.sendMessage(from, { text: "📋 Bot belum masuk grup mana pun." });
        if (msgKey) await react(sock, msgKey, "✅");
        return;
      }

      // Urutkan: whitelist dulu, sisanya alfabet
      entries.sort((a, b) => {
        const aWl = config.isGroupAllowed(a.id) ? 0 : 1;
        const bWl = config.isGroupAllowed(b.id) ? 0 : 1;
        if (aWl !== bWl) return aWl - bWl;
        return (a.subject || "").localeCompare(b.subject || "");
      });

      let text = `📋 *Daftar Grup Bot (${entries.length} grup)*\n`;
      for (let i = 0; i < entries.length; i++) {
        const g = entries[i];
        const wlTag = config.isGroupAllowed(g.id) ? " ✅" : "";
        text += `\n*${i + 1}. ${g.subject || "(tanpa nama)"}*${wlTag}\n`;
        text += `   ID: ${g.id}\n`;
        text += `   👥 ${g.size || g.participants?.length || "?"} member\n`;
      }
      text += `\n✅ = sudah di-whitelist`;

      await sock.sendMessage(from, { text });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ listgc error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal ambil daftar grup.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // .outgc <nomor urut dari listgc / idgc> — keluar grup lalu cabut dari whitelist (owner only).
  if (command === "outgc") {
    // Helper: ambil & sort entries (sama persis kayak listgc)
    async function fetchSortedGroups() {
      const allGroups = await sock.groupFetchAllParticipating();
      const entries = Object.values(allGroups);
      entries.sort((a, b) => {
        const aWl = config.isGroupAllowed(a.id) ? 0 : 1;
        const bWl = config.isGroupAllowed(b.id) ? 0 : 1;
        if (aWl !== bWl) return aWl - bWl;
        return (a.subject || "").localeCompare(b.subject || "");
      });
      return entries;
    }

    // Tanpa args → tampilin list + instruksi
    if (!args || !args.trim()) {
      try {
        const entries = await fetchSortedGroups();
        if (entries.length === 0) {
          await sock.sendMessage(from, { text: "📋 Bot belum masuk grup mana pun." });
          if (msgKey) await react(sock, msgKey, "✅");
          return;
        }
        let text = `📋 *Pilih grup yang mau di-out:*\n`;
        for (let i = 0; i < entries.length; i++) {
          const g = entries[i];
          const wlTag = config.isGroupAllowed(g.id) ? " ✅" : "";
          text += `\n*${i + 1}.* ${g.subject || "(tanpa nama)"}${wlTag}\n`;
          text += `   👥 ${g.size || g.participants?.length || "?"} member\n`;
        }
        text += `\nBalas dengan: *${p}outgc <nomor>*\nContoh: *${p}outgc 3*`;
        await sock.sendMessage(from, { text });
        if (msgKey) await react(sock, msgKey, "✅");
      } catch (e) {
        await sock.sendMessage(from, { text: `❌ Gagal ambil daftar grup.\n${e.message}` });
        if (msgKey) await react(sock, msgKey, "❌");
      }
      return;
    }

    let groupJid = null;

    // Cek nomor urut dulu (angka murni) — SEBELUM normalizeGroupJid
    // biar "1" gak dikira JID "1@g.us"
    const rawArg = args.trim();
    const idx = parseInt(rawArg, 10);
    if (!isNaN(idx) && idx > 0 && String(idx) === rawArg) {
      // input murni angka → resolve sebagai nomor urut listgc
      try {
        const entries = await fetchSortedGroups();
        if (idx > entries.length) {
          await sock.sendMessage(from, {
            text: `❌ Nomor ${idx} gak ada. Bot cuma di ${entries.length} grup.\nKetik *${p}outgc* buat lihat daftarnya.`,
          });
          if (msgKey) await react(sock, msgKey, "❌");
          return;
        }
        groupJid = entries[idx - 1].id;
      } catch (e) {
        await sock.sendMessage(from, { text: `❌ Gagal ambil daftar grup.\n${e.message}` });
        if (msgKey) await react(sock, msgKey, "❌");
        return;
      }
    } else {
      // Bukan angka murni → coba parse sebagai JID
      groupJid = normalizeGroupJid(rawArg);
    }

    if (!groupJid) {
      await sock.sendMessage(from, {
        text: `❌ Format gak valid. Ketik *${p}outgc* buat lihat daftar grup.`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    // Ambil nama grup dulu sebelum leave (biar pesan konfirmasi lebih informatif)
    let groupName = groupJid;
    try {
      const meta = await sock.groupMetadata(groupJid).catch(() => null);
      if (meta?.subject) groupName = meta.subject;
    } catch {}

    try {
      await sock.groupLeave(groupJid);
      config.removeGroup(groupJid);
      await sock.sendMessage(from, {
        text: `✅ Bot keluar dari *${groupName}* dan grup dihapus dari whitelist.\nID: ${groupJid}`,
      });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ outgc error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal keluar dari grup.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // .joingc <link> — masuk via tautan undangan lalu otomatis whitelist (owner only).
  if (command === "joingc") {
    const inviteCode = getInviteCode(args);
    if (!inviteCode) {
      await sock.sendMessage(from, {
        text: `❌ Kirim link undangan grup WhatsApp yang valid.\nContoh: *${p}joingc https://chat.whatsapp.com/IjAE2P1KcD4Hya3mEBCTgf*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      const groupJid = await sock.groupAcceptInvite(inviteCode);
      if (!groupJid) throw new Error("WhatsApp tidak mengembalikan ID grup.");

      config.addGroup(groupJid);
      const metadata = await sock.groupMetadata(groupJid).catch(() => null);
      const name = metadata?.subject || groupJid;
      const members = metadata?.size || metadata?.participants?.length || "?";
      await sock.sendMessage(from, {
        text: `✅ Bot masuk ke *${name}* dan otomatis di-whitelist.\nID: ${groupJid}\n👥 ${members} member`,
      });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ joingc error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal masuk grup. Pastikan link masih aktif dan bot belum mencapai batas grup.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // .addmeta — invite bot Meta AI resmi ke grup (owner only, grup only)
  if (command === "addmeta") {
    if (!(await isOwner(sock, sender))) {
      if (msgKey) await react(sock, msgKey, "");
      return;
    }

    if (!group) {
      await sock.sendMessage(from, {
        text: "❌ Command ini cuma bisa dipakai di dalam grup.",
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      await sock.groupParticipantsUpdate(from, [META_AI_JID], "add");
      await sock.sendMessage(from, { text: "✅ Sukses add Meta AI ke grup." });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ Gagal addmeta:", e);
      await sock.sendMessage(from, {
        text: `❌ Gagal nambahin Meta AI ke grup.\n${e?.message || e}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // ── useprofile — ganti foto profil bot ───────────────────────────────
  // Cara pakai: kirim foto ke bot dengan caption "(prefix)useprofile"
  // Foto diambil dari imageMessage, didownload, terus di-set sebagai
  // profil picture akun WA yang lagi dipake bot.
  if (command === "useprofile") {
    if (!(await isOwner(sock, sender))) {
      if (msgKey) await react(sock, msgKey, "");
      return;
    }

    const imageMsg = msg?.message?.imageMessage;
    if (!imageMsg) {
      await sock.sendMessage(from, {
        text: `❌ Kirim foto dulu wak, terus kasih caption *${p}useprofile*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      if (msgKey) await react(sock, msgKey, "⏳");
      const { downloadMediaMessage } = require("@itsliaaa/baileys");
      const buffer = await downloadMediaMessage(msg, "buffer", {});
      await sock.updateProfilePicture(sock.user.id, buffer);
      await sock.sendMessage(from, { text: "✅ Foto profil bot berhasil diganti!" });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ useprofile error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal ganti foto profil.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // ── usebanner — ganti banner WA Business ─────────────────────────────
  // Sama kayak useprofile tapi update profile cover/banner.
  // Hanya jalan kalau nomor WA bot terdaftar sebagai WA Business.
  if (command === "usebanner") {
    if (!(await isOwner(sock, sender))) {
      if (msgKey) await react(sock, msgKey, "");
      return;
    }

    const imageMsg = msg?.message?.imageMessage;
    if (!imageMsg) {
      await sock.sendMessage(from, {
        text: `❌ Kirim foto dulu, terus kasih caption *${p}usebanner*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      if (msgKey) await react(sock, msgKey, "⏳");
      const { downloadMediaMessage } = require("@itsliaaa/baileys");
      const buffer = await downloadMediaMessage(msg, "buffer", {});
      await sock.updateCoverPhoto(buffer);
      await sock.sendMessage(from, { text: "✅ Banner WA Business berhasil diganti!" });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ usebanner error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal ganti banner.\n${e.message}\n\n_Pastikan nomor bot terdaftar sebagai WA Business._`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // ── setnick — ganti nama/nickname bot di WA ───────────────────────────
  // Contoh: .setnick Nama Custom
  // Nama baru muncul ke orang lain setelah bot kirim pesan berikutnya
  // (WA distribute pushName lewat header pesan, bukan real-time broadcast).
  if (command === "setnick") {
    if (!(await isOwner(sock, sender))) {
      if (msgKey) await react(sock, msgKey, "");
      return;
    }
    if (!args || args.trim().length === 0) {
      await sock.sendMessage(from, {
        text: `❌ Sebutin nama barunya.\nContoh: *${p}setnick Nama Custom*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    try {
      const newName = args.trim();
      // Emit creds.update TANPA mutasi creds.me dulu — biarkan handler
      // di socket.js yang detect perubahan nama dan otomatis kirim
      // node <presence name="..."> ke server WA.
      sock.ev.emit("creds.update", { me: { ...sock.authState.creds.me, name: newName } });
      await sock.sendMessage(from, {
        text: `✅ Nama bot berhasil diganti ke *${newName}*\n\n_Nama baru aktif mulai pesan berikutnya._`,
      });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ setnick error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal ganti nama bot.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // .wm <nama pack> — rename sticker: reply sticker + .wm <pack> → kirim ulang
  if (command === "wm") {
    const packName = args.trim();
    if (!packName) {
      await sock.sendMessage(from, {
        text: `📌 Cara pakai: reply sticker lalu ketik *${p}wm <nama pack>*\nContoh: *${p}wm Mayzaa*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    if (packName.length > 128 || /[\r\n]/.test(packName)) {
      await sock.sendMessage(from, { text: "❌ Nama pack maksimal 128 karakter, tanpa baris baru." });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    // Cari sticker: reply ke sticker ATAU sticker langsung
    const quotedMsg =
      msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
      msg?.message?.interactiveResponseMessage?.contextInfo?.quotedMessage;
    const directSticker = msg?.message?.stickerMessage;
    const quotedSticker = quotedMsg?.stickerMessage;

    if (!directSticker && !quotedSticker) {
      await sock.sendMessage(from, {
        text: `❌ Reply sticker dulu, terus ketik *${p}wm ${packName}*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      const { downloadMediaMessage } = require("@itsliaaa/baileys");
      const { restampStickerMeta } = require("../systemconverter/stickerMeta");

      let dlMsg;
      if (directSticker) {
        dlMsg = msg;
      } else {
        const quotedCtx =
          msg.message.extendedTextMessage?.contextInfo ||
          msg.message.interactiveResponseMessage?.contextInfo;
        dlMsg = {
          key: {
            remoteJid: from,
            id: quotedCtx?.stanzaId,
            participant: quotedCtx?.participant,
          },
          message: quotedMsg,
        };
      }

      const buffer = await downloadMediaMessage(dlMsg, "buffer", {});
      if (!buffer || buffer.length === 0) throw new Error("Download sticker gagal, buffer kosong.");

      const newSticker = restampStickerMeta(buffer, packName, "");
      await sock.sendMessage(from, { sticker: newSticker }, { quoted: msg });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ wm error:", e.message);
      await sock.sendMessage(from, { text: `❌ Gagal rename sticker.\n${e.message}` });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  if (command === "setprefix") {
    if (!(await isOwner(sock, sender))) {
      await sock.sendMessage(from, { text: "⛔ Command ini khusus owner." });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    if (!args || args.trim().length === 0) {
      await sock.sendMessage(from, {
        text: `❌ Sebutin prefix barunya dong.\nContoh: *${p}setprefix !*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    const newPrefix = args.trim().charAt(0); // ambil 1 karakter pertama
    config.prefix = newPrefix;
    await sock.sendMessage(from, {
      text:
        `✅ Prefix berhasil diganti ke *${newPrefix}*\n\n` +
        `Sekarang semua command pakai *${newPrefix}*\n` +
        `Contoh: *${newPrefix}menu*, *${newPrefix}allmenu*, dll.\n\n` +
        `Kalau mau ganti lagi: *${newPrefix}setprefix <simbol>*`,
    });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // .getprofile — ambil foto profil orang yang di-tag (public)
  if (command === "getprofile" || command === "getpp" || command === "getpfp") {
    const ctx = msg?.message?.extendedTextMessage?.contextInfo ||
                msg?.message?.interactiveResponseMessage?.contextInfo;
    const tagged = ctx?.mentionedJid || [];
    const target = tagged.find(Boolean);
    if (!target) {
      await sock.sendMessage(from, {
        text: `📌 Cara pakai: tag orang lalu ketik *${p}getprofile*\nContoh: *${p}getprofile @nama*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    try {
      const url = await sock.profilePictureUrl(target, "image");
      await sock.sendMessage(from, { image: { url }, caption: `Foto profil ${target}` });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ Gagal ambil foto profil.\n${e.message}` });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  if (command === "addwl") {
    if (!(await isOwner(sock, sender))) {
      await sock.sendMessage(from, { text: "⛔ Command ini khusus owner." });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    if (!args) {
      await sock.sendMessage(from, {
        text: `❌ Tulis nomor yang mau di-whitelist.\nContoh: *${p}addwl 628123456789*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    // normalisasi: hilangkan karakter non-digit, tambah suffix WA
    const num = args.trim().replace(/\D/g, "");
    const jid = `${num}@s.whatsapp.net`;
    config.addWhitelist(jid);
    await sock.sendMessage(from, {
      text: `✅ *${num}* berhasil ditambahkan ke whitelist.\nSekarang bot akan respon pesan dari nomor itu.`,
    });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  if (command === "removewl") {
    if (!(await isOwner(sock, sender))) {
      await sock.sendMessage(from, { text: "⛔ Command ini khusus owner." });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    if (!args) {
      await sock.sendMessage(from, {
        text: `❌ Tulis nomor yang mau dihapus dari whitelist.\nContoh: *${p}removewl 628123456789*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    const num = args.trim().replace(/\D/g, "");
    const jid = `${num}@s.whatsapp.net`;
    config.removeWhitelist(jid);
    await sock.sendMessage(from, {
      text: `✅ *${num}* dihapus dari whitelist.`,
    });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  if (command === "listwl") {
    if (!(await isOwner(sock, sender))) {
      await sock.sendMessage(from, { text: "⛔ Command ini khusus owner." });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    const wl = config.whitelist;
    if (wl.length === 0) {
      await sock.sendMessage(from, {
        text: "📋 *Whitelist kosong* — bot merespon semua orang.",
      });
    } else {
      const list = wl.map((j, i) => `${i + 1}. ${j}`).join("\n");
      await sock.sendMessage(from, {
        text: `📋 *Daftar Whitelist (${wl.length} nomor):*\n\n${list}`,
      });
    }
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // ── getjid: encode nomor HP -> JID WhatsApp ─────────────────────────
  // Contoh: .getjid 089531367146  atau  .getjid 6289531367146
  if (command === "getjid" || command === "encode") {
    if (!(await isOwner(sock, sender))) {
      await sock.sendMessage(from, { text: "⛔ Command ini khusus owner." });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    if (!args) {
      await sock.sendMessage(from, {
        text: `❌ Tulis nomornya.\nContoh: *${p}getjid 089531367146*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    const num = normalizePhone(args.trim());
    const jid = phoneToJid(args.trim());
    await sock.sendMessage(from, {
      text:
        `🔐 *Encode nomor -> JID*\n\n` +
        `Nomor masuk : ${args.trim()}\n` +
        `Dinormalisasi: ${num}\n` +
        `JID          : ${jid}`,
    });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // ── getnumber: decode JID/@lid -> nomor HP asli ──────────────────────
  // Bisa dipakai 2 cara:
  //   - reply ke pesan orang lain: .getnumber
  //   - tempel JID langsung: .getnumber 129111632691455@lid
  if (command === "getnumber" || command === "decode") {
    if (!(await isOwner(sock, sender))) {
      await sock.sendMessage(from, { text: "⛔ Command ini khusus owner." });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    const quotedParticipant = quotedInfo?.participant;
    const targetJid = args?.trim() || quotedParticipant;

    if (!targetJid) {
      await sock.sendMessage(from, {
        text:
          `❌ Reply pesan orangnya, atau tempel JID-nya.\n` +
          `Contoh: *${p}getnumber 129111632691455@lid*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    const type = jidType(targetJid);
    let number = null;

    if (type === "lid") {
      number = await resolvePNForLid(sock, targetJid);
    } else if (type === "personal") {
      number = targetJid.split("@")[0].split(":")[0];
    }

    await sock.sendMessage(from, {
      text: number
        ? `🔓 *Decode JID -> nomor*\n\nJID   : ${targetJid}\nTipe  : ${type}\nNomor : ${number}`
        : `❌ Gagal decode. Tipe JID: ${type}.\n` +
          (type === "lid"
            ? "Belum ke-sync sama WA (belum ada di lid-cache) — coba lagi setelah orangnya kirim pesan minimal sekali."
            : "JID ini bukan JID personal (grup/newsletter gak punya nomor HP)."),
    });
    if (msgKey) await react(sock, msgKey, number ? "✅" : "❌");
    return;
  }

  // ── maker: brat ──────────────────────────────────────────────────
  // .brat <teks> → sticker statis dari API brat
  if (command === "brat") {
    if (!args) {
      await sock.sendMessage(from, {
        text: `❌ Kasih teksnya dong.\nContoh: *${p}brat halo dunia*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    try {
      // Ambil raw buffer dari API brat (GET + User-Agent, auto-handle
      // kalau API-nya balikin JSON berisi URL hasil, bukan file langsung)
      const imgBuffer = await makeBrat(args);
      // Hasil brat gak punya alpha channel → pakai bufferToWebp (bg putih),
      // BUKAN bufferToWebpTransparent (itu buat sticker yang usernya kirim sendiri)
      const { bufferToWebp }   = require("../systemconverter/jpg-pngtowebp");
      const { addStickerMeta } = require("../systemconverter/stickerMeta");
      const webpBuffer    = await bufferToWebp(imgBuffer, 90);
      const stickerBuffer = addStickerMeta(webpBuffer);
      await sock.sendMessage(from, { sticker: stickerBuffer });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ brat error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal bikin sticker brat.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // ── maker: bratvid ────────────────────────────────────────────────
  // .bratvid <teks> → animated sticker dari API bratvid
  if (command === "bratvid") {
    if (!args) {
      await sock.sendMessage(from, {
        text: `❌ Kasih teksnya dong.\nContoh: *${p}bratvid halo dunia*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    let webpPath = null;
    try {
      webpPath = await makeBratVid(args);
      const webpBuffer = fs.readFileSync(webpPath);
      await sock.sendMessage(from, {
        sticker: webpBuffer,
      });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ bratvid error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal bikin animated sticker bratvid.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    } finally {
      // hapus file webp tmp setelah kirim
      try { if (webpPath && fs.existsSync(webpPath)) fs.unlinkSync(webpPath); } catch {}
    }
    return;
  }

  // ── sticker: s / stiker / sticker ────────────────────────────────
  // Reply foto/video/webp → dijadiin sticker dengan packname & author
  // dari env/.env.sticker. Foto: sharp pipeline (VP8X + transparent bg).
  // Video/GIF/webp animated: ffmpeg → animated webp.
  if (["s", "stiker", "sticker"].includes(command)) {
    // Cari sumber media: quoted message atau imageMessage langsung
    const quotedMsg = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage
                   || msg?.message?.interactiveResponseMessage?.contextInfo?.quotedMessage;
    const directImg = msg?.message?.imageMessage;
    const directVid = msg?.message?.videoMessage;

    const hasQuotedImg = quotedMsg?.imageMessage;
    const hasQuotedVid = quotedMsg?.videoMessage;
    const hasQuotedWebp = quotedMsg?.stickerMessage;

    if (!directImg && !directVid && !hasQuotedImg && !hasQuotedVid && !hasQuotedWebp) {
      await sock.sendMessage(from, {
        text: `❌ Reply foto atau video dulu, atau kirim foto dengan caption *${p}s*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      const { downloadMediaMessage } = require("@itsliaaa/baileys");
      const { bufferToWebpTransparent } = require("../systemconverter/jpg-pngtowebp");
      const { videoToAnimatedWebp } = require("../systemconverter/ffmpeg");
      const { addStickerMeta } = require("../systemconverter/stickerMeta");
      const { TEMP_DIR, ensureTempDir } = require("../systemconverter/tempDir");
      const path = require("path");

      ensureTempDir();

      const isVideo = !!(directVid || hasQuotedVid);
      const isWebp  = !!hasQuotedWebp;

      // Tentuin pesan yang mau didownload
      let dlMsg;
      if (directImg || directVid) {
        // Kirim langsung dengan caption .s
        dlMsg = msg;
      } else {
        // Reply ke pesan lain — rebuild msg object dari quotedMessage
        const quotedKey = msg.message.extendedTextMessage?.contextInfo
                       || msg.message.interactiveResponseMessage?.contextInfo;
        dlMsg = {
          key: {
            remoteJid: from,
            id: quotedKey?.stanzaId,
            participant: quotedKey?.participant,
          },
          message: quotedMsg,
        };
      }

      const buffer = await downloadMediaMessage(dlMsg, "buffer", {});
      if (!buffer || buffer.length === 0) throw new Error("Download media gagal, buffer kosong.");

      let stickerBuffer;

      if (isVideo || isWebp) {
        // Video/GIF/animated webp → ffmpeg jadi animated webp
        const os = require("os");
        const ffmpegPath = os.platform() === "win32" && fs.existsSync("C:\\ffmpeg\\bin\\ffmpeg.exe")
          ? "C:\\ffmpeg\\bin\\ffmpeg.exe"
          : "ffmpeg";

        const inputExt = isWebp ? ".webp" : ".mp4";
        const inputPath = path.join(TEMP_DIR, `sticker-in-${Date.now()}${inputExt}`);
        const outputPath = path.join(TEMP_DIR, `sticker-out-${Date.now()}.webp`);
        fs.writeFileSync(inputPath, buffer);

        try {
          await videoToAnimatedWebp(inputPath, { outputPath, fps: 15, maxDuration: 6, ffmpegPath });
          const raw = fs.readFileSync(outputPath);
          stickerBuffer = addStickerMeta(raw);
        } finally {
          try { fs.unlinkSync(inputPath); } catch {}
          try { fs.unlinkSync(outputPath); } catch {}
        }
      } else {
        // Foto → sharp → VP8X webp transparan → inject EXIF
        const webpBuffer = await bufferToWebpTransparent(buffer, 90);
        stickerBuffer = addStickerMeta(webpBuffer);
      }

      await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ sticker error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal bikin sticker.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // ── toimg: reply sticker → convert jadi foto biasa (PNG) ──────────
  if (["toimg", "toimage"].includes(command)) {
    const quotedMsg = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage
                   || msg?.message?.interactiveResponseMessage?.contextInfo?.quotedMessage;
    const directSticker = msg?.message?.stickerMessage;
    const quotedSticker = quotedMsg?.stickerMessage;

    if (!directSticker && !quotedSticker) {
      await sock.sendMessage(from, {
        text: `❌ Reply sticker dulu, terus ketik *${p}toimg*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      const { downloadMediaMessage } = require("@itsliaaa/baileys");
      const sharp = require("sharp");

      let dlMsg;
      if (directSticker) {
        dlMsg = msg;
      } else {
        const quotedCtx = msg.message.extendedTextMessage?.contextInfo
                       || msg.message.interactiveResponseMessage?.contextInfo;
        dlMsg = {
          key: {
            remoteJid: from,
            id: quotedCtx?.stanzaId,
            participant: quotedCtx?.participant,
          },
          message: quotedMsg,
        };
      }

      const buffer = await downloadMediaMessage(dlMsg, "buffer", {});
      if (!buffer || buffer.length === 0) throw new Error("Download sticker gagal, buffer kosong.");

      // Sticker (webp, statis/animated) → PNG. Kalau animated, sharp
      // otomatis ambil frame pertama.
      const pngBuffer = await sharp(buffer).png().toBuffer();

      await sock.sendMessage(
        from,
        { image: pngBuffer, caption: "✅ Sticker berhasil dijadiin foto!" },
        { quoted: msg }
      );
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ toimg error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal convert sticker ke foto.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // ── rvo: buka ulang pesan sekali-lihat (foto/video/audio) ─────────
  // Reply pesan "view once" lalu ketik .rvo → bot download & kirim
  // ulang media-nya sebagai pesan biasa (gak sekali-lihat lagi).
  if (["rvo", "readonce", "viewonce"].includes(command)) {
    const quotedMsg = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage
                   || msg?.message?.interactiveResponseMessage?.contextInfo?.quotedMessage;

    // Bongkar kemungkinan bentuk pesan view-once:
    //  - dibungkus viewOnceMessage / viewOnceMessageV2 / viewOnceMessageV2Extension
    //  - atau imageMessage/videoMessage/audioMessage langsung dengan flag viewOnce:true
    function unwrapViewOnce(container) {
      if (!container) return null;
      const wrapped =
        container.viewOnceMessage?.message ||
        container.viewOnceMessageV2?.message ||
        container.viewOnceMessageV2Extension?.message;
      if (wrapped) return wrapped;

      if (
        container.imageMessage?.viewOnce ||
        container.videoMessage?.viewOnce ||
        container.audioMessage?.viewOnce
      ) {
        return container;
      }
      return null;
    }

    const innerFromQuoted = unwrapViewOnce(quotedMsg);
    const innerFromDirect = unwrapViewOnce(msg?.message);
    const inner = innerFromQuoted || innerFromDirect;

    if (!inner) {
      await sock.sendMessage(from, {
        text: `❌ Reply pesan sekali-lihat (foto/video/audio) dulu, terus ketik *${p}rvo*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      const { downloadMediaMessage } = require("@itsliaaa/baileys");

      let dlMsg;
      if (innerFromQuoted) {
        const quotedCtx = msg.message.extendedTextMessage?.contextInfo
                       || msg.message.interactiveResponseMessage?.contextInfo;
        dlMsg = {
          key: {
            remoteJid: from,
            id: quotedCtx?.stanzaId,
            participant: quotedCtx?.participant,
          },
          message: inner,
        };
      } else {
        dlMsg = { key: msg.key, message: inner };
      }

      const buffer = await downloadMediaMessage(dlMsg, "buffer", {});
      if (!buffer || buffer.length === 0) throw new Error("Download media gagal, buffer kosong.");

      if (inner.imageMessage) {
        await sock.sendMessage(
          from,
          { image: buffer, caption: inner.imageMessage.caption || "✅ View once berhasil dibuka!" },
          { quoted: msg }
        );
      } else if (inner.videoMessage) {
        await sock.sendMessage(
          from,
          { video: buffer, caption: inner.videoMessage.caption || "✅ View once berhasil dibuka!" },
          { quoted: msg }
        );
      } else if (inner.audioMessage) {
        await sock.sendMessage(
          from,
          {
            audio: buffer,
            mimetype: inner.audioMessage.mimetype || "audio/ogg; codecs=opus",
            ptt: !!inner.audioMessage.ptt,
          },
          { quoted: msg }
        );
      } else {
        throw new Error("Tipe media gak dikenali.");
      }

      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error("❌ rvo error:", e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal buka view once.\n${e.message}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // ── AI IMAGE commands ─────────────────────────────────────────────
  // Flow semua command ini sama:
  //   1. Cari gambar: direct imageMessage ATAU quoted imageMessage
  //   2. Download pakai downloadMediaMessage
  //   3. Kirim buffer ke fungsi processor di menusystem/aiimage.js
  //   4. Kirim hasil: gambar (sendMessage image) atau teks

  if (["removebg", "tosketch", "hitamkan", "image2prompt", "img2img", "topixel", "enhancer"].includes(command)) {
    // Cari sumber gambar — prioritas: gambar langsung dikirim, lalu quoted
    const quotedMsg =
      msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
      msg?.message?.interactiveResponseMessage?.contextInfo?.quotedMessage;
    const directImg = msg?.message?.imageMessage;
    const quotedImg = quotedMsg?.imageMessage;

    if (!directImg && !quotedImg) {
      await sock.sendMessage(from, {
        text: `❌ Kirim/reply foto dulu wak, terus kasih caption *${p}${command}*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    // .img2img wajib ada prompt di caption yang sama
    if (command === "img2img" && !args) {
      await sock.sendMessage(from, {
        text: `❌ Kasih prompt-nya juga dong wak.\nContoh: *${p}img2img ubah background jadi pantai*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      const { downloadMediaMessage } = require("@itsliaaa/baileys");

      // Rebuild msg object buat quoted jika perlu
      let dlMsg;
      if (directImg) {
        dlMsg = msg;
      } else {
        const quotedCtx =
          msg.message.extendedTextMessage?.contextInfo ||
          msg.message.interactiveResponseMessage?.contextInfo;
        dlMsg = {
          key: {
            remoteJid: from,
            id: quotedCtx?.stanzaId,
            participant: quotedCtx?.participant,
          },
          message: quotedMsg,
        };
      }

      const imageBuffer = await downloadMediaMessage(dlMsg, "buffer", {});
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error("Download gambar gagal, buffer kosong.");
      }

      // Dispatch ke fungsi yang sesuai
      let result;
      if (command === "img2img") {
        result = await aiImage.img2img(imageBuffer, args);
      } else if (command === "topixel") {
        const level = args && !isNaN(args.trim()) ? parseInt(args.trim(), 10) : 30;
        result = await aiImage.topixel(imageBuffer, level);
      } else {
        const cmdMap = {
          removebg:    aiImage.removeBg,
          tosketch:    aiImage.toSketch,
          hitamkan:    aiImage.hitamkan,
          enhancer:    aiImage.enhancer,
          image2prompt: aiImage.image2prompt,
        };
        result = await cmdMap[command](imageBuffer);
      }

      if (result.type === "image") {
        const captions = {
          removebg:    "✅ Background berhasil dihapus!",
          tosketch:    "✅ Foto berhasil dijadiin sketsa!",
          hitamkan:    "✅ Foto berhasil dijadiin hitam putih!",
          img2img:     "✅ Foto berhasil diedit sesuai prompt!",
          topixel:     "✅ Foto berhasil dijadiin pixel art!",
          enhancer:    "✅ Foto berhasil di-enhance!",
        };
        let caption = captions[command] || "✅ Done!";
        if (result.url) caption += `\n\n🔗 ${result.url}`;
        await sock.sendMessage(
          from,
          { image: result.data, caption },
          { quoted: msg }
        );
      } else {
        // type === "text" (image2prompt)
        await sock.sendMessage(from, {
          text: `🖼️ *Image to Prompt*\n\n${result.data}`,
        }, { quoted: msg });
      }

      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error(`❌ ${command} error:`, e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal proses ${command}.\n${e.message}\n\nCoba lagi bentar ya.`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // ── tombol download URL ────────────────────────────────────────
  if (command === "dlurl") {
    const url = args.trim();
    if (/^https?:\/\//i.test(url)) {
      await sock.sendMessage(from, { text: url });
      if (msgKey) await react(sock, msgKey, "✅");
    }
    return;
  }

  // ── DOWNLOADER (.tiktok / .ig /.fb + auto-detect kalau cuma kirim link) ─
  {
    const detect = require("../menusystem/downloader").detectDownloaderUrl;
    const url = args?.trim() || rawText?.trim() || "";
    const detected = detect(url || rawText);
    const explicit = ["tiktok", "ig", "instagram", "fb", "facebook", "spotify", "pindl", "ytmp3", "ytmp4", "douyin"].includes(command);
    const platformByCommand = { ig: "instagram", instagram: "instagram", fb: "facebook", facebook: "facebook", pindl: "pinterest" };
    const target = explicit
      ? (url ? { platform: platformByCommand[command] || command, url } : null)
      : detected;

    if (target?.platform === "youtube") {
      const choiceId = (platform) => `${p}${platform} ${target.url}`;
      await sock.sendMessage(from, {
        text: "Pilih format download:",
        optionText: "Format YouTube",
        optionTitle: "YouTube",
        nativeFlow: [{
          text: "Format YouTube",
          sections: [{
            title: "Download",
            rows: [
              { title: "MP4 Video", description: "Download video YouTube", id: choiceId("ytmp4") },
              { title: "MP3 Audio", description: "Download audio YouTube", id: choiceId("ytmp3") },
            ],
          }],
        }],
      });
      if (msgKey) await react(sock, msgKey, "✅");
      return;
    }

    if (target) {
      await sock.sendMessage(from, { text: "Please wait..." });
      if (!explicit) {
        // auto-detect tanpa prefix juga bisa tapi biar gak spam: butuh prefix
        // cek hasPrefix udah true di atas -> lanjut
      }
      const platform = target.platform;
      try {
        const dl = require("../menusystem/downloader");
        const { items, caption } = await dl.download(platform, target.url);
        let sentCaption = caption ? `📝 ${caption}` : "";
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const captionOpt = idx === 0 && sentCaption ? sentCaption : undefined;
          if (item.type === "image") {
            await sock.sendMessage(from, { image: { url: item.url }, caption: captionOpt });
          } else if (item.type === "audio") {
            await sock.sendMessage(from, { audio: { url: item.url }, mimetype: "audio/mpeg" });
            if (captionOpt) await sock.sendMessage(from, { text: captionOpt });
          } else {
            await sock.sendMessage(from, { video: { url: item.url }, caption: captionOpt });
          }
        }
        // Tombol inline: klik langsung kirim URL download.
                const firstUrl = items[0]?.url;
                if (firstUrl) {
                  const shortUrl = await shortenUrl(firstUrl);
                  const payload = {
                    text: "\u{1F517} Tap untuk lihat link download:",
                    optionText: "See",
                    optionTitle: "Download",
                    nativeFlow: [
                      {
                        text: "see",
                        sections: [
                          {
                            title: "Download",
                            rows: [
                              {
                                header: "",
                                title: "See Download URL",
                                description: "Kirim link download langsung",
                                id: `${p}dlurl ${shortUrl}`,
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  };
                  await sock.sendMessage(from, payload);
                }
        if (msgKey) await react(sock, msgKey, "✅");
      } catch (e) {
        const msgText = e.response?.data?.message || e.message || String(e);
        await sock.sendMessage(from, { text: `❌ Gagal download ${platform}.\n${msgText}` });
        if (msgKey) await react(sock, msgKey, "❌");
      }
      return;
    }
    if (explicit && !target) {
      await sock.sendMessage(from, {
        text: `📌 Cara pakai: *${p}${command} <link>*${command === "tiktok" ? "\nContoh: *.tiktok https://vt.tiktok.com/xxxxx*" : ""}`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
  }

  // ── AI commands ────────────────────────────────────────────────
  if (AI_HANDLERS[command]) {
    if (!args) {
      const found = findCommand(command);
      await sock.sendMessage(from, {
        text: found
          ? buildCommandUsage(found.category, found.command)
          : `❌ Kasih pertanyaannya dong.\nContoh: *${p}${command} halo*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      const { model, text } = await AI_HANDLERS[command](args);
      await sock.sendMessage(from, { text });
      if (msgKey) await react(sock, msgKey, "✅");
    } catch (e) {
      console.error(`❌ AI (${command}) error:`, e.message);
      await sock.sendMessage(from, {
        text: `❌ Gagal manggil ${command}.\n${e.message}\n\nCoba lagi bentar ya.`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

  // ── kategori menu ─────────────────────────────────────────────────
  const category = findCategory(command);
  if (category) {
    // Kalau user memilih separator __allmenu__ dari list (rowId = .__allmenu__)
    if (category.isAllMenuSeparator) {
      await sock.sendMessage(from, { text: buildAllMenu() });
      if (msgKey) await react(sock, msgKey, "✅");
      return;
    }

    if (category.directText) {
      const text =
        typeof category.directText === "string"
          ? category.directText
          : category.directText; // getter
      await sock.sendMessage(from, { text });
    } else if (group) {
      try {
        await sock.sendMessage(from, buildCategoryMenuInteractive(category));
      } catch {
        await sock.sendMessage(from, { text: buildCategoryMenuText(category) });
      }
    } else {
      await sock.sendMessage(from, buildCategoryMenuList(category));
    }
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // ── command spesifik ──────────────────────────────────────────────
  const found = findCommand(command);
  if (found) {
    if (found.category.directText) {
      const text = found.category.directText;
      await sock.sendMessage(from, { text });
      if (msgKey) await react(sock, msgKey, "✅");
      return;
    }

    if (!args) {
      await sock.sendMessage(from, {
        text: buildCommandUsage(found.category, found.command),
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    // TODO: sambungin ke fitur asli (API AI, downloader, dll)
    await sock.sendMessage(from, {
      text:
        `🚧 Command *${p}${found.command.command}* diterima dengan isi:\n"${args}"\n\n` +
        `(fitur ini belum diimplementasi, ini masih base)`,
    });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  // command gak dikenali → hapus reaction ⏳ (ganti kosong) biar gak berisik
  if (msgKey) await react(sock, msgKey, "");
}

module.exports = { handleMessage, parseCommand, isGroup };
