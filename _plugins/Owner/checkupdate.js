// owner only - cek versi remote di github vs lokal
const PKG_URL = "https://raw.githubusercontent.com/Mayzaaonex/Bot-Whatsapp/main/package.json";
const README_URL = "https://raw.githubusercontent.com/Mayzaaonex/Bot-Whatsapp/main/README.md";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

function extractLatestChange(readme) {
  // ambil 1 baris changelog terbaru (bukan header/separator)
  const lines = readme.split(/\r?\n/);
  const idx = lines.findIndex(l => l.trim() === "## Changelog");
  if (idx === -1) return "";
  for (let i = idx + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || l.includes("Versi") || l.includes("---")) continue;
    if (!l.startsWith("|")) continue;
    // | 1.2.7 | 2026-10-05 | catatan |
    const cols = l.split("|").map(s => s.trim()).filter(Boolean);
    if (cols.length >= 3) {
      const ver = cols[0];
      const note = cols[2];
      return `v${ver} — ${note}`;
    }
    return l.replace(/\|/g, " ").trim();
  }
  return "";
}

function compareVersion(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i]||0) > (pb[i]||0)) return 1;
    if ((pa[i]||0) < (pb[i]||0)) return -1;
  }
  return 0;
}

async function checkUpdate() {
  try {
    const localPkg = require("../../package.json");
    const localVer = localPkg.version;
    let remotePkg;
    try { remotePkg = await fetchJson(PKG_URL); }
    catch(e) { return { success: false, text: "\u274C Gagal ambil versi remote: " + e.message }; }
    const remoteVer = remotePkg.version || "unknown";
    const cmp = compareVersion(localVer, remoteVer);
    if (cmp >= 0) {
      return { success: true, text: "\u2705 Bot sudah up to date!\n\n*Versi:* v" + localVer };
    }
    let change = "";
    try {
      const readme = await fetchText(README_URL);
      change = extractLatestChange(readme);
    } catch {}
    let txt = "\uD83D\uDD04 *Update Tersedia!*\n\n";
    txt += "*Lokal:* v" + localVer + " \u2192 *Remote:* v" + remoteVer + "\n";
    if (change) txt += "\n> " + change + "\n";
    txt += "\nKetik *.update* untuk update otomatis.";
    return { success: false, text: txt };
  } catch(e) {
    return { success: false, text: "\u274C Gagal cek update: " + e.message };
  }
}

module.exports = { checkUpdate };
