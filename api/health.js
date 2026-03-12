// api/health.js — Vercel Serverless Function (CommonJS)
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const hasKey = !!process.env.DEEPSEEK_API_KEY;
  res.status(200).json({ ok: hasKey, provider: hasKey ? 'deepseek' : 'none', version: '6.0' });
};
