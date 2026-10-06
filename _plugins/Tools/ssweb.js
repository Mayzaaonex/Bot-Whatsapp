const axios = require('axios');
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

async function ssweb(targetUrl, device = 'desktop') {
    try {
        if (!targetUrl) {
            return { ...credit, status: false, message: 'Parameter url wajib diisi' };
        }

        if (!isValidUrl(targetUrl)) {
            return { ...credit, status: false, message: 'URL tidak valid atau tidak diizinkan' };
        }

        const allowedDevices = ['desktop', 'tablet', 'mobile'];
        if (!allowedDevices.includes(device)) {
            return { ...credit, status: false, message: 'Device tidak valid. Pilih: ' + allowedDevices.join(', ') };
        }

        const deviceConfig = {
            desktop: { width: 1920, height: 1080 },
            tablet: { width: 768, height: 1024 },
            mobile: { width: 393, height: 852 }
        };

        const { width, height } = deviceConfig[device];
        const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&meta=false&screenshot.type=png&screenshot.fullPage=false&viewport.width=${width}&viewport.height=${height}&adblock=true&force=false`;

        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            },
            timeout: 30000
        });

        if (response.data?.status === 'success' && response.data?.data?.screenshot) {
            return {
                ...credit,
                status: true,
                result: {
                    target_url: targetUrl,
                    screenshot_url: response.data.data.screenshot.url || '',
                    format: response.data.data.screenshot.type || 'png',
                    size: response.data.data.screenshot.size_pretty || '',
                    dimensions: {
                        width: response.data.data.screenshot.width || width,
                        height: response.data.data.screenshot.height || height
                    },
                    device
                }
            };
        } else {
            return { ...credit, status: false, message: 'Gagal mengambil screenshot' };
        }

    } catch (error) {
        return { ...credit, status: false, message: sanitizeError(error) };
    }
}

module.exports = { ssweb };
