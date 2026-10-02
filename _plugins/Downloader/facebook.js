const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs');
const credit = { creator: 'Mayzaa' };

async function fetchFgetLinks(fbUrl) {
    try {
        const payload = qs.stringify({ id: fbUrl, locale: 'id' });
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Hx-Current-Url': 'https://fget.io/id',
            'Hx-Request': 'true',
            'Hx-Target': 'target',
            'Hx-Trigger': 'form',
            'Origin': 'https://fget.io',
            'Referer': 'https://fget.io/id'
        };

        const { data: html } = await axios.post('https://fget.io/process', payload, { headers, timeout: 30000 });
        const $ = cheerio.load(html);

        const thumbnail = $('.result-thumbnail img').attr('src') || null;
        const downloads = [];

        $('.space-y-2 .flex').each((_, el) => {
            const quality = $(el).find('.text-sm').text().trim();
            const type = $(el).find('.text-xs').text().replace(/[()]/g, '').trim();
            const url = $(el).find('a').attr('href');

            if (quality && url) {
                downloads.push({ quality, type, url });
            }
        });

        return { thumbnail, downloads };
    } catch {
        return { thumbnail: null, downloads: [] };
    }
}

async function fetchWayInMeta(fbUrl) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'Content-Type': 'application/json',
            'Origin': 'https://wayin.ai',
            'Referer': 'https://wayin.ai/',
            'X-Platform': 'web'
        };

        const parseRes = await axios.post(
            `https://wayinvideo-api.wayin.ai/api/parse_url?url=${encodeURIComponent(fbUrl)}`,
            {},
            { headers, timeout: 15000 }
        );

        const cleanVideoUrl = parseRes.data?.data || fbUrl;

        const metaRes = await axios.post(
            'https://wayinvideo-api.wayin.ai/api/p/v2/get_video_meta',
            { video_url: cleanVideoUrl },
            { headers, timeout: 15000 }
        );

        const meta = metaRes.data?.data || {};

        return {
            title: meta.title || null,
            author: meta.author || null,
            abstract: meta.abstract || null,
            duration: meta.duration ? `${Math.floor(meta.duration / 1000)}s` : null,
            view_count: meta.view_count || 0,
            comment_count: meta.comment_count || 0,
            like_count: meta.like_count || 0,
            published_at: meta.published_at ? new Date(meta.published_at * 1000).toISOString() : null,
            resolution: meta.res || null
        };
    } catch {
        return null;
    }
}

async function fbDownloader(fbUrl) {
    try {
        const [fgetData, metaData] = await Promise.all([
            fetchFgetLinks(fbUrl),
            fetchWayInMeta(fbUrl)
        ]);

        if (!fgetData.downloads.length) {
            return {
                status: false,
                message: 'Gagal mengambil media download.'
            };
        }

        return {
            status: true,
            metadata: metaData || { title: 'No Metadata Available' },
            downloads: {
                thumbnail: fgetData.thumbnail,
                links: fgetData.downloads
            }
        };

    } catch (err) {
        return {
            status: false,
            message: err.message
        };
    }
}

const facebook = async (req, res) => {
    try {
        const url = req.query.url || '';
        if (!url) {
            return res.json({ ...credit, status: false, message: 'Parameter url wajib diisi' });
        }

        // Validasi URL Facebook
        const fbRegex = /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch|fb\.com)\//i;
        if (!fbRegex.test(url)) {
            return res.json({ ...credit, status: false, message: 'URL Facebook tidak valid' });
        }

        const result = await fbDownloader(url);

        if (!result.status) {
            return res.json({ ...credit, status: false, message: result.message });
        }

        res.json({
            ...credit,
            status: true,
            result: {
                metadata: result.metadata,
                thumbnail: result.downloads.thumbnail,
                downloads: result.downloads.links,
                source: url
            }
        });

    } catch (error) {
        res.json({ ...credit, status: false, message: error.message });
    }
};

module.exports = { facebook };

if (require.main === module) {
    const url = process.argv[2];
    if (!url) {
        process.stdout.write(JSON.stringify({ status: false, message: "Missing URL argument" }) + "\n");
        process.exitCode = 1;
    } else {
        facebook({ query: { url } }, { json: (result) => {
            process.stdout.write(JSON.stringify(result) + "\n");
            if (!result?.status) process.exitCode = 1;
        } }).catch((error) => {
            process.stdout.write(JSON.stringify({ status: false, message: error.message }) + "\n");
            process.exitCode = 1;
        });
    }
}