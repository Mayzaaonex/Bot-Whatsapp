const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { randomBytes } = require("crypto");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const MAYZAA_BASE = "https://api.mayzaa.my.id/mayzaa";
const MAYZAA_IMAGE_BASE = `${MAYZAA_BASE}/ai-image`;
const MAYZAA_TOOLS_BASE = `${MAYZAA_BASE}/tools`;
const PLUGINS_DIR = path.join(__dirname, "..", "_plugins", "AI-Image");
async function postMayzaaJson(url, imageBuffer, extraFields = {}) {
  const form = new FormData();
  form.append("file", imageBuffer, { filename: "image.jpg", contentType: "image/jpeg" });
  for (const [k, v] of Object.entries(extraFields)) form.append(k, String(v));
  const { data } = await axios.post(url, form, { headers: { ...form.getHeaders(), "User-Agent": UA }, timeout: 120000, maxBodyLength: Infinity, maxContentLength: Infinity });
  if (data?.status === false) throw new Error(data.message || `${url}: request gagal.`);
  return data?.result;
}
async function postMayzaaBinary(url, imageBuffer, extraFields = {}) {
  const form = new FormData();
  form.append("file", imageBuffer, { filename: "image.jpg", contentType: "image/jpeg" });
  for (const [k, v] of Object.entries(extraFields)) form.append(k, String(v));
  const res = await axios.post(url, form, { headers: { ...form.getHeaders(), "User-Agent": UA }, timeout: 60000, responseType: "arraybuffer", maxBodyLength: Infinity, maxContentLength: 50 * 1024 * 1024 });
  if ((res.headers["content-type"] || "").includes("application/json")) {
    let msg = `${url}: API gagal.`;
    try { const p = JSON.parse(Buffer.from(res.data).toString("utf8")); msg = p?.message || p?.error || msg; } catch {}
    throw new Error(msg);
  }
  return Buffer.from(res.data);
}
async function downloadImageBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer", headers: { "User-Agent": UA }, timeout: 30000 });
  return Buffer.from(res.data);
}
function execPlugin(pluginFile, tmpInputPath, extraArgs = []) {
  const pluginPath = path.join(PLUGINS_DIR, pluginFile);
  if (!fs.existsSync(pluginPath)) throw new Error(`Plugin tidak ditemukan: ${pluginFile}`);
  return new Promise((resolve, reject) => {
    const args = [pluginPath, tmpInputPath, ...extraArgs];
    execFile("node", args, { timeout: 300000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) return reject(new Error(stderr || err.message));
      let json = null;
      try { json = JSON.parse(String(stdout).trim()); } catch {}
      if (!json) {
        const matches = String(stdout).match(/\{[\s\S]*\}/g);
        if (matches) for (let i = matches.length - 1; i >= 0; i--) try { const p = JSON.parse(matches[i]); if (p && ("status" in p || "result_path" in p)) { json = p; break; } } catch {}
      }
      if (!json) return reject(new Error(`Plugin output tidak valid: ${String(stdout).slice(0, 800) || stderr?.slice(0, 800) || err?.message || "unknown"}`));
      if (json.status === false) return reject(new Error(json.error || json.message || "Plugin gagal."));
      if (!json.result_path) return reject(new Error("Plugin sukses tapi result_path kosong."));
      resolve(json);
    });
  });
}
function writeTmpInput(buffer) {
  const { TEMP_DIR, ensureTempDir } = require("../systemconverter/tempDir");
  ensureTempDir();
  const tmpPath = path.join(TEMP_DIR, `aiimage-${Date.now()}-${randomBytes(4).toString("hex")}.jpg`);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}
function readResultBuffer(p) { if (!fs.existsSync(p)) throw new Error(`File hasil tidak ada: ${p}`); return fs.readFileSync(p); }
function cleanupFiles(...paths) { for (const p of paths) try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {} }
async function removeBg(buf) { const b = await postMayzaaBinary(`${MAYZAA_TOOLS_BASE}/removebg`, buf); return { type: "image", data: b }; }
async function topixel(buf, level = 30) { const b = await postMayzaaBinary(`${MAYZAA_TOOLS_BASE}/topixel`, buf, { level }); return { type: "image", data: b }; }
async function toSketch(buf) { const r = await postMayzaaJson(`${MAYZAA_IMAGE_BASE}/to-sketch`, buf); const u = r?.output_url; if (!u) throw new Error("ToSketch: output_url gak ada."); const b = await downloadImageBuffer(u); return { type: "image", data: b, url: u }; }
async function hitamkan(buf) { const inPath = writeTmpInput(buf); try { const r = await execPlugin("hitam.js", inPath); const b = readResultBuffer(r.result_path); cleanupFiles(inPath); try { if (fs.existsSync(r.result_path)) fs.unlinkSync(r.result_path); } catch {} return { type: "image", data: b }; } catch (e) { cleanupFiles(inPath); throw e; } }
async function enhancer(buf) { const r = await postMayzaaJson(`${MAYZAA_TOOLS_BASE}/enhancer`, buf); const u = r?.result_url; if (!u) throw new Error("Enhancer: result_url gak ada."); const b = await downloadImageBuffer(u); return { type: "image", data: b, url: u }; }
async function image2prompt(buf) { const r = await postMayzaaJson(`${MAYZAA_IMAGE_BASE}/image2prompt`, buf); const p = typeof r === "string" ? r : r?.text || r?.prompt; if (!p?.trim()) throw new Error("Image2Prompt: prompt gak ada."); return { type: "text", data: String(p).trim() }; }
async function img2img(buf, prompt) { if (!prompt?.trim()) throw new Error("Img2Img butuh prompt. Contoh: kirim foto + caption *.img2img ubah jadi gaya anime*"); const inPath = writeTmpInput(buf); try { const r = await execPlugin("image2image.js", inPath, [prompt.trim()]); const b = readResultBuffer(r.result_path); cleanupFiles(inPath); try { if (fs.existsSync(r.result_path)) fs.unlinkSync(r.result_path); } catch {} return { type: "image", data: b }; } catch (e) { cleanupFiles(inPath); throw e; } }
module.exports = { removeBg, topixel, toSketch, hitamkan, enhancer, image2prompt, img2img };
