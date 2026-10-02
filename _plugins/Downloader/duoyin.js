const axios = require('axios');
const credit = { creator: 'Mayzaa' };

class DouyinDownloader {
    constructor() {
        this.baseUrl = 'https://snaptik.fi';
        this.endpoint = '/api/tiktok';
        this.headers = {
            'Content-Type': 'application/json',
            'Origin': this.baseUrl,
            'Referer': `${this.baseUrl}/id/douyin-story-downloader`,
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'Sec-Ch-Ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"'
        };
    }

    async download(url) {
        try {
            const response = await axios.post(
                `${this.baseUrl}${this.endpoint}`,
                { url: url },
                { headers: this.headers, timeout: 30000 }
            );

            const data = response.data;

            if (!data || data.status !== 'tunnel') {
                throw new Error(`Gagal memproses video. Status: ${data?.status || 'unknown'}`);
            }

            return {
                status: true,
                title: data.title || 'No Title',
                description: data.description || '',
                artist: data.artist || 'Unknown',
                duration: data.duration ? `${Math.floor(data.duration / 1000)}s` : 'N/A',
                cover: data.cover || null,
                audio: data.audio || null,
                download_link: data.download_link || null,
                statistics: data.statistics || {},
                source: data.extract_source || 'web'
            };
        } catch (err) {
            console.error('[!] Error:', err.response?.data || err.message);
            return {
                status: false,
                message: err.response?.data?.message || err.message
            };
        }
    }
}

const douyin = async (req, res) => {
    try {
        const url = req.query.url || '';
        if (!url) {
            return res.json({ ...credit, status: false, message: 'Parameter url wajib diisi' });
        }


        const douyinRegex = /^(https?:\/\/)?(www\.)?(douyin\.com|v\.douyin\.com)\//i;
        if (!douyinRegex.test(url)) {
            return res.json({ ...credit, status: false, message: 'URL Douyin tidak valid' });
        }

        const downloader = new DouyinDownloader();
        const result = await downloader.download(url);

        if (!result.status) {
            return res.json({ ...credit, status: false, message: result.message });
        }

        res.json({
            ...credit,
            status: true,
            result: {
                title: result.title,
                description: result.description,
                artist: result.artist,
                duration: result.duration,
                cover: result.cover,
                audio: result.audio,
                download_link: result.download_link,
                statistics: result.statistics,
                source: result.source
            }
        });

    } catch (error) {
        res.json({ ...credit, status: false, message: error.message });
    }
};

module.exports = { douyin };

if (require.main === module) {
    const url = process.argv[2];
    if (!url) {
        process.stdout.write(JSON.stringify({ status: false, message: "Missing URL argument" }) + "\n");
        process.exitCode = 1;
    } else {
        douyin({ query: { url } }, { json: (result) => {
            process.stdout.write(JSON.stringify(result) + "\n");
            if (!result?.status) process.exitCode = 1;
        } }).catch((error) => {
            process.stdout.write(JSON.stringify({ status: false, message: error.message }) + "\n");
            process.exitCode = 1;
        });
    }
}