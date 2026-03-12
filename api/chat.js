// api/chat.js — Vercel Serverless Function
// Proxies AI calls server-side so API keys are never exposed to browser

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

async function proxyChat({ messages, systemPrompt, provider }) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
  const CLAUDE_API_KEY   = process.env.CLAUDE_API_KEY   || '';

  // Prefer DeepSeek — cheap and reliable for this use case
  if (DEEPSEEK_API_KEY && provider !== 'claude') {
    const payload = JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 500,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    });
    const res = await httpsPost('api.deepseek.com', '/chat/completions', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    }, payload);
    if (res.error) throw new Error(res.error.message || 'DeepSeek error');
    return res.choices[0].message.content;
  }

  if (!CLAUDE_API_KEY) {
    throw new Error('No AI API key configured. Set DEEPSEEK_API_KEY or CLAUDE_API_KEY in Vercel environment variables.');
  }

  const payload = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: systemPrompt,
    messages
  });
  const res = await httpsPost('api.anthropic.com', '/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': CLAUDE_API_KEY,
    'anthropic-version': '2023-06-01'
  }, payload);
  if (res.error) throw new Error(res.error.message || 'Claude error');
  return res.content[0].text;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const reply = await proxyChat(req.body);
    res.status(200).json({ reply });
  } catch (e) {
    console.error('[chat] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
