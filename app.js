// app.js — Jarvisphine v5.0 — Full feature set

let currentScreen = 'chat';
let chatHistory = [];
let memory = {};
let settings = {};
let saveStates = [];
let isTyping = false;
let isRecording = false;
let recognition = null;
let neuralLinkActive = false;
let syncTimeout = null;
let checkinsSentToday = {};

// ── Passphrase Lock ───────────────────────────────────
async function initLockScreen() {
  const lockScreen = document.getElementById('lockScreen');
  const enterMode  = document.getElementById('lockEnterMode');
  const setMode    = document.getElementById('lockSetMode');

  if (!JARVISPHINE.hasPassphrase()) {
    enterMode.style.display = 'none';
    setMode.style.display   = 'flex';
  } else {
    enterMode.style.display = 'flex';
    setMode.style.display   = 'none';
  }

  // Focus input
  setTimeout(() => {
    (JARVISPHINE.hasPassphrase()
      ? document.getElementById('passphraseInput')
      : document.getElementById('passphraseSetInput')
    ).focus();
  }, 300);

  // Enter to unlock
  document.getElementById('passphraseInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') tryUnlock();
  });

  document.getElementById('unlockBtn').addEventListener('click', tryUnlock);
  document.getElementById('setPassphraseBtn').addEventListener('click', trySetPassphrase);
}

async function tryUnlock() {
  const input = document.getElementById('passphraseInput').value;
  const errEl = document.getElementById('lockError');
  if (!input) { errEl.textContent = '// PASSPHRASE REQUIRED'; return; }
  const ok = await JARVISPHINE.verifyPassphrase(input);
  if (ok) {
    document.getElementById('lockScreen').classList.add('hidden');
    startApp();
  } else {
    errEl.textContent = '// ACCESS DENIED';
    document.getElementById('passphraseInput').value = '';
    setTimeout(() => { errEl.textContent = ''; }, 2000);
  }
}

async function trySetPassphrase() {
  const pass    = document.getElementById('passphraseSetInput').value;
  const confirm = document.getElementById('passphraseConfirmInput').value;
  const errEl   = document.getElementById('lockError');
  if (!pass)           { errEl.textContent = '// PASSPHRASE REQUIRED'; return; }
  if (pass.length < 4) { errEl.textContent = '// MIN 4 CHARACTERS';    return; }
  if (pass !== confirm) { errEl.textContent = '// PASSPHRASES DO NOT MATCH'; return; }
  await JARVISPHINE.setPassphrase(pass);
  document.getElementById('lockScreen').classList.add('hidden');
  startApp();
}

// Lock icon in header
function lockSystem() {
  if (!confirm('Lock JARVISPHINE?')) return;
  document.getElementById('lockScreen').classList.remove('hidden');
  document.getElementById('passphraseInput').value = '';
  // Show enter mode
  document.getElementById('lockEnterMode').style.display = 'flex';
  document.getElementById('lockSetMode').style.display   = 'none';
  setTimeout(() => document.getElementById('passphraseInput').focus(), 100);
}

