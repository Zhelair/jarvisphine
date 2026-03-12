// app.js — Jarvisphine v6.0

let currentScreen = 'chat';
let chatHistory   = [];
let memory        = {};
let settings      = {};
let saveStates    = [];
let isTyping      = false;
let isRecording   = false;
let recognition   = null;
let neuralLinkActive   = false;
let syncTimeout        = null;
let checkinsSentToday  = {};

// ── Boot Sequence ─────────────────────────────────────
function runBoot(callback) {
  const canvas = document.getElementById('matrixCanvas');
  const ctx    = canvas.getContext('2d');
  const boot   = document.getElementById('bootOverlay');
  const hud    = document.getElementById('bootHUD');
  const fill   = document.getElementById('bootProgressFill');
  const text   = document.getElementById('bootText');

  canvas.width  = boot.offsetWidth  || 480;
  canvas.height = boot.offsetHeight || 800;

  const cols  = Math.floor(canvas.width / 14);
  const drops = Array(cols).fill(1);
  const chars = 'JARVISPHINE01アカサタナハマヤ'.split('');

  const drawMatrix = () => {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00d4ff';
    ctx.font = '13px monospace';
    drops.forEach((y, i) => {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * 14, y * 14);
      if (y * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
  };

  const matrixInterval = setInterval(drawMatrix, 40);

  const lines = [
    'JARVISPHINE v6.0 BOOT SEQUENCE...',
    'CHARCOAL TERMINAL LOADING...',
    'NEURAL LINK CALIBRATING...',
    'SUPABASE SYNC ONLINE...',
    'MOMENTUM ENGINE READY...',
    'PERSONALITY CORE LOADED...',
    'ALL SYSTEMS NOMINAL.'
  ];

  let lineIdx = 0;
  const lineInterval = setInterval(() => {
    if (lineIdx < lines.length) {
      text.textContent = lines[lineIdx];
      fill.style.width = ((lineIdx + 1) / lines.length * 100) + '%';
      lineIdx++;
    }
  }, 280);

  setTimeout(() => { hud.classList.add('visible'); }, 500);
  setTimeout(() => {
    clearInterval(matrixInterval);
    clearInterval(lineInterval);
    fill.style.width = '100%';
    setTimeout(() => { boot.classList.add('hidden'); if (callback) callback(); }, 400);
  }, 2200);
}

// ── App Start ─────────────────────────────────────────
async function startApp() {
  runBoot(async () => {
    // Check server health
    checkServerStatus();

    setSyncStatus('syncing');
    const remote = await JARVISPHINE.loadFromSupabase();

    if (remote.memory) {
      memory = JARVISPHINE.migrateMemory(remote.memory);
      const today = new Date().toDateString();
      if (memory.lastDate !== today) {
        if (memory.lastDate && memory.today) {
          if (!memory.history) memory.history = [];
          memory.history.unshift({ date: memory.lastDate, ...memory.today });
          if (memory.history.length > 90) memory.history.pop();
        }
        memory.today   = JARVISPHINE.defaultToday();
        memory.lastDate = today;
      }
      JARVISPHINE.saveMemory(memory);
    } else {
      memory = JARVISPHINE.loadMemory();
    }

    if (remote.settings) {
      settings = { ...JARVISPHINE.loadSettings(), ...remote.settings };
    } else {
      settings = JARVISPHINE.loadSettings();
    }

    if (remote.chat_history) {
      chatHistory = remote.chat_history;
      JARVISPHINE.saveHistory(chatHistory);
    } else {
      chatHistory = JARVISPHINE.loadHistory();
    }

    if (remote.save_states) {
      saveStates = remote.save_states;
      JARVISPHINE.saveSaveStates(saveStates);
    } else {
      saveStates = JARVISPHINE.loadSaveStates();
    }

    setSyncStatus('synced');

    const todayKey = new Date().toDateString();
    const storedCheckins = JSON.parse(localStorage.getItem('jarvisphine_checkins_sent') || '{}');
    checkinsSentToday = storedCheckins[todayKey] || {};

    renderHome();
    renderIntel();
    renderSettings();
    showScreen('chat');
    initVoice();
    initEventListeners();
    startScheduler();
    applyPersonalityMode(settings.personality || 'sharp');
    updateModeBadge(settings.personality || 'sharp');

    if (chatHistory.length === 0) {
      setTimeout(() => sendJarvisphineMessage(
        "hey — I'm Jarvisphine. your real companion, not a bot. how's today looking? log your morning and tell me the plan."
      ), 2200);
    } else {
      renderChat();
    }
  });
}

// ── Server Status ─────────────────────────────────────
async function checkServerStatus() {
  const dot  = document.getElementById('serverDot');
  const text = document.getElementById('serverStatusText');
  const prov = document.getElementById('providerStatus');
  try {
    const r = await fetch('/api/health');
    if (!r.ok) throw new Error('offline');
    const d = await r.json();
    if (dot)  { dot.className  = 'server-dot online'; }
    if (text) { text.textContent = 'Backend server online ✓'; text.style.color = 'var(--green)'; }
    if (prov) { prov.textContent = `// AI: ${d.provider?.toUpperCase() || 'UNKNOWN'}`; }
  } catch {
    if (dot)  { dot.className  = 'server-dot offline'; }
    if (text) { text.textContent = 'Backend offline — AI unavailable'; text.style.color = 'var(--red)'; }
    if (prov) { prov.textContent = '// RUN: node server.js'; }
  }
}

// ── Event Listeners ───────────────────────────────────
function initEventListeners() {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.addEventListener('click', () => showScreen(b.dataset.screen))
  );

  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('saveSettings').addEventListener('click', saveSettingsFn);
  document.getElementById('generateBriefing').addEventListener('click', generateMissionBriefing);

  // Quick log
  document.querySelectorAll('.quick-log').forEach(b => b.addEventListener('click', () => {
    const type = b.dataset.type, val = b.dataset.value;
    if (val === 'prompt') {
      if (type === 'wake')   promptWakeTime();
      if (type === 'sleep')  promptSleepHours();
      if (type === 'energy') promptEnergyScore();
    } else {
      quickLog(type, val, b);
    }
  }));

  // Morning ritual buttons
  document.querySelectorAll('.ritual-btn').forEach(b => b.addEventListener('click', () => {
    logRitual(b.dataset.ritual, b.dataset.value, b);
  }));

  // Daily plan
  document.getElementById('savePlanBtn').addEventListener('click', saveDailyPlan);

  // Export / Import
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () =>
    document.getElementById('importFileInput').click()
  );
  document.getElementById('importFileInput').addEventListener('change', importData);

  // Save states
  document.getElementById('openSaveStatesBtn').addEventListener('click', openSaveModal);
  document.getElementById('closeSaveModal').addEventListener('click', closeSaveModal);
  document.getElementById('createSaveBtn').addEventListener('click', createSaveState);

  // Force sync
  document.getElementById('forceSyncBtn').addEventListener('click', () => forceSync(true));

  // Goals
  document.getElementById('addGoalBtn').addEventListener('click', openGoalModal);
  document.getElementById('closeGoalModal').addEventListener('click', closeGoalModal);
  document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
  document.getElementById('goalPeriod').addEventListener('change', () => {
    const p = document.getElementById('goalPeriod').value;
    document.getElementById('goalText').placeholder =
      p === 'weekly' ? 'e.g., Run 3x this week' :
      p === 'monthly' ? 'e.g., Read 2 books' : 'e.g., Learn Spanish basics';
  });

  // Journal
  document.getElementById('journalSaveBtn').addEventListener('click', saveJournal);
  document.getElementById('journalText').addEventListener('input', () => {
    const len = document.getElementById('journalText').value.length;
    document.getElementById('journalCharCount').textContent = len + ' / 500';
  });

  // Voice
  const vBtn = document.getElementById('voiceBtn');
  vBtn.addEventListener('mousedown', activateNeuralLink);
  vBtn.addEventListener('touchstart', e => { e.preventDefault(); activateNeuralLink(); });
  vBtn.addEventListener('mouseup', stopVoice);
  vBtn.addEventListener('mouseleave', stopVoice);
  vBtn.addEventListener('touchend', stopVoice);
  document.getElementById('neuralLinkClose').addEventListener('click', deactivateNeuralLink);
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
    });
  });

  // Personality modes
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.addEventListener('click', () => {
      const mode = b.dataset.mode;
      settings.personality = mode;
      JARVISPHINE.saveSettings(settings);
      applyPersonalityMode(mode);
      updateModeBadge(mode);
      debouncedSync();
      showToast(`// MODE: ${mode.toUpperCase()}`, 'gold');
    });
  });

  // Mode badge cycles
  document.getElementById('modeBadge').addEventListener('click', () => {
    const modes = ['soft', 'sharp', 'noexcuses'];
    const cur  = modes.indexOf(settings.personality || 'sharp');
    const next = modes[(cur + 1) % modes.length];
    settings.personality = next;
    JARVISPHINE.saveSettings(settings);
    applyPersonalityMode(next);
    updateModeBadge(next);
    debouncedSync();
    showToast(`// MODE: ${next.toUpperCase()}`, 'gold');
  });

  // Intel tab buttons
  document.getElementById('generateBriefBtn').addEventListener('click', generateIntelBrief);
  document.getElementById('generateInsightsBtn').addEventListener('click', generatePatternInsights);

  // Passphrase / lock
  document.getElementById('lockBtn')?.addEventListener('click', () => {
    if (!confirm('Lock Jarvisphine? You will need your passphrase to access your data again.')) return;
    NAMESPACE.clear();
    location.reload();
  });
  document.getElementById('changePassBtn')?.addEventListener('click', () => {
    const newPass = prompt('Enter new passphrase (your data will move to the new passphrase namespace):');
    if (!newPass || !newPass.trim()) return;
    NAMESPACE.set(newPass.trim());
    debouncedSync();
    showToast('// PASSPHRASE UPDATED', 'green');
  });

  window.speechSynthesis?.addEventListener('voiceschanged', () => {});
}

