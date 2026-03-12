// api/health.js — Vercel Serverless Function
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const provider = process.env.DEEPSEEK_API_KEY ? 'deepseek'
    : process.env.CLAUDE_API_KEY ? 'claude'
    : 'none';

  res.status(200).json({ ok: provider !== 'none', provider, version: '6.0' });
}