// ── Boot Sequence ─────────────────────────────────────
function runBoot(callback) {
  const canvas = document.getElementById('matrixCanvas');
  const ctx    = canvas.getContext('2d');
  const boot   = document.getElementById('bootOverlay');
  const hud    = document.getElementById('bootHUD');
  const fill   = document.getElementById('bootProgressFill');
  const text   = document.getElementById('bootText');

  canvas.width  = boot.offsetWidth || 480;
  canvas.height = boot.offsetHeight || 800;

  // Matrix rain setup
  const cols = Math.floor(canvas.width / 14);
  const drops = Array(cols).fill(1);
  const chars = 'JARVISPHINE01アカサタナハマヤラワ'.split('');

  let matrixFrame = 0;
  const drawMatrix = () => {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff1a2e';
    ctx.font = '13px monospace';
    drops.forEach((y, i) => {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * 14, y * 14);
      if (y * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
  };

  const matrixInterval = setInterval(drawMatrix, 40);

  // Boot lines sequence
  const lines = [
    'JARVISPHINE v5.0 BOOT SEQUENCE...',
    'LOADING STARK TERMINAL UI...',
    'NEURAL LINK CALIBRATING...',
    'SUPABASE SYNC ONLINE...',
    'THREAT ANALYSIS ENGINE READY...',
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

  // Show HUD after 500ms of matrix rain
  setTimeout(() => { hud.classList.add('visible'); }, 500);

  // Complete boot
  setTimeout(() => {
    clearInterval(matrixInterval);
    clearInterval(lineInterval);
    fill.style.width = '100%';
    setTimeout(() => {
      boot.classList.add('hidden');
      if (callback) callback();
    }, 400);
  }, 2200);
}

// ── App Start ─────────────────────────────────────────
async function startApp() {
  runBoot(async () => {
    // Try to load from Supabase first
    setSyncStatus('syncing');
    const remote = await JARVISPHINE.loadFromSupabase();

    if (remote.memory) {
      memory = remote.memory;
      // Day rollover check
      const today = new Date().toDateString();
      if (memory.lastDate !== today) {
        if (memory.lastDate && memory.today) {
          if (!memory.history) memory.history = [];
          memory.history.unshift({ date: memory.lastDate, ...memory.today });
          if (memory.history.length > 90) memory.history.pop();
        }
        memory.today = { drinks: null, sport: null, mood: null, water: null, journal: '', wake: null, outdoor: null };
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

    // Load checkins sent today
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

    if (!settings.apiKey && !settings.deepseekKey) {
      showScreen('settings');
      showToast('SYSTEM: API KEY REQUIRED');
    } else if (chatHistory.length === 0) {
      setTimeout(() => sendJarvisphineMessage("hey — I'm Jarvisphine. your real companion, not a bot. how's today looking?"), 2200);
    } else {
      renderChat();
    }
  });
}

// ── Event Listeners ───────────────────────────────────
function initEventListeners() {
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.screen)));

  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('saveSettings').addEventListener('click', saveSettingsFn);
  document.getElementById('generateBriefing').addEventListener('click', generateMissionBriefing);
  document.querySelectorAll('.quick-log').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.type === 'wake' && b.dataset.value === 'prompt') { promptWakeTime(); }
    else quickLog(b.dataset.type, b.dataset.value, b);
  }));

  // Export / Import
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
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
      updateProviderStatus();
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

  // Mode badge in header (cycle through modes)
  document.getElementById('modeBadge').addEventListener('click', () => {
    const modes = ['soft', 'sharp', 'noexcuses'];
    const cur = modes.indexOf(settings.personality || 'sharp');
    const next = modes[(cur + 1) % modes.length];
    settings.personality = next;
    JARVISPHINE.saveSettings(settings);
    applyPersonalityMode(next);
    updateModeBadge(next);
    debouncedSync();
    showToast(`// MODE: ${next.toUpperCase()}`, 'gold');
  });

  // Lock icon
  document.getElementById('lockIconBtn').addEventListener('click', lockSystem);

  // Change passphrase
  document.getElementById('changePassBtn').addEventListener('click', async () => {
    const val = document.getElementById('newPassInput').value;
    if (!val || val.length < 4) { showToast('// MIN 4 CHARACTERS'); return; }
    await JARVISPHINE.setPassphrase(val);
    document.getElementById('newPassInput').value = '';
    showToast('// PASSPHRASE UPDATED', 'green');
  });

  window.speechSynthesis?.addEventListener('voiceschanged', () => {});
}

// ── Personality Mode ──────────────────────────────────
function applyPersonalityMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
}

