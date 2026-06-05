import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DID_API_KEY = process.env.DID_API_KEY;
const DID_BASE = 'https://api.d-id.com';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AVATAR_IMAGE_URL = process.env.AVATAR_IMAGE_URL; // Majed's image URL

// ─── Create D-ID Streaming Session ───────────────────────────────────────────
app.post('/api/did/session', async (req, res) => {
  try {
    const resp = await fetch(`${DID_BASE}/talks/streams`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_url: AVATAR_IMAGE_URL,
        driver_url: 'bank://lively',
        config: { stitch: true, fluent: true }
      })
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Send SDP Answer to D-ID ──────────────────────────────────────────────────
app.post('/api/did/sdp', async (req, res) => {
  const { streamId, sessionId, answer } = req.body;
  try {
    const resp = await fetch(`${DID_BASE}/talks/streams/${streamId}/sdp`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answer, session_id: sessionId })
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Send ICE Candidate to D-ID ───────────────────────────────────────────────
app.post('/api/did/ice', async (req, res) => {
  const { streamId, sessionId, candidate } = req.body;
  try {
    const resp = await fetch(`${DID_BASE}/talks/streams/${streamId}/ice`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ candidate, session_id: sessionId })
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Make Majed Speak via D-ID ────────────────────────────────────────────────
app.post('/api/did/speak', async (req, res) => {
  const { streamId, sessionId, text } = req.body;
  try {
    const resp = await fetch(`${DID_BASE}/talks/streams/${streamId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId,
        script: {
          type: 'text',
          input: text,
          provider: {
            type: 'elevenlabs',
            voice_id: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Arabic male
            voice_config: { stability: 0.55, similarity_boost: 0.80, style: 0.2, use_speaker_boost: true }
          }
        },
        config: { fluent: true, pad_audio: 0.2 }
      })
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Chat with Gemini ─────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  const systemPrompt = `أنت ماجد، المساعد الذكي لإنجوسوفت للتدريب والاستشارات.
أنت مساعد تعليمي ودود ومتخصص في المجالات الهندسية.
ترد دائماً باللغة العربية بأسلوب واضح ومشجع.
إجاباتك مختصرة ومفيدة — لا تزيد عن 3 جمل في الرد الواحد.
اسمك ماجد وتعمل لصالح شركة إنجوسوفت.`;

  try {
    const messages = [
      ...(history || []),
      { role: 'user', parts: [{ text: message }] }
    ];

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages,
          generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
        })
      }
    );
    const data = await resp.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، حدث خطأ.';
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Delete D-ID Session ──────────────────────────────────────────────────────
app.delete('/api/did/session/:streamId', async (req, res) => {
  const { streamId } = req.params;
  const { sessionId } = req.body;
  try {
    const resp = await fetch(`${DID_BASE}/talks/streams/${streamId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ session_id: sessionId })
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Majed Avatar Server running on port ${PORT}`));
