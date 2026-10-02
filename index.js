const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@itsliaaa/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

const config = require("./config");
const { handleMessage } = require("./handlers/messageHandler");
const { ensureTempDir, TEMP_DIR } = require("./systemconverter/tempDir");
const { formatJidForLog, resolvePNForLid } = require("./systemconverter/jid");

const logger = pino({ level: "silent" });

ensureTempDir();
console.log("📁 Folder file sementara:", TEMP_DIR);

// ═══════════════════════════════════════════════════════════════════
//  BOT WHATSAPP (Baileys)
// ═══════════════════════════════════════════════════════════════════

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: ["Bot Base", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Scan QR ini pakai WhatsApp kamu:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Koneksi terputus, reconnect:", shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ Bot berhasil connect ke WhatsApp!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      // Grup yang belum di-whitelist: jangan di-autoread juga (biar bot
      // bener-bener gak keliatan aktif di sana).
      const jid = msg.key.remoteJid;
      if (jid?.endsWith("@g.us") && !config.isGroupAllowed(jid)) continue;
      try {
        await sock.readMessages([msg.key]);
      } catch (e) {
        console.error("⚠️  Autoread gagal:", e.message);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const listReplyId =
      msg.message.listResponseMessage?.singleSelectReply?.selectedRowId;
    const nativeFlowParams =
      msg.message.interactiveResponseMessage?.nativeFlowResponseMessage
        ?.paramsJson;
    let nativeFlowId;
    if (nativeFlowParams) {
      try {
        nativeFlowId = JSON.parse(nativeFlowParams).id;
      } catch (e) {
        nativeFlowId = undefined;
      }
    }

    const quotedInfo =
      msg.message.extendedTextMessage?.contextInfo ||
      msg.message.interactiveResponseMessage?.contextInfo;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      listReplyId ||
      nativeFlowId ||
      "";

    if (sender.endsWith("@lid")) {
      await resolvePNForLid(sock, sender);
    }

    const senderLog =
      sender !== from ? ` (pengirim: ${formatJidForLog(sender)})` : "";
    console.log(
      "📩 Pesan masuk dari",
      formatJidForLog(from) + senderLog,
      "->",
      text
    );

    try {
      await handleMessage(sock, from, sender, text, quotedInfo, msg.pushName, msg.key, msg);
    } catch (err) {
      console.error("❌ Error di handleMessage:", err);
    }
  });

  // ── Auto-remove whitelist kalau bot di-kick / keluar dari grup ──────
  // Baileys emit "group-participants.update" saat ada perubahan peserta.
  // Kalau action-nya "remove" dan salah satu JID yang di-remove adalah
  // JID bot sendiri, artinya bot di-kick → langsung hapus dari whitelist.
  sock.ev.on("group-participants.update", ({ id, participants, action }) => {
    if (action !== "remove") return;
    const botJid = sock.user?.id;
    if (!botJid) return;

    // Normalisasi device suffix tanpa mengubah tipe JID (@lid/@s.whatsapp.net).
    const botBase = botJid.replace(/:\d+(?=@)/, "");
    const kicked = participants.some((p) => p.replace(/:\d+(?=@)/, "") === botBase);

    if (kicked && config.isGroupAllowed(id)) {
      config.removeGroup(id);
      console.log(`🚪 Bot di-kick dari ${id} — otomatis dihapus dari whitelist.`);
    }
  });

  return sock;
}

startBot();