function updateModeBadge(mode) {
  const badge = document.getElementById('modeBadge');
  const labels = { soft: 'SOFT', sharp: 'SHARP', noexcuses: 'NO XCSS' };
  badge.textContent = labels[mode] || 'SHARP';
  badge.className = `mode-badge ${mode}`;
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
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
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
  if (!settings.apiKey && !settings.deepseekKey) { showToast('NO API KEY — CHECK CONFIG'); showScreen('settings'); return; }
  inp.value = '';
  inp.style.height = '';
  appendMsg('user', text);
  chatHistory.push({ role: 'user', content: text });

  // Extract log data
  const logData = JARVISPHINE.extractLogData(text);
  if (Object.keys(logData).length) {
    Object.assign(memory.today, logData);
    if (typeof logData.drinks === 'number') JARVISPHINE.updateStreak(memory, 'sober_days', logData.drinks === 0);
    if (logData.sport === 'yes') JARVISPHINE.updateStreak(memory, 'sport_days', true);
    if (logData.sport === 'no')  JARVISPHINE.updateStreak(memory, 'sport_days', false);
    JARVISPHINE.saveMemory(memory);
    if (currentScreen === 'home') renderHome();
  }

  isTyping = true; showTyping();
  try {
    const sys  = JARVISPHINE.getSystemPrompt(settings.userName || 'Friend', memory, settings.personality || 'sharp');
    const msgs = chatHistory.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
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

// ── Wake Time Prompt ──────────────────────────────────
function promptWakeTime() {
  const t = prompt('What time did you wake up? (e.g., 7:30 or 9)');
  if (!t) return;
  const match = t.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) { showToast('// INVALID TIME FORMAT'); return; }
  const h = parseInt(match[1]);
  const m = match[2] ? parseInt(match[2]) : 0;
  const wake = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  memory.today.wake = wake;
  JARVISPHINE.saveMemory(memory);
  renderHome();
  showToast(`// WAKE: ${wake}`, 'green');
  showScreen('chat');
  sendMessage(`woke up at ${wake}`);
}

// ── Quick Log ─────────────────────────────────────────
function quickLog(type, value, btn) {
  if (type === 'drinks')  memory.today.drinks  = parseInt(value);
  if (type === 'sport')   memory.today.sport   = value;
  if (type === 'mood')    memory.today.mood     = value;
  if (type === 'water')   memory.today.water    = parseInt(value);
  if (type === 'outdoor') memory.today.outdoor  = value;

  if (type === 'sport') JARVISPHINE.updateStreak(memory, 'sport_days', value === 'yes');
  if (type === 'drinks') JARVISPHINE.updateStreak(memory, 'sober_days', parseInt(value) === 0);

  JARVISPHINE.saveMemory(memory);
  renderHome();

  // Visual feedback
  if (btn) {
    btn.classList.add('selected');
    setTimeout(() => btn.classList.remove('selected'), 1200);
  }

  const msgs = {
    'drinks-0': 'logged 0 drinks today', 'drinks-1': 'had 1 drink',
    'drinks-3': 'had 3+ drinks',         'sport-yes': 'did sport today',
    'sport-no': 'skipped sport today',   'mood-good': 'mood is good today',
    'mood-low': 'feeling low today',     'water-6': 'drank 6 glasses of water',
    'water-8': 'drank 8 glasses of water','outdoor-yes': 'went outside today',
    'outdoor-no': 'stayed inside today'
  };
  const key = `${type}-${value}`;
  if (msgs[key]) { showScreen('chat'); sendMessage(msgs[key]); }
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
  document.getElementById('nlResponse').textContent = '// PROCESSING...';
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
  { key: 'morning',      h: 11, m: 30, name: 'morning' },
  { key: 'afternoon',    h: 14, m:  0, name: 'afternoon' },
  { key: 'lateafternoon',h: 17, m:  0, name: 'lateafternoon' },
  { key: 'evening',      h: 20, m:  0, name: 'evening' },
  { key: 'debrief',      h: 23, m:  0, name: 'debrief' }
];

function startScheduler() {
  setInterval(checkScheduledEvents, 30000); // check every 30s
}

function checkScheduledEvents() {
  const now    = new Date();
  const todayStr = now.toDateString();

  // Reset sent checkins on new day
  const stored = JSON.parse(localStorage.getItem('jarvisphine_checkins_sent') || '{}');
  if (!stored[todayStr]) {
    checkinsSentToday = {};
    const clean = { [todayStr]: {} };
    localStorage.setItem('jarvisphine_checkins_sent', JSON.stringify(clean));
  }

  // Check each slot (±1 minute window)
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

  // Auto-debrief at 23:00
  if (now.getHours() === 23 && now.getMinutes() === 0 && !checkinsSentToday['auto_debrief']) {
    checkinsSentToday['auto_debrief'] = true;
    triggerManualDebrief();
  }
}

async function triggerCheckIn(slotName) {
  if (!settings.apiKey && !settings.deepseekKey) return;
  const prompt = JARVISPHINE.getCheckInPrompt(settings.userName || 'Friend', memory, slotName);
  try {
    const resp = await JARVISPHINE.callAPI([{ role: 'user', content: prompt }], '', settings);
    showScreen('chat');
    sendJarvisphineMessage(resp, true);
    showToast('// CHECK-IN FROM JARVISPHINE', 'gold');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Jarvisphine', { body: resp.slice(0, 80) });
    }
  } catch(e) { /* silent fail */ }
}

