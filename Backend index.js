require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const vision = require('@google-cloud/vision');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

// Configure clients / env
const visionClient = new vision.ImageAnnotatorClient(); // uses GOOGLE_APPLICATION_CREDENTIALS
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-1.0'; // adjust if needed

if (!GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY not set. Gemini calls will likely fail.');
}

function parseDataUrl(dataUrl) {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error('Invalid data URL');
  return Buffer.from(m[2], 'base64');
}

app.post('/', async (req, res) => {
  try {
    const { imageURL } = req.body;
    if (!imageURL) return res.status(400).json({ error: 'imageURL required' });

    // Decode image
    const imageBuffer = parseDataUrl(imageURL);

    // 1) Run Vision API: labels and object localization
    const [labelResp] = await visionClient.labelDetection({ image: { content: imageBuffer } });
    const labels = (labelResp.labelAnnotations || []).map(l => ({
      description: l.description,
      score: l.score
    }));

    const [objResp] = await visionClient.objectLocalization({ image: { content: imageBuffer } });
    const objects = (objResp.localizedObjectAnnotations || []).map(o => ({
      name: o.name,
      score: o.score
    }));

    // Build a concise context for Gemini
    const visionSummary = [
      'Labels:',
      ...labels.slice(0, 6).map(l => `${l.description} (${(l.score*100).toFixed(0)}%)`),
      'Objects:',
      ...objects.slice(0, 6).map(o => `${o.name} (${(o.score*100).toFixed(0)}%)`)
    ].join('\n');

    const prompt = `
You are an assistant that must decide whether an image contains a threat.
Do NOT hallucinate beyond the provided vision detections.
Context (vision detections):
${visionSummary}

Question: Is there a threat in this image? If yes, what kind of threat (e.g., firearm, knife, explosive, suspicious behavior)? Provide a short JSON response with these keys:
{ "threat": "yes" | "no", "type": "<short label or 'unknown'>", "confidence_estimate": "<low|medium|high>", "explanation": "<one-sentence explanation>" }

Answer only with the JSON.
`;

    // 2) Send prompt to Gemini (Generative Language REST)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generate?key=${GEMINI_API_KEY}`;

    const geminiBody = {
      prompt: { text: prompt },
      temperature: 0.0,
      maxOutputTokens: 200
    };

    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    });

    if (!geminiResp.ok) {
      const text = await geminiResp.text();
      console.error('Gemini error:', geminiResp.status, text);
      return res.status(500).json({ error: 'Gemini request failed', details: text });
    }

    const geminiJson = await geminiResp.json();

    // Extract text output from likely response shapes
    let answerText = '';
    if (geminiJson.candidates && geminiJson.candidates[0] && geminiJson.candidates[0].output) {
      answerText = geminiJson.candidates[0].output;
    } else if (geminiJson.choices && geminiJson.choices[0] && geminiJson.choices[0].message) {
      answerText = geminiJson.choices[0].message.content || '';
    } else if (typeof geminiJson.output === 'string') {
      answerText = geminiJson.output;
    } else {
      answerText = JSON.stringify(geminiJson);
    }

    // Return a simple description string the frontend expects
    res.json({ description: answerText.trim(), vision: { labels, objects } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));

