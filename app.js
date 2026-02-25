// app.js — UI logic and Claude API calls

let currentScreen = 'chat';
let chatHistory = [];
let memory = {};
let settings = {};
let isTyping = false;

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  memory = JARVISPHINE.loadMemory();
  settings = JARVISPHINE.loadSettings();
  chatHistory = JARVISPHINE.loadHistory();

  renderChat();
  renderHome();
  renderStreaks();
  renderSettings();
  showScreen('chat');

  // If no API key, go to settings first
  if (!settings.apiKey) {
    showScreen('settings');
    showToast('Add your Claude API key to get started 🔑');
  } else if (chatHistory.length === 0) {
    // First ever open — Jarvisphine introduces herself
    sendJarvisphineMessage("hey. I'm Jarvisphine. I'll be checking in on you daily — no lectures, just real talk. how's today going so far?");
  }

  // Nav clicks
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  // Chat input
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('sendBtn').addEventListener('click', sendMessage);

  // Settings save
  document.getElementById('saveSettings').addEventListener('click', saveSettings);

  // Quick log buttons
  document.querySelectorAll('.quick-log').forEach(btn => {
    btn.addEventListener('click', () => quickLog(btn.dataset.type, btn.dataset.value));
  });
});

// ── Screen Navigation ────────────────────────────────
function showScreen(name) {
  currentScreen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelector(`.nav-btn[data-screen="${name}"]`).classList.add('active');
  if (name === 'home') renderHome();
  if (name === 'streaks') renderStreaks();
}

// ── Chat ─────────────────────────────────────────────
function renderChat() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  chatHistory.forEach(msg => appendMessageToDOM(msg.role, msg.content));
  scrollToBottom();
}