// ── Personality Mode ──────────────────────────────────
function applyPersonalityMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode)
  );
}

function updateModeBadge(mode) {
  const badge  = document.getElementById('modeBadge');
  const labels = { soft: 'SOFT', sharp: 'SHARP', noexcuses: 'NO XCSS' };
  badge.textContent = labels[mode] || 'SHARP';
  badge.className   = `mode-badge ${mode}`;
}

// ── Sync Status ───────────────────────────────────────
function setSyncStatus(status) {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.className = `sync-dot ${status}`;
  dot.title = { synced: 'Synced', syncing: 'Syncing...', error: 'Sync failed' }[status] || '';
}

function debouncedSync() {
  clearTimeout(syncTimeout);
  setSyncStatus('syncing');
  syncTimeout = setTimeout(() => forceSync(false), 2000);
}

async function forceSync(showFeedback = false) {
  setSyncStatus('syncing');
  const ok = await JARVISPHINE.syncToSupabase(memory, settings, chatHistory, saveStates);
  setSyncStatus(ok ? 'synced' : 'error');
  if (showFeedback) showToast(ok ? '// SYNCED TO CLOUD' : '// SYNC FAILED', ok ? 'green' : undefined);
}

// ── Screen Navigation ─────────────────────────────────
function showScreen(name) {
  currentScreen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + name)?.classList.add('active');
  document.querySelector(`.nav-btn[data-screen="${name}"]`)?.classList.add('active');
  if (name === 'home')    renderHome();
  if (name === 'intel')   renderIntel();
  if (name === 'journal') renderJournal();
  if (name === 'goals')   renderGoals();
}

