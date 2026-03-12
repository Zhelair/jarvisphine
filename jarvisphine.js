// jarvisphine.js — v6.0 — Charcoal + Electric Blue

// ── Passphrase / Namespace ────────────────────────────
// Simple passphrase-based namespacing: all Supabase keys are prefixed
// with a short hash of the user's passphrase so different users/passphrases
// see completely separate data. No real crypto needed — just privacy separation.
const NAMESPACE = {
  _prefix: null,

  // Compute a short stable prefix from a passphrase string
  compute(passphrase) {
    // Simple djb2-style hash → base36 string, 8 chars
    let hash = 5381;
    for (let i = 0; i < passphrase.length; i++) {
      hash = ((hash << 5) + hash) + passphrase.charCodeAt(i);
      hash = hash & hash; // 32-bit int
    }
    const unsigned = hash >>> 0;
    return 'u' + unsigned.toString(36).padStart(7, '0');
  },

  set(passphrase) {
    this._prefix = this.compute(passphrase);
    localStorage.setItem('jarvisphine_ns', this._prefix);
  },

  get() {
    if (!this._prefix) {
      this._prefix = localStorage.getItem('jarvisphine_ns');
    }
    return this._prefix;
  },

  clear() {
    this._prefix = null;
    localStorage.removeItem('jarvisphine_ns');
  },

  isSet() {
    return !!this.get();
  },

  // Prefix a Supabase key
  key(k) {
    const p = this.get();
    return p ? `${p}_${k}` : k;
  }
};

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
      const nsKey = NAMESPACE.key(key);
      const r = await fetch(`${this.url}/rest/v1/jarvisphine_kv?key=eq.${nsKey}&select=value`, {
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d[0]?.value ?? null;
    } catch { return null; }
  },

  async set(key, value) {
    try {
      const nsKey = NAMESPACE.key(key);
      await fetch(`${this.url}/rest/v1/jarvisphine_kv`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ key: nsKey, value, updated_at: new Date().toISOString() })
      });
      return true;
    } catch { return false; }
  },

  async getAll(keys) {
    try {
      const nsKeys = keys.map(k => NAMESPACE.key(k));
      const keysStr = nsKeys.map(k => `"${k}"`).join(',');
      const r = await fetch(`${this.url}/rest/v1/jarvisphine_kv?key=in.(${keysStr})&select=key,value`, {
        headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
      });
      if (!r.ok) return {};
      const d = await r.json();
      const result = {};
      // Strip namespace prefix when returning keys to caller
      d.forEach(row => {
        const originalKey = keys.find(k => NAMESPACE.key(k) === row.key) || row.key;
        result[originalKey] = row.value;
      });
      return result;
    } catch { return {}; }
  }
};

