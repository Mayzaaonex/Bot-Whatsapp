#!/usr/bin/env node
// Usage: node ytmp3.js <youtube_url>

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';
const FORMAT = 'mp3';

let cookieJar = '';

function extractVideoId(url) {
  const m = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return m ? m[1] : null;
}

function rand() {
  return Math.random().toString().slice(2);
}

function browserHeaders(extra = {}) {
  const h = {
    'User-Agent': UA,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.8',
    'Origin': 'https://ytmp3.mobi',
    'Referer': 'https://ytmp3.mobi/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'sec-ch-ua': '"Chromium";v="154", "Brave";v="154", "Not A(Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-GPC': '1',
    ...extra
  };
  if (cookieJar) h['Cookie'] = cookieJar;
  return h;
}

async function httpGet(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: browserHeaders(),
    redirect: 'manual'
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookieJar = setCookie.split(';')[0];
  return res;
}

async function run(youtubeUrl) {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error('Invalid YouTube URL');

  // 1. Init
  const initRes = await httpGet(`https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${rand()}`);
  const initData = await initRes.json();
  if (initData.error !== 0 || !initData.convertURL) {
    throw new Error(`Init failed: ${JSON.stringify(initData)}`);
  }

  // 2. Convert (mp3)
  const convRes = await httpGet(`${initData.convertURL}&v=${videoId}&f=${FORMAT}`);
  const conv = await convRes.json();
  if (conv.error !== 0) throw new Error(`Convert failed: ${JSON.stringify(conv)}`);

  // 3. Poll
  let progress = 0;
  let attempts = 0;
  while (progress < 3 && attempts < 60) {
    await new Promise(r => setTimeout(r, 2000));
    attempts++;
    const progRes = await httpGet(conv.progressURL);
    const prog = await progRes.json();
    progress = prog.progress ?? 0;
  }
  if (progress < 3) throw new Error(`Timeout (progress=${progress})`);

  // 4. Redirect — ambil URL final
  const redirRes = await httpGet(conv.downloadURL);
  let finalUrl = conv.downloadURL;
  if ([301, 302, 303, 307, 308].includes(redirRes.status)) {
    finalUrl = redirRes.headers.get('location');
    if (!finalUrl) throw new Error('No Location header');
  }

  return {
    status: true,
    url: youtubeUrl,
    videoId,
    title: conv.title,
    format: FORMAT,
    downloadUrl: finalUrl
  };
}

// ============================================================
// CLI — PURE JSON, PRETTY PRINT
// ============================================================
(async () => {
  const url = process.argv[2];

  let result;
  try {
    if (!url) throw new Error('Missing YouTube URL');
    result = await run(url);
  } catch (err) {
    result = { status: false, error: err.message, url: url || null };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
})();