// ── Chat ──────────────────────────────────────────────
function renderChat() {
  const c = document.getElementById('chatMessages');
  c.innerHTML = '';
  chatHistory.forEach(m => appendMsg(m.role, m.content, m.checkin));
  scrollBottom();
}

function appendMsg(role, content, isCheckin = false) {
  const c   = document.getElementById('chatMessages');
  const d   = document.createElement('div');
  const cls = role === 'user' ? 'message-user' : isCheckin ? 'message-checkin' : 'message-jarvis';
  d.className = `message ${cls}`;
  d.innerHTML = role === 'assistant'
    ? `<div class="avatar">J</div><div class="bubble">${content}</div>`
    : `<div class="bubble">${content}</div>`;
  c.appendChild(d);
  scrollBottom();
}

function scrollBottom() {
  const c = document.getElementById('chatMessages');
  if (c) c.scrollTop = c.scrollHeight;
}

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
  const inp  = document.getElementById('chatInput');
  const text = override || inp.value.trim();
  if (!text) return;
  inp.value = '';
  inp.style.height = '';
  appendMsg('user', text);
  chatHistory.push({ role: 'user', content: text });

  // Extract log data from natural language
  const logData = JARVISPHINE.extractLogData(text);
  if (Object.keys(logData).length) {
    Object.assign(memory.today, logData);
    if (typeof logData.drinks === 'number')
      JARVISPHINE.updateStreak(memory, 'sober_days', logData.drinks === 0);
    if (logData.sport === 'yes') JARVISPHINE.updateStreak(memory, 'sport_days', true);
    if (logData.sport === 'no')  JARVISPHINE.updateStreak(memory, 'sport_days', false);
    JARVISPHINE.saveMemory(memory);
    if (currentScreen === 'home') renderHome();
  }

  isTyping = true; showTyping();
  try {
    const sys      = JARVISPHINE.getSystemPrompt(settings.userName || 'Friend', memory, settings.personality || 'sharp');
    const msgs     = chatHistory.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    const response = await JARVISPHINE.callAPI(msgs, sys, settings);
    removeTyping();
    sendJarvisphineMessage(response);
  } catch (err) {
    removeTyping();
    sendJarvisphineMessage(`SYSTEM ERROR: ${err.message}`);
  }
  isTyping = false;
}

function sendJarvisphineMessage(content, isCheckin = false) {
  appendMsg('assistant', content, isCheckin);
  chatHistory.push({ role: 'assistant', content, checkin: isCheckin });
  JARVISPHINE.saveHistory(chatHistory);
  const lastMsg = document.getElementById('lastMessage');
  if (lastMsg) lastMsg.textContent = content.slice(0, 90) + (content.length > 90 ? '...' : '');
  debouncedSync();
}

// ── Wake / Sleep / Energy prompts ─────────────────────
function promptWakeTime() {
  const t = prompt('What time did you wake up? (e.g., 7:30 or 9)');
  if (!t) return;
  const match = t.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) { showToast('// INVALID TIME FORMAT'); return; }
  const h    = parseInt(match[1]);
  const m    = match[2] ? parseInt(match[2]) : 0;
  const wake = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  memory.today.wake = wake;
  JARVISPHINE.saveMemory(memory);
  renderHome();
  showToast(`// WAKE: ${wake}`, 'green');
  showScreen('chat');
  // Morning plan prompt after wake time logged
  if (!memory.today.plan) {
    setTimeout(() => triggerMorningPlanPrompt(), 500);
  } else {
    sendMessage(`woke up at ${wake}`);
  }
}

function promptSleepHours() {
  const t = prompt('How many hours did you sleep? (e.g., 7.5)');
  if (!t) return;
  const h = parseFloat(t);
  if (isNaN(h) || h < 0 || h > 24) { showToast('// INVALID VALUE'); return; }
  memory.today.sleep_hours = h;
  JARVISPHINE.saveMemory(memory);
  renderHome();
  showToast(`// SLEEP: ${h}h`, 'green');
  showScreen('chat');
  sendMessage(`slept ${h} hours last night`);
}

function promptEnergyScore() {
  const t = prompt('Energy level right now? (1-10)');
  if (!t) return;
  const e = parseInt(t);
  if (isNaN(e) || e < 1 || e > 10) { showToast('// ENTER 1-10'); return; }
  memory.today.energy = e;
  JARVISPHINE.saveMemory(memory);
  renderHome();
  showToast(`// ENERGY: ${e}/10`, 'green');
  showScreen('chat');
  sendMessage(`energy level is ${e}/10 today`);
}

// ── Morning Plan ──────────────────────────────────────
async function triggerMorningPlanPrompt() {
  if (!chatHistory.length) return;
  try {
    const prompt = JARVISPHINE.getMorningPlanPrompt(settings.userName || 'Friend', memory);
    const resp   = await JARVISPHINE.callAPI([{ role: 'user', content: prompt }], '', settings);
    sendJarvisphineMessage(resp, true);
  } catch { /* silent */ }
}

function saveDailyPlan() {
  const text = document.getElementById('dailyPlanInput').value.trim();
  if (!text) { showToast('// TYPE YOUR PLAN FIRST'); return; }
  memory.today.plan = text;
  JARVISPHINE.saveMemory(memory);
  debouncedSync();
  renderDailyPlan();
  document.getElementById('dailyPlanInput').value = '';
  showToast('// PLAN LOCKED IN', 'green');
  showScreen('chat');
  sendMessage(`Today's plan: ${text}`);
}

function renderDailyPlan() {
  const display = document.getElementById('dailyPlanDisplay');
  const input   = document.getElementById('dailyPlanInput');
  if (!display) return;
  const plan = memory.today?.plan || '';
  if (plan) {
    display.textContent = plan;
    display.classList.add('has-plan');
    if (input) input.placeholder = 'Update today\'s plan...';
  } else {
    display.classList.remove('has-plan');
  }
}

