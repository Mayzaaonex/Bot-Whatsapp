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

function extractChangelog(readme) {
  const lines = readme.split(/\r?\n/);
  const chIdx = lines.findIndex(l => l.trim() === "## Changelog");
  if (chIdx === -1) return "";
  let out = [];
  let inTable = false;
  for (let i = chIdx; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("|") && l.includes("|")) {
      if (!inTable && l.includes("Versi")) { inTable = true; continue; }
      if (l.includes("---")) continue;
      out.push(l);
      if (out.length >= 5) break;
    } else if (inTable && out.length > 0) break;
  }
  return out.join("\n");
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
      return { success: true, text: "\u2705 Bot sudah up to date!\n\n*Versi lokal:* v" + localVer + "\n*Versi remote:* v" + remoteVer };
    }
    let changelog = "";
    try {
      const readme = await fetchText(README_URL);
      changelog = extractChangelog(readme);
    } catch {}
    let txt = "\uD83D\uDD04 *Update Tersedia!*\n\n";
    txt += "*Lokal:* v" + localVer + " \u2192 *Remote:* v" + remoteVer + "\n\n";
    if (changelog) txt += "*Changelog (5 terbaru):*\n" + changelog + "\n\n";
    txt += "Ketik *.update* untuk update otomatis.";
    return { success: false, text: txt };
  } catch(e) {
    return { success: false, text: "\u274C Gagal cek update: " + e.message };
  }
}

module.exports = { checkUpdate };
