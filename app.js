// app.js — v4 — Goals, Journal, Export/Import

let currentScreen = 'chat';
let chatHistory = [];
let memory = {};
let settings = {};
let isTyping = false;
let isRecording = false;
let recognition = null;
let neuralLinkActive = false;
let debriefCheckInterval = null;

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  memory = JARVISPHINE.loadMemory();
  settings = JARVISPHINE.loadSettings();
  chatHistory = JARVISPHINE.loadHistory();

  renderHome();
  renderIntel();
  renderSettings();
  showScreen('chat');
  initVoice();
  runBoot();
  startDebriefChecker();

  if (!settings.apiKey && !settings.deepseekKey) {
    showScreen('settings');
    showToast('SYSTEM: API KEY REQUIRED');
  } else if (chatHistory.length === 0) {
    setTimeout(() => sendJarvisphineMessage("hey — I'm Jarvisphine. your real companion, not a bot. how's today looking?"), 2200);
  } else {
    renderChat();
  }

  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.screen)));
  document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('saveSettings').addEventListener('click', saveSettingsFn);
  document.getElementById('generateBriefing').addEventListener('click', generateMissionBriefing);
  document.querySelectorAll('.quick-log').forEach(b => b.addEventListener('click', () => quickLog(b.dataset.type, b.dataset.value)));

  // Export/Import buttons
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput').addEventListener('change', importData);

  // Goals
  document.getElementById('addGoalBtn').addEventListener('click', openGoalModal);
  document.getElementById('closeGoalModal').addEventListener('click', closeGoalModal);
  document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
  document.getElementById('goalPeriod').addEventListener('change', () => {
    const per = document.getElementById('goalPeriod').value;
    document.getElementById('goalText').placeholder = per === 'weekly' ? 'e.g., Run 3x this week' : per === 'monthly' ? 'e.g., Read 2 books' : 'e.g., Learn Spanish basics';
  });

  // Journal
  document.getElementById('journalSaveBtn').addEventListener('click', saveJournal);

  // Voice btn — hold to activate Neural Link
  const vBtn = document.getElementById('voiceBtn');
  vBtn.addEventListener('mousedown', activateNeuralLink);
  vBtn.addEventListener('touchstart', e => { e.preventDefault(); activateNeuralLink(); });
  vBtn.addEventListener('mouseup', stopVoice);
  vBtn.addEventListener('mouseleave', stopVoice);
  vBtn.addEventListener('touchend', stopVoice);

  // Neural Link overlay close
  document.getElementById('neuralLinkClose').addEventListener('click', deactivateNeuralLink);

  // Neural Link mic button
  const nlMic = document.getElementById('nlMicBtn');
  nlMic.addEventListener('mousedown', startVoiceCapture);
  nlMic.addEventListener('touchstart', e => { e.preventDefault(); startVoiceCapture(); });
  nlMic.addEventListener('mouseup', stopVoiceCapture);
  nlMic.addEventListener('touchend', stopVoiceCapture);

  // Provider toggle
  document.querySelectorAll('.provider-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.provider-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      settings.provider = b.dataset.provider;
      JARVISPHINE.saveSettings(settings);
      updateProviderStatus();
    });
  });

  window.speechSynthesis?.addEventListener('voiceschanged', () => {});
});

// ── Boot ──────────────────────────────────────────────
function runBoot() {
  const lines = ['INITIALIZING JARVISPHINE v4.0...', 'NEURAL LINK READY...', 'THREAT ANALYSIS ONLINE...', 'ALL SYSTEMS NOMINAL.'];
  const el = document.getElementById('bootText');
  if (!el) return;
  let i = 0;
  const iv = setInterval(() => {
    el.textContent = lines[i++];
    if (i >= lines.length) {
      clearInterval(iv);
      setTimeout(() => document.getElementById('bootOverlay')?.classList.add('hidden'), 700);
    }
  }, 500);
}

// ── Screen Nav ────────────────────────────────────────
function showScreen(name) {
  currentScreen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + name)?.classList.add('active');
  document.querySelector(`.nav-btn[data-screen="${name}"]`)?.classList.add('active');
  if (name === 'home') renderHome();
  if (name === 'intel') renderIntel();
  if (name === 'journal') renderJournal();
  if (name === 'goals') renderGoals();
}

// ── Chat ──────────────────────────────────────────────
function renderChat() {
  const c = document.getElementById('chatMessages');
  c.innerHTML = '';
  chatHistory.forEach(m => appendMsg(m.role, m.content));
  scrollBottom();
}