// ── Morning Ritual ────────────────────────────────────
function logRitual(ritualKey, value, btn) {
  if (!memory.today.morning_ritual) {
    memory.today.morning_ritual = { stretch: null, shower: null, breakfast: null, meditate: null };
  }
  memory.today.morning_ritual[ritualKey] = value;
  JARVISPHINE.saveMemory(memory);
  renderMorningRitual();
  renderMomentumScore();
  debouncedSync();

  // Visual feedback on button
  const siblings = document.querySelectorAll(`.ritual-btn[data-ritual="${ritualKey}"]`);
  siblings.forEach(s => { s.classList.remove('done', 'skipped'); });
  if (btn) {
    btn.classList.add(value === 'yes' ? 'done' : 'skipped');
    setTimeout(() => btn.classList.remove('done', 'skipped'), 2000);
  }

  const labels = {
    'stretch:yes': 'stretched this morning', 'stretch:no': 'skipped stretching',
    'shower:yes':  'took a cold shower',    'shower:no':  'skipped the cold shower',
    'breakfast:yes': 'had a good breakfast','breakfast:no': 'skipped breakfast',
    'meditate:yes': 'meditated this morning','meditate:no': 'skipped meditation'
  };
  const key = `${ritualKey}:${value}`;
  if (labels[key]) { showScreen('chat'); sendMessage(labels[key]); }
}

function renderMorningRitual() {
  const ritual = memory.today?.morning_ritual || {};
  document.querySelectorAll('.ritual-btn').forEach(btn => {
    const r = btn.dataset.ritual;
    const v = btn.dataset.value;
    btn.classList.remove('done', 'skipped');
    if (ritual[r] === v) {
      btn.classList.add(v === 'yes' ? 'done' : 'skipped');
    }
  });
  // Update morning score bar
  const score = JARVISPHINE.calcMorningRitualScore(ritual);
  const fill  = document.getElementById('morningScoreFill');
  const label = document.getElementById('morningScoreLabel');
  if (fill)  fill.style.width = score + '%';
  if (label) {
    label.textContent = score + '%';
    label.style.color = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--gold)' : 'var(--text2)';
  }
}

// ── Quick Log ─────────────────────────────────────────
function quickLog(type, value, btn) {
  if (type === 'drinks')  memory.today.drinks  = parseInt(value);
  if (type === 'sport')   memory.today.sport   = value;
  if (type === 'mood')    memory.today.mood    = value;
  if (type === 'water')   memory.today.water   = parseInt(value);
  if (type === 'outdoor') memory.today.outdoor = value;

  if (type === 'sport')  JARVISPHINE.updateStreak(memory, 'sport_days', value === 'yes');
  if (type === 'drinks') JARVISPHINE.updateStreak(memory, 'sober_days', parseInt(value) === 0);

  JARVISPHINE.saveMemory(memory);
  renderHome();

  if (btn) {
    btn.classList.add('selected');
    setTimeout(() => btn.classList.remove('selected'), 1200);
  }

  const msgs = {
    'drinks-0': 'logged 0 drinks today', 'drinks-1': 'had 1 drink',
    'drinks-3': 'had 3+ drinks',         'sport-yes': 'did sport today',
    'sport-no': 'skipped sport today',   'mood-good': 'mood is good today',
    'mood-low': 'feeling low today',     'water-6': 'drank 6 glasses of water',
    'water-8': 'drank 8 glasses of water', 'outdoor-yes': 'went outside today',
    'outdoor-no': 'stayed inside today'
  };
  const key = `${type}-${value}`;
  if (msgs[key]) { showScreen('chat'); sendMessage(msgs[key]); }
}

// ── Voice / Neural Link ───────────────────────────────
function initVoice() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return;
  const SR    = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous     = false;
  recognition.interimResults = true;
  recognition.lang           = 'en-US';
  recognition.onresult = e => {
    const t = Array.from(e.results).map(r => r[0].transcript).join('');
    if (neuralLinkActive) document.getElementById('nlTranscript').textContent = t;
    else document.getElementById('chatInput').value = t;
    if (e.results[e.results.length-1].isFinal) {
      if (neuralLinkActive) sendNeuralLinkMessage(t);
      else { stopVoice(); setTimeout(() => sendMessage(), 300); }
    }
  };
  recognition.onerror = () => { stopVoice(); if (!neuralLinkActive) showToast('VOICE CAPTURE FAILED'); };
  recognition.onend   = () => { if (!neuralLinkActive) stopVoice(); };
}

function activateNeuralLink() {
  neuralLinkActive = true;
  document.getElementById('neuralLink').classList.add('active');
  document.getElementById('voiceBtn').classList.add('recording');
  document.getElementById('nlStatus').textContent = 'NEURAL LINK ACTIVE';
}

function deactivateNeuralLink() {
  neuralLinkActive = false;
  document.getElementById('neuralLink').classList.remove('active');
  document.getElementById('voiceBtn').classList.remove('recording');
  JARVISPHINE.stopSpeaking();
  if (recognition) try { recognition.stop(); } catch(e) {}
  isRecording = false;
}

function startVoiceCapture() {
  isRecording = true;
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
    setTimeout(() => { try { recognition.start(); } catch(e) {} }, 100);
  }
  document.getElementById('nlMicBtn').classList.add('active');
  document.getElementById('nlStatus').textContent = '// LISTENING...';
}

function stopVoiceCapture() {
  isRecording = false;
  document.getElementById('nlMicBtn').classList.remove('active');
  if (recognition) try { recognition.stop(); } catch(e) {}
}

function sendNeuralLinkMessage(text) {
  if (!text.trim()) return;
  document.getElementById('nlTranscript').textContent = '';
  document.getElementById('nlResponse').textContent  = '// PROCESSING...';
  sendMessage(text.trim());
  const checkReply = setInterval(() => {
    const last = chatHistory[chatHistory.length - 1];
    if (last && last.role === 'assistant') {
      clearInterval(checkReply);
      document.getElementById('nlResponse').textContent = last.content.substring(0, 300);
      JARVISPHINE.speak(last.content);
    }
  }, 400);
  setTimeout(() => clearInterval(checkReply), 10000);
}

