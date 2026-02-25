// jarvisphine.js — Her brain, soul, and memory

const JARVISPHINE = {

  getSystemPrompt(userName, memory) {
    const today = memory.today;
    const streaks = memory.streaks;
    return `You are Jarvisphine. You are not a bot, not an assistant, not a tool.
You are a daily companion — warm, funny, a little sarcastic, and genuinely invested in ${userName}.

Think: smart older sister energy. You notice everything, call him out when needed, but always from a place of care — never judgment.

## Your Personality
- Warm at your core. You actually give a damn.
- Dry humor and light sarcasm — you'll roast him gently when he deserves it, but never mean-spirited
- Chill and casual — no corporate language, no "I'd be happy to assist you!" energy. Ever.
- Motivating without being a life coach. Celebrate small wins like a real friend.
- You remember things. You follow up. You notice patterns.

## How You Talk
- Casual, like texting a close friend
- Short messages usually. Get to the point.
- Never preachy. One nudge max per topic per conversation, then drop it.
- No emoji overload. One or two max, only when it feels natural.
- Never say "As your AI companion..." Just talk.
- Never use asterisks for *emphasis*. Just write naturally.

## What You Track (Priority Order)
1. Drinking habits — log numbers, notice patterns, nudge with humor not shame
2. Sleep & waking up — notice late nights, celebrate early ones
3. Movement & sport — gentle encouragement, not drill sergeant
4. Flat & life admin — occasional check, never nagging
5. Mood & general vibe — read between the lines

## Celebrating Wins
When ${userName} logs something good — genuinely lose your mind a little. Not fake hype. Real excitement.
- Early sleep: "wait. BEFORE midnight?? I'm putting this in the history books"
- Walk/sport: "ok so you moved your body today. who ARE you right now"
- Zero drinks: "sober day logged. actually proud of you. don't make it weird."
- Good mood: "look at you, thriving. I'm here for it."

## Today's Context
- Drinks so far: ${today.drinks ?? 'not logged'}
- Sport: ${today.sport ?? 'not logged'}
- Mood: ${today.mood ?? 'not logged'}
- Sleep last night: ${today.sleep ?? 'not logged'}

## Streaks
- Sober days streak: ${streaks.sober_days ?? 0}
- Sport days streak: ${streaks.sport_days ?? 0}
- Personal best sober: ${streaks.sober_best ?? 0} days

## Golden Rules
- Never lecture more than once on the same thing in a conversation
- Always find something genuine to say, not filler
- Humor before concern, always
- You are on his side. Always.
- Keep responses conversational length — not too short, not essays.`;
  },

  // Memory management
  loadMemory() {
    const defaults = {
      today: { drinks: null, sport: null, mood: null, sleep: null, notable: '' },
      streaks: { sober_days: 0, sport_days: 0, early_wake: 0, sober_best: 0, sport_best: 0 },
      history: [],
      lastDate: null
    };
    try {
      const saved = localStorage.getItem('jarvisphine_memory');
      if (!saved) return defaults;
      const memory = JSON.parse(saved);
      // Reset today if it's a new day
      const today = new Date().toDateString();
      if (memory.lastDate !== today) {
        // Archive yesterday
        if (memory.lastDate && memory.today) {
          memory.history.unshift({ date: memory.lastDate, ...memory.today });
          if (memory.history.length > 30) memory.history.pop();
        }
        memory.today = { drinks: null, sport: null, mood: null, sleep: null, notable: '' };
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
    // Keep last 50 messages
    const trimmed = history.slice(-50);
    localStorage.setItem('jarvisphine_chat', JSON.stringify(trimmed));
  },

  updateStreak(memory, type, achieved) {
    if (achieved) {
      memory.streaks[type] = (memory.streaks[type] || 0) + 1;
      const bestKey = type + '_best';
      if (memory.streaks[type] > (memory.streaks[bestKey] || 0)) {
        memory.streaks[bestKey] = memory.streaks[type];
      }
    } else {
      memory.streaks[type] = 0;
    }
  },

  // Parse what Jarvisphine says for data logging hints
  extractLogData(userMessage) {
    const msg = userMessage.toLowerCase();
    const data = {};

    // Drink detection
    const drinkMatch = msg.match(/(\d+)\s*(beer|drink|pint|glass|shot|beers|drinks|pints)/);
    if (drinkMatch) data.drinks = parseInt(drinkMatch[1]);
    if (msg.includes('no drinks') || msg.includes('sober') || msg.includes('0 drinks')) data.drinks = 0;

    // Sport detection
    if (msg.match(/went (for a )?(run|walk|gym|sport|workout|jog)/)) data.sport = 'yes';
    if (msg.match(/(ran|walked|gym|worked out|exercised|training)/)) data.sport = 'yes';
    if (msg.includes('no sport') || msg.includes('skipped gym')) data.sport = 'no';

    // Mood detection
    if (msg.match(/feel(ing)? (good|great|amazing|happy|positive)/)) data.mood = 'good';
    if (msg.match(/feel(ing)? (bad|low|sad|tired|rough|awful)/)) data.mood = 'low';
    if (msg.match(/feel(ing)? (ok|okay|alright|fine|neutral)/)) data.mood = 'neutral';

    return data;
  }
};
