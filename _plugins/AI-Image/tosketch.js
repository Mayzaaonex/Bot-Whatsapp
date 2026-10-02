const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const credit = { creator: 'Mayza' };

const toSketch = async (req, res) => {
    try {
        if (!req.files?.file) {
            return res.json({ ...credit, status: false, message: 'File wajib diupload' });
        }

        const file = req.files.file;
        const BASE = 'https://artyde.com';
        const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36';
        const uploadFields = ['file', 'image', 'img', 'photo', 'source_image', 'upload'];
        let uploaded = null;

        for (const field of uploadFields) {
            const form = new FormData();
            form.append(field, file.data, { filename: file.name, contentType: file.mimetype });

            try {
                const result = await axios.post(`${BASE}/upload_photoToSketch_website`, form, {
                    headers: {
                        ...form.getHeaders(),
                        'User-Agent': UA,
                        'Origin': BASE,
                        'Referer': `${BASE}/photo_to_sketch`
                    },
                    timeout: 30000
                });

                if (result.data?.status === 'success' && result.data?.file_id) {
                    uploaded = result.data;
                    break;
                }
            } catch (e) {}
        }

        if (!uploaded) throw new Error('Upload gagal');

        const fileId = uploaded.file_id;
        const outputName = fileId.replace(/\.[^.]+$/, '.png');
        const outputUrl = `${BASE}/output/${outputName}`;

        let done = false;
        for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const headRes = await axios.head(outputUrl, {
                    headers: { 'User-Agent': UA, 'Referer': `${BASE}/` },
                    timeout: 10000
                });
                if (headRes.status === 200) {
                    done = true;
                    break;
                }
            } catch (e) {}
        }

        if (!done) throw new Error('Timeout menunggu hasil');

        res.json({ ...credit, status: true, result: { output_url: outputUrl, file_id: fileId } });

    } catch (error) {
        res.json({ ...credit, status: false, message: error.message });
    }
};

module.exports = { toSketch };