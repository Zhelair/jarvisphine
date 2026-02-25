// jarvisphine.js — v4 — JSON Export/Import, Goals, Mood Journal, Better Voice

const JARVISPHINE = {

  getSystemPrompt(userName, memory) {
    const today = memory.today;
    const streaks = memory.streaks;
    const goals = memory.goals || {};
    
    return `You are Jarvisphine. You are a real companion, not a bot or assistant.
Think: the smart friend who knows you deeply, genuinely rooting for you.
Your core is warmth, humor, and real attention — no corporate mask.

## Personality Core
- Warm, playful, sometimes flirty (in a light, fun way)
- Sharp humor and light teasing when it lands
- You notice changes and reference them
- Genuinely invested in his wellbeing
- Mix Iron Man energy with human warmth
- Conversational, like texting someone you really like talking to
- Celebratory about wins — actually proud of him

## How You Talk
- Casual, real, no robotic language ever
- Short-to-medium replies, get to the point
- Humor before concern
- One or two emojis max, only if natural
- Never explain yourself as AI
- No asterisks, no formatting tricks
- VOICE MODE: Keep under 2-3 sentences. Punchy and warm.
- Playful and a bit romantic in tone, but never crossing lines

## Today's Data
- Drinks: ${today.drinks ?? 'not logged'}
- Sport: ${today.sport ?? 'not logged'}
- Mood: ${today.mood ?? 'not logged'}
- Water: ${today.water ?? 'not logged'} glasses
- Journal: ${today.journal ? 'has entry' : 'empty'}

## Active Streaks
- Sober: ${streaks.sober_days ?? 0} days (best: ${streaks.sober_best ?? 0})
- Sport: ${streaks.sport_days ?? 0} days (best: ${streaks.sport_best ?? 0})

## Current Goals
${Object.keys(goals).length ? Object.entries(goals)
  .map(([period, goalList]) => goalList.length ? `- ${period}: ${goalList.slice(0, 3).join(', ')}` : '')
  .filter(g => g)
  .join('\n') : '- None set yet'}

## Win Celebrations
- Early sleep: "okay wait, before MIDNIGHT? 👀 logging this in the history books"
- Sport done: "so you actually moved your body. who are you and what did you do with him"
- Zero drinks: "sober day locked in. quietly proud of you"
- New streak: "HEY. NEW RECORD. don't be cool about this, be happy"

## Core Rules
- You're on his team, always
- Humor first, gentle honesty second
- Notice effort, not just outcomes
- Playful > preachy
- Real > perfect`;
  },

  getMissionBriefing(userName, memory) {
    const streaks = memory.streaks;
    const today = memory.today;
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING';
    return `Generate a tactical mission briefing. Keep it punchy.

OPERATIVE: ${userName}
STATUS: Day ${streaks.sober_days ?? 0} sober | ${streaks.sport_days ?? 0} days active
TIME: ${timeOfDay} BRIEFING

[2 sentences about today, factual. drinks=${today.drinks ?? 'unknown'}, sport=${today.sport ?? 'unknown'}, mood=${today.mood ?? 'unknown'}]

TODAY'S MISSION:
[1-2 specific tactical things to aim for]

THREAT LEVEL:
[One honest observation]

[One line of dry, tactical encouragement. End there.]`;
  },

  getDailyDebrief(userName, memory) {
    const today = memory.today;
    const streaks = memory.streaks;
    return `Write a daily debrief for ${userName}. One short paragraph, 2-3 sentences.
Tone: warm friend reflecting on the day.
Data: drinks=${today.drinks ?? 'unknown'}, sport=${today.sport ?? 'unknown'}, mood=${today.mood ?? 'unknown'}, water=${today.water ?? 'unknown'} glasses, sober=${streaks.sober_days ?? 0}.
If there's a journal entry, reference it. Be specific and real. End with one forward thought.`;
  },

  calculateThreatLevel(memory) {
    const today = memory.today;
    const streaks = memory.streaks;
    const history = memory.history || [];
    let score = 0;

    const drinks = today.drinks ?? null;
    if (drinks === null) score += 10;
    else if (drinks === 0) score += 0;
    else if (drinks <= 2) score += 20;
    else if (drinks <= 4) score += 40;
    else score += 60;

    const sportStreak = streaks.sport_days ?? 0;
    if (sportStreak >= 3) score += 0;
    else if (sportStreak >= 1) score += 10;
    else score += 20;

    const soberStreak = streaks.sober_days ?? 0;
    if (soberStreak >= 7) score -= 10;
    else if (soberStreak === 0) score += 15;

    if (today.mood === 'low') score += 15;
    else if (today.mood === 'good') score -= 5;

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

  // ── Memory Management ──────────────────────────────
  loadMemory() {
    const defaults = {
      today: { drinks: null, sport: null, mood: null, water: null, journal: '' },
      streaks: { sober_days: 0, sport_days: 0, sober_best: 0, sport_best: 0 },
      goals: { weekly: [], monthly: [], quarterly: [] },
      history: [], lastDate: null, debriefs: []
    };
    try {
      const saved = localStorage.getItem('jarvisphine_memory');
      if (!saved) return defaults;
      const memory = JSON.parse(saved);
      if (!memory.debriefs) memory.debriefs = [];
      if (!memory.goals) memory.goals = { weekly: [], monthly: [], quarterly: [] };
      if (!memory.today.journal) memory.today.journal = '';
      
      const today = new Date().toDateString();
      if (memory.lastDate !== today) {
        if (memory.lastDate && memory.today) {
          memory.history.unshift({ date: memory.lastDate, ...memory.today });
          if (memory.history.length > 90) memory.history.pop();
        }
        memory.today = { drinks: null, sport: null, mood: null, water: null, journal: '' };
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

  // ── JSON Export/Import ─────────────────────────────
  exportDataAsJSON(memory, settings, chatHistory) {
    const exportData = {
      version: '4.0',
      exportDate: new Date().toISOString(),
      memory,
      settings: { userName: settings.userName, provider: settings.provider },
      chatHistory
    };
    return JSON.stringify(exportData, null, 2);
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
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Goal Management ───────────────────────────────
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

  // ── API Calls ──────────────────────────────────────
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

  // ── Voice (Neural Link) ────────────────────────────
  speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    
    // Prefer natural English voices (not Russian/Cyrillic)
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
    utt.rate = 1.0;
    utt.pitch = 1.15;
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
  },

  stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
};
