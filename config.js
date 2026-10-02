// ============================================================
//  CONFIG BOT — prefix & whitelist
//
//  Semua data yang berubah waktu runtime disimpen di folder /database:
//   - database/bot_config.json → prefix + whitelist nomor (chat pribadi)
//   - database/whitelist.json  → whitelist GRUP (diisi owner lewat .setgc)
// ============================================================

const fs = require("fs");
const path = require("path");
const { normalizePhone, jidToNumber, resolvePNForLid, getCachedPNForLid } = require("./systemconverter/jid");

// database/bot_config.json = state yang di-generate/diubah runtime (prefix, whitelist)
// config.json              = setting yang di-edit manual sama owner (nomor admin, dll)
const DB_DIR = path.join(__dirname, "database");
const CONFIG_FILE = path.join(DB_DIR, "bot_config.json");
const GROUP_WHITELIST_FILE = path.join(DB_DIR, "whitelist.json");
const ADMIN_CONFIG_FILE = path.join(__dirname, "config.json");

// pastiin folder database ada (dibuat otomatis kalau kehapus)
fs.mkdirSync(DB_DIR, { recursive: true });

// default config kalau file belum ada
const DEFAULT_CONFIG = {
  prefix: ".",
  // whitelist JID — bot HANYA respon pesan dari JID ini.
  // format: ["628123456789@s.whatsapp.net", "628111@g.us", ...]
  // Kosongkan array [] = whitelist OFF (bot respon semua orang).
  whitelist: [],
};

// ── ADMIN NUMBERS (dari config.json) ────────────────────────────────
// Ditulis pakai nomor HP biasa (08xxx ATAU 628xxx, dua-duanya support),
// terus dinormalisasi supaya bisa dicocokin sama JID dari Baileys.
function loadAdminConfig() {
  try {
    if (fs.existsSync(ADMIN_CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, "utf8"));
      return {
        prefix: raw.prefix,
        admins: Array.isArray(raw.admins) ? raw.admins : [],
        adminJids: Array.isArray(raw.adminJids) ? raw.adminJids : [],
      };
    }
  } catch (e) {
    console.error("⚠️  Gagal baca config.json:", e.message);
  }
  return { prefix: undefined, admins: [] };
}

const _adminCfg = loadAdminConfig();
// Normalisasi sekali di awal — jadi "089531367146" dan "6289531367146"
// dua-duanya diterima di config.json dan berakhir di format yang sama.
const ADMIN_NUMBERS = _adminCfg.admins.map(normalizePhone);
// JID mentah (dipakai buat akun yang muncul sebagai "@lid", bukan nomor HP —
// lid gak bisa dicocokin lewat nomor, jadi harus exact-match JID-nya)
const ADMIN_JIDS = _adminCfg.adminJids || [];

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch (e) {
    console.error("⚠️  Gagal baca config, pakai default:", e.message);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

// ── WHITELIST GRUP (database/whitelist.json) ────────────────────────
// Format: { "groups": ["120363012345678901@g.us", ...] }
function loadGroupWhitelist() {
  try {
    if (fs.existsSync(GROUP_WHITELIST_FILE)) {
      const raw = JSON.parse(fs.readFileSync(GROUP_WHITELIST_FILE, "utf8"));
      return Array.isArray(raw.groups) ? raw.groups : [];
    }
  } catch (e) {
    console.error("⚠️  Gagal baca database/whitelist.json:", e.message);
  }
  return [];
}

function saveGroupWhitelist(groups) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(
    GROUP_WHITELIST_FILE,
    JSON.stringify({ groups }, null, 2),
    "utf8"
  );
}

let _groups = loadGroupWhitelist();

// Config di-load sekali waktu require, tapi bisa di-reload
let _cfg = loadConfig();
// Kalau prefix belum pernah di-set runtime (bot_config.json belum ada),
// pakai prefix default dari config.json
if (_adminCfg.prefix && !fs.existsSync(CONFIG_FILE)) {
  _cfg.prefix = _adminCfg.prefix;
}

const config = {
  get prefix() { return _cfg.prefix; },
  set prefix(v) { _cfg.prefix = v; saveConfig(_cfg); },

  /** Daftar nomor admin (sudah dinormalisasi, format 628xxxxxxxxxx) */
  get admins() { return ADMIN_NUMBERS; },

  /**
   * Cek apakah sebuah JID adalah admin/owner — versi cepat/sync.
   * JID tipe "@lid" HANYA kena kalau udah pernah ke-resolve & masuk cache
   * (lid-cache.json) atau ditulis manual di adminJids. Kalau belum pernah
   * ke-resolve, pakai isOwnerAsync (butuh sock) supaya bisa auto-decode.
   */
  isOwner(jid) {
    if (!jid) return false;
    if (ADMIN_JIDS.includes(jid)) return true;

    if (jid.endsWith("@lid")) {
      const cachedNumber = getCachedPNForLid(jid);
      return cachedNumber ? ADMIN_NUMBERS.includes(cachedNumber) : false;
    }

    const number = jidToNumber(jid);
    if (!number) return false;
    return ADMIN_NUMBERS.includes(number);
  },

  /**
   * Sama kayak isOwner(), tapi buat JID "@lid" yang belum ke-resolve,
   * dia bakal query langsung ke sock (LID mapping bawaan Baileys) buat
   * dapetin nomor HP aslinya. Hasilnya auto ke-cache, jadi panggilan
   * berikutnya buat LID yang sama gak perlu nunggu sock lagi.
   *
   * @param {object} sock  socket Baileys aktif
   * @param {string} jid
   * @returns {Promise<boolean>}
   */
  async isOwnerAsync(sock, jid) {
    if (!jid) return false;
    if (ADMIN_JIDS.includes(jid)) return true;

    if (jid.endsWith("@lid")) {
      const number = await resolvePNForLid(sock, jid);
      return number ? ADMIN_NUMBERS.includes(number) : false;
    }

    const number = jidToNumber(jid);
    if (!number) return false;
    return ADMIN_NUMBERS.includes(number);
  },

  get whitelist() { return _cfg.whitelist; },
  set whitelist(v) { _cfg.whitelist = v; saveConfig(_cfg); },

  addWhitelist(jid) {
    if (!_cfg.whitelist.includes(jid)) {
      _cfg.whitelist.push(jid);
      saveConfig(_cfg);
    }
  },

  removeWhitelist(jid) {
    _cfg.whitelist = _cfg.whitelist.filter((j) => j !== jid);
    saveConfig(_cfg);
  },

  isAllowed(jid) {
    if (_cfg.whitelist.length === 0) return true;
    return _cfg.whitelist.includes(jid);
  },

  // ── whitelist grup ──
  // Grup yang gak ada di sini = bot diem total (cuma .idgc & .setgc
  // dari owner yang tetap jalan di semua grup).
  get groups() { return [..._groups]; },

  isGroupAllowed(jid) {
    return _groups.includes(jid);
  },

  /** @returns {boolean} true kalau baru ditambahin, false kalau udah ada */
  addGroup(jid) {
    if (_groups.includes(jid)) return false;
    _groups.push(jid);
    saveGroupWhitelist(_groups);
    return true;
  },

  /** @returns {boolean} true kalau berhasil dihapus, false kalau emang gak ada */
  removeGroup(jid) {
    if (!_groups.includes(jid)) return false;
    _groups = _groups.filter((j) => j !== jid);
    saveGroupWhitelist(_groups);
    return true;
  },

  reload() {
    _cfg = loadConfig();
    _groups = loadGroupWhitelist();
  },
};

module.exports = config;