// ── Mission Briefing ──────────────────────────────────
function generateMissionBriefing() {
  if (!settings.apiKey && !settings.deepseekKey) { showToast('NO API KEY — CHECK CONFIG'); return; }
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
  if (!settings.apiKey && !settings.deepseekKey) { showToast('NO API KEY — CHECK CONFIG'); return; }
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
    memory = data.memory;
    settings = { ...settings, ...data.settings };
    chatHistory = data.chatHistory || [];
    saveStates = data.saveStates || [];
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

function closeSaveModal() {
  document.getElementById('saveModal').classList.remove('active');
}

function renderSaveStates() {
  const list = document.getElementById('saveStatesList');
  if (!saveStates.length) {
    list.innerHTML = '<p class="empty-state">// NO SAVES YET</p>';
    return;
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
  const save = {
    name,
    date: new Date().toISOString(),
    snapshot: JSON.parse(JSON.stringify(memory)),
    chatSnapshot: chatHistory.slice(-20)
  };
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
  memory = JSON.parse(JSON.stringify(saveStates[idx].snapshot));
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
function openGoalModal() {
  document.getElementById('goalModal').classList.add('active');
  document.getElementById('goalText').value = '';
}

function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('active');
}

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
  showToast(`// GOAL ADDED`, 'green');
}

function deleteGoal(period, idx) {
  if (!memory.goals[period]) return;
  memory.goals[period].splice(idx, 1);
  JARVISPHINE.saveMemory(memory);
  debouncedSync();
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
  const today   = memory.today || {};
  const streaks = memory.streaks || {};
  animateStat('stat-drinks',  today.drinks  != null ? today.drinks : '—');
  animateStat('stat-sport',   today.sport   ?? '—');
  animateStat('stat-mood',    today.mood    ?? '—');
  animateStat('stat-water',   today.water   != null ? today.water + 'gl' : '—');
  animateStat('stat-wake',    today.wake    ?? '—');
  animateStat('stat-outdoor', today.outdoor ?? '—');
  animateStat('streak-sober', streaks.sober_days ?? 0);
  animateStat('streak-sport', streaks.sport_days ?? 0);

  // Color coding
  const dEl = document.getElementById('stat-drinks');
  if (dEl && today.drinks != null) {
    dEl.className = `stat-value ${today.drinks === 0 ? 'green' : today.drinks <= 2 ? '' : 'red'}`;
  }
  const sEl = document.getElementById('stat-sport');
  if (sEl) sEl.className = `stat-value ${today.sport === 'yes' ? 'green' : today.sport === 'no' ? 'red' : ''}`;
  const oEl = document.getElementById('stat-outdoor');
  if (oEl) oEl.className = `stat-value ${today.outdoor === 'yes' ? 'green' : today.outdoor === 'no' ? 'red' : ''}`;

  renderThreatLevel();
}

function animateStat(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.textContent;
  if (current === String(val)) return;
  el.classList.add('updating');
  setTimeout(() => { el.textContent = val; el.classList.remove('updating'); }, 130);
}

function renderThreatLevel() {
  const threat = JARVISPHINE.calculateThreatLevel(memory);
  const arc    = document.getElementById('threatArc');
  const label  = document.getElementById('threatLabel');
  const pct    = document.getElementById('threatPct');
  const desc   = document.getElementById('threatDesc');
  const dot    = document.getElementById('threatIndicator');
  if (!arc) return;

  // Circumference for r=35: 2π×35 ≈ 220
  const circumference = 220;
  const offset = circumference - (circumference * threat.score / 100);
  arc.style.strokeDashoffset = offset;
  arc.style.stroke = threat.color;
  arc.style.filter = `drop-shadow(0 0 6px ${threat.color})`;

  label.textContent = threat.level;
  label.style.color = threat.color;
  label.style.textShadow = `0 0 8px ${threat.color}`;
  pct.textContent   = threat.score + '%';
  pct.style.color   = threat.color;
  if (desc) { desc.textContent = threat.desc; }
  if (dot)  { dot.style.background = threat.color; dot.style.boxShadow = `0 0 8px ${threat.color}`; }
}

// ── Intel ─────────────────────────────────────────────
function renderIntel() {
  const streaks = memory.streaks || {};
  const history = memory.history || [];
  animateStat('s-sober-current', streaks.sober_days  ?? 0);
  animateStat('s-sober-best',    streaks.sober_best   ?? 0);
  animateStat('s-sport-current', streaks.sport_days  ?? 0);
  animateStat('s-sport-best',    streaks.sport_best   ?? 0);
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
    ctx.fillStyle = '#3a1018'; ctx.font = '9px Orbitron, monospace';
    ctx.fillText('// NO DATA', 10, 40); return;
  }
  const maxVal = Math.max(...days.map(d => d.drinks || 0), 1);
  const barW = Math.floor((w - 20) / days.length) - 4;
  days.forEach((day, i) => {
    const val  = day.drinks || 0;
    const barH = Math.max(2, (val / maxVal) * (h - 20));
    const x    = 10 + i * ((w - 20) / days.length);
    const y    = h - barH - 10;
    const color = val === 0 ? '#00ff41' : val <= 2 ? '#f5a623' : '#ff1a2e';
    ctx.fillStyle = color + '30'; ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = color;        ctx.fillRect(x, y, barW, 2);
    ctx.shadowColor = color; ctx.shadowBlur = 4;
    ctx.fillRect(x, y, barW, 2); ctx.shadowBlur = 0;
    ctx.fillStyle = '#3a1018'; ctx.font = '7px Orbitron, monospace';
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
  const moodY     = { good: 10, neutral: 25, low: 40 };
  const moodColor = { good: '#00ff41', neutral: '#f5a623', low: '#ff1a2e' };
  const pts = days.map((d, i) => ({
    x: 15 + i * ((w - 30) / Math.max(days.length - 1, 1)),
    y: moodY[d.mood] || 25,
    color: moodColor[d.mood] || '#3a1018'
  }));
  if (pts.length > 1) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#f5a62330'; ctx.lineWidth = 1; ctx.stroke();
  }
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.fill();
    ctx.shadowColor = p.color; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
  });
}

