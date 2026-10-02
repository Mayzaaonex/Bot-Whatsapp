// ============================================================
//  SYSTEM / AI IMAGE
//  removebg, tosketch, hitamkan, image2prompt, img2img, topixel, enhancer
//  Semua endpoint pake api.mayzaa.my.id.
//
//  Semua fungsi nerima Buffer gambar, return:
//    { type: "image", data: Buffer, url?: string }  → gambar hasil
//      (url ada kalau API-nya balikin JSON + result_url/output_url,
//       biar bisa ikut dikirim di caption WA)
//    { type: "text", data: string }                 → teks hasil (image2prompt)
// ============================================================

const axios = require("axios");
const FormData = require("form-data");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const MAYZAA_BASE = "https://api.mayzaa.my.id/mayzaa";
const MAYZAA_IMAGE_BASE = `${MAYZAA_BASE}/ai-image`;
const MAYZAA_TOOLS_BASE = `${MAYZAA_BASE}/tools`;

// ── HELPER — POST multipart, balikin JSON "result" ──
// Dipake buat endpoint yang balikin JSON: { status, result: {...} / "..." }
async function postMayzaaJson(url, imageBuffer, extraFields = {}) {
  const form = new FormData();
  form.append("file", imageBuffer, { filename: "image.jpg", contentType: "image/jpeg" });
  for (const [key, value] of Object.entries(extraFields)) {
    form.append(key, String(value));
  }

  const { data } = await axios.post(url, form, {
    headers: { ...form.getHeaders(), "User-Agent": UA },
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  if (data && data.status === false) {
    throw new Error(data.message || `${url}: request gagal.`);
  }

  return data?.result;
}

// ── HELPER — POST multipart, balikin Buffer gambar langsung ──
// Dipake buat endpoint yang balikin file gambar langsung (bukan JSON).
async function postMayzaaBinary(url, imageBuffer, extraFields = {}) {
  const form = new FormData();
  form.append("file", imageBuffer, { filename: "image.jpg", contentType: "image/jpeg" });
  for (const [key, value] of Object.entries(extraFields)) {
    form.append(key, String(value));
  }

  const res = await axios.post(url, form, {
    headers: { ...form.getHeaders(), "User-Agent": UA },
    timeout: 60000,
    responseType: "arraybuffer",
    maxBodyLength: Infinity,
    maxContentLength: 50 * 1024 * 1024,
  });

  const contentType = res.headers["content-type"] || "";
  if (contentType.includes("application/json")) {
    // Kalau gagal, biasanya API balikin JSON error, bukan gambar
    let msg = `${url}: API gagal, tidak ada hasil gambar.`;
    try {
      const parsed = JSON.parse(Buffer.from(res.data).toString("utf8"));
      msg = parsed?.message || parsed?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return Buffer.from(res.data);
}

// ── HELPER — download gambar dari URL jadi Buffer ──
async function downloadImageBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": UA },
    timeout: 30000,
  });
  return Buffer.from(res.data);
}

// ── REMOVEBG ─────────────────────────────────────────────────
// Output: { type: "image", data: Buffer PNG tanpa background }
// Endpoint ini balikin file PNG langsung (bukan JSON).
async function removeBg(imageBuffer) {
  const buffer = await postMayzaaBinary(`${MAYZAA_TOOLS_BASE}/removebg`, imageBuffer);
  return { type: "image", data: buffer };
}

// ── TOPIXEL ──────────────────────────────────────────────────
// Output: { type: "image", data: Buffer PNG pixel-art }
// Endpoint ini balikin file gambar langsung (bukan JSON). Level default 30.
async function topixel(imageBuffer, level = 30) {
  const buffer = await postMayzaaBinary(`${MAYZAA_TOOLS_BASE}/topixel`, imageBuffer, { level });
  return { type: "image", data: buffer };
}

// ── TOSKETCH ──────────────────────────────────────────────────
// Output: { type: "image", data: Buffer, url: output_url }
// Response mayzaa: { result: { output_url, file_id } }
async function toSketch(imageBuffer) {
  const result = await postMayzaaJson(`${MAYZAA_IMAGE_BASE}/to-sketch`, imageBuffer);
  const url = result?.output_url;
  if (!url) throw new Error("ToSketch: output_url gak ada di response.");

  const buffer = await downloadImageBuffer(url);
  return { type: "image", data: buffer, url };
}

// ── HITAMKAN ──────────────────────────────────────────────────
// Output: { type: "image", data: Buffer, url: result_url }
// Response mayzaa: { result: { original_url, result_url } }
async function hitamkan(imageBuffer) {
  const result = await postMayzaaJson(`${MAYZAA_IMAGE_BASE}/hitam`, imageBuffer);
  const url = result?.result_url;
  if (!url) throw new Error("Hitamkan: result_url gak ada di response.");

  const buffer = await downloadImageBuffer(url);
  return { type: "image", data: buffer, url };
}

// ── ENHANCER ─────────────────────────────────────────────────
// Output: { type: "image", data: Buffer, url: result_url }
// Response mayzaa: { result: { original_url, result_url } }
async function enhancer(imageBuffer) {
  const result = await postMayzaaJson(`${MAYZAA_TOOLS_BASE}/enhancer`, imageBuffer);
  const url = result?.result_url;
  if (!url) throw new Error("Enhancer: result_url gak ada di response.");

  const buffer = await downloadImageBuffer(url);
  return { type: "image", data: buffer, url };
}

// ── IMAGE2PROMPT ──────────────────────────────────────────────
// Output: { type: "text", data: string prompt }
// Response mayzaa: { result: "<prompt string>" } (top-level "result" = string, bukan object)
async function image2prompt(imageBuffer) {
  const result = await postMayzaaJson(`${MAYZAA_IMAGE_BASE}/image2prompt`, imageBuffer);
  const prompt = typeof result === "string" ? result : result?.text || result?.prompt;
  if (!prompt || !String(prompt).trim()) {
    throw new Error("Image2Prompt: prompt gak ada di response.");
  }
  return { type: "text", data: String(prompt).trim() };
}

// ── IMG2IMG (edit pake prompt) ──────────────────────────────────
// Output: { type: "image", data: Buffer, url: result_url }
// Response mayzaa: { result: { original_url, result_url, prompt_used } }
async function img2img(imageBuffer, prompt) {
  if (!prompt || !prompt.trim()) {
    throw new Error(
      "Img2Img butuh prompt. Contoh: kirim foto + caption *.img2img ubah jadi gaya anime*"
    );
  }

  const result = await postMayzaaJson(`${MAYZAA_IMAGE_BASE}/img2img`, imageBuffer, {
    prompt: prompt.trim(),
  });
  const url = result?.result_url;
  if (!url) throw new Error("Img2Img: result_url gak ada di response.");

  const buffer = await downloadImageBuffer(url);
  return { type: "image", data: buffer, url };
}

module.exports = {
  removeBg,
  topixel,
  toSketch,
  hitamkan,
  enhancer,
  image2prompt,
  img2img,
};
