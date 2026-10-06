const QRCode = require('qrcode');
const credit = { creator: 'Mayzaa' };

async function qrgenerator(text) {
    try {
        if (!text) {
            return { ...credit, status: false, message: 'Parameter text atau url wajib diisi' };
        }

        const qrBuffer = await QRCode.toBuffer(text, {
            type: 'png',
            width: 512,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        });

        return { ...credit, status: true, buffer: qrBuffer };
    } catch (error) {
        console.error('[qrgenerator]', error.message);
        return { ...credit, status: false, message: error.message };
    }
}

module.exports = { qrgenerator };