function drawSportHeatmap(history) {
  const canvas = document.getElementById('sportHeatmap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 30;
  ctx.clearRect(0, 0, w, h);
  const days  = [...history].slice(0, 28).reverse();
  const cellW = Math.floor((w - 10) / 28);
  days.forEach((day, i) => {
    const x    = 5 + i * cellW;
    const done = day.sport === 'yes';
    ctx.fillStyle = done ? '#ff1a2e30' : '#0a0000';
    ctx.fillRect(x, 5, cellW - 2, 20);
    if (done) {
      ctx.fillStyle = '#ff1a2e'; ctx.fillRect(x, 5, cellW - 2, 2);
      ctx.shadowColor = '#ff1a2e'; ctx.shadowBlur = 4;
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
  document.getElementById('apiKeyInput').value      = settings.apiKey || '';
  document.getElementById('deepseekKeyInput').value = settings.deepseekKey || '';
  document.getElementById('userNameInput').value    = settings.userName || '';
  const p = settings.provider || 'claude';
  document.querySelectorAll('.provider-btn').forEach(b => b.classList.toggle('active', b.dataset.provider === p));
  updateProviderStatus();
  applyPersonalityMode(settings.personality || 'sharp');
}

function updateProviderStatus() {
  const el = document.getElementById('providerStatus');
  if (el) el.textContent = settings.provider === 'deepseek' ? '// DEEPSEEK ACTIVE' : '// CLAUDE ACTIVE';
}

function saveSettingsFn() {
  settings.apiKey      = document.getElementById('apiKeyInput').value.trim();
  settings.deepseekKey = document.getElementById('deepseekKeyInput').value.trim();
  settings.userName    = document.getElementById('userNameInput').value.trim() || 'Friend';
  JARVISPHINE.saveSettings(settings);
  updateProviderStatus();
  debouncedSync();
  showToast('// CONFIGURATION SAVED', 'green');
  showScreen('chat');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = type ? `show ${type}` : 'show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLockScreen();
});
