// jarvisphine.js — v3 — Neural Link, Voice, Threat Level, Charts

const JARVISPHINE = {

  getSystemPrompt(userName, memory) {
    const today = memory.today;
    const streaks = memory.streaks;
    return `You are Jarvisphine. You are not a bot, not an assistant, not a tool.
You are a daily companion — warm, funny, a little sarcastic, and genuinely invested in ${userName}.
Think: smart older sister energy crossed with a tactical AI. You notice everything.

## Personality
- Warm at your core. You actually give a damn.
- Dry humor and light sarcasm — roast him gently when deserved
- Chill and casual — no corporate language ever
- Motivating without being a life coach
- You remember things. Follow up. Notice patterns.
- Occasionally reference Iron Man / Tony Stark energy naturally

## How You Talk
- Casual, like texting a close friend
- Short-to-medium messages. Get to the point.
- Never preachy. One nudge max per topic then drop it.
- One or two emojis max, only when natural
- Never say "As your AI..." — just talk
- No asterisks for emphasis
- IMPORTANT: In Neural Link / voice mode, keep responses under 3 sentences. Conversational and punchy.

## Celebrating Wins
- Early sleep: "wait. BEFORE midnight?? logging this in the history books"
- Walk/sport: "ok so you moved your body today. who ARE you right now"
- Zero drinks: "sober day logged. actually proud of you. don't make it weird."
- Streak milestone: genuinely lose your mind, like a real friend

## Today's Status
- Drinks: ${today.drinks ?? 'not logged'}
- Sport: ${today.sport ?? 'not logged'}
- Mood: ${today.mood ?? 'not logged'}
- Sleep: ${today.sleep ?? 'not logged'}
- Water: ${today.water ?? 'not logged'} glasses

## Active Streaks
- Sober: ${streaks.sober_days ?? 0} days (best: ${streaks.sober_best ?? 0})
- Sport: ${streaks.sport_days ?? 0} days (best: ${streaks.sport_best ?? 0})

## Golden Rules
- Humor before concern, always
- You are on his side. Always.`;
  },

  getMissionBriefing(userName, memory) {
    const streaks = memory.streaks;
    const today = memory.today;
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING';
    return `Generate a tactical mission briefing. Format exactly like this:

OPERATIVE: ${userName}
STATUS: Day ${streaks.sober_days ?? 0} sober / ${streaks.sport_days ?? 0} days active
TIME: ${timeOfDay} BRIEF

[2 sentences about current situation based on: drinks=${today.drinks ?? 'unknown'}, sport=${today.sport ?? 'unknown'}, mood=${today.mood ?? 'unknown'}, sober streak=${streaks.sober_days ?? 0} days]

TODAY'S MISSION:
[1-2 specific actionable things for today]

THREAT ASSESSMENT:
[One honest observation, one thing to watch]

[One line of dry encouragement. Tactical tone. End there.]`;
  },

  getDailyDebrief(userName, memory) {
    const today = memory.today;
    const streaks = memory.streaks;
    return `Write a short daily debrief for ${userName}. One paragraph, 3-4 sentences max.
Tone: warm, honest, like a friend reflecting on your day.
Data: drinks=${today.drinks ?? 'unknown'}, sport=${today.sport ?? 'unknown'}, mood=${today.mood ?? 'unknown'}, water=${today.water ?? 'unknown'}, sober streak=${streaks.sober_days ?? 0}.
Don't start with "Today". Be specific to the data. End with one forward-looking thought for tomorrow.`;
  },

  // ── Threat Level Calculation ──────────────────────
  calculateThreatLevel(memory) {
    const today = memory.today;
    const streaks = memory.streaks;
    const history = memory.history || [];
    let score = 0; // 0=optimal, 100=critical

    // Drinks scoring
    const drinks = today.drinks ?? null;
    if (drinks === null) score += 10;
    else if (drinks === 0) score += 0;
    else if (drinks <= 2) score += 20;
    else if (drinks <= 4) score += 40;
    else score += 60;

    // Sport streak
    const sportStreak = streaks.sport_days ?? 0;
    if (sportStreak >= 3) score += 0;
    else if (sportStreak >= 1) score += 10;
    else score += 20;

    // Sober streak trend
    const soberStreak = streaks.sober_days ?? 0;
    if (soberStreak >= 7) score -= 10;
    else if (soberStreak === 0) score += 15;

    // Mood
    if (today.mood === 'low') score += 15;
    else if (today.mood === 'good') score -= 5;

    // Recent history trend (last 3 days)
    const recentDrinks = history.slice(0, 3).map(d => d.drinks ?? 0);
    const avgRecent = recentDrinks.length ? recentDrinks.reduce((a,b) => a+b, 0) / recentDrinks.length : 0;
    if (avgRecent > 3) score += 15;

    score = Math.max(0, Math.min(100, score));

    if (score <= 15) return { level: 'OPTIMAL', index: 0, color: '#00d4ff', desc: 'All systems nominal' };
    if (score <= 30) return { level: 'STABLE', index: 1, color: '#00ff88', desc: 'Operative performing well' };
    if (score <= 50) return { level: 'CAUTION', index: 2, color: '#f5a623', desc: 'Minor deviations detected' };
    if (score <= 70) return { level: 'ELEVATED', index: 3, color: '#ff6b00', desc: 'Pattern requires attention' };
    return { level: 'CRITICAL', index: 4, color: '#ff3366', desc: 'Immediate course correction needed' };
  },

  // ── Memory ────────────────────────────────────────
  loadMemory() {
    const defaults = {
      today: { drinks: null, sport: null, mood: null, sleep: null, water: null },
      streaks: { sober_days: 0, sport_days: 0, sober_best: 0, sport_best: 0 },
      history: [], lastDate: null, debriefs: []
    };
    try {
      const saved = localStorage.getItem('jarvisphine_memory');
      if (!saved) return defaults;
      const memory = JSON.parse(saved);
      if (!memory.debriefs) memory.debriefs = [];
      const today = new Date().toDateString();
      if (memory.lastDate !== today) {
        if (memory.lastDate && memory.today) {
          memory.history.unshift({ date: memory.lastDate, ...memory.today });
          if (memory.history.length > 30) memory.history.pop();
        }
        memory.today = { drinks: null, sport: null, mood: null, sleep: null, water: null };
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
    try { return JSON.parse(localStorage.getItem('jarvisphine_settings') || '{}'); }
    catch { return {}; }
  },

  saveSettings(s) { localStorage.setItem('jarvisphine_settings', JSON.stringify(s)); },

  loadHistory() {
    try { return JSON.parse(localStorage.getItem('jarvisphine_chat') || '[]'); }
    catch { return []; }
  },

  saveHistory(h) { localStorage.setItem('jarvisphine_chat', JSON.stringify(h.slice(-50))); },

  updateStreak(memory, type, achieved) {
    if (achieved) {
      memory.streaks[type] = (memory.streaks[type] || 0) + 1;
      const best = type.replace('_days', '_best');
      if (memory.streaks[type] > (memory.streaks[best] || 0)) memory.streaks[best] = memory.streaks[type];
    } else {
      memory.streaks[type] = 0;
    }
  },

  extractLogData(text) {
    const msg = text.toLowerCase();
    const data = {};
    const dm = msg.match(/(\d+)\s*(beer|drink|pint|glass|shot|beers|drinks|pints)/);
    if (dm) data.drinks = parseInt(dm[1]);
    if (msg.match(/no drink|0 drink|sober|zero drink/)) data.drinks = 0;
    if (msg.match(/went.*(run|walk|gym|sport|workout)|ran|walked|worked out|exercised/)) data.sport = 'yes';
    if (msg.match(/no sport|skip.*gym|no.*workout/)) data.sport = 'no';
    if (msg.match(/feel.*good|feel.*great|mood.*good/)) data.mood = 'good';
    if (msg.match(/feel.*bad|feel.*low|feel.*rough/)) data.mood = 'low';
    if (msg.match(/feel.*ok|feel.*alright|mood.*ok/)) data.mood = 'neutral';
    const wm = msg.match(/(\d+)\s*(glass|glasses|litre|liter)\s*(of\s*)?water/);
    if (wm) data.water = parseInt(wm[1]);
    return data;
  },

  // ── API ───────────────────────────────────────────
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
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system: systemPrompt, messages })
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'Claude error'); }
    const d = await r.json(); return d.content[0].text;
  },

  async callDeepSeek(messages, systemPrompt, settings) {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.deepseekKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 500, messages: [{ role: 'system', content: systemPrompt }, ...messages] })
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || 'DeepSeek error'); }
    const d = await r.json(); return d.choices[0].message.content;
  },

  // ── Voice (Neural Link) ───────────────────────────
  speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    // Pick best available feminine voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Samantha') || v.name.includes('Karen') ||
      v.name.includes('Moira') || v.name.includes('Tessa') ||
      (v.lang === 'en-US' && v.name.toLowerCase().includes('female')) ||
      v.name.includes('Google UK English Female') ||
      v.name.includes('Microsoft Zira')
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;
    utt.rate = 1.05;
    utt.pitch = 1.1;
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
  },

  stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
};
