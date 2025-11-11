require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const vision = require('@google-cloud/vision');
// dynamic import adapter for node-fetch so this file stays CommonJS-compatible
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '12mb' }));

const visionClient = new vision.ImageAnnotatorClient(); // requires GOOGLE_APPLICATION_CREDENTIALS
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-1.0';

function parseDataUrl(dataUrl) {
    const m = typeof dataUrl === 'string' && dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!m) throw new Error('Invalid data URL');
    return Buffer.from(m[2], 'base64');
}

function simpleWeaponHeuristic(labels, objects) {
    const keywords = ['gun','firearm','pistol','rifle','knife','blade','explosive','bomb','grenade'];
    const all = [...labels.map(l => l.toLowerCase()), ...objects.map(o => o.toLowerCase())].join(' ');
    for (const k of keywords) {
        if (all.includes(k)) {
            return { threat: 'yes', type: k, confidence_estimate: 'medium', explanation: `Detected keyword "${k}" in vision results.` };
        }
    }
    return { threat: 'no', type: 'none', confidence_estimate: 'low', explanation: 'No weapon-related keywords detected.' };
}

app.post('/', async (req, res) => {
    try {
        const { imageURL } = req.body;
        if (!imageURL) return res.status(400).json({ error: 'imageURL required' });

        const imageBuffer = parseDataUrl(imageURL);

        // Vision label detection
        const [labelResp] = await visionClient.labelDetection({ image: { content: imageBuffer } });
        const labels = (labelResp.labelAnnotations || []).map(l => String(l.description || '').toLowerCase());

        // Object localization (may be empty depending on image)
        let objects = [];
        try {
            const [objResp] = await visionClient.objectLocalization({ image: { content: imageBuffer } });
            objects = (objResp.localizedObjectAnnotations || []).map(o => String(o.name || '').toLowerCase());
        } catch (e) {
            // objectLocalization may not be available or fail; continue with labels
            console.warn('object localization failed:', e && e.message);
        }

        let descriptionText = '';

        if (GEMINI_API_KEY) {
            const visionSummary = [
                'Labels: ' + labels.slice(0,6).join(', '),
                'Objects: ' + objects.slice(0,6).join(', ')
            ].join('\n');

            const prompt = `You are an assistant. Based on the vision detections below, answer with a short JSON:
${visionSummary}

Question: Is there a threat in this image? If yes, what kind of threat?
Return JSON: { "threat": "yes"|"no", "type": "<label or unknown>", "confidence_estimate": "<low|medium|high>", "explanation": "<one-sentence>" }`;

            const body = {
                prompt: { text: prompt },
                temperature: 0.0,
                maxOutputTokens: 200
            };

            const geminiResp = await fetch(`https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generate?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!geminiResp.ok) {
                const text = await geminiResp.text();
                console.error('Gemini call failed:', geminiResp.status, text);
                descriptionText = `Gemini error: ${geminiResp.status}`;
            } else {
                const geminiJson = await geminiResp.json();
                // extract likely text fields
                let out = '';
                if (Array.isArray(geminiJson.candidates) && geminiJson.candidates[0] && geminiJson.candidates[0].output) {
                    out = geminiJson.candidates[0].output;
                } else if (typeof geminiJson.output === 'string') {
                    out = geminiJson.output;
                } else {
                    out = JSON.stringify(geminiJson);
                }
                descriptionText = out.trim();
            }
        } else {
            // fallback heuristic
            const heuristic = simpleWeaponHeuristic(labels, objects);
            descriptionText = JSON.stringify(heuristic);
        }

        return res.json({ description: descriptionText, vision: { labels, objects } });
    } catch (err) {
        console.error('Backend error:', err && err.stack ? err.stack : err);
        return res.status(500).json({ error: err.message || 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));

