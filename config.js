
const fs = require("fs");
const path = require("path");
const { normalizePhone, jidToNumber, resolvePNForLid, getCachedPNForLid } = require("./systemconverter/jid");


const DB_DIR = path.join(__dirname, "database");
const CONFIG_FILE = path.join(DB_DIR, "bot_config.json");
const GROUP_WHITELIST_FILE = path.join(DB_DIR, "whitelist.json");
const ADMIN_CONFIG_FILE = path.join(__dirname, "config.json");


fs.mkdirSync(DB_DIR, { recursive: true });


const DEFAULT_CONFIG = {
  prefix: ".",

  whitelist: [],
};


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

const ADMIN_NUMBERS = _adminCfg.admins.map(normalizePhone);

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


let _cfg = loadConfig();

if (_adminCfg.prefix && !fs.existsSync(CONFIG_FILE)) {
  _cfg.prefix = _adminCfg.prefix;
}

const config = {
  get prefix() { return _cfg.prefix; },
  set prefix(v) { _cfg.prefix = v; saveConfig(_cfg); },


  get admins() { return ADMIN_NUMBERS; },



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


  get groups() { return [..._groups]; },

  isGroupAllowed(jid) {
    return _groups.includes(jid);
  },


  addGroup(jid) {
    if (_groups.includes(jid)) return false;
    _groups.push(jid);
    saveGroupWhitelist(_groups);
    return true;
  },


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