function appendMsg(role, content) {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = `message ${role === 'user' ? 'message-user' : 'message-jarvis'}`;
  d.innerHTML = role === 'assistant'
    ? `<div class="avatar">J</div><div class="bubble">${content}</div>`
    : `<div class="bubble">${content}</div>`;
  c.appendChild(d);
  scrollBottom();
}

function scrollBottom() { const c = document.getElementById('chatMessages'); if (c) c.scrollTop = c.scrollHeight; }

function showTyping() {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = 'message message-jarvis'; d.id = 'typing';
  d.innerHTML = `<div class="avatar">J</div><div class="bubble typing"><span></span><span></span><span></span></div>`;
  c.appendChild(d); scrollBottom();
}

function removeTyping() { document.getElementById('typing')?.remove(); }

async function sendMessage(override) {
  if (isTyping) return;
  const inp = document.getElementById('chatInput');
  const text = override || inp.value.trim();
  if (!text) return;
  if (!settings.apiKey && !settings.deepseekKey) { showToast('NO API KEY — CHECK CONFIG'); showScreen('settings'); return; }
  inp.value = '';
  appendMsg('user', text);
  chatHistory.push({ role: 'user', content: text });

  const logData = JARVISPHINE.extractLogData(text);
  if (Object.keys(logData).length) {
    Object.assign(memory.today, logData);
    if (typeof logData.drinks === 'number') JARVISPHINE.updateStreak(memory, 'sober_days', logData.drinks === 0);
    if (logData.sport === 'yes') JARVISPHINE.updateStreak(memory, 'sport_days', true);
    if (logData.sport === 'no') JARVISPHINE.updateStreak(memory, 'sport_days', false);
    JARVISPHINE.saveMemory(memory);
    if (currentScreen === 'home') renderHome();
  }

  isTyping = true; showTyping();
  try {
    const sys = JARVISPHINE.getSystemPrompt(settings.userName || 'Friend', memory);
    const msgs = chatHistory.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    const response = await JARVISPHINE.callAPI(msgs, sys, settings);
    removeTyping();
    sendJarvisphineMessage(response);
  } catch (err) {
    removeTyping();
    sendJarvisphineMessage(`SYSTEM ERROR: ${err.message}`);
  }
  isTyping = false;
}

function sendJarvisphineMessage(content) {
  appendMsg('assistant', content);
  chatHistory.push({ role: 'assistant', content });
  JARVISPHINE.saveHistory(chatHistory);
  document.getElementById('lastMessage') && (document.getElementById('lastMessage').textContent = content.slice(0, 90) + (content.length > 90 ? '...' : ''));
}

// ── Voice / Neural Link ───────────────────────────────
function initVoice() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.onresult = e => {
    const t = Array.from(e.results).map(r => r[0].transcript).join('');
    if (neuralLinkActive) {
      document.getElementById('nlTranscript').textContent = t;
    } else {
      document.getElementById('chatInput').value = t;
    }
    if (e.results[e.results.length-1].isFinal) {
      if (neuralLinkActive) sendNeuralLinkMessage(t);
      else { stopVoice(); setTimeout(() => sendMessage(), 300); }
    }
  };
  recognition.onerror = () => { stopVoice(); if (!neuralLinkActive) showToast('VOICE CAPTURE FAILED'); };
  recognition.onend = () => { if (!neuralLinkActive) stopVoice(); };
}

function activateNeuralLink() {
  neuralLinkActive = true;
  document.getElementById('neuralLink').classList.add('active');
  document.getElementById('voiceBtn').classList.add('recording');
  document.getElementById('nlStatus').textContent = 'NEURAL LINK ACTIVE';
  pulseArcReactor(true);
}

function deactivateNeuralLink() {
  neuralLinkActive = false;
  document.getElementById('neuralLink').classList.remove('active');
  document.getElementById('voiceBtn').classList.remove('recording');
  JARVISPHINE.stopSpeaking();
  if (recognition) try { recognition.stop(); } catch(e) {}
  isRecording = false;
  pulseArcReactor(false);
}

function startVoiceCapture() {
  isRecording = true;
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
    setTimeout(() => { try { recognition.start(); } catch(e) {} }, 100);
  }
  document.getElementById('nlMicBtn').classList.add('recording');
  document.getElementById('nlStatus').textContent = '// LISTENING...';
}

function stopVoiceCapture() {
  isRecording = false;
  document.getElementById('nlMicBtn').classList.remove('recording');
  if (recognition) try { recognition.stop(); } catch(e) {}
}

