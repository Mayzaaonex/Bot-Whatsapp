const path = require("path");
const { runNode } = require("../systemconverter/pluginRunner");
const PLUGIN_DIR = path.join(__dirname, "..", "_plugins", "Downloader");
const PLUGINS = { tiktok: "tiktok.js", instagram: "instagram.js", facebook: "facebook.js", spotify: "spotify.js", pinterest: "pinterest.js", douyin: "duoyin.js", ytmp3: "ytmp3.js", ytmp4: "ytmp4.js" };
function detectDownloaderUrl(text) {
  const url = String(text || "").trim().match(/https?:\/\/[^\s<>]+/i)?.[0];
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "vt.tiktok.com" || host === "vm.tiktok.com" || host.endsWith(".tiktok.com")) return { platform: "tiktok", url };
    if (host === "instagram.com" || host === "instagr.am" || host.endsWith(".instagram.com")) return { platform: "instagram", url };
    if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch" || host === "fb.com") return { platform: "facebook", url };
    if (host === "open.spotify.com" || host === "spotify.com") return { platform: "spotify", url };
    if (host === "pin.it" || host === "pinterest.com" || host.endsWith(".pinterest.com")) return { platform: "pinterest", url };
    if (host === "v.douyin.com" || host === "douyin.com" || host.endsWith(".douyin.com")) return { platform: "douyin", url };
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com" || host.endsWith(".youtube.com")) return { platform: "youtube", url };
  } catch {}
  return null;
}
function asHttpUrl(u) { try { const x=new URL(String(u)); return /^https?:$/.test(x.protocol)?x.href:null; } catch { return null; } }
function normalize(platform, response) {
  if (!response?.status) throw new Error(response?.message || response?.error || "Plugin gagal mengambil media.");
  const result = response.result || response;
  const items = [];
  const add = (url, type) => { url = asHttpUrl(url); if (url) items.push({ url, type }); };
  if (platform === "tiktok") add(result.video_url, "video");
  else if (platform === "facebook") { const downloads = Array.isArray(result.downloads) ? result.downloads : []; const preferred = downloads.find((item) => /hd|high/i.test(item.quality || item.type || "")) || downloads[0]; add(preferred?.url || result.video_url, "video"); }
  else if (platform === "instagram") { for (const media of result.media || []) add(media.url, String(media.type).toLowerCase().includes("image") ? "image" : "video"); if (!items.length) add(result.download_url || result.video || result.image, result.image && !result.video ? "image" : "video"); }
  else if (platform === "spotify") add(result.download_url, "audio");
  else if (platform === "pinterest") { for (const media of result.media || []) add(media.url, String(media.type).toLowerCase().includes("image") ? "image" : "video"); }
  else if (platform === "douyin") add(result.download_link, "video");
  else if (platform === "ytmp3" || platform === "ytmp4") add(response.downloadUrl, platform === "ytmp3" ? "audio" : "video");
  if (!items.length) throw new Error("Plugin tidak mengembalikan URL media.");
  return { items, caption: result.caption || result.title || result.metadata?.title || "" };
}
async function runPlugin(platform, url) {
  const plugin = PLUGINS[platform];
  if (!plugin) throw new Error("Platform tidak didukung.");
  const { json } = await runNode(path.join(PLUGIN_DIR, plugin), [url]);
  return normalize(platform, json);
}
module.exports = { detectDownloaderUrl, download: runPlugin, normalize };