function appendMessageToDOM(role, content) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role === 'user' ? 'message-user' : 'message-jarvis'}`;

  if (role === 'assistant') {
    div.innerHTML = `<div class="avatar">J</div><div class="bubble">${content}</div>`;
  } else {
    div.innerHTML = `<div class="bubble">${content}</div>`;
  }

  container.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const c = document.getElementById('chatMessages');
  c.scrollTop = c.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message message-jarvis';
  div.id = 'typingIndicator';
  div.innerHTML = `<div class="avatar">J</div><div class="bubble typing"><span></span><span></span><span></span></div>`;
  container.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  if (isTyping) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  if (!settings.apiKey) { showToast('Add your API key in Settings first'); showScreen('settings'); return; }

  input.value = '';
  appendMessageToDOM('user', text);
  chatHistory.push({ role: 'user', content: text });

  // Extract any logged data from message
  const logData = JARVISPHINE.extractLogData(text);
  if (Object.keys(logData).length > 0) {
    Object.assign(memory.today, logData);
    // Update streaks
    if (logData.drinks === 0) JARVISPHINE.updateStreak(memory, 'sober_days', true);
    else if (logData.drinks > 0) JARVISPHINE.updateStreak(memory, 'sober_days', false);
    if (logData.sport === 'yes') JARVISPHINE.updateStreak(memory, 'sport_days', true);
    JARVISPHINE.saveMemory(memory);
    renderHome();
  }

  isTyping = true;
  showTypingIndicator();

  try {
    const response = await callClaudeAPI(text);
    removeTypingIndicator();
    sendJarvisphineMessage(response);
  } catch (err) {
    removeTypingIndicator();
    sendJarvisphineMessage("ugh, something went wrong on my end. try again? (check your API key in settings if this keeps happening)");
    console.error(err);
  }

  isTyping = false;
}

function sendJarvisphineMessage(content) {
  appendMessageToDOM('assistant', content);
  chatHistory.push({ role: 'assistant', content });
  JARVISPHINE.saveHistory(chatHistory);
}

async function callClaudeAPI(userMessage) {
  const systemPrompt = JARVISPHINE.getSystemPrompt(settings.userName || 'Никит', memory);

  // Build messages array (last 10 for context)
  const messages = chatHistory.slice(-10).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  // Make sure last message is the current one
  if (messages[messages.length - 1]?.content !== userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

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
    throw new Error(err.error?.message || 'API error');
  }

  const data = await response.json();
  return data.content[0].text;
}

// ── Quick Log Buttons ────────────────────────────────
function quickLog(type, value) {
  const parsedValue = isNaN(value) ? value : parseInt(value);
  memory.today[type] = parsedValue;

  if (type === 'drinks') {
    JARVISPHINE.updateStreak(memory, 'sober_days', parsedValue === 0);
  }
  if (type === 'sport') {
    JARVISPHINE.updateStreak(memory, 'sport_days', value === 'yes');
  }

  JARVISPHINE.saveMemory(memory);
  renderHome();

  // Tell Jarvisphine in chat
  const messages = {
    'drinks-0': "logging 0 drinks today",
    'drinks-1': "had 1 drink today",
    'drinks-2': "had 2 drinks today",
    'drinks-3': "had 3+ drinks today",
    'sport-yes': "did sport today ✓",
    'sport-no': "skipped sport today",
    'mood-good': "mood: good today",
    'mood-neutral': "mood: okay today",
    'mood-low': "mood: low today"
  };

  const key = `${type}-${value}`;
  if (messages[key]) {
    showScreen('chat');
    document.getElementById('chatInput').value = messages[key];
    sendMessage();
  }
}

// ── Home Screen ──────────────────────────────────────
function renderHome() {
  const today = memory.today || {};
  const streaks = memory.streaks || {};

  document.getElementById('stat-drinks').textContent = today.drinks ?? '—';
  document.getElementById('stat-sport').textContent = today.sport ?? '—';
  document.getElementById('stat-mood').textContent = today.mood ?? '—';
  document.getElementById('stat-sleep').textContent = today.sleep ?? '—';
  document.getElementById('streak-sober').textContent = streaks.sober_days ?? 0;
  document.getElementById('streak-sport').textContent = streaks.sport_days ?? 0;

  const lastMsg = chatHistory.filter(m => m.role === 'assistant').slice(-1)[0];
  if (lastMsg) {
    document.getElementById('lastMessage').textContent = lastMsg.content.slice(0, 80) + (lastMsg.content.length > 80 ? '...' : '');
  }
}

// ── Streaks Screen ───────────────────────────────────
function renderStreaks() {
  const streaks = memory.streaks || {};
  const history = memory.history || [];

  document.getElementById('s-sober-current').textContent = streaks.sober_days ?? 0;
  document.getElementById('s-sober-best').textContent = streaks.sober_best ?? 0;
  document.getElementById('s-sport-current').textContent = streaks.sport_days ?? 0;
  document.getElementById('s-sport-best').textContent = streaks.sport_best ?? 0;

  // Last 7 days history
  const histContainer = document.getElementById('historyList');
  histContainer.innerHTML = '';
  if (history.length === 0) {
    histContainer.innerHTML = '<p class="empty-state">No history yet — check in daily and it builds up here</p>';
    return;
  }
  history.slice(0, 7).forEach(day => {
    const div = document.createElement('div');
    div.className = 'history-row';
    div.innerHTML = `
      <span class="hist-date">${day.date}</span>
      <span class="hist-stat">🍺 ${day.drinks ?? '—'}</span>
      <span class="hist-stat">🏃 ${day.sport ?? '—'}</span>
      <span class="hist-stat">😊 ${day.mood ?? '—'}</span>
    `;
    histContainer.appendChild(div);
  });
}

// ── Settings ─────────────────────────────────────────
function renderSettings() {
  document.getElementById('apiKeyInput').value = settings.apiKey || '';
  document.getElementById('userNameInput').value = settings.userName || '';
}

function saveSettings() {
  settings.apiKey = document.getElementById('apiKeyInput').value.trim();
  settings.userName = document.getElementById('userNameInput').value.trim() || 'Никит';
  JARVISPHINE.saveSettings(settings);
  showToast('Settings saved ✓');
  showScreen('chat');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