function sendNeuralLinkMessage(text) {
  if (!text.trim()) return;
  const cleanText = text.trim();
  document.getElementById('nlTranscript').textContent = '';
  document.getElementById('nlResponse').textContent = '// PROCESSING...';
  sendMessage(cleanText);
  setTimeout(() => {
    const lastMsg = chatHistory[chatHistory.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      document.getElementById('nlResponse').textContent = lastMsg.content.substring(0, 300) + (lastMsg.content.length > 300 ? '...' : '');
      JARVISPHINE.speak(lastMsg.content);
    }
  }, 500);
}

function pulseArcReactor(active) {
  const arc = document.getElementById('nlArc');
  if (active) arc?.classList.add('pulsing');
  else arc?.classList.remove('pulsing');
}

function stopVoice() { if (recognition) try { recognition.stop(); } catch(e) {} }

// ── Export / Import ───────────────────────────────────
function exportData() {
  const json = JARVISPHINE.exportDataAsJSON(memory, settings, chatHistory);
  const filename = `jarvisphine_backup_${new Date().toISOString().split('T')[0]}.json`;
  JARVISPHINE.downloadJSON(filename, json);
  showToast('// DATA EXPORTED SUCCESSFULLY');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const result = JARVISPHINE.importDataFromJSON(ev.target.result);
    if (!result.success) {
      showToast(`IMPORT ERROR: ${result.error}`);
      return;
    }
    const { data } = result;
    memory = data.memory;
    settings = { ...settings, ...data.settings };
    chatHistory = data.chatHistory || [];
    JARVISPHINE.saveMemory(memory);
    JARVISPHINE.saveSettings(settings);
    JARVISPHINE.saveHistory(chatHistory);
    renderChat();
    renderHome();
    renderIntel();
    showToast('// DATA IMPORTED SUCCESSFULLY');
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ── Goals ─────────────────────────────────────────────
function openGoalModal() {
  document.getElementById('goalModal').classList.add('active');
  document.getElementById('goalText').value = '';
  document.getElementById('goalPeriod').value = 'weekly';
}

function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('active');
}

function saveGoal() {
  const text = document.getElementById('goalText').value.trim();
  const period = document.getElementById('goalPeriod').value;
  if (!text) { showToast('GOAL TEXT REQUIRED'); return; }
  if (!memory.goals) memory.goals = { weekly: [], monthly: [], quarterly: [] };
  memory.goals[period].push(text);
  JARVISPHINE.saveMemory(memory);
  closeGoalModal();
  renderGoals();
  showToast(`// GOAL ADDED TO ${period.toUpperCase()}`);
}

function deleteGoal(period, index) {
  if (!memory.goals[period]) return;
  memory.goals[period].splice(index, 1);
  JARVISPHINE.saveMemory(memory);
  renderGoals();
}

function renderGoals() {
  const goals = memory.goals || { weekly: [], monthly: [], quarterly: [] };
  const container = document.getElementById('goalsList');
  if (!container) return;

  let html = '';
  ['weekly', 'monthly', 'quarterly'].forEach(period => {
    const list = goals[period] || [];
    const icon = { weekly: '📅', monthly: '🗓️', quarterly: '📊' }[period];
    html += `<div class="goals-section">
      <h3>${icon} ${period.toUpperCase()} GOALS</h3>
      ${list.length ? list.map((g, i) => `
        <div class="goal-item">
          <span>${g}</span>
          <button onclick="deleteGoal('${period}', ${i})" class="btn-delete">✕</button>
        </div>
      `).join('') : '<p class="empty-state">// no goals set</p>'}
    </div>`;
  });
  container.innerHTML = html;
}

// ── Journal ───────────────────────────────────────────
function renderJournal() {
  const journal = memory.today.journal || '';
  document.getElementById('journalText').value = journal;
  document.getElementById('journalCharCount').textContent = journal.length + ' / 500';
}

function saveJournal() {
  const text = document.getElementById('journalText').value.trim();
  if (text.length > 500) { showToast('JOURNAL TOO LONG (MAX 500)'); return; }
  memory.today.journal = text;
  JARVISPHINE.saveMemory(memory);
  showToast('// JOURNAL SAVED');
}

document.addEventListener('DOMContentLoaded', () => {
  const jt = document.getElementById('journalText');
  if (jt) {
    jt.addEventListener('input', () => {
      const len = jt.value.length;
      document.getElementById('journalCharCount').textContent = len + ' / 500';
    });
  }
});

