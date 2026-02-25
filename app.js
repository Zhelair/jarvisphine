// app.js — v2 — Jarvisphine with voice, mission briefing, HUD

let currentScreen = 'chat';
let chatHistory = [];
let memory = {};
let settings = {};
let isTyping = false;
let isRecording = false;
let mediaRecorder = null;
let recognition = null;
let briefingGenerated = false;

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  memory = JARVISPHINE.loadMemory();
  settings = JARVISPHINE.loadSettings();
  chatHistory = JARVISPHINE.loadHistory();

  renderHome();
  renderStreaks();
  renderSettings();
  showScreen('chat');
  initVoice();
  runHUDBootSequence();

  if (!settings.apiKey && !settings.deepseekKey) {
    showScreen('settings');
    showToast('SYSTEM: API key required to initialize 🔑');
  } else if (chatHistory.length === 0) {
    setTimeout(() => {
      sendJarvisphineMessage("systems online. hey — I'm Jarvisphine. I'll be checking in on you daily. no lectures, just real talk. how's today looking so far?");
    }, 2000);
  } else {
    renderChat();
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('saveSettings').addEventListener('click', saveSettingsFn);
  document.getElementById('generateBriefing').addEventListener('click', generateMissionBriefing);

  document.querySelectorAll('.quick-log').forEach(btn => {
    btn.addEventListener('click', () => quickLog(btn.dataset.type, btn.dataset.value));
  });

  // Voice button
  const voiceBtn = document.getElementById('voiceBtn');
  voiceBtn.addEventListener('mousedown', startVoice);
  voiceBtn.addEventListener('touchstart', e => { e.preventDefault(); startVoice(); });
  voiceBtn.addEventListener('mouseup', stopVoice);
  voiceBtn.addEventListener('mouseleave', stopVoice);
  voiceBtn.addEventListener('touchend', stopVoice);

  // Provider toggle
  document.querySelectorAll('.provider-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.provider-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      settings.provider = btn.dataset.provider;
      JARVISPHINE.saveSettings(settings);
      updateProviderStatus();
    });
  });
});

// ── HUD Boot Sequence ─────────────────────────────────
function runHUDBootSequence() {
  const lines = [
    'INITIALIZING JARVISPHINE v2.0...',
    'LOADING PERSONALITY MATRIX...',
    'CONNECTING NEURAL INTERFACE...',
    'COMPANION SYSTEMS ONLINE.'
  ];
  const el = document.getElementById('bootText');
  if (!el) return;
  let i = 0;
  const interval = setInterval(() => {
    el.textContent = lines[i];
    i++;
    if (i >= lines.length) {
      clearInterval(interval);
      setTimeout(() => {
        const boot = document.getElementById('bootOverlay');
        if (boot) boot.classList.add('hidden');
      }, 800);
    }
  }, 500);
}

// ── Screen Navigation ─────────────────────────────────
function showScreen(name) {
  currentScreen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + name)?.classList.add('active');
  document.querySelector(`.nav-btn[data-screen="${name}"]`)?.classList.add('active');
  if (name === 'home') { renderHome(); if (!briefingGenerated) generateMissionBriefing(); }
  if (name === 'streaks') renderStreaks();
}

// ── Chat ──────────────────────────────────────────────
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
  if (c) c.scrollTop = c.scrollHeight;
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

async function sendMessage(overrideText) {
  if (isTyping) return;
  const input = document.getElementById('chatInput');
  const text = overrideText || input.value.trim();
  if (!text) return;
  if (!settings.apiKey && !settings.deepseekKey) {
    showToast('SYSTEM ERROR: No API key detected');
    showScreen('settings');
    return;
  }

  input.value = '';
  appendMessageToDOM('user', text);
  chatHistory.push({ role: 'user', content: text });

  const logData = JARVISPHINE.extractLogData(text);
  if (Object.keys(logData).length > 0) {
    Object.assign(memory.today, logData);
    if (typeof logData.drinks === 'number') {
      JARVISPHINE.updateStreak(memory, 'sober_days', logData.drinks === 0);
    }
    if (logData.sport === 'yes') JARVISPHINE.updateStreak(memory, 'sport_days', true);
    if (logData.sport === 'no') JARVISPHINE.updateStreak(memory, 'sport_days', false);
    JARVISPHINE.saveMemory(memory);
    renderHome();
  }

  isTyping = true;
  showTypingIndicator();

  try {
    const systemPrompt = JARVISPHINE.getSystemPrompt(settings.userName || 'Никит', memory);
    const messages = chatHistory.slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    const response = await JARVISPHINE.callAPI(messages, systemPrompt, settings);
    removeTypingIndicator();
    sendJarvisphineMessage(response);
  } catch (err) {
    removeTypingIndicator();
    sendJarvisphineMessage(`SYSTEM ERROR: ${err.message}. Check your API key in settings.`);
    console.error(err);
  }
  isTyping = false;
}

function sendJarvisphineMessage(content) {
  appendMessageToDOM('assistant', content);
  chatHistory.push({ role: 'assistant', content });
  JARVISPHINE.saveHistory(chatHistory);
  updateLastMessage(content);
}

// ── Voice Input ───────────────────────────────────────
function initVoice() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      document.getElementById('chatInput').value = transcript;
      if (e.results[e.results.length - 1].isFinal) {
        stopVoice();
        setTimeout(() => sendMessage(), 300);
      }
    };

    recognition.onerror = () => { stopVoice(); showToast('Voice not recognized — try again'); };
    recognition.onend = () => stopVoice();
  }
}

function startVoice() {
  if (!recognition) { showToast('Voice not supported in this browser'); return; }
  if (isRecording) return;
  isRecording = true;
  document.getElementById('voiceBtn').classList.add('recording');
  recognition.start();
  showToast('🎙️ Listening...');
}

