const https  = require("https");
const http   = require("http");
const fs     = require("fs");
const path   = require("path");

const { TEMP_DIR, ensureTempDir } = require("../systemconverter/tempDir");
const { videoToAnimatedWebp, getFfmpegPath } = require("../systemconverter/ffmpeg");
const { addStickerMeta }          = require("../systemconverter/stickerMeta");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

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
    const priorityKeys = ["url", "link", "result", "data", "image", "video", "webp", "sticker"];
    for (const key of priorityKeys) {
      if (key in obj) {
        const found = findUrlInJson(obj[key], depth + 1);
        if (found) return found;
      }
    }

    for (const key of Object.keys(obj)) {
      if (priorityKeys.includes(key)) continue;
      const found = findUrlInJson(obj[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

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

function writeTmp(buffer, ext) {
  ensureTempDir();
  const filePath = path.join(
    TEMP_DIR,
    `maker-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  );
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function cleanup(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  }
}

async function makeBrat(text) {
  const encoded = encodeURIComponent(text);
  const url = `https://api.mayzaa.my.id/mayzaa/maker/brat?text=${encoded}`;

  return fetchBuffer(url);
}

async function makeBratVid(text) {
  const encoded = encodeURIComponent(text);
  const url = `https://api.mayzaa.my.id/mayzaa/maker/bratvid?text=${encoded}`;
  const vidBuffer = await fetchBuffer(url);
  const inputPath = writeTmp(vidBuffer, ".mp4");
  let outputPath;
  try {
    outputPath = await videoToAnimatedWebp(inputPath, {
      fps: 15,
      maxDuration: 6,
      ffmpegPath: getFfmpegPath(),
    });

    const webpBuffer  = fs.readFileSync(outputPath);
    const finalBuffer = addStickerMeta(webpBuffer);
    fs.writeFileSync(outputPath, finalBuffer);
    return outputPath;
  } finally {
    cleanup(inputPath);
  }
}

module.exports = { makeBrat, makeBratVid };