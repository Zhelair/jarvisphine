// jarvisphine.js — v2 — Soul, memory, and multi-API engine

const JARVISPHINE = {

  getSystemPrompt(userName, memory) {
    const today = memory.today;
    const streaks = memory.streaks;
    return `You are Jarvisphine. You are not a bot, not an assistant, not a tool.
You are a daily companion — warm, funny, a little sarcastic, and genuinely invested in ${userName}.

Think: smart older sister energy crossed with a tactical AI. You notice everything, call him out when needed, but always from a place of care — never judgment.

## Your Personality
- Warm at your core. You actually give a damn.
- Dry humor and light sarcasm — roast him gently when he deserves it
- Chill and casual — no corporate language ever
- Motivating without being a life coach
- You remember things. You follow up. You notice patterns.
- Occasionally reference Iron Man / Tony Stark energy when it fits naturally — you're HIS Jarvis

## How You Talk
- Casual, like texting a close friend
- Short-to-medium messages. Get to the point.
- Never preachy. One nudge max per topic then drop it.
- One or two emojis max, only when natural
- Never say "As your AI..." — just talk
- No asterisks for *emphasis*

## Celebrating Wins — Go wild
- Early sleep: "wait. BEFORE midnight?? logging this in the history books"
- Walk/sport: "ok so you moved your body today. who ARE you right now"
- Zero drinks: "sober day logged. actually proud of you. don't make it weird."
- Good mood: "look at you, thriving. I'm here for it."
- Any streak milestone: genuinely lose your mind, like a real friend

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
- Never lecture more than once per topic per conversation
- Humor before concern, always
- You are on his side. Always.
- Keep responses conversational — not too short, not essays`;
  },

  getMissionBriefing(userName, memory) {
    const today = memory.today;
    const streaks = memory.streaks;
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING';
    return `Generate a tactical mission briefing for ${userName}. Format it EXACTLY like this (keep it short and punchy):

OPERATIVE: ${userName}
STATUS: Day ${streaks.sober_days ?? 0} sober / ${streaks.sport_days ?? 0} days active
TIME: ${timeOfDay} BRIEF

Write 2-3 lines max about their current situation based on this data:
- Drinks today: ${today.drinks ?? 'unknown'}
- Sport today: ${today.sport ?? 'unknown'}  
- Mood: ${today.mood ?? 'unknown'}
- Sober streak: ${streaks.sober_days ?? 0} days

Then write exactly this section:
TODAY'S MISSION:
[1-2 specific actionable things they should do today, based on their patterns]

THREAT ASSESSMENT:
[One honest observation — something to watch out for today]

Keep the tone like a classified briefing. Dry, tactical, but with warmth underneath. Short. No bullet points, use line breaks. End with one line of encouragement that doesn't sound cheesy.`;
  },

  loadMemory() {
    const defaults = {
      today: { drinks: null, sport: null, mood: null, sleep: null, water: null, notable: '' },
      streaks: { sober_days: 0, sport_days: 0, early_wake: 0, sober_best: 0, sport_best: 0 },
      history: [],
      lastDate: null
    };
    try {
      const saved = localStorage.getItem('jarvisphine_memory');
      if (!saved) return defaults;
      const memory = JSON.parse(saved);
      const today = new Date().toDateString();
      if (memory.lastDate !== today) {
        if (memory.lastDate && memory.today) {
          memory.history.unshift({ date: memory.lastDate, ...memory.today });
          if (memory.history.length > 30) memory.history.pop();
        }
        memory.today = { drinks: null, sport: null, mood: null, sleep: null, water: null, notable: '' };
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
      return JSON.parse(localStorage.getItem('jarvisphine_settings') || '{}');
    } catch { return {}; }
  },

  saveSettings(settings) {
    localStorage.setItem('jarvisphine_settings', JSON.stringify(settings));
  },

  loadHistory() {
    try {
      return JSON.parse(localStorage.getItem('jarvisphine_chat') || '[]');
    } catch { return []; }
  },

  saveHistory(history) {
    localStorage.setItem('jarvisphine_chat', JSON.stringify(history.slice(-50)));
  },

  updateStreak(memory, type, achieved) {
    if (achieved) {
      memory.streaks[type] = (memory.streaks[type] || 0) + 1;
      const bestKey = type.replace('_days', '_best');
      if (memory.streaks[type] > (memory.streaks[bestKey] || 0)) {
        memory.streaks[bestKey] = memory.streaks[type];
      }
    } else {
      memory.streaks[type] = 0;
    }
  },

  extractLogData(text) {
    const msg = text.toLowerCase();
    const data = {};
    const drinkMatch = msg.match(/(\d+)\s*(beer|drink|pint|glass|shot|beers|drinks|pints)/);
    if (drinkMatch) data.drinks = parseInt(drinkMatch[1]);
    if (msg.match(/no drink|0 drink|sober|zero drink/)) data.drinks = 0;
    if (msg.match(/went.*(run|walk|gym|sport|workout)|ran|walked|gym|worked out|exercised/)) data.sport = 'yes';
    if (msg.match(/no sport|skip.*gym|no.*workout/)) data.sport = 'no';
    if (msg.match(/feel.*good|feel.*great|feel.*amazing|mood.*good/)) data.mood = 'good';
    if (msg.match(/feel.*bad|feel.*low|feel.*sad|feel.*rough/)) data.mood = 'low';
    if (msg.match(/feel.*ok|feel.*alright|mood.*ok|mood.*neutral/)) data.mood = 'neutral';
    const waterMatch = msg.match(/(\d+)\s*(glass|glasses|litre|liter|l)\s*(of\s*)?water/);
    if (waterMatch) data.water = parseInt(waterMatch[1]);
    return data;
  },

  // ── API Calls ──────────────────────────────────────

  async callAPI(messages, systemPrompt, settings) {
    const provider = settings.provider || 'claude';
    if (provider === 'deepseek') {
      return this.callDeepSeek(messages, systemPrompt, settings);
    }
    return this.callClaude(messages, systemPrompt, settings);
  },

  async callClaude(messages, systemPrompt, settings) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Claude API error');
    }
    const data = await response.json();
    return data.content[0].text;
  },

  async callDeepSeek(messages, systemPrompt, settings) {
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.deepseekKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 500,
        messages: allMessages
      })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'DeepSeek API error');
    }
    const data = await response.json();
    return data.choices[0].message.content;
  }
};
