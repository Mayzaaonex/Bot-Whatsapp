/**
 * ttstalk.js
 * TikTok Profile Stalker via ttviewr.com
 * Author  : Mayzaa
 * Credit  : Mayzaa
 * Usage   : node ttstalk.js <username>
 * Example : node ttstalk.js mrbeast
 * Output  : pure JSON ke stdout + auto-save avatar & cover video ke ./<username>/
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const AUTHOR = "Mayzaa";

// ---------- Parse args ----------
const username = process.argv[2];

if (!username) {
  console.log(
    JSON.stringify(
      { success: false, author: AUTHOR, error: "No username provided" },
      null,
      2
    )
  );
  process.exit(1);
}

// ---------- Config ----------
const HOST = "ttviewr.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

// ---------- Fetch profile ----------
function fetchProfile(user) {
  return new Promise((resolve, reject) => {
    const url = `https://${HOST}/api/profile?username=${encodeURIComponent(user)}`;

    const opts = {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "User-Agent": UA,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Sec-GPC": "1",
        Connection: "keep-alive",
      },
    };

    https
      .get(url, opts, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`)
            );
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error("Response bukan JSON: " + body.slice(0, 200)));
          }
        });
      })
      .on("error", reject);
  });
}

// ---------- Download file (avatar/cover) ----------
function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        "User-Agent": UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        Referer: "https://www.tiktok.com/",
      },
    };

    https
      .get(url, opts, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          const next = res.headers.location;
          if (!next) return reject(new Error("Redirect tanpa location"));
          return downloadFile(next, outPath).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const writer = fs.createWriteStream(outPath);
        res.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      })
      .on("error", reject);
  });
}

// ---------- Extract extension dari URL ----------
function getExt(url) {
  const m = url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
  return m ? "." + m[1].toLowerCase() : ".jpg";
}

// ---------- MAIN ----------
(async () => {
  try {
    const data = await fetchProfile(username);

    if (!data.profile) {
      console.log(
        JSON.stringify(
          {
            success: false,
            author: AUTHOR,
            username,
            error: "Profile tidak ditemukan",
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    const p = data.profile;

    // ---------- Bikin folder output ----------
    const outDir = path.join(process.cwd(), p.username);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // ---------- Download avatar ----------
    let avatarFile = null;
    let avatarSize = 0;
    if (p.avatar) {
      const ext = getExt(p.avatar);
      const fileName = `avatar${ext}`;
      const filePath = path.join(outDir, fileName);
      try {
        await downloadFile(p.avatar, filePath);
        avatarFile = path.relative(process.cwd(), filePath);
        avatarSize = fs.statSync(filePath).size;
      } catch (e) {
        // silent
      }
    }

    // ---------- Download semua cover video ----------
    const videos = await Promise.all(
      (p.videos || []).map(async (v, i) => {
        let coverFile = null;
        let coverSize = 0;
        const coverUrl = v.cover || v.image;

        if (coverUrl) {
          const ext = getExt(coverUrl);
          const fileName = `${String(i + 1).padStart(2, "0")}_${v.id}${ext}`;
          const filePath = path.join(outDir, fileName);
          try {
            await downloadFile(coverUrl, filePath);
            coverFile = path.relative(process.cwd(), filePath);
            coverSize = fs.statSync(filePath).size;
          } catch (e) {
            // silent
          }
        }

        return {
          id: v.id,
          caption: v.caption,
          url: v.url,
          cover: coverUrl,
          coverFile,
          coverSize,
          coverSizeFormatted: coverSize
            ? `${(coverSize / 1024).toFixed(2)} KB`
            : null,
          image: v.image,
          publishedAt: v.publishedAt,
          likes: v.likes,
          comments: v.comments,
          shares: v.shares,
        };
      })
    );

    // ---------- OUTPUT JSON ----------
    console.log(
      JSON.stringify(
        {
          success: true,
          author: AUTHOR,
          outputDir: path.relative(process.cwd(), outDir),
          profile: {
            username: p.username,
            nickname: p.nickname,
            bio: p.bio,
            avatar: p.avatar,
            avatarFile,
            avatarSize,
            avatarSizeFormatted: avatarSize
              ? `${(avatarSize / 1024).toFixed(2)} KB`
              : null,
            verified: p.verified,
            profileUrl: p.profileUrl,
            stats: {
              followers: p.followers,
              following: p.following,
              likes: p.likes,
              videos: p.videoCount,
            },
            videos,
          },
          cached: data.cached,
          source: "ttviewr.com",
          savedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          success: false,
          author: AUTHOR,
          username,
          error: err.message,
        },
        null,
        2
      )
    );
    process.exit(1);
  }
})();