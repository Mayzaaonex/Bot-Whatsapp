// ============================================================
//  SYSTEM / JID — konversi JID <-> nomor HP
// ============================================================
// Baileys selalu ngasih JID (mis. "6289531367146@s.whatsapp.net"),
// bukan nomor HP polos. Modul ini nyambungin dua dunia itu:
//   - nomor HP lokal (08xxx) yang user tulis di config.json
//   - JID internasional (628xxx@s.whatsapp.net) yang dipakai Baileys

/**
 * Normalisasi nomor HP ke format internasional tanpa "+", tanpa "62" dobel.
 * Nerima 08xxx, 628xxx, +628xxx, atau ada spasi/strip — semua diratain.
 * @param {string} raw
 * @returns {string} nomor format 628xxxxxxxxxx (angka doang)
 */
function normalizePhone(raw) {
  if (!raw) return "";
  let num = String(raw).replace(/\D/g, ""); // buang semua selain digit

  if (num.startsWith("0")) {
    num = "62" + num.slice(1);
  } else if (num.startsWith("620")) {
    // kasus salah ketik "620xxx"
    num = "62" + num.slice(3);
  } else if (!num.startsWith("62")) {
    // jaga-jaga kalau user nulis tanpa 0 dan tanpa 62, mis. "89531367146"
    num = "62" + num;
  }
  return num;
}

/**
 * Ubah nomor HP (format apapun) jadi JID WhatsApp personal.
 * @param {string} phone
 * @returns {string} mis. "6289531367146@s.whatsapp.net"
 */
function phoneToJid(phone) {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

/**
 * Ambil "nomor" mentah dari sebuah JID.
 * Kalau JID-nya grup/newsletter/lid (bukan JID personal), balikin null
 * karena bagian sebelum "@" itu BUKAN nomor HP asli (grup: id acak,
 * lid: id internal WA, newsletter: id channel).
 * @param {string} jid
 * @returns {string|null} nomor format 628xxxxxxxxxx, atau null
 */
function jidToNumber(jid) {
  if (!jid) return null;
  if (
    jid.endsWith("@g.us") ||
    jid.endsWith("@newsletter") ||
    jid.endsWith("@lid") ||
    jid.endsWith("@broadcast")
  ) {
    return null;
  }
  const [user] = jid.split("@");
  // JID personal kadang ada device id (mis. "6289531367146:12"), buang itu
  return user.split(":")[0];
}

/**
 * Tipe JID buat keperluan log/debug.
 * @param {string} jid
 * @returns {"personal"|"group"|"newsletter"|"lid"|"broadcast"|"unknown"}
 */
function jidType(jid) {
  if (!jid) return "unknown";
  if (jid.endsWith("@g.us")) return "group";
  if (jid.endsWith("@newsletter")) return "newsletter";
  if (jid.endsWith("@lid")) return "lid";
  if (jid.endsWith("@broadcast")) return "broadcast";
  if (jid.endsWith("@s.whatsapp.net")) return "personal";
  return "unknown";
}

/**
 * Format JID jadi string enak dibaca buat log, contoh:
 * "6289531367146@s.whatsapp.net" -> "6289531367146 (personal)"
 * "120363...@g.us"               -> "120363... (group)"
 * "129111...@lid"                -> "129111... (lid)" atau
 *                                    "6289531367146 (lid→personal)" kalau
 *                                    udah ke-resolve & ada di cache
 * @param {string} jid
 */
function formatJidForLog(jid) {
  const type = jidType(jid);
  let number = jidToNumber(jid);

  if (!number && type === "lid" && _lidCache.has(jid)) {
    return `${_lidCache.get(jid)} (lid→personal)`;
  }

  return number ? `${number} (${type})` : `${jid} (${type})`;
}

// ── LID RESOLVER (async, butuh koneksi sock) ────────────────────────
// JID tipe "@lid" itu ID internal WA, BUKAN nomor HP — jadi gak bisa
// dikonversi cuma modal string. Tapi Baileys ("@itsliaaa/baileys")
// nyimpen pemetaan LID<->nomor-HP sendiri di signalRepository begitu
// WA nge-sync-in nya. Kita query itu sekali per LID, terus disimpen
// di MEMORI (bukan file terpisah di disk) biar lookup berikutnya
// instant selama bot masih nyala. Restart bot = cache kosong lagi,
// tapi itu gak masalah karena LID langsung ke-resolve ulang begitu
// orangnya kirim pesan pertama.
const _lidCache = new Map();

/**
 * Resolve JID "@lid" jadi nomor HP asli (628xxxxxxxxxx), pakai:
 *   1. cache di memori — instant, gak perlu sock
 *   2. sock.signalRepository.lidMapping.getPNForLID() — query real ke Baileys
 * Hasil query #2 otomatis disimpen ke cache buat next time.
 *
 * @param {object|null} sock  socket Baileys aktif (boleh null kalau cuma mau cek cache)
 * @param {string} lid        JID tipe "xxxx@lid"
 * @returns {Promise<string|null>} nomor 628xxxxxxxxxx, atau null kalau belum kesync
 */
async function resolvePNForLid(sock, lid) {
  if (!lid || !lid.endsWith("@lid")) return null;

  if (_lidCache.has(lid)) return _lidCache.get(lid);

  if (!sock?.signalRepository?.lidMapping?.getPNForLID) return null;

  try {
    const pnJid = await sock.signalRepository.lidMapping.getPNForLID(lid);
    if (!pnJid) return null;
    const number = jidToNumber(pnJid);
    if (!number) return null;

    _lidCache.set(lid, number);
    return number;
  } catch (e) {
    console.error(`⚠️  Gagal resolve LID ${lid}:`, e.message);
    return null;
  }
}

/**
 * Cek cache LID tanpa perlu sock (buat isOwner versi sync).
 * @param {string} lid
 * @returns {string|null} nomor 628xxxxxxxxxx kalau udah pernah ke-resolve
 */
function getCachedPNForLid(lid) {
  return _lidCache.get(lid) || null;
}

module.exports = {
  normalizePhone,
  phoneToJid,
  jidToNumber,
  jidType,
  formatJidForLog,
  resolvePNForLid,
  getCachedPNForLid,
};
