const axios = require('axios');
const FormData = require('form-data');
const credit = { creator: 'Mayzaa' };

function generateRandomIP() {
    const r = () => Math.floor(Math.random() * 254) + 1;
    return `${r()}.${r()}.${r()}.${r()}`;
}

async function downloadPinterest(pinUrl) {
    const apiUrl = 'https://pintsave.net/api/fetch-media';
    const randomIp = generateRandomIP();
    const form = new FormData();
    form.append('url', pinUrl);

    try {
        const response = await axios.post(apiUrl, form, {
            headers: {
                ...form.getHeaders(),
                'Host': 'pintsave.net',
                'Origin': 'https://pintsave.net',
                'Referer': 'https://pintsave.net/id/download',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
                'X-Client-Ipv4': randomIp,
                'X-Forwarded-For': randomIp
            },
            timeout: 30000
        });

        const resData = response.data;

        if (resData && resData.media) {
            return {
                status: true,
                ip_used: randomIp,
                title: resData.title || null,
                description: resData.description || null,
                author: resData.creator_username || null,
                statistics: {
                    likes: resData.reaction_counts?.likes || 0,
                    comments: resData.reaction_counts?.comments || 0
                },
                media: resData.media.map(item => ({
                    url: item.url,
                    type: item.type,
                    quality: item.quality || null,
                    thumbnail: item.thumbnail || null
                }))
            };
        } else {
            return {
                status: false,
                message: 'Gagal mendapatkan data media. Pastikan URL Pinterest benar.',
                raw: resData
            };
        }

    } catch (error) {
        return {
            status: false,
            message: error.message,
            error_details: error.response ? error.response.data : null
        };
    }
}

const pinterest = async (req, res) => {
    try {
        const url = req.query.url || '';
        if (!url) {
            return res.json({ ...credit, status: false, message: 'Parameter url wajib diisi' });
        }

        // Validasi URL Pinterest
        const pinRegex = /^(https?:\/\/)?(www\.)?(pinterest\.com|pin\.it)\//i;
        if (!pinRegex.test(url)) {
            return res.json({ ...credit, status: false, message: 'URL Pinterest tidak valid' });
        }

        const result = await downloadPinterest(url);

        if (!result.status) {
            return res.json({ ...credit, status: false, message: result.message });
        }

        res.json({
            ...credit,
            status: true,
            result: {
                title: result.title,
                description: result.description,
                author: result.author,
                statistics: result.statistics,
                media: result.media,
                source: url
            }
        });

    } catch (error) {
        res.json({ ...credit, status: false, message: error.message });
    }
};

module.exports = { pinterest };

if (require.main === module) {
    const url = process.argv[2];
    if (!url) {
        process.stdout.write(JSON.stringify({ status: false, message: "Missing URL argument" }) + "\n");
        process.exitCode = 1;
    } else {
        pinterest({ query: { url } }, { json: (result) => {
            process.stdout.write(JSON.stringify(result) + "\n");
            if (!result?.status) process.exitCode = 1;
        } }).catch((error) => {
            process.stdout.write(JSON.stringify({ status: false, message: error.message }) + "\n");
            process.exitCode = 1;
        });
    }
}