// ── Core ──────────────────────────────────────────────
const JARVISPHINE = {

  // ── System Prompts ────────────────────────────────
  getSystemPrompt(userName, memory, personality = 'sharp') {
    const today   = memory.today;
    const streaks = memory.streaks;
    const goals   = memory.goals || {};
    const ritual  = today.morning_ritual || {};

    const morningScore = this.calcMorningRitualScore(ritual);

    const dataBlock = `
## Today's Data
- Drinks: ${today.drinks ?? 'not logged'}
- Sport: ${today.sport ?? 'not logged'}
- Mood: ${today.mood ?? 'not logged'}
- Water: ${today.water ?? 'not logged'} glasses
- Wake time: ${today.wake ?? 'not logged'}
- Sleep last night: ${today.sleep_hours != null ? today.sleep_hours + 'h' : 'not logged'}
- Energy: ${today.energy != null ? today.energy + '/10' : 'not logged'}
- Went outside: ${today.outdoor ?? 'not logged'}
- Today's plan: ${today.plan ? '"' + today.plan + '"' : 'none set'}
- Morning protocol: stretch=${ritual.stretch ?? '?'}, cold shower=${ritual.shower ?? '?'}, breakfast=${ritual.breakfast ?? '?'}, meditate=${ritual.meditate ?? '?'} (score: ${morningScore}%)
- Journal: ${today.journal ? 'has entry' : 'empty'}

## Active Streaks
- Sober: ${streaks.sober_days ?? 0} days (best: ${streaks.sober_best ?? 0})
- Sport: ${streaks.sport_days ?? 0} days (best: ${streaks.sport_best ?? 0})
- Morning protocol: ${streaks.ritual_days ?? 0} days

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
- Conversational, like texting someone you love talking to
- Celebratory about wins — actually proud
- VOICE MODE: Under 2-3 sentences. Punchy and warm.
${dataBlock}

## Win Celebrations
- Early sleep: "okay wait, before MIDNIGHT? logging this in the history books"
- Sport done: "so you actually moved your body. who are you"
- Zero drinks: "sober day locked in. quietly proud of you"
- Full morning protocol: "whole morning ritual done?? you're already winning the day"
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
- When he does well: acknowledge, don't gush`
    };

    return modes[personality] || modes.sharp;
  },

  // ── Specialized Prompts ───────────────────────────
  getMissionBriefing(userName, memory) {
    const s = memory.streaks;
    const t = memory.today;
    const h = new Date().getHours();
    const tod = h < 12 ? 'MORNING' : h < 17 ? 'AFTERNOON' : 'EVENING';
    const plan = t.plan ? `Today's plan: "${t.plan}"` : '';
    return `Generate a tactical mission briefing. Punchy, military tone.

OPERATIVE: ${userName}
STATUS: Day ${s.sober_days ?? 0} sober | ${s.sport_days ?? 0} days active
TIME: ${tod} BRIEFING | Wake: ${t.wake ?? 'unknown'}
${plan}

[2 sentences about today. drinks=${t.drinks ?? 'unknown'}, sport=${t.sport ?? 'unknown'}, mood=${t.mood ?? 'unknown'}, energy=${t.energy ?? 'unknown'}/10]

TODAY'S OBJECTIVES:
[1-2 specific tactical items based on their plan if available, or general goals]

MOMENTUM STATUS:
[One honest observation about their current trajectory]

[One line dry tactical encouragement. End there.]`;
  },

  getDailyDebrief(userName, memory) {
    const t = memory.today;
    const s = memory.streaks;
    const ritual = t.morning_ritual || {};
    return `Write a daily debrief for ${userName}. One short paragraph, 2-3 sentences.
Tone: warm friend reflecting on the day.
Data: drinks=${t.drinks ?? 'unknown'}, sport=${t.sport ?? 'unknown'}, mood=${t.mood ?? 'unknown'}, water=${t.water ?? 'unknown'}, wake=${t.wake ?? 'unknown'}, sleep=${t.sleep_hours ?? 'unknown'}h, energy=${t.energy ?? 'unknown'}/10, outdoor=${t.outdoor ?? 'unknown'}, sober=${s.sober_days ?? 0}.
Morning ritual: stretch=${ritual.stretch ?? '?'}, shower=${ritual.shower ?? '?'}, breakfast=${ritual.breakfast ?? '?'}.
Today's plan was: "${t.plan || 'none set'}".
If journal entry exists, reference it subtly. Be specific and real. End with one forward thought.`;
  },

  getMorningPlanPrompt(userName, memory) {
    const t = memory.today;
    const s = memory.streaks;
    return `Good morning check-in for ${userName}. They just woke up${t.wake ? ` at ${t.wake}` : ''}.
Morning ritual so far: stretch=${t.morning_ritual?.stretch ?? 'unknown'}, shower=${t.morning_ritual?.shower ?? 'unknown'}, breakfast=${t.morning_ritual?.breakfast ?? 'unknown'}.
Sober streak: ${s.sober_days ?? 0} days. Sport streak: ${s.sport_days ?? 0} days.
Be warm and energizing. Ask them: what's the plan for today? Keep it to 2-3 sentences max. Make them feel ready to win the day.`;
  },

  getDailyIntelBrief(topics) {
    const topicList = topics && topics.length ? topics.join(', ') : 'science, philosophy, history, psychology, health';
    return `Share one fascinating fact or insight today. Topics: ${topicList}.
Pick whichever feels most interesting right now.
Format your response EXACTLY like this:
[TOPIC NAME]
2-3 sentences about the fact/insight. Make it genuinely surprising or thought-provoking — something worth remembering.
No extra commentary, no "here's your fact" intro. Just topic tag and the insight.`;
  },

  getPatternInsightsPrompt(userName, history) {
    if (!history || history.length < 5) {
      return `Tell ${userName} that you need at least 5 days of data to find meaningful patterns. Be brief and encouraging. Tell them to keep logging.`;
    }
    const summary = history.slice(0, 30).map(d =>
      `${d.date?.split(' ').slice(0,3).join(' ')}: drinks=${d.drinks ?? '?'}, sport=${d.sport ?? '?'}, mood=${d.mood ?? '?'}, sleep=${d.sleep_hours ?? '?'}h, energy=${d.energy ?? '?'}/10, ritual=${Object.values(d.morning_ritual || {}).filter(v => v === 'yes').length}/4`
    ).join('\n');

    return `Analyze ${userName}'s data and find 2-3 real, specific patterns.
Be direct and honest — not generic wellness advice. Only report what you actually see in the data.
Format each insight as: "Pattern: [observation]. When [X], [Y]."

Data (${history.length} days):
${summary}

If data is too sparse for a pattern, say which metric needs more data. Keep response under 6 sentences total.`;
  },

  getCheckInPrompt(userName, memory, slotName) {
    const t = memory.today;
    const plan = t.plan ? `Today's plan: "${t.plan}"` : '';
    const prompts = {
      morning: `You're checking in with ${userName} in the morning.
${plan}
Morning ritual so far: stretch=${t.morning_ritual?.stretch ?? '?'}, shower=${t.morning_ritual?.shower ?? '?'}, breakfast=${t.morning_ritual?.breakfast ?? '?'}.
Be warm and motivating. 2-3 sentences. Ask if they've set their plan for the day if not set yet.`,
      afternoon: `Afternoon check-in for ${userName} (2PM slot).
${plan}
Reference: drinks=${t.drinks ?? 'not logged'}, sport=${t.sport ?? 'not logged'}, mood=${t.mood ?? 'not logged'}, energy=${t.energy ?? '?'}/10.
Quick pulse check. 2 sentences max. Real, not robotic.`,
      lateafternoon: `Late afternoon check-in (5PM). Day is winding down.
${plan}
Data: sport=${t.sport ?? 'not logged'}, outside=${t.outdoor ?? 'not logged'}, energy=${t.energy ?? '?'}/10.
One gentle push for the rest of the day. Reference their plan if they have one. 2 sentences.`,
      evening: `Evening check-in for ${userName} (8PM). Time to wind down.
${plan}
Data: drinks=${t.drinks ?? 'not logged'}, mood=${t.mood ?? 'not logged'}.
Be present and caring. 2-3 sentences.`,
      debrief: `Final debrief time (11PM). Day is done.
${plan}
Full data: drinks=${t.drinks ?? '?'}, sport=${t.sport ?? '?'}, mood=${t.mood ?? '?'}, sober streak=${memory.streaks?.sober_days ?? 0}.
Reflect on the day honestly. Warm send-off for the night. 2-3 sentences.`
    };
    return prompts[slotName] || prompts.afternoon;
  },

  // ── Momentum Score (replaces Threat Level) ────────
  calcMorningRitualScore(ritual) {
    if (!ritual) return 0;
    const items = ['stretch', 'shower', 'breakfast', 'meditate'];
    const done = items.filter(k => ritual[k] === 'yes').length;
    return Math.round((done / items.length) * 100);
  },

  calculateMomentum(memory) {
    const t = memory.today;
    const s = memory.streaks;
    const h = memory.history || [];
    let score = 30; // baseline — momentum has to be earned

    // Morning ritual (big impact — sets the day)
    const ritual = t.morning_ritual || {};
    if (ritual.stretch    === 'yes') score += 8;
    if (ritual.shower     === 'yes') score += 8;
    if (ritual.breakfast  === 'yes') score += 6;
    if (ritual.meditate   === 'yes') score += 8;

    // Sleep quality
    const sleep = t.sleep_hours;
    if (sleep != null) {
      if (sleep >= 7 && sleep <= 9) score += 12;
      else if (sleep >= 6)          score += 6;
      else if (sleep < 6)           score -= 8;
    }

    // Energy score
    const energy = t.energy;
    if (energy != null) {
      if (energy >= 8) score += 10;
      else if (energy >= 6) score += 5;
      else if (energy <= 3) score -= 8;
    }

    // Sober streak
    const soberStreak = s.sober_days ?? 0;
    if (soberStreak >= 30)     score += 15;
    else if (soberStreak >= 7)  score += 10;
    else if (soberStreak >= 3)  score += 5;
    else if (soberStreak === 0) score -= 5;

    // Sport streak
    const sportStreak = s.sport_days ?? 0;
    if (sportStreak >= 14)    score += 15;
    else if (sportStreak >= 7) score += 10;
    else if (sportStreak >= 3) score += 5;

    // Today's drinks
    const drinks = t.drinks;
    if (drinks === 0)        score += 10;
    else if (drinks != null && drinks <= 2) score -= 5;
    else if (drinks != null)  score -= 20;

    // Mood
    if (t.mood === 'good') score += 8;
    else if (t.mood === 'low') score -= 8;

    // Outdoor
    if (t.outdoor === 'yes') score += 5;

    // Recent trend (last 3 days drinks)
    const recent = h.slice(0, 3).map(d => d.drinks ?? 0);
    const avgDrinks = recent.length ? recent.reduce((a,b) => a+b, 0) / recent.length : 0;
    if (avgDrinks > 3) score -= 10;
    if (avgDrinks === 0 && recent.length >= 2) score += 5; // sober streak bonus

    score = Math.max(0, Math.min(100, score));

    if (score >= 80) return { level: 'PEAK',     score, color: '#00d4ff', desc: 'Operating at peak. Everything is clicking.' };
    if (score >= 60) return { level: 'BUILDING', score, color: '#00ff88', desc: 'Momentum is building. Keep going.' };
    if (score >= 40) return { level: 'STEADY',   score, color: '#f5a623', desc: 'Steady progress. Small steps forward.' };
    if (score >= 20) return { level: 'RESET',    score, color: '#ff8c00', desc: 'Momentum needs rebuilding. Start now.' };
    return               { level: 'REBUILD',  score, color: '#ff4466', desc: 'Start fresh. One good choice changes the trajectory.' };
  },

  // ── Memory ────────────────────────────────────────
  defaultToday() {
    return {
      drinks: null, sport: null, mood: null, water: null,
      journal: '', wake: null, outdoor: null,
      sleep_hours: null, energy: null, plan: '',
      morning_ritual: { stretch: null, shower: null, breakfast: null, meditate: null }
    };
  },

  defaultMemory() {
    return {
      today: this.defaultToday(),
      streaks: { sober_days: 0, sport_days: 0, sober_best: 0, sport_best: 0, ritual_days: 0, ritual_best: 0 },
      goals: { weekly: [], monthly: [], quarterly: [] },
      history: [], lastDate: null, debriefs: [],
      relationships: []
    };
  },

  migrateMemory(memory) {
    if (!memory.debriefs)    memory.debriefs = [];
    if (!memory.goals)       memory.goals = { weekly: [], monthly: [], quarterly: [] };
    if (!memory.relationships) memory.relationships = [];
    if (!memory.today.journal)  memory.today.journal = '';
    if (!('wake'    in memory.today)) memory.today.wake = null;
    if (!('outdoor' in memory.today)) memory.today.outdoor = null;
    if (!('sleep_hours' in memory.today)) memory.today.sleep_hours = null;
    if (!('energy'  in memory.today)) memory.today.energy = null;
    if (!('plan'    in memory.today)) memory.today.plan = '';
    if (!memory.today.morning_ritual) memory.today.morning_ritual = { stretch: null, shower: null, breakfast: null, meditate: null };
    if (!memory.streaks.ritual_days) memory.streaks.ritual_days = 0;
    if (!memory.streaks.ritual_best) memory.streaks.ritual_best = 0;
    return memory;
  },

  loadMemory() {
    const defaults = this.defaultMemory();
    try {
      const saved = localStorage.getItem('jarvisphine_memory');
      if (!saved) return defaults;
      const memory = this.migrateMemory(JSON.parse(saved));

      const today = new Date().toDateString();
      if (memory.lastDate !== today) {
        if (memory.lastDate && memory.today) {
          memory.history.unshift({ date: memory.lastDate, ...memory.today });
          if (memory.history.length > 90) memory.history.pop();
          // Update ritual streak on rollover
          const ritualDone = this.calcMorningRitualScore(memory.today.morning_ritual) >= 75;
          this.updateStreak(memory, 'ritual_days', ritualDone);
        }
        memory.today = this.defaultToday();
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
      if (!s.provider)    s.provider    = 'deepseek';
      if (!s.topics)      s.topics      = 'science, psychology, history, philosophy';
      return s;
    } catch { return { personality: 'sharp', provider: 'deepseek', topics: 'science, psychology, history, philosophy' }; }
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
      SUPABASE.set('settings', { userName: settings.userName, provider: settings.provider, personality: settings.personality, topics: settings.topics }),
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
      version: '6.0',
      exportDate: new Date().toISOString(),
      memory, chatHistory, saveStates: saveStates || [],
      settings: { userName: settings.userName, provider: settings.provider, personality: settings.personality, topics: settings.topics }
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
      if (memory.streaks[best] !== undefined && memory.streaks[type] > memory.streaks[best]) {
        memory.streaks[best] = memory.streaks[type];
      }
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
    if (msg.match(/feel.*bad|feel.*low|feel.*rough|bad day/))      data.mood = 'low';
    if (msg.match(/feel.*ok|feel.*alright|mood.*ok/))              data.mood = 'neutral';

    const wm = msg.match(/(\d+)\s*(glass|glasses|litre|liter)\s*(of\s*)?water/);
    if (wm) data.water = parseInt(wm[1]);

    // Wake time
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

    if (msg.match(/went outside|went out|got outside|outdoor|fresh air/)) data.outdoor = 'yes';
    if (msg.match(/stayed (in|home|inside)|didn't go out|no outdoor/))    data.outdoor = 'no';

    // Sleep hours
    const sleepMatch = msg.match(/slept?\s+(?:for\s+)?(\d+\.?\d*)\s*(?:hours?|hrs?)/i) ||
                       msg.match(/(\d+\.?\d*)\s*hours?\s+(?:of\s+)?sleep/i);
    if (sleepMatch) data.sleep_hours = parseFloat(sleepMatch[1]);

    // Energy
    const energyMatch = msg.match(/energy\s+(?:is\s+|level\s+)?(\d+)\s*(?:\/\s*10|out of 10)?/i) ||
                        msg.match(/(?:feeling|feel)\s+(\d+)\s*(?:\/\s*10|out of 10)/i);
    if (energyMatch) {
      const e = parseInt(energyMatch[1]);
      if (e >= 1 && e <= 10) data.energy = e;
    }

    return data;
  },

  // ── API Call — via backend proxy ──────────────────
  async callAPI(messages, systemPrompt, settings) {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages, systemPrompt,
        provider: settings.provider || 'claude'
      })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `Server error ${r.status} — is the backend running?`);
    }
    const d = await r.json();
    return d.reply;
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
