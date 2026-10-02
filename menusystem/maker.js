// ============================================================
//  SYSTEM / MAKER — brat (sticker statis) & bratvid (sticker gerak)
// ============================================================

const https  = require("https");
const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const os     = require("os");

const { TEMP_DIR, ensureTempDir } = require("../systemconverter/tempDir");
const { videoToAnimatedWebp }     = require("../systemconverter/ffmpeg");
const { addStickerMeta }          = require("../systemconverter/stickerMeta");

// ── User-Agent biar API gak nolak request ───────────────────
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

// ── Path ffmpeg: Windows → C:\ffmpeg\bin, VPS/Linux → PATH ─
function getFfmpegPath() {
  if (os.platform() === "win32") {
    const win = "C:\\ffmpeg\\bin\\ffmpeg.exe";
    if (fs.existsSync(win)) return win;
  }
  return "ffmpeg";
}

// ── GET mentah → { buffer, contentType }, ikutin redirect ───
// Selalu pakai GET + User-Agent (banyak API nolak request tanpa UA).
function rawGet(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const opts = {
      method: "GET",
      headers: {
        "User-Agent": UA,
        "Accept": "*/*",
      },
    };
    const client = url.startsWith("https") ? https : http;

    const req = client.get(url, opts, (res) => {
      if (
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        res.resume();
        const nextUrl = new URL(res.headers.location, url).toString();
        return rawGet(nextUrl, redirectsLeft - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Request gagal HTTP ${res.statusCode}: ${url}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: (res.headers["content-type"] || "").toLowerCase(),
        })
      );
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error(`Timeout ambil data: ${url}`)));
  });
}

// ── Cari URL gambar/video di dalam objek JSON hasil API ─────
// Endpoint kayak gini biasanya balikin JSON, bukan file langsung, contoh:
//   { status: true, result: { url: "https://..." } }
//   { status: true, data: "https://..." }
//   { url: "https://..." }
// Jadi kita cari field bernama url/link/result/data/image/video secara
// rekursif, ambil string pertama yang keliatan kayak URL http(s).
function findUrlInJson(obj, depth = 0) {
  if (depth > 4 || obj == null) return null;
  if (typeof obj === "string") {
    return /^https?:\/\//i.test(obj) ? obj : null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findUrlInJson(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj === "object") {
    // prioritaskan nama field yang umum dipakai
    const priorityKeys = ["url", "link", "result", "data", "image", "video", "webp", "sticker"];
    for (const key of priorityKeys) {
      if (key in obj) {
        const found = findUrlInJson(obj[key], depth + 1);
        if (found) return found;
      }
    }
    // fallback: cek semua field lain
    for (const key of Object.keys(obj)) {
      if (priorityKeys.includes(key)) continue;
      const found = findUrlInJson(obj[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// ── Download URL → Buffer gambar/video final ─────────────────
// Auto-detect: kalau API balikin JSON (bukan file langsung), extract
// URL hasil dari JSON-nya lalu di-GET ulang (masih pakai UA yang sama).
async function fetchBuffer(url) {
  const first = await rawGet(url);
  const looksLikeJson =
    first.contentType.includes("application/json") ||
    (!first.contentType.includes("image") &&
      !first.contentType.includes("video") &&
      !first.contentType.includes("octet-stream") &&
      /^\s*[{[]/.test(first.buffer.slice(0, 20).toString("utf8")));

  if (!looksLikeJson) {
    return first.buffer;
  }

  let json;
  try {
    json = JSON.parse(first.buffer.toString("utf8"));
  } catch {
    // bukan JSON valid meskipun keliatan kayak JSON — anggap ini file asli
    return first.buffer;
  }

  if (json && json.status === false) {
    throw new Error(`API error: ${json.message || json.msg || "gagal generate"}`);
  }

  const resultUrl = findUrlInJson(json);
  if (!resultUrl) {
    throw new Error("API balikin JSON tapi gak ketemu URL hasilnya (cek format respons API).");
  }

  const second = await rawGet(resultUrl);
  return second.buffer;
}

// ── Tulis buffer ke file tmp, return path ───────────────────
function writeTmp(buffer, ext) {
  ensureTempDir();
  const filePath = path.join(
    TEMP_DIR,
    `maker-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  );
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// ── Hapus file tmp (best effort) ────────────────────────────
function cleanup(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  }
}

// ============================================================
//  brat — sticker statis
// ============================================================
async function makeBrat(text) {
  const encoded = encodeURIComponent(text);
  const url = `https://api.mayzaa.my.id/mayzaa/maker/brat?text=${encoded}`;
  // Cukup return raw buffer dari API — konversi ke webp + inject EXIF
  // dilakukan di handler .brat pakai pipeline yang sama dengan .s/.stiker
  return fetchBuffer(url);
}

// ============================================================
//  bratvid — animated sticker
// ============================================================
async function makeBratVid(text) {
  const encoded = encodeURIComponent(text);
  const url = `https://api.mayzaa.my.id/mayzaa/maker/bratvid?text=${encoded}`;
  const vidBuffer = await fetchBuffer(url); // direct mp4 + UA, fetchBuffer handle redirect/JSON fallback
  const inputPath = writeTmp(vidBuffer, ".mp4");
  let outputPath;
  try {
    outputPath = await videoToAnimatedWebp(inputPath, {
      fps: 15,
      maxDuration: 6,
      ffmpegPath: getFfmpegPath(),
    });
    // Baca, inject EXIF, tulis ulang
    const webpBuffer  = fs.readFileSync(outputPath);
    const finalBuffer = addStickerMeta(webpBuffer);
    fs.writeFileSync(outputPath, finalBuffer);
    return outputPath;
  } finally {
    cleanup(inputPath);
  }
}

module.exports = { makeBrat, makeBratVid };
