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
const { addMetaAI } = require("../_plugins/Owner/addmeta");
const { swgc } = require("../_plugins/Owner/swgc");
const { checkUpdate } = require("../_plugins/Owner/checkupdate");
const { buildPingText } = require("../_plugins/Public/ping");
const { sendOwnerContact } = require("../_plugins/Public/owner");

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


const AI_HANDLERS = {
  gemini: aiProviders.gemini,
  chatgpt: aiProviders.chatgpt,
  deepai: aiProviders.deepai,
  deepseekflash: aiProviders.deepseekV4Flash,
  deepseekpro: aiProviders.deepseekV4Pro,
  gemini31pro: aiProviders.gemini31Pro,
};

function toMentionJid(sender) {
  if (sender.endsWith("@lid")) {
    const number = getCachedPNForLid(sender);
    return number ? phoneToJid(number) : sender;
  }
  return sender;
}


async function isOwner(sock, jid) {
  return config.isOwnerAsync(sock, jid);
}


function parseCommand(rawText) {
  const text = rawText.trim();
  const p = config.prefix;


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


function isGroup(jid) {
  return jid.endsWith("@g.us");
}


function isAllowed(jid) {
  return config.isAllowed(jid);
}


const OWNER_ANY_GROUP_COMMANDS = ["idgc", "setgc", "delgc", "listgc", "listgrup", "listgroup", "grouplist", "outgc", "joingc", "swgc", "version", "checkupdate", "update"];


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


function getGreeting() {

  const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const hour = nowWIB.getUTCHours();

  if (hour >= 4 && hour < 11) {
    return "Ohayou gozaimasu ☀️";
  } else if (hour >= 11 && hour < 18) {
    return "Konnichiwa 🌤️";
  } else {
    return "Konbanwa 🌙";
  }
}


async function react(sock, msgKey, emoji) {
  try {
    await sock.sendMessage(msgKey.remoteJid, {
      react: { text: emoji, key: msgKey },
    });
  } catch (e) {
    console.error("⚠️  Gagal kirim reaction:", e.message);
  }
}
function getQuoted(msg) {
  return getQuoted(msg);
}
function getQuotedCtx(msg) {
  return getQuotedCtx(msg);
}
function quotedDlMsg(from, quotedMsg, msg) {
  const c = getQuotedCtx(msg);
  return { key: { remoteJid: from, id: c?.stanzaId, participant: c?.participant }, message: quotedMsg };
}


async function handleMessage(sock, from, sender, rawText, quotedInfo, pushName, msgKey, msg) {
  if (!rawText?.trim()) return;

  let { command, args, hasPrefix } = parseCommand(rawText);


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
  const reply = async (text, emoji) => { await sock.sendMessage(from, { text }); if (msgKey && emoji) await react(sock, msgKey, emoji); };
  const replyErr = async (text) => reply(text, "❌");
  const fail = async (text) => { await sock.sendMessage(from, { text }); if (msgKey) await react(sock, msgKey, "❌"); };
  const ownerOnly = async () => { if (await isOwner(sock, sender)) return false; await fail("⛔ Command ini khusus owner."); return true; };


  // public: script — link repo (semua orang, grup/pc)
  if (command === "script" || command === "sc" || command === "repo") {
    const ver = (() => { try { return require("../package.json").version; } catch { return "?"; } })();
    const repo = "https://github.com/Mayzaaonex/Bot-Whatsapp";
    const text =
      `╭─ *SCRIPT BOT* ─╮\n` +
      `│ 🤖 *Mayzaa Bot* v${ver}\n` +
      `│ 📦 *Base:* Baileys @itsliaaa/baileys\n` +
      `│ 🔗 *Repo:* ${repo}\n` +
      `│ ⭐ *Star & Fork* biar semangat update!\n` +
      `│ 🚀 *Run:* \`npm install && node main.js\`\n` +
      `│ 📝 *Changelog:* ${repo}/blob/main/README.md\n` +
      `╰───────────────╯\n\n` +
      `> run: node main.js (watcher auto-restart)`;
    if (msgKey) await react(sock, msgKey, "\u2728");
    await sock.sendMessage(from, { text });
    return;
  }

  // public: ping — bisa dipakai semua orang (tanpa whitelist/owner)
  if (command === "ping") {
    try {
      const ts = msg?.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : null;
      const raw = ts && ts > 0 ? Date.now() - ts : 0;
      const ms = raw >= 0 && raw < 120000 ? raw : 0;
      const text = buildPingText(ms);
      if (msgKey) await react(sock, msgKey, "\u2705");
      await sock.sendMessage(from, { text });
    } catch (e) {
      await sock.sendMessage(from, { text: `\u274c Ping gagal: ${e.message}` });
      if (msgKey) await react(sock, msgKey, "\u274c");
    }
    return;
  }

  if (OWNER_ANY_GROUP_COMMANDS.includes(command)) {

    if (!(await isOwner(sock, sender))) return;
  } else if (group) {
    if (!config.isGroupAllowed(from)) return;
  } else if (!isAllowed(from)) {
    return;
  }


  if (msgKey) await react(sock, msgKey, "⏳");


  if (command === "menu") {
    const mentionJid = toMentionJid(sender);
    const mentionTag = `@${mentionJid.split("@")[0]}`;
    const greeting = `${getGreeting()} 👋 ${mentionTag}\n\nSilakan pilih menu di bawah ini ya 👇`;


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


  if (command === "allmenu") {
    await sock.sendMessage(from, { text: buildAllMenu() });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }


  if (command === "__allmenu__") {
    await sock.sendMessage(from, { text: buildAllMenu() });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }




  if (command === "owner") {
    try { await sendOwnerContact(sock, from, msg); } catch (e) { await sock.sendMessage(from, { text: `❌ Gagal kirim kontak: ${e.message}` }); }
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }

  if (command === "ownermenu") {
    if (!(await isOwner(sock, sender))) {
      if (msgKey) await react(sock, msgKey, "");
      return;
    }

    const mentionJid = toMentionJid(sender);
    const mentionTag = `@${mentionJid.split("@")[0]}`;
    const ownerCategory = findCategory("owner");
    const menuText = ownerCategory?.directText || `${p}ownermenu`;

    await sock.sendMessage(from, {
      text: `${getGreeting()} ${mentionTag}\n\n${menuText}`,
      mentions: [mentionJid],
    });
    if (msgKey) await react(sock, msgKey, "\u2705");
    return;
  }


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


  if (["listgc", "listgrup", "listgroup", "grouplist"].includes(command)) {
    try {
      const allGroups = await sock.groupFetchAllParticipating();
      const entries = Object.values(allGroups);

      if (entries.length === 0) {
        await sock.sendMessage(from, { text: "📋 Bot belum masuk grup mana pun." });
        if (msgKey) await react(sock, msgKey, "✅");
        return;
      }


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


  if (command === "outgc") {

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


    const rawArg = args.trim();
    const idx = parseInt(rawArg, 10);
    if (!isNaN(idx) && idx > 0 && String(idx) === rawArg) {

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

      groupJid = normalizeGroupJid(rawArg);
    }

    if (!groupJid) {
      await sock.sendMessage(from, {
        text: `❌ Format gak valid. Ketik *${p}outgc* buat lihat daftar grup.`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }


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

    {
      const res = await addMetaAI(sock, from);
      await sock.sendMessage(from, { text: res.text });
      if (msgKey) await react(sock, msgKey, res.success ? "✅" : "❌");
    }
    return;
  }

  if (command === "swgc") {
    const res = await swgc(sock, from, sender, args, config, isOwner);
    await sock.sendMessage(from, { text: res.text });
    if (msgKey) await react(sock, msgKey, res.success ? "✅" : "❌");
    return;
  }

  if (command === "version") {
    if (!(await isOwner(sock, sender))) { if (msgKey) await react(sock, msgKey, ""); return; }
    const localVer = require("../package.json").version;
    try {
      const res = await checkUpdate();
      await sock.sendMessage(from, { text: res.text });
      if (msgKey) await react(sock, msgKey, res.success ? "\u2705" : "\uD83D\uDD04");
    } catch(e) {
      await sock.sendMessage(from, { text: `*Versi lokal:* v${localVer}\n\u274C Gagal cek remote: ${e.message}` });
      if (msgKey) await react(sock, msgKey, "\u274C");
    }
    return;
  }

  if (command === "checkupdate") {
    if (!(await isOwner(sock, sender))) { if (msgKey) await react(sock, msgKey, ""); return; }
    const res = await checkUpdate();
    await sock.sendMessage(from, { text: res.text });
    if (msgKey) await react(sock, msgKey, res.success ? "✅" : "🔄");
    return;
  }

  if (command === "update") {
    if (!(await isOwner(sock, sender))) { if (msgKey) await react(sock, msgKey, ""); return; }
    const { execSync } = require("child_process");
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    let sent = await sock.sendMessage(from, { text: "🔄 Mengupdate..." });
    const edit = async (txt) => { try { await sock.sendMessage(from, { text: txt, edit: sent.key }); } catch { try { sent = await sock.sendMessage(from, { text: txt }); } catch {} } };
    try {
      if (msgKey) await react(sock, msgKey, "⏳");
      await edit("🔄 Mengupdate...\n⏳ Menarik update dari GitHub...");
      const out = execSync("git fetch origin && git reset --hard origin/main && npm install", { encoding: "utf8", timeout: 120000 });
      await edit("✅ Update selesai (force).\n" + out.slice(0, 2500) + "\n\n♻️ Restart dalam 5 detik...");
      for (let i = 5; i >= 0; i--) {
        await delay(1000);
        const txt = i === 0 ? "♻️ Restarting..." : `♻️ Restart dalam ${i} detik...`;
        await edit(txt);
      }
      process.exit(0);
    } catch(e) {
      await edit("❌ Gagal update:\n" + (e.stderr || e.stdout || e.message).slice(0, 3500));
      if (msgKey) await react(sock, msgKey, "❌");
    }
    return;
  }

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


    const quotedMsg = getQuoted(msg);
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
    if (await ownerOnly()) return;
    if (!args || args.trim().length === 0) {
      await sock.sendMessage(from, {
        text: `❌ Sebutin prefix barunya dong.\nContoh: *${p}setprefix !*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    const newPrefix = args.trim().charAt(0);
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


  if (command === "getprofile" || command === "getpp" || command === "getpfp") {
    const ctx = getQuotedCtx(msg);
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
    if (await ownerOnly()) return;
    if (!args) {
      await sock.sendMessage(from, {
        text: `❌ Tulis nomor yang mau di-whitelist.\nContoh: *${p}addwl 628123456789*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

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
    if (await ownerOnly()) return;
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
    if (await ownerOnly()) return;
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


  if (command === "getjid" || command === "encode") {
    if (await ownerOnly()) return;
    if (!args) {
      await sock.sendMessage(from, {
        text: `❌ Tulis nomornya.\nContoh: *${p}getjid 081234567890*`,
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


  if (command === "getnumber" || command === "decode") {
    if (await ownerOnly()) return;

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


  if (command === "brat") {
    if (!args) {
      await sock.sendMessage(from, {
        text: `❌ Kasih teksnya dong.\nContoh: *${p}brat halo dunia*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }
    try {

      const imgBuffer = await makeBrat(args);

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

      try { if (webpPath && fs.existsSync(webpPath)) fs.unlinkSync(webpPath); } catch {}
    }
    return;
  }


  if (["s", "stiker", "sticker"].includes(command)) {

    const quotedMsg = getQuoted(msg);
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


      let dlMsg;
      if (directImg || directVid) {

        dlMsg = msg;
      } else {

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

        const { getFfmpegPath } = require("../systemconverter/ffmpeg");
        const ffmpegPath = getFfmpegPath();

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


  if (["toimg", "toimage"].includes(command)) {
    const quotedMsg = getQuoted(msg);
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


  if (["rvo", "readonce", "viewonce"].includes(command)) {
    const quotedMsg = getQuoted(msg);


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



  if (["tosketch", "hitamkan", "image2prompt", "img2img"].includes(command)) {

    const quotedMsg = getQuoted(msg);
    const directImg = msg?.message?.imageMessage;
    const quotedImg = quotedMsg?.imageMessage;

    if (!directImg && !quotedImg) {
      await sock.sendMessage(from, {
        text: `❌ Kirim/reply foto dulu wak, terus kasih caption *${p}${command}*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }


    if (command === "img2img" && !args) {
      await sock.sendMessage(from, {
        text: `❌ Kasih prompt-nya juga dong wak.\nContoh: *${p}img2img ubah background jadi pantai*`,
      });
      if (msgKey) await react(sock, msgKey, "❌");
      return;
    }

    try {
      const { downloadMediaMessage } = require("@itsliaaa/baileys");


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


      let result;
      if (command === "img2img") {
        result = await aiImage.img2img(imageBuffer, args);
      } else {
        const cmdMap = {
          tosketch:    aiImage.toSketch,
          hitamkan:    aiImage.hitamkan,
          image2prompt: aiImage.image2prompt,
        };
        result = await cmdMap[command](imageBuffer);
      }

      if (result.type === "image") {
        const captions = {
          tosketch:    "✅ Foto berhasil dijadiin sketsa!",
          hitamkan:    "✅ Foto berhasil dijadiin hitam putih!",
          img2img:     "✅ Foto berhasil diedit sesuai prompt!",
        };
        let caption = captions[command] || "✅ Done!";
        if (result.url) caption += `\n\n🔗 ${result.url}`;
        await sock.sendMessage(
          from,
          { image: result.data, caption },
          { quoted: msg }
        );
      } else {

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


  if (command === "dlurl") {
    const url = args.trim();
    if (/^https?:\/\//i.test(url)) {
      await sock.sendMessage(from, { text: url });
      if (msgKey) await react(sock, msgKey, "✅");
    }
    return;
  }


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

      }
      const platform = target.platform;
      try {
        const dl = require("../menusystem/downloader");
        const { items, caption, author, stats } = await dl.download(platform, target.url);
        let sentCaption = '';
        if (platform === "instagram") {
          const likes = stats?.likes ?? '-';
          const comments = stats?.comments ?? '-';
          const cap = caption ?? '-';
          const auth = author ?? '-';
          sentCaption = `┏━ RESULT\n┣ Author : ${auth}\n┣ ❤️ Likes  : ${likes}\n┣ 💬 Komen  : ${comments}\n┗━\n\n${cap}`;
        } else if (caption) {
          sentCaption = `📝 ${caption}`;
        }
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


  const category = findCategory(command);
  if (category) {

    if (category.isAllMenuSeparator) {
      await sock.sendMessage(from, { text: buildAllMenu() });
      if (msgKey) await react(sock, msgKey, "✅");
      return;
    }

    if (category.directText) {
      const text =
        typeof category.directText === "string"
          ? category.directText
          : category.directText;
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


    await sock.sendMessage(from, {
      text:
        `🚧 Command *${p}${found.command.command}* diterima dengan isi:\n"${args}"\n\n` +
        `(fitur ini belum diimplementasi, ini masih base)`,
    });
    if (msgKey) await react(sock, msgKey, "✅");
    return;
  }


  if (msgKey) await react(sock, msgKey, "");
}

module.exports = { handleMessage, parseCommand, isGroup };
