// api/chat.js — Vercel Serverless Function (CommonJS)
// Proxies DeepSeek calls server-side; validates passphrase before responding

const https = require('https');

function httpsPost(hostname, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const buf  = Buffer.from(body);
    const opts = {
      hostname, path: urlPath, method: 'POST',
      headers: { ...headers, 'Content-Length': buf.length }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Passphrase');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // ── Passphrase validation ──────────────────────────
  const validPhrases = (process.env.VALID_PASSPHRASES || '')
    .split(',').map(p => p.trim()).filter(Boolean);
  const incoming = (req.headers['x-passphrase'] || '').trim();

  if (validPhrases.length > 0 && !validPhrases.includes(incoming)) {
    res.status(401).json({ error: 'Invalid passphrase' });
    return;
  }

  // ── DeepSeek proxy ────────────────────────────────
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
  if (!DEEPSEEK_API_KEY) {
    res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured in Vercel environment variables.' });
    return;
  }

  try {
    const { messages, systemPrompt } = req.body;
    const payload = JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 500,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    });
    const result = await httpsPost('api.deepseek.com', '/chat/completions', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    }, payload);

    if (result.error) throw new Error(result.error.message || 'DeepSeek error');
    res.status(200).json({ reply: result.choices[0].message.content });
  } catch (e) {
    console.error('[chat] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
