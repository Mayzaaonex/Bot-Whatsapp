const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const credit = { creator: 'Mayzaa' };

const isValidUrl = (url) => {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipPattern.test(hostname)) {
            const octets = hostname.split('.').map(Number);
            if (octets[0] === 169 && octets[1] === 254) return false;
            if (octets[0] === 10 || octets[0] === 127 || octets[0] === 0) return false;
            if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
            if (octets[0] === 192 && octets[1] === 168) return false;
        }
        if (hostname.includes('localhost') || hostname.includes('metadata.google.internal') || hostname.includes('169.254.169.254')) return false;
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch { return false; }
};

const sanitizeError = (error) => {
    const msg = error.message || '';
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) return 'Failed to connect to target';
    if (msg.includes(' certificate') || msg.includes('SSL')) return 'SSL error';
    return 'Internal error';
};

async function removebg(imageUrl) {
    try {
        if (!imageUrl) {
            return { ...credit, status: false, message: 'Parameter url wajib diisi' };
        }

        if (!isValidUrl(imageUrl)) {
            return { ...credit, status: false, message: 'URL tidak valid atau tidak diizinkan' };
        }

        // Remove background
        const deviceId = crypto.randomBytes(8).toString('hex');
        const resultRes = await axios.post('https://www.dreamai.art/api/background-remover', {
            images: [imageUrl]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
                'Origin': 'https://www.dreamai.art',
                'Referer': 'https://www.dreamai.art/en/ai-background-remover',
                'X-Device-Id': deviceId
            },
            timeout: 30000
        });

        if (!resultRes.data?.success) throw new Error('Remove background gagal');

        const imgRes = await axios.get(resultRes.data.processedImage, {
            responseType: 'arraybuffer',
            timeout: 30000
        });

        return { ...credit, status: true, buffer: imgRes.data };

    } catch (error) {
        return { ...credit, status: false, message: sanitizeError(error) };
    }
}

module.exports = { removebg };