function stopVoice() { if (recognition) try { recognition.stop(); } catch(e) {} }

// ── Scheduled Check-ins ───────────────────────────────
const CHECK_IN_SLOTS = [
  { key: 'morning',       h: 11, m: 30, name: 'morning'       },
  { key: 'afternoon',     h: 14, m:  0, name: 'afternoon'     },
  { key: 'lateafternoon', h: 17, m:  0, name: 'lateafternoon' },
  { key: 'evening',       h: 20, m:  0, name: 'evening'       },
  { key: 'debrief',       h: 23, m:  0, name: 'debrief'       }
];

function startScheduler() {
  setInterval(checkScheduledEvents, 30000);
}

function checkScheduledEvents() {
  const now      = new Date();
  const todayStr = now.toDateString();

  const stored = JSON.parse(localStorage.getItem('jarvisphine_checkins_sent') || '{}');
  if (!stored[todayStr]) {
    checkinsSentToday = {};
    localStorage.setItem('jarvisphine_checkins_sent', JSON.stringify({ [todayStr]: {} }));
  }

  CHECK_IN_SLOTS.forEach(slot => {
    if (checkinsSentToday[slot.key]) return;
    const slotTime = slot.h * 60 + slot.m;
    const nowTime  = now.getHours() * 60 + now.getMinutes();
    if (Math.abs(nowTime - slotTime) <= 1) {
      checkinsSentToday[slot.key] = true;
      const data = JSON.parse(localStorage.getItem('jarvisphine_checkins_sent') || '{}');
      if (!data[todayStr]) data[todayStr] = {};
      data[todayStr][slot.key] = true;
      localStorage.setItem('jarvisphine_checkins_sent', JSON.stringify(data));
      triggerCheckIn(slot.name);
    }
  });

  if (now.getHours() === 23 && now.getMinutes() === 0 && !checkinsSentToday['auto_debrief']) {
    checkinsSentToday['auto_debrief'] = true;
    triggerManualDebrief();
  }
}

async function triggerCheckIn(slotName) {
  try {
    const prompt = JARVISPHINE.getCheckInPrompt(settings.userName || 'Friend', memory, slotName);
    const resp   = await JARVISPHINE.callAPI([{ role: 'user', content: prompt }], '', settings);
    showScreen('chat');
    sendJarvisphineMessage(resp, true);
    showToast('// CHECK-IN FROM JARVISPHINE', 'gold');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Jarvisphine', { body: resp.slice(0, 80) });
    }
  } catch { /* silent */ }
}

// ── Mission Briefing ──────────────────────────────────
function generateMissionBriefing() {
  const btn = document.getElementById('generateBriefing');
  btn.disabled = true; btn.textContent = '⚡ GENERATING...';
  const prompt = JARVISPHINE.getMissionBriefing(settings.userName || 'Friend', memory);
  JARVISPHINE.callAPI([{ role: 'user', content: prompt }], '', settings)
    .then(resp => {
      document.getElementById('missionBriefingText').innerHTML = resp.replace(/\n/g, '<br>');
      btn.disabled = false; btn.textContent = '⚡ REGENERATE BRIEFING';
    })
    .catch(err => {
      showToast(`ERROR: ${err.message}`);
      btn.disabled = false; btn.textContent = '⚡ GENERATE BRIEFING';
    });
}

function triggerManualDebrief() {
  const prompt = JARVISPHINE.getDailyDebrief(settings.userName || 'Friend', memory);
  JARVISPHINE.callAPI([{ role: 'user', content: prompt }], '', settings)
    .then(resp => {
      const today = new Date().toDateString();
      if (!memory.debriefs) memory.debriefs = [];
      memory.debriefs.unshift({ date: today, text: resp });
      if (memory.debriefs.length > 30) memory.debriefs.pop();
      JARVISPHINE.saveMemory(memory);
      renderIntel();
      debouncedSync();
      showToast('// DEBRIEF GENERATED', 'green');
    })
    .catch(err => showToast(`ERROR: ${err.message}`));
}

// ── Intel Brief (Daily Learning) ──────────────────────
async function generateIntelBrief() {
  const btn = document.getElementById('generateBriefBtn');
  const el  = document.getElementById('intelBriefText');
  btn.disabled = true; btn.textContent = '🧠 LOADING...';
  const topics = (settings.topics || 'science, psychology, history, philosophy').split(',').map(t => t.trim()).filter(Boolean);
  const prompt = JARVISPHINE.getDailyIntelBrief(topics);
  try {
    const resp = await JARVISPHINE.callAPI([{ role: 'user', content: prompt }], '', settings);
    // Parse topic tag
    const topicMatch = resp.match(/^\[([^\]]+)\]/);
    if (topicMatch) {
      const topic   = topicMatch[1];
      const content = resp.replace(/^\[([^\]]+)\]\n?/, '');
      el.innerHTML = `<span class="intel-topic">[${topic}]</span>${content}`;
    } else {
      el.textContent = resp;
    }
    showToast('// INTEL BRIEF READY', 'green');
  } catch (err) {
    el.textContent = `Error: ${err.message}`;
    showToast(`ERROR: ${err.message}`);
  }
  btn.disabled = false; btn.textContent = '🧠 GET BRIEF';
}

