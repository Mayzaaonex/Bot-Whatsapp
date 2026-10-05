const fs = require("fs");
const path = require("path");

const OPTIN_FILE = path.join(__dirname, "../../database/optin.json");

function loadOptin() {
  try {
    if (fs.existsSync(OPTIN_FILE)) {
      return JSON.parse(fs.readFileSync(OPTIN_FILE, "utf8"));
    }
  } catch {}
  return { users: [] };
}

function saveOptin(data) {
  fs.mkdirSync(path.dirname(OPTIN_FILE), { recursive: true });
  fs.writeFileSync(OPTIN_FILE, JSON.stringify(data, null, 2));
}

function num(x) {
  return String(x || "").replace(/\D/g, "");
}

function jid(n) {
  return `${num(n)}@s.whatsapp.net`;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function swgc(sock, from, sender, args, config, isOwner) {
  if (!(await isOwner(sock, sender))) {
    return { success: false, text: "❌ Khusus owner." };
  }

  const raw = args.trim();
  const i = raw.indexOf("|");
  if (i < 0) {
    return { success: false, text: "Format: .swgc | <pesan> atau .swgc all | <pesan>" };
  }

  const target = raw.slice(0, i).trim();
  const msg = raw.slice(i + 1).trim();
  if (!msg) {
    return { success: false, text: "Pesan tidak boleh kosong." };
  }

  let ids = [];

  if (target !== "all") {
    const gid = target.endsWith("@g.us") ? target : `${target}@g.us`;
    if (!/^\d+(-\d+)?@g\.us$/.test(gid)) {
      return { success: false, text: "❌ ID grup tidak valid." };
    }
    try {
      const g = await sock.groupMetadata(gid);
      ids = g.participants.map((x) => num(x.id));
    } catch (e) {
      return { success: false, text: `❌ Gagal ambil member grup: ${e.message}` };
    }
  } else {
    try {
      const gs = await sock.groupFetchAllParticipating();
      for (const g of Object.values(gs)) {
        ids.push(...g.participants.map((x) => num(x.id)));
      }
    } catch (e) {
      return { success: false, text: `❌ Gagal ambil semua grup: ${e.message}` };
    }
  }

  const allowed = new Set(loadOptin().users.map(String));
  const unique = [...new Set(ids)].filter((x) => allowed.has(x)).slice(0, 50);

  let sent = 0,
    failed = 0;
  for (const n of unique) {
    try {
      await sock.sendMessage(jid(n), { text: msg });
      sent++;
    } catch {
      failed++;
    }
    await sleep(500);
  }

  return {
    success: true,
    text: `╭━━〔 📤 SWGC 〕━━╮\n│ 👥 Terdeteksi : ${[...new Set(ids)].length}\n│ ✅ Opt-in : ${unique.length}\n│ 📤 Terkirim : ${sent}\n│ ⚠️ Gagal : ${failed}\n╰━━━━━━━━━━━━━━╯`,
  };
}

module.exports = { swgc };