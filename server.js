// server.js — Jarvisphine v6.0 — Backend Proxy
// Keeps AI API keys server-side, never exposed to browser
// Run: CLAUDE_API_KEY=sk-ant-... node server.js
//  or: DEEPSEEK_API_KEY=sk-... node server.js

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT             = process.env.PORT             || 3000;
const CLAUDE_API_KEY   = process.env.CLAUDE_API_KEY   || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// ── HTTPS helper ──────────────────────────────────────
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

// ── AI proxy ──────────────────────────────────────────
async function proxyChat(body) {
  const { messages, systemPrompt, provider } = body;

  if (provider === 'deepseek' && DEEPSEEK_API_KEY) {
    const payload = JSON.stringify({
      model: 'deepseek-chat', max_tokens: 500,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    });
    const res = await httpsPost('api.deepseek.com', '/chat/completions', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    }, payload);
    if (res.error) throw new Error(res.error.message || 'DeepSeek error');
    return res.choices[0].message.content;
  }

  if (!CLAUDE_API_KEY) throw new Error('No AI API key configured on server. Set CLAUDE_API_KEY or DEEPSEEK_API_KEY.');

  const payload = JSON.stringify({
    model: 'claude-haiku-4-5-20251001', max_tokens: 500,
    system: systemPrompt, messages
  });
  const res = await httpsPost('api.anthropic.com', '/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': CLAUDE_API_KEY,
    'anthropic-version': '2023-06-01'
  }, payload);
  if (res.error) throw new Error(res.error.message || 'Claude error');
  return res.content[0].text;
}

// ── MIME types ────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml'
};

// ── HTTP server ───────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── API: health ──────────────────────────────────
  if (req.url === '/api/health' && req.method === 'GET') {
    const provider = DEEPSEEK_API_KEY ? 'deepseek' : CLAUDE_API_KEY ? 'claude' : 'none';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: provider !== 'none', provider, version: '6.0' }));
    return;
  }

  // ── API: chat proxy ──────────────────────────────
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data  = JSON.parse(body);
        const reply = await proxyChat(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (e) {
        console.error('[API] Error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Static file serving ──────────────────────────
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

// ── Start ─────────────────────────────────────────────
server.listen(PORT, () => {
  const aiStatus = DEEPSEEK_API_KEY ? 'DeepSeek ✓' : CLAUDE_API_KEY ? 'Claude   ✓' : '⚠  NONE — set CLAUDE_API_KEY or DEEPSEEK_API_KEY';
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   JARVISPHINE v6.0 — BACKEND PROXY      ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  URL:  http://localhost:${PORT}              ║`);
  console.log(`║  AI:   ${aiStatus.padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
