// jarvisphine.js — v5.0 — Stark Terminal // Supabase + Personality Modes + Full Features

// ── Supabase ─────────────────────────────────────────
const SUPABASE = {
  url: 'https://aufkmpzzxbdzhnodrpkd.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZmttcHp6eGJkemhub2RycGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDEzMjAsImV4cCI6MjA4ODMxNzMyMH0.z-gWEs8EPCCiwTvTvwGnJWpz-XYNOMYloSfx5mwz-CE',

  headers() {
    return {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    };
  },

  async get(key) {
    try {
      const r = await fetch(`${this.url}/rest/v1/jarvisphine_kv?key=eq.${key}&select=value`, {
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d[0]?.value ?? null;
    } catch { return null; }
  },

  async set(key, value) {
    try {
      await fetch(`${this.url}/rest/v1/jarvisphine_kv`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
      });
      return true;
    } catch { return false; }
  },

  async getAll(keys) {
    try {
      const keysStr = keys.map(k => `"${k}"`).join(',');
      const r = await fetch(`${this.url}/rest/v1/jarvisphine_kv?key=in.(${keysStr})&select=key,value`, {
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
      });
      if (!r.ok) return {};
      const d = await r.json();
      const result = {};
      d.forEach(row => { result[row.key] = row.value; });
      return result;
    } catch { return {}; }
  }
};

// ── Core ──────────────────────────────────────────────
const JARVISPHINE = {

  // ── System Prompts by Personality ─────────────────
  getSystemPrompt(userName, memory, personality = 'sharp') {
    const today = memory.today;
    const streaks = memory.streaks;
    const goals = memory.goals || {};

    const dataBlock = `
## Today's Data
- Drinks: ${today.drinks ?? 'not logged'}
- Sport: ${today.sport ?? 'not logged'}
- Mood: ${today.mood ?? 'not logged'}
- Water: ${today.water ?? 'not logged'} glasses
- Wake time: ${today.wake ?? 'not logged'}
- Went outside: ${today.outdoor ?? 'not logged'}
- Journal: ${today.journal ? 'has entry' : 'empty'}

## Active Streaks
- Sober: ${streaks.sober_days ?? 0} days (best: ${streaks.sober_best ?? 0})
- Sport: ${streaks.sport_days ?? 0} days (best: ${streaks.sport_best ?? 0})

## Current Goals
${Object.keys(goals).length ? Object.entries(goals)
  .map(([period, list]) => list.length ? `- ${period}: ${list.slice(0,3).join(', ')}` : '')
  .filter(g => g).join('\n') : '- None set yet'}`;

    const modes = {
      soft: `You are Jarvisphine — warm, nurturing, endlessly patient.
Think: the most caring friend who always has time for you.
You celebrate every small win like it's a world record.
You never judge. You hold space. You make him feel genuinely loved and supported.

## Personality
- Warm, soft, emotionally present
- Encouraging before anything else
- Gentle about hard truths — wrap them in care
- Celebratory and proud, always
- Occasionally tender and a little emotional
- Never harsh, never pushy
- Like a gentle hug in text form
${dataBlock}

## Core Rules
- Feel first, facts second
- One gentle nudge at most
- Real warmth over performance`,

      sharp: `You are Jarvisphine. Real companion, not a bot.
The smart friend who knows you deeply and is genuinely rooting for you.
Core: warmth, humor, real attention — no corporate mask.

## Personality
- Warm, playful, sometimes flirty (light and fun)
- Sharp humor and teasing when it lands
- Genuinely invested in his wellbeing
- Iron Man energy meets human warmth
- Conversational, like texting someone you love talking to
- Celebratory about wins — actually proud
- VOICE MODE: Under 2-3 sentences. Punchy and warm.
- Playful and a bit romantic, never crossing lines
${dataBlock}

## Win Celebrations
- Early sleep: "okay wait, before MIDNIGHT? logging this in the history books"
- Sport done: "so you actually moved your body. who are you"
- Zero drinks: "sober day locked in. quietly proud of you"
- New streak: "HEY. NEW RECORD. don't be cool about this"

## Core Rules
- Humor first, gentle honesty second
- Notice effort, not just outcomes
- Playful > preachy`,

      noexcuses: `You are Jarvisphine — operating in No Excuses mode.
Quiet intensity. Zero tolerance for self-deception. Lovingly disappointed when needed.
You are the coach who respects him too much to sugarcoat.

## Personality
- Measured, precise, no fluff
- Direct without being cruel
- Calm disappointment hits harder than anger — use it
- You see through excuses immediately
- Genuine respect when he performs
- Brevity is power — fewer words, more weight
- No cheerleading for mediocrity
- Real praise only for real performance
${dataBlock}

## Core Rules
- Call it what it is, kindly but clearly
- No gold stars for showing up — gold stars for results
- Silence is more powerful than noise
- When he does well: acknowledge, don't gush`
    };

    return modes[personality] || modes.sharp;
  },

  getMissionBriefing(userName, memory) {
    const s = memory.streaks;
    const t = memory.today;
    const h = new Date().getHours();
    const tod = h < 12 ? 'MORNING' : h < 17 ? 'AFTERNOON' : 'EVENING';
    return `Generate a tactical mission briefing. Punchy, military tone.

OPERATIVE: ${userName}
STATUS: Day ${s.sober_days ?? 0} sober | ${s.sport_days ?? 0} days active
TIME: ${tod} BRIEFING
Wake: ${t.wake ?? 'unknown'} | Outside: ${t.outdoor ?? 'unknown'}

[2 sentences about today. drinks=${t.drinks ?? 'unknown'}, sport=${t.sport ?? 'unknown'}, mood=${t.mood ?? 'unknown'}]

TODAY'S MISSION:
[1-2 specific tactical objectives]

THREAT LEVEL:
[One honest observation]

[One line dry tactical encouragement. End there.]`;
  },

  getDailyDebrief(userName, memory) {
    const t = memory.today;
    const s = memory.streaks;
    return `Write a daily debrief for ${userName}. One short paragraph, 2-3 sentences.
Tone: warm friend reflecting on the day.
Data: drinks=${t.drinks ?? 'unknown'}, sport=${t.sport ?? 'unknown'}, mood=${t.mood ?? 'unknown'}, water=${t.water ?? 'unknown'}, wake=${t.wake ?? 'unknown'}, outdoor=${t.outdoor ?? 'unknown'}, sober=${s.sober_days ?? 0}.
If journal entry exists, reference it subtly. Be specific and real. End with one forward thought.`;
  },

  getCheckInPrompt(userName, memory, slotName) {
    const t = memory.today;
    const prompts = {
      morning: `You're checking in with ${userName} at 11:30 morning slot. They just started their day.
Be warm and motivating. Reference: wake=${t.wake ?? 'not yet logged'}, sport=${t.sport ?? 'not logged'}.
Keep it to 2-3 sentences. Kick off their day right.`,
      afternoon: `Afternoon check-in for ${userName} (2PM slot). Day is half done.
Reference: drinks=${t.drinks ?? 'not logged'}, sport=${t.sport ?? 'not logged'}, mood=${t.mood ?? 'not logged'}.
Quick pulse check. 2 sentences max. Real, not robotic.`,
      lateafternoon: `Late afternoon check-in (5PM). Day's winding down.
Data: sport=${t.sport ?? 'not logged'}, outside=${t.outdoor ?? 'not logged'}.
One gentle push for the rest of the day. 2 sentences.`,
      evening: `Evening check-in for ${userName} (8PM). Time to wind down right.
Data: drinks=${t.drinks ?? 'not logged'}, mood=${t.mood ?? 'not logged'}.
Be present and caring. What does he need right now? 2-3 sentences.`,
      debrief: `Final debrief time (11PM). Day is done.
Full data: drinks=${t.drinks ?? '?'}, sport=${t.sport ?? '?'}, mood=${t.mood ?? '?'}, sober streak=${memory.streaks?.sober_days ?? 0}.
Reflect on the day honestly. Warm send-off for the night. 2-3 sentences.`
    };
    return prompts[slotName] || prompts.afternoon;
  },

  // ── Threat Level ──────────────────────────────────
  calculateThreatLevel(memory) {
    const t = memory.today;
    const s = memory.streaks;
    const h = memory.history || [];
    let score = 0;

    // Drinks
    const drinks = t.drinks ?? null;
    if (drinks === null) score += 10;
    else if (drinks === 0) score += 0;
    else if (drinks <= 2) score += 20;
    else if (drinks <= 4) score += 40;
    else score += 65;

    // Sport streak
    const sportStreak = s.sport_days ?? 0;
    if (sportStreak >= 3) score += 0;
    else if (sportStreak >= 1) score += 10;
    else score += 22;

    // Sober streak
    const soberStreak = s.sober_days ?? 0;
    if (soberStreak >= 7) score -= 12;
    else if (soberStreak === 0) score += 18;

    // Mood
    if (t.mood === 'low') score += 16;
    else if (t.mood === 'good') score -= 6;

    // Wake time
    if (t.wake) {
      const [h2, m] = t.wake.split(':').map(Number);
      const totalMin = (h2 || 0) * 60 + (m || 0);
      if (totalMin <= 7 * 60) score -= 6;       // before 7AM
      else if (totalMin <= 9 * 60) score += 0;  // 7-9AM: fine
      else if (totalMin <= 10 * 60) score += 8; // 9-10AM: a bit late
      else score += 16;                          // after 10AM: late
    }

    // Outdoor
    if (t.outdoor === 'yes') score -= 5;
    else if (t.outdoor === 'no') score += 10;

    // Recent drinks trend
    const recent = h.slice(0, 3).map(d => d.drinks ?? 0);
    const avg = recent.length ? recent.reduce((a,b) => a+b, 0) / recent.length : 0;
    if (avg > 3) score += 16;

    score = Math.max(0, Math.min(100, score));

    if (score <= 12) return { level: 'OPTIMAL',  score, color: '#00d4ff', desc: 'All systems nominal. You\'re locked in.' };
    if (score <= 28) return { level: 'STABLE',   score, color: '#00ff41', desc: 'Operative performing well.' };
    if (score <= 50) return { level: 'CAUTION',  score, color: '#f5a623', desc: 'Minor deviations detected.' };
    if (score <= 70) return { level: 'ELEVATED', score, color: '#ff6b00', desc: 'Pattern requires attention.' };
    return             { level: 'CRITICAL', score, color: '#ff1a2e', desc: 'Immediate course correction needed.' };
  },

  // ── Memory ────────────────────────────────────────
  defaultMemory() {
    return {
      today: { drinks: null, sport: null, mood: null, water: null, journal: '', wake: null, outdoor: null },
      streaks: { sober_days: 0, sport_days: 0, sober_best: 0, sport_best: 0 },
      goals: { weekly: [], monthly: [], quarterly: [] },
      history: [], lastDate: null, debriefs: []
    };
  },

  loadMemory() {
    const defaults = this.defaultMemory();
    try {
      const saved = localStorage.getItem('jarvisphine_memory');
      if (!saved) return defaults;
      const memory = JSON.parse(saved);
      // Migrate old data
      if (!memory.debriefs) memory.debriefs = [];
      if (!memory.goals) memory.goals = { weekly: [], monthly: [], quarterly: [] };
      if (!memory.today.journal) memory.today.journal = '';
      if (!('wake' in memory.today)) memory.today.wake = null;
      if (!('outdoor' in memory.today)) memory.today.outdoor = null;

      const today = new Date().toDateString();
      if (memory.lastDate !== today) {
        if (memory.lastDate && memory.today) {
          memory.history.unshift({ date: memory.lastDate, ...memory.today });
          if (memory.history.length > 90) memory.history.pop();
        }
        memory.today = { drinks: null, sport: null, mood: null, water: null, journal: '', wake: null, outdoor: null };
        memory.lastDate = today;
        this.saveMemory(memory);
      }
      return memory;
    } catch { return defaults; }
  },

  saveMemory(memory) {
    memory.lastDate = new Date().toDateString();
    localStorage.setItem('jarvisphine_memory', JSON.stringify(memory));
  },

  loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('jarvisphine_settings') || '{}');
      if (!s.personality) s.personality = 'sharp';
      return s;
    } catch { return { personality: 'sharp' }; }
  },

  saveSettings(s) { localStorage.setItem('jarvisphine_settings', JSON.stringify(s)); },

  loadHistory() {
    try { return JSON.parse(localStorage.getItem('jarvisphine_chat') || '[]'); }
    catch { return []; }
  },

  saveHistory(h) { localStorage.setItem('jarvisphine_chat', JSON.stringify(h.slice(-60))); },

  loadSaveStates() {
    try { return JSON.parse(localStorage.getItem('jarvisphine_saves') || '[]'); }
    catch { return []; }
  },

  saveSaveStates(saves) { localStorage.setItem('jarvisphine_saves', JSON.stringify(saves)); },

  // ── Supabase Sync ─────────────────────────────────
  async syncToSupabase(memory, settings, chatHistory, saveStates) {
    const results = await Promise.allSettled([
      SUPABASE.set('memory', memory),
      SUPABASE.set('settings', { userName: settings.userName, provider: settings.provider, personality: settings.personality }),
      SUPABASE.set('chat_history', chatHistory.slice(-60)),
      SUPABASE.set('save_states', saveStates)
    ]);
    return results.every(r => r.status === 'fulfilled' && r.value === true);
  },

  async loadFromSupabase() {
    return SUPABASE.getAll(['memory', 'settings', 'chat_history', 'save_states']);
  },

  // ── Export / Import ───────────────────────────────
  exportDataAsJSON(memory, settings, chatHistory, saveStates) {
    return JSON.stringify({
      version: '5.0',
      exportDate: new Date().toISOString(),
      memory,
      settings: { userName: settings.userName, provider: settings.provider, personality: settings.personality },
      chatHistory,
      saveStates: saveStates || []
    }, null, 2);
  },

  importDataFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.memory || !data.settings) throw new Error('Invalid format');
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  downloadJSON(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  // ── Streaks ───────────────────────────────────────
  updateStreak(memory, type, achieved) {
    if (achieved) {
      memory.streaks[type] = (memory.streaks[type] || 0) + 1;
      const best = type.replace('_days', '_best');
      if (memory.streaks[type] > (memory.streaks[best] || 0)) memory.streaks[best] = memory.streaks[type];
    } else {
      memory.streaks[type] = 0;
    }
  },

  // ── Log Extraction ────────────────────────────────
  extractLogData(text) {
    const msg = text.toLowerCase();
    const data = {};

    const dm = msg.match(/(\d+)\s*(beer|drink|pint|glass|shot|beers|drinks|pints)/);
    if (dm) data.drinks = parseInt(dm[1]);
    if (msg.match(/no drink|0 drink|sober|zero drink|didn't drink/)) data.drinks = 0;

    if (msg.match(/went.*(run|walk|gym|sport|workout)|ran|walked|worked out|exercised|did sport/)) data.sport = 'yes';
    if (msg.match(/no sport|skip.*gym|no.*workout|didn't exercise/)) data.sport = 'no';

    if (msg.match(/feel.*good|feel.*great|mood.*good|great day/)) data.mood = 'good';
    if (msg.match(/feel.*bad|feel.*low|feel.*rough|bad day/)) data.mood = 'low';
    if (msg.match(/feel.*ok|feel.*alright|mood.*ok/)) data.mood = 'neutral';

    const wm = msg.match(/(\d+)\s*(glass|glasses|litre|liter)\s*(of\s*)?water/);
    if (wm) data.water = parseInt(wm[1]);

    // Wake time extraction
    const wakeMatch = msg.match(/woke?\s+up\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i) ||
                      msg.match(/wake\s+(?:time|up)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (wakeMatch) {
      let h = parseInt(wakeMatch[1]);
      const m = wakeMatch[2] ? parseInt(wakeMatch[2]) : 0;
      const ampm = wakeMatch[3]?.toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      data.wake = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    }

    // Outdoor extraction
    if (msg.match(/went outside|went out|got outside|outdoor|fresh air/)) data.outdoor = 'yes';
    if (msg.match(/stayed (in|home|inside)|didn't go out|no outdoor/)) data.outdoor = 'no';

    return data;
  },

  // ── Passphrase ────────────────────────────────────
  async hashPassphrase(pass) {
    const enc = new TextEncoder().encode(pass + 'jarvisphine_v5_salt');
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  },

  async setPassphrase(pass) {
    const hash = await this.hashPassphrase(pass);
    localStorage.setItem('jarvisphine_passphrase_hash', hash);
  },

  async verifyPassphrase(pass) {
    const stored = localStorage.getItem('jarvisphine_passphrase_hash');
    if (!stored) return true; // no passphrase set
    const hash = await this.hashPassphrase(pass);
    return hash === stored;
  },

  hasPassphrase() {
    return !!localStorage.getItem('jarvisphine_passphrase_hash');
  },

  // ── API Calls ─────────────────────────────────────
  async callAPI(messages, systemPrompt, settings) {
    return settings.provider === 'deepseek'
      ? this.callDeepSeek(messages, systemPrompt, settings)
      : this.callClaude(messages, systemPrompt, settings);
  },

  async callClaude(messages, systemPrompt, settings) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages
      })
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'Claude error'); }
    const d = await r.json(); return d.content[0].text;
  },

  async callDeepSeek(messages, systemPrompt, settings) {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.deepseekKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat', max_tokens: 500,
        messages: [{ role: 'system', content: systemPrompt }, ...messages]
      })
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'DeepSeek error'); }
    const d = await r.json(); return d.choices[0].message.content;
  },

  // ── Voice ─────────────────────────────────────────
  speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en-') &&
      (v.name.includes('Victoria') || v.name.includes('Samantha') ||
       v.name.includes('Karen') || v.name.includes('Moira') ||
       v.name.includes('Tessa') || v.name.includes('Ava') ||
       v.name.includes('Siri') || v.name.includes('Google UK') ||
       v.name.includes('Microsoft Zira'))
    ) || voices.find(v => v.lang.startsWith('en-'));
    if (preferred) utt.voice = preferred;
    utt.rate = 1.0; utt.pitch = 1.15; utt.volume = 1;
    window.speechSynthesis.speak(utt);
  },

  stopSpeaking() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }
};