function stopVoice() {
  if (!isRecording) return;
  isRecording = false;
  document.getElementById('voiceBtn').classList.remove('recording');
  if (recognition) { try { recognition.stop(); } catch(e) {} }
}

// ── Mission Briefing ──────────────────────────────────
async function generateMissionBriefing() {
  if (!settings.apiKey && !settings.deepseekKey) return;
  const btn = document.getElementById('generateBriefing');
  const briefingEl = document.getElementById('missionBriefingText');
  btn.textContent = 'GENERATING...';
  btn.disabled = true;
  briefingEl.innerHTML = '<span class="scanning">SCANNING OPERATIVE DATA...</span>';

  try {
    const prompt = JARVISPHINE.getMissionBriefing(settings.userName || 'Никит', memory);
    const messages = [{ role: 'user', content: prompt }];
    const response = await JARVISPHINE.callAPI(messages, 'You are a tactical AI briefing system. Be concise and punchy.', settings);
    briefingEl.innerHTML = response.replace(/\n/g, '<br>');
    briefingGenerated = true;
  } catch (err) {
    briefingEl.textContent = 'BRIEFING UNAVAILABLE — check API connection';
  }
  btn.textContent = 'REFRESH BRIEFING';
  btn.disabled = false;
}

// ── Quick Log ─────────────────────────────────────────
function quickLog(type, value) {
  const parsed = isNaN(value) ? value : parseInt(value);
  memory.today[type] = parsed;
  if (type === 'drinks') JARVISPHINE.updateStreak(memory, 'sober_days', parsed === 0);
  if (type === 'sport') JARVISPHINE.updateStreak(memory, 'sport_days', value === 'yes');
  JARVISPHINE.saveMemory(memory);
  renderHome();

  const msgs = {
    'drinks-0': "logged 0 drinks today", 'drinks-1': "had 1 drink",
    'drinks-2': "had 2 drinks", 'drinks-3': "had 3+ drinks",
    'sport-yes': "did sport today", 'sport-no': "skipped sport",
    'mood-good': "mood is good today", 'mood-neutral': "mood is okay",
    'mood-low': "mood is low today", 'water-2': "drank 2 glasses of water",
    'water-6': "drank 6 glasses of water", 'water-8': "drank 8 glasses of water"
  };
  const key = `${type}-${value}`;
  if (msgs[key]) { showScreen('chat'); sendMessage(msgs[key]); }
}

// ── Home ──────────────────────────────────────────────
function renderHome() {
  const today = memory.today || {};
  const streaks = memory.streaks || {};

  // Animate stat values
  animateStat('stat-drinks', today.drinks ?? '—');
  animateStat('stat-sport', today.sport ?? '—');
  animateStat('stat-mood', today.mood ?? '—');
  animateStat('stat-water', today.water != null ? today.water + ' gl' : '—');
  animateStat('streak-sober', streaks.sober_days ?? 0);
  animateStat('streak-sport', streaks.sport_days ?? 0);
}

function animateStat(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('updating');
  setTimeout(() => { el.textContent = value; el.classList.remove('updating'); }, 150);
}

function updateLastMessage(content) {
  const el = document.getElementById('lastMessage');
  if (el) el.textContent = content.slice(0, 90) + (content.length > 90 ? '...' : '');
}

// ── Streaks ───────────────────────────────────────────
function renderStreaks() {
  const streaks = memory.streaks || {};
  const history = memory.history || [];
  document.getElementById('s-sober-current').textContent = streaks.sober_days ?? 0;
  document.getElementById('s-sober-best').textContent = streaks.sober_best ?? 0;
  document.getElementById('s-sport-current').textContent = streaks.sport_days ?? 0;
  document.getElementById('s-sport-best').textContent = streaks.sport_best ?? 0;

  const container = document.getElementById('historyList');
  container.innerHTML = '';
  if (!history.length) {
    container.innerHTML = '<p class="empty-state">// NO HISTORICAL DATA — check in daily to build your record</p>';
    return;
  }
  history.slice(0, 7).forEach(day => {
    const div = document.createElement('div');
    div.className = 'history-row';
    div.innerHTML = `
      <span class="hist-date">${day.date}</span>
      <span class="hist-pill drinks">🍺 ${day.drinks ?? '—'}</span>
      <span class="hist-pill sport">🏃 ${day.sport ?? '—'}</span>
      <span class="hist-pill mood">😊 ${day.mood ?? '—'}</span>
    `;
    container.appendChild(div);
  });
}

// ── Settings ──────────────────────────────────────────
function renderSettings() {
  document.getElementById('apiKeyInput').value = settings.apiKey || '';
  document.getElementById('deepseekKeyInput').value = settings.deepseekKey || '';
  document.getElementById('userNameInput').value = settings.userName || '';
  const provider = settings.provider || 'claude';
  document.querySelectorAll('.provider-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });
  updateProviderStatus();
}

function updateProviderStatus() {
  const provider = settings.provider || 'claude';
  const el = document.getElementById('providerStatus');
  if (el) el.textContent = provider === 'deepseek' ? '// DEEPSEEK ACTIVE' : '// CLAUDE HAIKU ACTIVE';
}

function saveSettingsFn() {
  settings.apiKey = document.getElementById('apiKeyInput').value.trim();
  settings.deepseekKey = document.getElementById('deepseekKeyInput').value.trim();
  settings.userName = document.getElementById('userNameInput').value.trim() || 'Никит';
  JARVISPHINE.saveSettings(settings);
  updateProviderStatus();
  showToast('SETTINGS SAVED ✓');
  showScreen('chat');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