// ── Mission Briefing ──────────────────────────────────
function generateMissionBriefing() {
  if (!settings.apiKey && !settings.deepseekKey) { showToast('NO API KEY — CHECK CONFIG'); return; }
  const btn = document.getElementById('generateBriefing');
  btn.disabled = true;
  btn.textContent = '⚡ GENERATING...';
  const prompt = JARVISPHINE.getMissionBriefing(settings.userName || 'Friend', memory);
  JARVISPHINE.callAPI([{ role: 'user', content: prompt }], '', settings).then(response => {
    document.getElementById('missionBriefingText').innerHTML = response.replace(/\n/g, '<br>');
    btn.disabled = false;
    btn.textContent = '⚡ REGENERATE BRIEFING';
  }).catch(err => {
    showToast(`ERROR: ${err.message}`);
    btn.disabled = false;
    btn.textContent = '⚡ GENERATE BRIEFING';
  });
}

function triggerManualDebrief() {
  if (!settings.apiKey && !settings.deepseekKey) { showToast('NO API KEY — CHECK CONFIG'); return; }
  const prompt = JARVISPHINE.getDailyDebrief(settings.userName || 'Friend', memory);
  JARVISPHINE.callAPI([{ role: 'user', content: prompt }], '', settings).then(response => {
    const today = new Date().toDateString();
    if (!memory.debriefs) memory.debriefs = [];
    memory.debriefs.unshift({ date: today, text: response });
    if (memory.debriefs.length > 30) memory.debriefs.pop();
    JARVISPHINE.saveMemory(memory);
    renderIntel();
    showToast('// DEBRIEF GENERATED');
  }).catch(err => { showToast(`ERROR: ${err.message}`); });
}

function startDebriefChecker() {
  debriefCheckInterval = setInterval(() => {
    const now = new Date();
    if (now.getHours() === 23 && now.getMinutes() === 0) {
      triggerManualDebrief();
    }
  }, 60000);
}

function quickLog(type, value) {
  if (type === 'drinks') memory.today.drinks = parseInt(value);
  if (type === 'sport') memory.today.sport = value;
  if (type === 'mood') memory.today.mood = value;
  if (type === 'water') memory.today.water = parseInt(value);
  if (type === 'sport') JARVISPHINE.updateStreak(memory, 'sport_days', value === 'yes');
  JARVISPHINE.saveMemory(memory);
  renderHome();
  const msgs = {
    'drinks-0': "logged 0 drinks today", 'drinks-1': "had 1 drink",
    'drinks-3': "had 3+ drinks", 'sport-yes': "did sport today",
    'sport-no': "skipped sport", 'mood-good': "mood is good today",
    'mood-low': "feeling low today", 'water-6': "drank 6 glasses of water",
    'water-8': "drank 8 glasses of water"
  };
  const key = `${type}-${value}`;
  if (msgs[key]) { showScreen('chat'); sendMessage(msgs[key]); }
}

// ── Home ──────────────────────────────────────────────
function renderHome() {
  const today = memory.today || {};
  const streaks = memory.streaks || {};
  setStat('stat-drinks', today.drinks ?? '—');
  setStat('stat-sport', today.sport ?? '—');
  setStat('stat-mood', today.mood ?? '—');
  setStat('stat-water', today.water != null ? today.water + 'gl' : '—');
  setStat('streak-sober', streaks.sober_days ?? 0);
  setStat('streak-sport', streaks.sport_days ?? 0);
  renderThreatLevel();
}

function setStat(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('updating');
  setTimeout(() => { el.textContent = val; el.classList.remove('updating'); }, 120);
}

function renderThreatLevel() {
  const threat = JARVISPHINE.calculateThreatLevel(memory);
  const bar = document.getElementById('threatBar');
  const label = document.getElementById('threatLabel');
  const desc = document.getElementById('threatDesc');
  const indicator = document.getElementById('threatIndicator');
  if (!bar) return;

  const pct = [10, 30, 55, 75, 95][threat.index];
  bar.style.width = pct + '%';
  bar.style.background = `linear-gradient(90deg, #f5a623, ${threat.color})`;
  bar.style.boxShadow = `0 0 10px ${threat.color}60`;
  label.textContent = threat.level;
  label.style.color = threat.color;
  desc.textContent = threat.desc;
  indicator.style.background = threat.color;
  indicator.style.boxShadow = `0 0 8px ${threat.color}`;
}

