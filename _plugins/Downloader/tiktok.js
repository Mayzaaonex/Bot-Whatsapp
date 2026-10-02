const axios = require('axios');
const credit = { creator: 'Mayzaa' };

function generateTT() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

function extractData(html) {
    const data = {};
    const vidMatch = html.match(/href="(https:\/\/tikcdn\.io\/ssstik\/\d+[^"]+)"\s+class="[^"]*without_watermark[^"]*vignette_active[^"]*"/);
    if (vidMatch) data.video_tanpa_watermark = vidMatch[1];
    const audMatch = html.match(/href="(https:\/\/tikcdn\.io\/ssstik\/m\/[^"]+)"\s+class="[^"]*music[^"]*"/);
    if (audMatch) data.audio_mp3 = audMatch[1];
    const capMatch = html.match(/<p class="maintext">([^<]+)<\/p>/);
    if (capMatch) data.caption = capMatch[1];
    const authMatch = html.match(/<h2>([^<]+)<\/h2>/);
    if (authMatch) data.author = authMatch[1];
    return data;
}

const tiktok = async (req, res) => {
    try {
        const url = req.query.url || '';
        if (!url) return res.json({ ...credit, status: false, message: 'Parameter url wajib diisi' });

        // Validasi URL TikTok
        const ttRegex = /^(https?:\/\/)?(www\.)?(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)\//i;
        if (!ttRegex.test(url)) {
            return res.json({ ...credit, status: false, message: 'URL TikTok tidak valid' });
        }

        const tt = generateTT();
        const response = await axios.post('https://ssstik.io/abc?url=dl',
            new URLSearchParams({ id: url, locale: 'en', tt }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'HX-Request': 'true',
                    'HX-Trigger': '_gcaptcha_pt',
                    'HX-Target': 'target',
                    'HX-Current-URL': 'https://ssstik.io/en',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Termux) AppleWebKit/537.36',
                    'Referer': 'https://ssstik.io/en'
                },
                timeout: 30000
            }
        );

        const hasil = extractData(response.data);
        if (!hasil.video_tanpa_watermark) {
            return res.json({ ...credit, status: false, message: 'Gagal mendapatkan link download' });
        }

        res.json({
            ...credit,
            status: true,
            result: {
                author: hasil.author || 'Unknown',
                caption: hasil.caption || '',
                video_url: hasil.video_tanpa_watermark,
                audio_url: hasil.audio_mp3 || null
            }
        });

    } catch (error) {
        res.json({ ...credit, status: false, message: error.message });
    }
};

module.exports = { tiktok };

if (require.main === module) {
    const url = process.argv[2];
    if (!url) {
        process.stdout.write(JSON.stringify({ status: false, message: "Missing URL argument" }) + "\n");
        process.exitCode = 1;
    } else {
        tiktok({ query: { url } }, { json: (result) => {
            process.stdout.write(JSON.stringify(result) + "\n");
            if (!result?.status) process.exitCode = 1;
        } }).catch((error) => {
            process.stdout.write(JSON.stringify({ status: false, message: error.message }) + "\n");
            process.exitCode = 1;
        });
    }
}