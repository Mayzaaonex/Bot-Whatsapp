const axios = require('axios');
const path = require('path');
const credit = { creator: 'Mayza' };

function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.webp': 'image/webp',
        '.gif': 'image/gif', '.bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'image/jpeg';
}

const image2prompt = async (req, res) => {
    try {
        if (!req.files?.file) {
            return res.json({ ...credit, status: false, message: 'File wajib diupload (POST multipart/form-data)' });
        }

        const file = req.files.file;
        const base64 = file.data.toString('base64');
        const mimeType = getMimeType(file.name);

        const submitRes = await axios.post('https://aiconvert.online/api/submit-prompt-job', {
            imageData: base64,
            mimeType,
            language: 'en',
            promptType: 'concise'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
                'Referer': 'https://aiconvert.online/prompt-generator'
            },
            timeout: 30000
        });

        const taskId = submitRes.data?.taskId;
        if (!taskId) throw new Error(submitRes.data?.message || 'Gagal submit gambar');

        let prompt = null;
        for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await axios.get(`https://aiconvert.online/api/check-status-kv?taskId=${taskId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
                    'Referer': 'https://aiconvert.online/prompt-generator'
                },
                timeout: 10000
            });

            if (statusRes.data?.status === 'SUCCESS' && statusRes.data?.result?.generatedPrompt) {
                prompt = statusRes.data.result.generatedPrompt;
                break;
            }
        }

        if (!prompt) throw new Error('Waktu habis, prompt tidak kunjung selesai');

        res.json({ ...credit, status: true, task_id: taskId, input: file.name, result: prompt });

    } catch (error) {
        res.json({ ...credit, status: false, message: error.message });
    }
};

module.exports = { image2prompt };