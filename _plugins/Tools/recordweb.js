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

async function recordWeb(url, device = 'desktop_fhd', scroll = true, darkMode = false) {
    try {
        if (!url) {
            return { ...credit, status: false, message: 'Parameter url wajib diisi' };
        }

        if (!isValidUrl(url)) {
            return { ...credit, status: false, message: 'URL tidak valid atau tidak diizinkan' };
        }

        const validDevices = [
            'desktop_hd', 'desktop_fhd', 'desktop_4k', 'desktop_wide',
            'laptop_13', 'laptop_15', 'macbook_air', 'macbook_pro',
            'ipad', 'ipad_pro', 'ipad_mini', 'samsung_tab',
            'iphone_se', 'iphone_14', 'iphone_14_pro', 'iphone_15_pro',
            'samsung_s24', 'pixel_8', 'xiaomi_14'
        ];
        if (!validDevices.includes(device)) {
            return { ...credit, status: false, message: 'Device tidak valid' };
        }

        const response = await axios.post('https://shinana-bentosnap.hf.space/api/record', {
            url,
            device,
            duration_ms: 8000,
            scroll,
            dark_mode: darkMode,
            wait_ms: 1000
        }, {
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 120000
        });

        return {
            ...credit,
            status: true,
            result: response.data
        };

    } catch (error) {
        return { ...credit, status: false, message: sanitizeError(error) };
    }
}

module.exports = { recordWeb };
