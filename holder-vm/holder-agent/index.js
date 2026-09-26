import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

// Minimal dev stub for pack/unpack so other services can talk to a local agent.
// This is intentionally simple and NOT suitable for production.

const app = express();
app.use(cors());
// Parse JSON bodies first so API endpoints receive objects.
app.use(bodyParser.json());
// Fallback text parser for DIDComm encrypted payloads or other non-JSON bodies
app.use(bodyParser.text({ type: '*/*' }));

// /unpack: accepts a packed DIDComm-like object and returns a simple "unpacked" wrapper
app.post('/unpack', async (req, res) => {
  try {
    const packed = req.body;
    const parsed = typeof packed === 'string' ? JSON.parse(packed) : packed;
    // For dev: if parsed has a 'message' field, echo it; otherwise wrap the body
    const message = parsed?.message || parsed;
    // Simulate async decryption
    await new Promise((r) => setTimeout(r, 10));
    res.json({ message });
  } catch (e) {
    res.status(400).json({ error: 'invalid request', details: e.message });
  }
});

// /pack: accepts {message,to,from} and returns a "packed" placeholder object
app.post('/pack', async (req, res) => {
  try {
    const { message, to, from } = req.body;
    // Log incoming pack request for debugging
    console.log('[holder-agent] /pack received body:', req.body);

    const missing = [];
    if (!message) missing.push('message');
    if (!to) missing.push('to');
    if (!from) missing.push('from');
    if (missing.length > 0) {
      console.warn('[holder-agent] /pack missing fields:', missing.join(', '));
      return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}`, received: req.body });
    }

    // Simulate packing by returning an object that the mediator will forward
    const packed = { from, to, message, meta: { devPacked: true, timestamp: Date.now() } };
    await new Promise((r) => setTimeout(r, 10));
    console.log('[holder-agent] /pack returning packed message');
    res.json(packed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`[holder-agent] dev stub listening on http://localhost:${PORT}`));
