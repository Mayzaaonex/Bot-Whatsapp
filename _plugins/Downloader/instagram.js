const { io } = require('socket.io-client');
const credit = { creator: 'Mayzaa' };

const IQSAVED_BASE = 'https://iqsaved.com';
const CDN_VIDEO = 'https://cdn.iqsaved.com/img.php';
const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

let cookieJar = {};

function parseCookies(res) {
    const raw = res.headers.get('set-cookie');
    if (!raw) return;
    const parts = raw.split(/,(?=[^;]+=)/);
    for (const part of parts) {
        const [pair] = part.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) {
            const name = pair.slice(0, idx).trim();
            const value = pair.slice(idx + 1).trim();
            if (name && value) cookieJar[name] = value;
        }
    }
}

function cookieHeader() {
    return Object.entries(cookieJar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

async function getSession() {
    const res = await fetch(`${IQSAVED_BASE}/en1/`, {
        headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': UA,
        },
    });
    parseCookies(res);
    return cookieHeader();
}

function extractShortcode(url) {
    const m = url.match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
}

async function getToken(igUrl) {
    const shortcode = extractShortcode(igUrl);
    const res = await fetch(`${IQSAVED_BASE}/connect/`, {
        headers: {
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
            referer: `${IQSAVED_BASE}/download-reels/${shortcode}/`,
            'user-agent': UA,
            cookie: cookieHeader(),
        },
    });

    if (!res.ok) throw new Error(`Connect gagal: HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.token) throw new Error('Token tidak ditemukan');
    return data.token;
}

async function fetchFromIqsaved(igUrl, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const shortcode = extractShortcode(igUrl);
        if (!shortcode) {
            return reject(new Error('URL Instagram tidak valid'));
        }

        const socket = io(IQSAVED_BASE, {
            path: '/socket.io/',
            transports: ['polling', 'websocket'],
            extraHeaders: {
                'user-agent': UA,
                cookie: cookieHeader(),
                origin: IQSAVED_BASE,
                referer: `${IQSAVED_BASE}/download-reels/${shortcode}/`,
            },
            reconnection: false,
            timeout: 15000,
        });

        let resolved = false;

        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                socket.close();
                reject(new Error('Timeout menunggu searchResult'));
            }
        }, timeoutMs);

        socket.on('connect', async () => {
            try {
                const token = await getToken(igUrl);
                socket.emit('search', {
                    date: Date.now(),
                    token,
                    requestType: '2',
                    serverType: 'link',
                    linkValue: igUrl,
                });
            } catch (err) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    socket.close();
                    reject(err);
                }
            }
        });

        socket.on('searchResult', (payload) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            socket.close();
            resolve(payload);
        });

        socket.on('connect_error', (err) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                socket.close();
                reject(new Error(`Socket error: ${err.message}`));
            }
        });
    });
}

function buildCdnUrl(cdnBase, value) {
    if (!value || typeof value !== 'string') return null;

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (value.startsWith('img.php?') || value.startsWith('img2.php?')) {
        return `https://cdn.iqsaved.com/${value}`;
    }

    const looksAlreadyEncoded = /%[0-9A-Fa-f]{2}/.test(value);
    if (looksAlreadyEncoded) {
        return `${cdnBase}?url=${value}`;
    }

    return `${cdnBase}?url=${encodeURIComponent(value)}`;
}

function parseSearchResult(payload) {
    const data = payload?.data;
    if (!data || data.status !== 'success') {
        throw new Error(data?.message || 'Response tidak success');
    }

    const inner = data.data;
    const items = inner?.items || [];

    const result = {
        author: {
            username: inner?.username || null,
            avatar: inner?.avatarSrc || null,
        },
        caption: inner?.text || null,
        stats: {
            likes: inner?.countLikes || 0,
            comments: inner?.countComments || 0,
            views: inner?.countViews || null,
        },
        media: [],
    };

    for (const item of items) {
        const dl = item?.downloadLink?.[0];
        if (!dl?.value || !dl?.filename) continue;

        const videoUrl = buildCdnUrl(CDN_VIDEO, dl.value);
        const thumbnailUrl = buildCdnUrl(CDN_VIDEO, item.imageSrc);

        result.media.push({
            type: item.type || 'video',
            thumbnail: thumbnailUrl,
            url: videoUrl,
            filename: dl.filename,
        });
    }

    if (result.media.length === 0) {
        throw new Error('Tidak ada media yang bisa di-download');
    }

    return result;
}


const instagram = async (req, res) => {
    try {
        const url = (req.query.url || req.body?.url || '').toString();
        if (!url) {
            return res.json({ ...credit, status: false, message: 'Parameter url wajib diisi' });
        }

        const igRegex = /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\//i;
        if (!igRegex.test(url)) {
            return res.json({ ...credit, status: false, message: 'URL Instagram tidak valid' });
        }

        await getSession();
        const payload = await fetchFromIqsaved(url);
        const parsed = parseSearchResult(payload);

        const type = url.includes('/reel/') ? 'reel' : url.includes('/tv/') ? 'igtv' : 'post';
        const firstMedia = parsed.media[0];

        return res.json({
            ...credit,
            status: true,
            result: {
                url,
                platform: 'instagram',
                type,
                author: parsed.author,
                caption: parsed.caption,
                stats: parsed.stats,
                media: parsed.media,
                video: firstMedia?.type === 'video' ? firstMedia.url : null,
                image: firstMedia?.type !== 'video' ? firstMedia.url : null,
                thumbnail: firstMedia?.thumbnail || null,
                download_url: firstMedia?.url || null,
            },
        });

    } catch (error) {
        console.error('[instagram]', error.message);
        return res.json({ ...credit, status: false, message: error.message });
    }
};

module.exports = { instagram };

if (require.main === module) {
    const url = process.argv[2];
    if (!url) {
        process.stdout.write(JSON.stringify({ status: false, message: "Missing URL argument" }) + "\n");
        process.exitCode = 1;
    } else {
        instagram({ query: { url }, body: {} }, { json: (result) => {
            process.stdout.write(JSON.stringify(result) + "\n");
            if (!result?.status) process.exitCode = 1;
        } }).catch((error) => {
            process.stdout.write(JSON.stringify({ status: false, message: error.message }) + "\n");
            process.exitCode = 1;
        });
    }
}