// ── Intel ─────────────────────────────────────────────
function renderIntel() {
  const streaks = memory.streaks || {};
  const history = memory.history || [];

  document.getElementById('s-sober-current').textContent = streaks.sober_days ?? 0;
  document.getElementById('s-sober-best').textContent = streaks.sober_best ?? 0;
  document.getElementById('s-sport-current').textContent = streaks.sport_days ?? 0;
  document.getElementById('s-sport-best').textContent = streaks.sport_best ?? 0;

  drawDrinksChart(history);
  drawMoodChart(history);
  drawSportHeatmap(history);
  renderDebriefs();
}

function drawDrinksChart(history) {
  const canvas = document.getElementById('drinksChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 80;
  ctx.clearRect(0, 0, w, h);

  const days = [...history].slice(0, 7).reverse();
  if (!days.length) {
    ctx.fillStyle = '#2a4a6a';
    ctx.font = '10px Orbitron, monospace';
    ctx.fillText('// NO DATA', 10, 40);
    return;
  }

  const maxVal = Math.max(...days.map(d => d.drinks || 0), 1);
  const barW = Math.floor((w - 20) / days.length) - 4;

  days.forEach((day, i) => {
    const val = day.drinks || 0;
    const barH = Math.max(2, (val / maxVal) * (h - 20));
    const x = 10 + i * ((w - 20) / days.length);
    const y = h - barH - 10;
    const color = val === 0 ? '#00ff88' : val <= 2 ? '#f5a623' : '#ff3366';
    ctx.fillStyle = color + '40';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, 2);
    ctx.fillStyle = '#2a4a6a';
    ctx.font = '8px Orbitron, monospace';
    ctx.fillText(val, x + barW/2 - 3, h - 2);
  });
}

function drawMoodChart(history) {
  const canvas = document.getElementById('moodChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 50;
  ctx.clearRect(0, 0, w, h);

  const days = [...history].slice(0, 7).reverse();
  if (!days.length) return;

  const moodY = { good: 10, neutral: 25, low: 40 };
  const moodColor = { good: '#00ff88', neutral: '#f5a623', low: '#ff3366' };
  const pts = days.map((d, i) => ({
    x: 15 + i * ((w - 30) / Math.max(days.length - 1, 1)),
    y: moodY[d.mood] || 25,
    color: moodColor[d.mood] || '#2a4a6a'
  }));

  if (pts.length > 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#f5a62340';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = p.color + '60';
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

function drawSportHeatmap(history) {
  const canvas = document.getElementById('sportHeatmap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 30;
  ctx.clearRect(0, 0, w, h);

  const days = [...history].slice(0, 28).reverse();
  const cellW = Math.floor((w - 10) / 28);

  days.forEach((day, i) => {
    const x = 5 + i * cellW;
    const done = day.sport === 'yes';
    ctx.fillStyle = done ? '#f5a62380' : '#0d1c2e';
    ctx.fillRect(x, 5, cellW - 2, 20);
    if (done) {
      ctx.fillStyle = '#f5a623';
      ctx.fillRect(x, 5, cellW - 2, 2);
    }
  });
}

function renderDebriefs() {
  const container = document.getElementById('debriefList');
  if (!container) return;
  const debriefs = memory.debriefs || [];
  if (!debriefs.length) {
    container.innerHTML = '<p class="empty-state">// NO DEBRIEFS YET — CHECK IN DAILY</p>';
    return;
  }
  container.innerHTML = debriefs.slice(0, 5).map(d => `
    <div class="debrief-entry">
      <div class="debrief-date">${d.date}</div>
      <div class="debrief-text">${d.text}</div>
    </div>
  `).join('');
}

// ── Settings ──────────────────────────────────────────
function renderSettings() {
  document.getElementById('apiKeyInput').value = settings.apiKey || '';
  document.getElementById('deepseekKeyInput').value = settings.deepseekKey || '';
  document.getElementById('userNameInput').value = settings.userName || '';
  const p = settings.provider || 'claude';
  document.querySelectorAll('.provider-btn').forEach(b => b.classList.toggle('active', b.dataset.provider === p));
  updateProviderStatus();
}

function updateProviderStatus() {
  const el = document.getElementById('providerStatus');
  if (el) el.textContent = (settings.provider === 'deepseek') ? '// DEEPSEEK ACTIVE' : '// CLAUDE HAIKU ACTIVE';
}

function saveSettingsFn() {
  settings.apiKey = document.getElementById('apiKeyInput').value.trim();
  settings.deepseekKey = document.getElementById('deepseekKeyInput').value.trim();
  settings.userName = document.getElementById('userNameInput').value.trim() || 'Friend';
  JARVISPHINE.saveSettings(settings);
  updateProviderStatus();
  showToast('// CONFIGURATION SAVED');
  showScreen('chat');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
