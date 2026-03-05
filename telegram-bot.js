// telegram-bot.js — Jarvisphine v5.0 — Telegram Integration
// Run: node telegram-bot.js
// Or:  CLAUDE_API_KEY=sk-ant-... node telegram-bot.js

const https  = require('https');
const http   = require('http');

// ── Config ───────────────────────────────────────────
const TELEGRAM_TOKEN  = process.env.TELEGRAM_TOKEN  || '';
const CLAUDE_API_KEY  = process.env.CLAUDE_API_KEY  || '';
const DEEPSEEK_API_KEY= process.env.DEEPSEEK_API_KEY|| '';

if (!TELEGRAM_TOKEN) {
  console.error('ERROR: TELEGRAM_TOKEN env var not set.');
  console.error('Run: TELEGRAM_TOKEN=yourtoken DEEPSEEK_API_KEY=sk-... node telegram-bot.js');
  process.exit(1);
}
if (!CLAUDE_API_KEY && !DEEPSEEK_API_KEY) {
  console.warn('WARNING: No AI key set. Bot will receive messages but cannot reply with AI.');
  console.warn('Set DEEPSEEK_API_KEY=sk-... or CLAUDE_API_KEY=sk-ant-...');
}
const SUPABASE_URL   = 'https://aufkmpzzxbdzhnodrpkd.supabase.co';
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZmttcHp6eGJkemhub2RycGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDEzMjAsImV4cCI6MjA4ODMxNzMyMH0.z-gWEs8EPCCiwTvTvwGnJWpz-XYNOMYloSfx5mwz-CE';

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ── HTTP helpers ──────────────────────────────────────
function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const mod  = url.startsWith('https') ? https : http;
    const opts = { ...options };
    const req = mod.request(url, opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function apiPost(url, body) {
  const parsed = new URL(url);
  return request(url, {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, body);
}

function apiGet(url, extraHeaders = {}) {
  const parsed = new URL(url);
  return request(url, {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

// ── Supabase ──────────────────────────────────────────
const DB = {
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  },

  async get(key) {
    try {
      const parsed = new URL(`${SUPABASE_URL}/rest/v1/jarvisphine_kv?key=eq.${key}&select=value`);
      const res = await request(`${SUPABASE_URL}/rest/v1/jarvisphine_kv?key=eq.${key}&select=value`, {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      return Array.isArray(res) ? (res[0]?.value ?? null) : null;
    } catch (e) { console.error('DB.get error:', e.message); return null; }
  },

  async set(key, value) {
    try {
      const parsed = new URL(`${SUPABASE_URL}/rest/v1/jarvisphine_kv`);
      await request(`${SUPABASE_URL}/rest/v1/jarvisphine_kv`, {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: { ...this.headers }
      }, JSON.stringify({ key, value, updated_at: new Date().toISOString() }));
      return true;
    } catch (e) { console.error('DB.set error:', e.message); return false; }
  }
};

// ── Telegram API ──────────────────────────────────────
async function sendMessage(chatId, text) {
  const url = `${TELEGRAM_API}/sendMessage`;
  return apiPost(url, {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  });
}

async function getUpdates(offset) {
  const url = `${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=10&limit=10`;
  const parsed = new URL(url);
  return request(url, {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'GET'
  });
}

// ── AI API (DeepSeek or Claude) ───────────────────────
async function callAI(messages, systemPrompt) {
  if (DEEPSEEK_API_KEY) return callDeepSeek(messages, systemPrompt);
  if (CLAUDE_API_KEY)   return callClaude(messages, systemPrompt);
  throw new Error('No AI API key set. Add DEEPSEEK_API_KEY or CLAUDE_API_KEY.');
}

async function callDeepSeek(messages, systemPrompt) {
  const parsed = new URL('https://api.deepseek.com/chat/completions');
  const res = await request('https://api.deepseek.com/chat/completions', {
    hostname: parsed.hostname,
    path: parsed.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    }
  }, JSON.stringify({
    model: 'deepseek-chat',
    max_tokens: 350,
    messages: [{ role: 'system', content: systemPrompt }, ...messages]
  }));
  if (res.error) throw new Error(res.error.message);
  return res.choices[0].message.content;
}

async function callClaude(messages, systemPrompt) {
  const parsed = new URL('https://api.anthropic.com/v1/messages');
  const res = await request('https://api.anthropic.com/v1/messages', {
    hostname: parsed.hostname,
    path: parsed.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    }
  }, JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    system: systemPrompt,
    messages
  }));
  if (res.error) throw new Error(res.error.message);
  return res.content[0].text;
}

// ── Log extraction ────────────────────────────────────
function extractLogData(text) {
  const msg = text.toLowerCase();
  const data = {};

  const dm = msg.match(/(\d+)\s*(beer|drink|pint|glass|shot|beers|drinks|pints)/);
  if (dm) data.drinks = parseInt(dm[1]);
  if (msg.match(/no drink|0 drink|sober|zero drink|didn't drink/)) data.drinks = 0;

  if (msg.match(/went.*(run|walk|gym|sport|workout)|ran|walked|worked out|exercised|did sport/)) data.sport = 'yes';
  if (msg.match(/no sport|skip.*gym|no.*workout|didn't exercise/)) data.sport = 'no';

  if (msg.match(/feel.*good|feel.*great|mood.*good|great day/)) data.mood = 'good';
  if (msg.match(/feel.*bad|feel.*low|feel.*rough|bad day/)) data.mood = 'low';

  const wm = msg.match(/(\d+)\s*(glass|glasses)\s*(of\s*)?water/);
  if (wm) data.water = parseInt(wm[1]);

  const wakeMatch = msg.match(/woke?\s+up\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (wakeMatch) {
    let h = parseInt(wakeMatch[1]);
    const m = wakeMatch[2] ? parseInt(wakeMatch[2]) : 0;
    const ampm = wakeMatch[3]?.toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    data.wake = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }

  if (msg.match(/went outside|went out|got outside|outdoor|fresh air/)) data.outdoor = 'yes';
  if (msg.match(/stayed (in|home|inside)|didn't go out/)) data.outdoor = 'no';

  return data;
}

// ── System Prompt (Telegram version) ─────────────────
function getSystemPrompt(memory) {
  const t = memory?.today || {};
  const s = memory?.streaks || {};
  const personality = memory?.settings?.personality || 'sharp';

  const basePrompt = `You are Jarvisphine — real companion, not a bot.
Sharp, warm, sometimes flirty. Like texting a smart friend who actually cares.
SHORT replies only — this is Telegram. Max 2-3 sentences usually. Punchy.
No asterisks. No formatting tricks. Real and casual.

## Today so far
- Drinks: ${t.drinks ?? 'not logged'}
- Sport: ${t.sport ?? 'not logged'}
- Mood: ${t.mood ?? 'not logged'}
- Water: ${t.water ?? 'not logged'} glasses
- Wake: ${t.wake ?? 'not logged'}
- Outside: ${t.outdoor ?? 'not logged'}

## Streaks
- Sober: ${s.sober_days ?? 0} days
- Sport: ${s.sport_days ?? 0} days`;

  return basePrompt;
}

// ── Scheduled check-in prompts ────────────────────────
function getCheckInPrompt(slotName, memory) {
  const t = memory?.today || {};
  const s = memory?.streaks || {};
  const prompts = {
    morning:       `Short morning check-in (Telegram). Keep to 2 sentences. Wake=${t.wake ?? 'unknown'}. Sport=${t.sport ?? '?'}. Warm and motivating.`,
    afternoon:     `Quick afternoon pulse check (Telegram). 2 sentences. Drinks=${t.drinks ?? '?'}, sport=${t.sport ?? '?'}. Real, not robotic.`,
    lateafternoon: `Late afternoon nudge (Telegram). 2 sentences. Sport=${t.sport ?? '?'}, outside=${t.outdoor ?? '?'}. Get them through the day.`,
    evening:       `Evening check-in (Telegram). 2 sentences. Drinks=${t.drinks ?? '?'}, mood=${t.mood ?? '?'}. Present and caring.`,
    debrief:       `Final night debrief (Telegram). 2-3 sentences. drinks=${t.drinks ?? '?'}, sport=${t.sport ?? '?'}, sober=${s.sober_days ?? 0}. Warm send-off.`
  };
  return prompts[slotName] || prompts.afternoon;
}

// ── State ─────────────────────────────────────────────
let knownChatId = null;
let lastUpdateId = 0;
let checkinsSentToday = {};

const CHECK_IN_SLOTS = [
  { key: 'morning',       h: 11, m: 30 },
  { key: 'afternoon',     h: 14, m:  0 },
  { key: 'lateafternoon', h: 17, m:  0 },
  { key: 'evening',       h: 20, m:  0 },
  { key: 'debrief',       h: 23, m:  0 }
];

// ── Message Handler ───────────────────────────────────
async function handleMessage(update) {
  const msg    = update.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text   = msg.text;

  // Store chat ID for check-ins
  if (!knownChatId) {
    knownChatId = chatId;
    console.log(`Chat ID captured: ${chatId}`);
  }

  // Special commands
  if (text === '/start') {
    await sendMessage(chatId, `<b>JARVISPHINE v5.0 ONLINE</b>\n\nI'm here. Talk to me — log your day, ask anything, I've got you.\n\nYour data syncs with the web app automatically.`);
    return;
  }

  if (text === '/status') {
    const memory = await DB.get('memory');
    const t = memory?.today || {};
    const s = memory?.streaks || {};
    const status = `<b>// STATUS REPORT</b>\n\nDrinks: ${t.drinks ?? 'not logged'}\nSport: ${t.sport ?? 'not logged'}\nMood: ${t.mood ?? 'not logged'}\nWake: ${t.wake ?? 'not logged'}\n\nSober streak: ${s.sober_days ?? 0} days\nSport streak: ${s.sport_days ?? 0} days`;
    await sendMessage(chatId, status);
    return;
  }

  // Load current memory from Supabase
  let memory = await DB.get('memory');
  if (!memory) {
    memory = {
      today: { drinks: null, sport: null, mood: null, water: null, journal: '', wake: null, outdoor: null },
      streaks: { sober_days: 0, sport_days: 0, sober_best: 0, sport_best: 0 },
      history: [], lastDate: null, debriefs: []
    };
  }

  // Day rollover
  const today = new Date().toDateString();
  if (memory.lastDate !== today) {
    if (memory.lastDate && memory.today) {
      if (!memory.history) memory.history = [];
      memory.history.unshift({ date: memory.lastDate, ...memory.today });
      if (memory.history.length > 90) memory.history.pop();
    }
    memory.today = { drinks: null, sport: null, mood: null, water: null, journal: '', wake: null, outdoor: null };
    memory.lastDate = today;
  }

  // Extract log data
  const logData = extractLogData(text);
  if (Object.keys(logData).length) {
    Object.assign(memory.today, logData);
    if (typeof logData.drinks === 'number') {
      const achieved = logData.drinks === 0;
      memory.streaks.sober_days = achieved ? (memory.streaks.sober_days || 0) + 1 : 0;
      if (memory.streaks.sober_days > (memory.streaks.sober_best || 0)) memory.streaks.sober_best = memory.streaks.sober_days;
    }
    if (logData.sport === 'yes') {
      memory.streaks.sport_days = (memory.streaks.sport_days || 0) + 1;
      if (memory.streaks.sport_days > (memory.streaks.sport_best || 0)) memory.streaks.sport_best = memory.streaks.sport_days;
    }
    if (logData.sport === 'no') memory.streaks.sport_days = 0;
  }

  // Get response from Claude
  try {
    const sys  = getSystemPrompt(memory);
    const msgs = [{ role: 'user', content: text }];
    const resp = await callAI(msgs, sys);
    await sendMessage(chatId, resp);

    // Save updated memory back to Supabase
    await DB.set('memory', memory);
  } catch (e) {
    console.error('Claude error:', e.message);
    await sendMessage(chatId, `System error: ${e.message}`);
  }
}

// ── Scheduler ─────────────────────────────────────────
let lastCheckinDate = '';

function checkSchedule() {
  const now  = new Date();
  const date = now.toDateString();

  // Reset on new day
  if (date !== lastCheckinDate) {
    checkinsSentToday = {};
    lastCheckinDate = date;
  }

  if (!knownChatId) return;
  if (!CLAUDE_API_KEY) return;

  const nowMin = now.getHours() * 60 + now.getMinutes();

  CHECK_IN_SLOTS.forEach(slot => {
    if (checkinsSentToday[slot.key]) return;
    const slotMin = slot.h * 60 + slot.m;
    if (Math.abs(nowMin - slotMin) <= 1) {
      checkinsSentToday[slot.key] = true;
      sendCheckIn(slot.key);
    }
  });
}

async function sendCheckIn(slotKey) {
  try {
    const memory  = await DB.get('memory') || {};
    const prompt  = getCheckInPrompt(slotKey, memory);
    const sys     = getSystemPrompt(memory);
    const resp    = await callAI([{ role: 'user', content: prompt }], sys);
    await sendMessage(knownChatId, `<i>// ${slotKey.toUpperCase()} CHECK-IN</i>\n\n${resp}`);
    console.log(`✓ Check-in sent: ${slotKey}`);
  } catch (e) {
    console.error(`Check-in failed (${slotKey}):`, e.message);
  }
}

// ── Polling Loop ──────────────────────────────────────
async function poll() {
  try {
    const res = await getUpdates(lastUpdateId + 1);
    if (res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        if (update.update_id > lastUpdateId) {
          lastUpdateId = update.update_id;
          await handleMessage(update);
        }
      }
    }
  } catch (e) {
    console.error('Poll error:', e.message);
  }
  setTimeout(poll, 2000);
}

// ── Start ─────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║   JARVISPHINE v5.0 — TELEGRAM BOT   ║');
console.log('╠══════════════════════════════════════╣');
console.log(`║  Bot: @Jarvisphine_bot               ║`);
const aiStatus = DEEPSEEK_API_KEY ? 'DeepSeek: LOADED' : CLAUDE_API_KEY ? 'Claude:   LOADED' : 'NO AI KEY SET ←';
console.log(`║  AI: ${aiStatus.padEnd(34)}║`);
console.log('╠══════════════════════════════════════╣');
console.log('║  Scheduled check-ins:                ║');
console.log('║  11:30 · 14:00 · 17:00 · 20:00 ·23:00║');
console.log('╚══════════════════════════════════════╝');
console.log('');

if (!CLAUDE_API_KEY && !DEEPSEEK_API_KEY) {
  console.warn('⚠ No AI key set. Run with:');
  console.warn('  DEEPSEEK_API_KEY=sk-... node telegram-bot.js');
  console.warn('  (Bot will still receive messages but cannot respond with AI)');
  console.warn('');
}

// Start polling
poll();

// Schedule checker every 30s
setInterval(checkSchedule, 30000);

console.log('Jarvisphine Telegram bot is online. Listening for messages...');