// ── Pattern Insights ──────────────────────────────────
async function generatePatternInsights() {
  const btn = document.getElementById('generateInsightsBtn');
  const el  = document.getElementById('patternInsightsText');
  btn.disabled = true; btn.textContent = '🔍 ANALYZING...';
  const history = memory.history || [];
  const prompt  = JARVISPHINE.getPatternInsightsPrompt(settings.userName || 'Friend', history);
  try {
    const resp = await JARVISPHINE.callAPI([{ role: 'user', content: prompt }], '', settings);
    el.innerHTML = resp.replace(/\n/g, '<br>');
    showToast('// PATTERNS ANALYZED', 'green');
  } catch (err) {
    el.textContent = `Error: ${err.message}`;
    showToast(`ERROR: ${err.message}`);
  }
  btn.disabled = false; btn.textContent = '🔍 ANALYZE PATTERNS';
}

// ── Export / Import ───────────────────────────────────
function exportData() {
  const json = JARVISPHINE.exportDataAsJSON(memory, settings, chatHistory, saveStates);
  JARVISPHINE.downloadJSON(`jarvisphine_backup_${new Date().toISOString().split('T')[0]}.json`, json);
  showToast('// DATA EXPORTED', 'green');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const result = JARVISPHINE.importDataFromJSON(ev.target.result);
    if (!result.success) { showToast(`IMPORT ERROR: ${result.error}`); return; }
    const { data } = result;
    memory     = data.memory;
    settings   = { ...settings, ...data.settings };
    chatHistory = data.chatHistory || [];
    saveStates  = data.saveStates  || [];
    JARVISPHINE.saveMemory(memory);
    JARVISPHINE.saveSettings(settings);
    JARVISPHINE.saveHistory(chatHistory);
    JARVISPHINE.saveSaveStates(saveStates);
    renderChat(); renderHome(); renderIntel(); renderSettings();
    applyPersonalityMode(settings.personality || 'sharp');
    updateModeBadge(settings.personality || 'sharp');
    debouncedSync();
    showToast('// DATA IMPORTED', 'green');
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ── Save States ───────────────────────────────────────
function openSaveModal() {
  renderSaveStates();
  document.getElementById('saveModal').classList.add('active');
  document.getElementById('saveStateName').value = '';
}

function closeSaveModal() { document.getElementById('saveModal').classList.remove('active'); }

function renderSaveStates() {
  const list = document.getElementById('saveStatesList');
  if (!saveStates.length) {
    list.innerHTML = '<p class="empty-state">// NO SAVES YET</p>'; return;
  }
  list.innerHTML = saveStates.map((s, i) => `
    <div class="save-state-item">
      <div>
        <div class="save-state-name">${s.name}</div>
        <div class="save-state-date">${new Date(s.date).toLocaleDateString()} — streak ${s.snapshot?.streaks?.sober_days ?? 0} sober</div>
      </div>
      <div class="save-state-actions">
        <button class="btn-save-action btn-load" onclick="loadSaveState(${i})">LOAD</button>
        <button class="btn-save-action btn-del-save" onclick="deleteSaveState(${i})">✕</button>
      </div>
    </div>
  `).join('');
}

function createSaveState() {
  const name = document.getElementById('saveStateName').value.trim();
  if (!name) { showToast('// NAME REQUIRED'); return; }
  const save = { name, date: new Date().toISOString(), snapshot: JSON.parse(JSON.stringify(memory)), chatSnapshot: chatHistory.slice(-20) };
  saveStates.unshift(save);
  if (saveStates.length > 10) saveStates.pop();
  JARVISPHINE.saveSaveStates(saveStates);
  debouncedSync();
  renderSaveStates();
  document.getElementById('saveStateName').value = '';
  showToast('// SAVE STATE CREATED', 'green');
}

function loadSaveState(idx) {
  if (!confirm(`Load save: "${saveStates[idx].name}"? Current data will be replaced.`)) return;
  memory      = JSON.parse(JSON.stringify(saveStates[idx].snapshot));
  chatHistory = saveStates[idx].chatSnapshot || [];
  JARVISPHINE.saveMemory(memory);
  JARVISPHINE.saveHistory(chatHistory);
  renderChat(); renderHome(); renderIntel();
  closeSaveModal();
  debouncedSync();
  showToast('// SAVE STATE LOADED', 'green');
}

function deleteSaveState(idx) {
  saveStates.splice(idx, 1);
  JARVISPHINE.saveSaveStates(saveStates);
  debouncedSync();
  renderSaveStates();
}

// ── Goals ─────────────────────────────────────────────
function openGoalModal()  { document.getElementById('goalModal').classList.add('active'); document.getElementById('goalText').value = ''; }
function closeGoalModal() { document.getElementById('goalModal').classList.remove('active'); }

function saveGoal() {
  const text   = document.getElementById('goalText').value.trim();
  const period = document.getElementById('goalPeriod').value;
  if (!text) { showToast('GOAL TEXT REQUIRED'); return; }
  if (!memory.goals) memory.goals = { weekly: [], monthly: [], quarterly: [] };
  memory.goals[period].push(text);
  JARVISPHINE.saveMemory(memory);
  debouncedSync();
  closeGoalModal();
  renderGoals();
  showToast('// GOAL ADDED', 'green');
}

function deleteGoal(period, idx) {
  if (!memory.goals[period]) return;
  memory.goals[period].splice(idx, 1);
  JARVISPHINE.saveMemory(memory);
  debouncedSync();
  renderGoals();
}

function renderGoals() {
  const goals     = memory.goals || { weekly: [], monthly: [], quarterly: [] };
  const container = document.getElementById('goalsList');
  if (!container) return;
  let html = '';
  ['weekly', 'monthly', 'quarterly'].forEach(period => {
    const list = goals[period] || [];
    const icon = { weekly: '📅', monthly: '🗓️', quarterly: '📊' }[period];
    html += `<div class="goals-section">
      <h3>${icon} ${period.toUpperCase()}</h3>
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
  const j = memory.today.journal || '';
  document.getElementById('journalText').value = j;
  document.getElementById('journalCharCount').textContent = j.length + ' / 500';
}

function saveJournal() {
  const text = document.getElementById('journalText').value.trim();
  if (text.length > 500) { showToast('MAX 500 CHARACTERS'); return; }
  memory.today.journal = text;
  JARVISPHINE.saveMemory(memory);
  debouncedSync();
  showToast('// JOURNAL SAVED', 'green');
}

// ── Home ──────────────────────────────────────────────
function renderHome() {
  const today   = memory.today   || {};
  const streaks = memory.streaks || {};

  animateStat('stat-drinks',  today.drinks  != null ? today.drinks : '—');
  animateStat('stat-sport',   today.sport   ?? '—');
  animateStat('stat-mood',    today.mood    ?? '—');
  animateStat('stat-water',   today.water   != null ? today.water + 'gl' : '—');
  animateStat('stat-wake',    today.wake    ?? '—');
  animateStat('stat-sleep',   today.sleep_hours != null ? today.sleep_hours + 'h' : '—');
  animateStat('stat-energy',  today.energy  != null ? today.energy + '/10' : '—');
  animateStat('stat-outdoor', today.outdoor ?? '—');
  animateStat('streak-sober', streaks.sober_days  ?? 0);
  animateStat('streak-sport', streaks.sport_days  ?? 0);
  animateStat('streak-ritual', streaks.ritual_days ?? 0);

  // Color coding
  const dEl = document.getElementById('stat-drinks');
  if (dEl && today.drinks != null) {
    dEl.className = `stat-value ${today.drinks === 0 ? 'green' : today.drinks <= 2 ? 'gold' : 'red'}`;
  }
  const sEl = document.getElementById('stat-sport');
  if (sEl) sEl.className = `stat-value ${today.sport === 'yes' ? 'green' : today.sport === 'no' ? 'red' : ''}`;
  const oEl = document.getElementById('stat-outdoor');
  if (oEl) oEl.className = `stat-value ${today.outdoor === 'yes' ? 'green' : today.outdoor === 'no' ? 'red' : ''}`;
  const eEl = document.getElementById('stat-energy');
  if (eEl && today.energy != null) {
    eEl.className = `stat-value ${today.energy >= 7 ? 'green' : today.energy >= 4 ? 'gold' : 'red'}`;
  }

  renderMorningRitual();
  renderDailyPlan();
  renderMomentumScore();
}

function animateStat(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent === String(val)) return;
  el.classList.add('updating');
  setTimeout(() => { el.textContent = val; el.classList.remove('updating'); }, 130);
}

function renderMomentumScore() {
  const momentum = JARVISPHINE.calculateMomentum(memory);
  const arc      = document.getElementById('threatArc');
  const label    = document.getElementById('threatLabel');
  const pct      = document.getElementById('threatPct');
  const desc     = document.getElementById('threatDesc');
  const dot      = document.getElementById('threatIndicator');
  if (!arc) return;

  const circumference = 220;
  const offset = circumference - (circumference * momentum.score / 100);
  arc.style.strokeDashoffset = offset;
  arc.style.stroke = momentum.color;
  arc.style.filter = `drop-shadow(0 0 6px ${momentum.color})`;

  label.textContent  = momentum.level;
  label.style.color  = momentum.color;
  label.style.textShadow = `0 0 8px ${momentum.color}`;
  pct.textContent    = momentum.score + '%';
  pct.style.color    = momentum.color;
  if (desc) desc.textContent = momentum.desc;
  if (dot)  { dot.style.background = momentum.color; dot.style.boxShadow = `0 0 8px ${momentum.color}`; }
}

// ── Intel ─────────────────────────────────────────────
function renderIntel() {
  const streaks = memory.streaks || {};
  const history = memory.history || [];
  animateStat('s-sober-current', streaks.sober_days ?? 0);
  animateStat('s-sober-best',    streaks.sober_best  ?? 0);
  animateStat('s-sport-current', streaks.sport_days ?? 0);
  animateStat('s-sport-best',    streaks.sport_best  ?? 0);
  drawDrinksChart(history);
  drawMoodChart(history);
  drawEnergyChart(history);
  drawSportHeatmap(history);
  renderDebriefs();
}

function drawDrinksChart(history) {
  const canvas = document.getElementById('drinksChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w   = canvas.width = canvas.offsetWidth;
  const h   = canvas.height = 80;
  ctx.clearRect(0, 0, w, h);
  const days = [...history].slice(0, 7).reverse();
  if (!days.length) {
    ctx.fillStyle = '#1c2640'; ctx.font = '9px Orbitron, monospace';
    ctx.fillText('// NO DATA YET', 10, 40); return;
  }
  const maxVal = Math.max(...days.map(d => d.drinks || 0), 1);
  const barW   = Math.floor((w - 20) / days.length) - 4;
  days.forEach((day, i) => {
    const val  = day.drinks || 0;
    const barH = Math.max(2, (val / maxVal) * (h - 20));
    const x    = 10 + i * ((w - 20) / days.length);
    const y    = h - barH - 10;
    const color = val === 0 ? '#00ff88' : val <= 2 ? '#f5a623' : '#ff4466';
    ctx.fillStyle = color + '30'; ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = color;        ctx.fillRect(x, y, barW, 2);
    ctx.shadowColor = color; ctx.shadowBlur = 4;
    ctx.fillRect(x, y, barW, 2); ctx.shadowBlur = 0;
    ctx.fillStyle = '#1c2640'; ctx.font = '7px Orbitron, monospace';
    ctx.fillText(val, x + barW/2 - 3, h - 2);
  });
}

function drawMoodChart(history) {
  const canvas = document.getElementById('moodChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w   = canvas.width = canvas.offsetWidth;
  const h   = canvas.height = 50;
  ctx.clearRect(0, 0, w, h);
  const days = [...history].slice(0, 7).reverse();
  if (!days.length) return;
  const moodY     = { good: 10, neutral: 25, low: 40 };
  const moodColor = { good: '#00ff88', neutral: '#f5a623', low: '#ff4466' };
  const pts = days.map((d, i) => ({
    x: 15 + i * ((w - 30) / Math.max(days.length - 1, 1)),
    y: moodY[d.mood] || 25,
    color: moodColor[d.mood] || '#1c2640'
  }));
  if (pts.length > 1) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#00d4ff30'; ctx.lineWidth = 1; ctx.stroke();
  }
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.fill();
    ctx.shadowColor = p.color; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
  });
}

function drawEnergyChart(history) {
  const canvas = document.getElementById('energyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w   = canvas.width = canvas.offsetWidth;
  const h   = canvas.height = 60;
  ctx.clearRect(0, 0, w, h);
  const days = [...history].slice(0, 7).reverse();
  if (!days.length) {
    ctx.fillStyle = '#1c2640'; ctx.font = '9px Orbitron, monospace';
    ctx.fillText('// NO DATA YET', 10, 30); return;
  }
  const pts = days.map((d, i) => ({
    x: 15 + i * ((w - 30) / Math.max(days.length - 1, 1)),
    ey: d.energy != null ? h - 5 - ((d.energy / 10) * (h - 15)) : null,
    sy: d.sleep_hours != null ? h - 5 - (Math.min(d.sleep_hours, 10) / 10 * (h - 15)) : null
  }));
  // Energy line (blue)
  const ePoints = pts.filter(p => p.ey != null);
  if (ePoints.length > 1) {
    ctx.beginPath(); ctx.moveTo(ePoints[0].x, ePoints[0].ey);
    ePoints.forEach(p => ctx.lineTo(p.x, p.ey));
    ctx.strokeStyle = '#00d4ff80'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ePoints.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.ey, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00d4ff'; ctx.fill();
    ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 5; ctx.fill(); ctx.shadowBlur = 0;
  });
  // Sleep line (gold)
  const sPoints = pts.filter(p => p.sy != null);
  if (sPoints.length > 1) {
    ctx.beginPath(); ctx.moveTo(sPoints[0].x, sPoints[0].sy);
    sPoints.forEach(p => ctx.lineTo(p.x, p.sy));
    ctx.strokeStyle = '#f5a62360'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  sPoints.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.sy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f5a623'; ctx.fill();
    ctx.shadowColor = '#f5a623'; ctx.shadowBlur = 5; ctx.fill(); ctx.shadowBlur = 0;
  });
  // Legend
  ctx.fillStyle = '#00d4ff'; ctx.font = '7px Orbitron, monospace';
  ctx.fillText('energy', 5, 10);
  ctx.fillStyle = '#f5a623';
  ctx.fillText('sleep', 50, 10);
}

function drawSportHeatmap(history) {
  const canvas = document.getElementById('sportHeatmap');
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  const w    = canvas.width = canvas.offsetWidth;
  const h    = canvas.height = 30;
  ctx.clearRect(0, 0, w, h);
  const days  = [...history].slice(0, 28).reverse();
  const cellW = Math.floor((w - 10) / 28);
  days.forEach((day, i) => {
    const x    = 5 + i * cellW;
    const done = day.sport === 'yes';
    ctx.fillStyle = done ? '#00d4ff20' : '#0d0d22';
    ctx.fillRect(x, 5, cellW - 2, 20);
    if (done) {
      ctx.fillStyle = '#00d4ff'; ctx.fillRect(x, 5, cellW - 2, 2);
      ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 4;
      ctx.fillRect(x, 5, cellW - 2, 2); ctx.shadowBlur = 0;
    }
  });
}

function renderDebriefs() {
  const container = document.getElementById('debriefList');
  if (!container) return;
  const debriefs = memory.debriefs || [];
  if (!debriefs.length) {
    container.innerHTML = '<p class="empty-state">// NO DEBRIEFS YET</p>'; return;
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
  document.getElementById('userNameInput').value = settings.userName || '';
  document.getElementById('topicsInput').value   = settings.topics  || 'science, psychology, history, philosophy';
  const p = settings.provider || 'claude';
  document.querySelectorAll('.provider-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.provider === p)
  );
  applyPersonalityMode(settings.personality || 'sharp');
  checkServerStatus();
}

function saveSettingsFn() {
  settings.userName = document.getElementById('userNameInput').value.trim() || 'Friend';
  settings.topics   = document.getElementById('topicsInput').value.trim()   || 'science, psychology, history, philosophy';
  JARVISPHINE.saveSettings(settings);
  debouncedSync();
  showToast('// CONFIGURATION SAVED', 'green');
  showScreen('chat');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = type ? `show ${type}` : 'show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Passphrase Gate ───────────────────────────────────
function initPassphrase() {
  const overlay = document.getElementById('passphraseOverlay');
  const input   = document.getElementById('passphraseInput');
  const btn     = document.getElementById('passphraseBtn');

  const canvas = document.getElementById('passphraseCanvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = overlay.offsetWidth  || 480;
  canvas.height = overlay.offsetHeight || 800;
  const cols  = Math.floor(canvas.width / 14);
  const drops = Array(cols).fill(1);
  const chars = 'JARVISPHINE01アカサタナハマヤ'.split('');
  const matrixInterval = setInterval(() => {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,212,255,0.5)';
    ctx.font = '13px monospace';
    drops.forEach((y, i) => {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * 14, y * 14);
      if (y * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
  }, 40);

  function submit() {
    const val = input.value.trim();
    if (!val) { input.classList.add('error'); setTimeout(() => input.classList.remove('error'), 600); return; }
    clearInterval(matrixInterval);
    NAMESPACE.set(val);
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.6s';
    setTimeout(() => { overlay.style.display = 'none'; startApp(); }, 600);
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (NAMESPACE.isSet()) {
    document.getElementById('passphraseOverlay').style.display = 'none';
    startApp();
  } else {
    document.getElementById('bootOverlay').style.display = 'none';
    initPassphrase();
  }
});
