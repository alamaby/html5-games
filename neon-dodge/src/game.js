'use strict';
/* Neon Dodge — browser shell: render, input, audio, i18n, SDK. Logic in ND. */

// ---------- CrazyGames SDK ----------
const CG = { game: null, ready: false, muted: false };
(function initCG() {
  function boot() {
    if (CG.ready || !window.CrazyGames || !window.CrazyGames.SDK) return;
    const SDK = window.CrazyGames.SDK;
    try {
      SDK.init().then(() => {
        CG.ready = true; CG.game = SDK.game;
        try {
          const go = SDK.game && SDK.game.settings;
          CG.muted = !!(go && go.muteAudio);
          if (CG.game && CG.game.onMuteStateChanged) {
            CG.game.onMuteStateChanged((m) => { CG.muted = !!m; });
          }
        } catch (e) {}
        syncMuteUI();
      }).catch(() => {});
    } catch (e) {}
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  setTimeout(boot, 1500);
})();
function requestMidgameAd(onDone) {
  const done = () => { if (onDone) onDone(); };
  if (!CG.ready || !CG.game || !CG.game.midgame) { done(); return; }
  let finished = false;
  const finish = () => { if (!finished) { finished = true; done(); } };
  const watchdog = setTimeout(finish, 8000);
  try {
    CG.game.midgame('midgame', () => {
      clearTimeout(watchdog);
      try { CG.game.gameplayStop(); } catch (e) {}
      setTimeout(finish, 50);
    }, () => { clearTimeout(watchdog); finish(); });
  } catch (e) { clearTimeout(watchdog); finish(); }
}

// ---------- audio ----------
let AC = null;
function ac() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!AC) { try { AC = new Ctx(); } catch (e) { return null; } }
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
function isMuted() {
  if (CG.muted) return true;
  try { return localStorage.getItem('nd_mute') === '1'; } catch (e) { return false; }
}
function beep(freq, dur, type, vol, slideTo) {
  if (isMuted()) return;
  const c = ac(); if (!c) return;
  try {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.25, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  } catch (e) {}
}
const sfx = {
  ui: () => beep(520, 0.06, 'sine', 0.22),
  nearmiss: () => beep(400, 0.14, 'sine', 0.22, 1400),
  explode: () => { beep(160, 0.4, 'sawtooth', 0.35, 40); beep(90, 0.5, 'square', 0.25, 30); },
  ach: () => { beep(880, 0.12, 'sine', 0.3); setTimeout(() => beep(1318, 0.18, 'sine', 0.3), 110); },
};

// ---------- i18n ----------
const STR = {
  en: {
    title: 'NEON DODGE', subtitle: 'How long can you survive?',
    howto: [
      '👆 <b>Drag</b> to move your orb',
      '💥 Dodge the falling neon',
      '⚡ Near misses score <b>+25</b>',
    ],
    tapStart: 'TAP TO START', best: 'BEST',
    gameOver: 'GAME OVER', tapRetry: 'TAP TO RETRY',
    newBest: '★ NEW BEST ★',
    achTitle: 'ACHIEVEMENTS', achClose: 'TAP TO CLOSE', locked: '???',
    newAch: (n) => '🏆 ' + n + ' new achievement' + (n > 1 ? 's!' : '!'),
    shareScore: 'SHARE SCORE',
    imgSaved: 'Image saved — share it to WhatsApp / Status!',
    shareText: (o) => 'I survived ' + o.t + 's in Neon Dodge (' + o.s + ' pts)! Can you beat it?',
    cardCta: 'How long can you survive?',
    survived: (t) => t.toFixed(1) + 's',
  },
  id: {
    title: 'NEON DODGE', subtitle: 'Berapa lama kamu bertahan?',
    howto: [
      '👆 <b>Seret</b> untuk menggerakkan orb',
      '💥 Hindari neon yang jatuh',
      '⚡ Nyaris kena dapat <b>+25</b>',
    ],
    tapStart: 'KETUK UNTUK MULAI', best: 'TERBAIK',
    gameOver: 'GAME OVER', tapRetry: 'KETUK UNTUK ULANGI',
    newBest: '★ REKOR BARU ★',
    achTitle: 'PENCAPAIAN', achClose: 'KETUK UNTUK TUTUP', locked: '???',
    newAch: (n) => '🏆 ' + n + ' pencapaian baru!',
    shareScore: 'BAGIKAN SKOR',
    imgSaved: 'Gambar tersimpan — bagikan ke WhatsApp / Status!',
    shareText: (o) => 'Aku bertahan ' + o.t + ' detik di Neon Dodge (' + o.s + ' poin)! Bisa kalahkan?',
    cardCta: 'Berapa lama kamu bertahan?',
    survived: (t) => t.toFixed(1) + ' dtk',
  },
};
let lang = 'en';
try { lang = localStorage.getItem('nd_lang') || 'en'; if (!STR[lang]) lang = 'en'; } catch (e) {}
const t = (k, arg) => { const v = STR[lang][k]; return typeof v === 'function' ? v(arg) : v; };

// ---------- achievements ----------
const ACHS = [
  { id: 'first_dodge', icon: '👆', name: { en: 'First Dodge', id: 'Hindaran Pertama' }, desc: { en: 'Survive 10 seconds', id: 'Bertahan 10 detik' } },
  { id: 'survivor', icon: '🏃', name: { en: 'Survivor', id: 'Penyintas' }, desc: { en: 'Survive 30 seconds', id: 'Bertahan 30 detik' } },
  { id: 'marathon', icon: '🏁', name: { en: 'Marathon', id: 'Maraton' }, desc: { en: 'Survive 60 seconds', id: 'Bertahan 60 detik' } },
  { id: 'close_call', icon: '⚡', name: { en: 'Close Call', id: 'Nyaris Kena' }, desc: { en: '5 near misses in one run', id: '5 near miss dalam sekali main' } },
  { id: 'daredevil', icon: '😱', name: { en: 'Daredevil', id: 'Pemberani' }, desc: { en: '15 near misses in one run', id: '15 near miss dalam sekali main' } },
  { id: 'centurion', icon: '💯', name: { en: 'Centurion', id: 'Centurion' }, desc: { en: 'Score 1000 in one run', id: 'Raih 1000 poin sekali main' } },
  { id: 'neon2k', icon: '🌟', name: { en: 'Neon Legend', id: 'Legenda Neon' }, desc: { en: 'Score 2000 in one run', id: 'Raih 2000 poin sekali main' } },
  { id: 'persistent', icon: '💪', name: { en: 'Persistent', id: 'Pantang Menyerah' }, desc: { en: 'Play 10 games', id: 'Mainkan 10 game' } },
];
let achUnlocked = {};
try { achUnlocked = JSON.parse(localStorage.getItem('nd_ach') || '{}'); } catch (e) { achUnlocked = {}; }
let achAtStart = 0, totalGames = 0;
try { totalGames = parseInt(localStorage.getItem('nd_games') || '0', 10) || 0; } catch (e) {}
const toastQueue = [];
let toastBusy = false, toastShows = 0;
function unlock(id) {
  if (achUnlocked[id]) return;
  achUnlocked[id] = 1;
  try { localStorage.setItem('nd_ach', JSON.stringify(achUnlocked)); } catch (e) {}
  toastQueue.push(id);
  pumpToast();
}
function pumpToast() {
  if (toastBusy || !toastQueue.length) return;
  toastBusy = true;
  toastShows++;
  const qid = toastQueue.shift();
  const a = ACHS.find((x) => x.id === qid);
  if (!a) { toastBusy = false; pumpToast(); return; }
  const el = $('achToast');
  el.innerHTML = '<div class="ticon">' + a.icon + '</div><div><div class="tname">' +
    a.name[lang] + '</div><div class="tdesc">' + a.desc[lang] + '</div></div>';
  el.classList.add('show');
  sfx.ach();
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { toastBusy = false; pumpToast(); }, 400);
  }, 2600);
}
function renderAchGrid() {
  $('achGrid').innerHTML = ACHS.map((a) => {
    const un = !!achUnlocked[a.id];
    return '<div class="achcard' + (un ? '' : ' locked') + '"><div class="aicon">' + a.icon +
      '</div><div class="aname">' + (un ? a.name[lang] : t('locked')) +
      '</div><div class="adesc">' + (un ? a.desc[lang] : '···') + '</div></div>';
  }).join('');
}

// ---------- state ----------
const cv = $('game');
const g = cv.getContext('2d');
const VW = ND.W, VH = ND.H;
let screen = 'menu';   // menu | play
let st = null;
let best = 0;
try { best = parseInt(localStorage.getItem('nd_best') || '0', 10) || 0; } catch (e) {}
let score = 0, newBestFlag = false;
let particles = [], floats = [], stars = [];
let shake = 0, flash = 0;
let overShown = false;

function $(id) { return document.getElementById(id); }
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// starfield
for (let i = 0; i < 70; i++) {
  stars.push({ x: Math.random() * VW, y: Math.random() * VH,
               s: 0.5 + Math.random() * 1.8, v: 20 + Math.random() * 60 });
}

function fitCanvas() {
  const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
  cv.style.width = Math.floor(VW * s) + 'px';
  cv.style.height = Math.floor(VH * s) + 'px';
}
window.addEventListener('resize', fitCanvas);

function newGame() {
  st = ND.createGame();
  score = 0; newBestFlag = false; overShown = false;
  particles = []; floats = [];
  shake = 0; flash = 0;
  achAtStart = Object.keys(achUnlocked).length;
  totalGames++;
  try { localStorage.setItem('nd_games', String(totalGames)); } catch (e) {}
  if (totalGames >= 10) unlock('persistent');
  screen = 'play';
  hide($('menuEl')); hide($('overEl')); hide($('achGal'));
  applyTexts();
  if (CG.game) { try { CG.game.gameplayStart(); } catch (e) {} }
}

function checkTimeAch() {
  if (st.time >= 10) unlock('first_dodge');
  if (st.time >= 30) unlock('survivor');
  if (st.time >= 60) unlock('marathon');
  if (st.nearMiss >= 5) unlock('close_call');
  if (st.nearMiss >= 15) unlock('daredevil');
  if (score >= 1000) unlock('centurion');
  if (score >= 2000) unlock('neon2k');
}

function gameOver() {
  score = Math.floor(st.score);
  newBestFlag = score > best;
  if (newBestFlag) {
    best = score;
    try { localStorage.setItem('nd_best', String(best)); } catch (e) {}
    if (CG.game) { try { CG.game.happytime(); } catch (e) {} }
  }
  if (CG.game) { try { CG.game.gameplayStop(); } catch (e) {} }
  requestMidgameAd(showOverPanel);
}

function showOverPanel() {
  if (overShown) return;
  overShown = true;
  $('overScore').textContent = score;
  $('overTime').textContent = t('survived', st.time);
  $('overNewBest').textContent = newBestFlag ? t('newBest') : '';
  const newAch = Object.keys(achUnlocked).length - achAtStart;
  $('overAch').textContent = newAch > 0 ? t('newAch', newAch) : '';
  applyTexts();
  show($('overEl'));
  screen = 'menu';
}

function drainEvents() {
  for (const e of st.events) {
    if (e.t === 'nearmiss') {
      sfx.nearmiss();
      floats.push({ x: e.x, y: e.y - 24, t: 0, txt: '+25' });
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * 6.28, sp = 80 + Math.random() * 120;
        particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                         t: 0, life: 0.4, r: 2 + Math.random() * 3, color: '#ffe08a' });
      }
      checkTimeAch();
    } else if (e.t === 'die') {
      sfx.explode();
      shake = 1; flash = 1;
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * 6.28, sp = 60 + Math.random() * 300;
        particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                         t: 0, life: 0.9, r: 2 + Math.random() * 5,
                         color: ['#7df9ff', '#ff5c7a', '#ffffff'][i % 3] });
      }
    } else if (e.t === 'over') {
      gameOver();
    }
  }
  st.events.length = 0;
}

// ---------- rendering ----------
function neon(color, width) {
  g.strokeStyle = color; g.lineWidth = width;
  g.shadowColor = color; g.shadowBlur = 18;
}
function render(time, dt) {
  g.save();
  g.clearRect(0, 0, VW, VH);
  if (shake > 0) {
    g.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);
    shake = Math.max(0, shake - dt * 2.4);
  }
  // bg
  const bg = g.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, '#0a0a1e'); bg.addColorStop(1, '#141432');
  g.fillStyle = bg; g.fillRect(-20, -20, VW + 40, VH + 40);
  // starfield
  g.fillStyle = 'rgba(255,255,255,.5)';
  for (const s of stars) {
    const y = (s.y + time * s.v * (screen === 'play' ? 2 : 1)) % VH;
    g.globalAlpha = 0.25 + 0.35 * (s.s / 2);
    g.fillRect(s.x, y, s.s, s.s);
  }
  g.globalAlpha = 1;
  // horizon grid glow
  g.strokeStyle = 'rgba(0,229,255,.12)'; g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const y = ((i * 97 + time * 120) % (VH + 80)) - 40;
    g.beginPath(); g.moveTo(0, y); g.lineTo(VW, y); g.stroke();
  }

  if (st && screen === 'play') {
    // obstacles
    for (const o of st.obstacles) {
      const col = 'hsl(' + o.hue + ',95%,62%)';
      if (o.kind === 'bar') {
        g.shadowColor = col; g.shadowBlur = 16;
        g.fillStyle = col;
        g.beginPath();
        const r = 8, x = o.x - o.w / 2, y = o.y - o.h / 2;
        g.moveTo(x + r, y);
        g.arcTo(x + o.w, y, x + o.w, y + o.h, r); g.arcTo(x + o.w, y + o.h, x, y + o.h, r);
        g.arcTo(x, y + o.h, x, y, r); g.arcTo(x, y, x + o.w, y, r);
        g.closePath(); g.fill();
        g.shadowBlur = 0;
        g.fillStyle = 'rgba(255,255,255,.75)';
        g.fillRect(x + 6, y + 3, o.w - 12, 3);
      } else if (o.kind === 'orb') {
        g.shadowColor = col; g.shadowBlur = 18;
        const gr = g.createRadialGradient(o.x - 4, o.y - 5, 2, o.x, o.y, o.r);
        gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
        g.shadowBlur = 0;
      } else {
        g.save();
        g.translate(o.x, o.y); g.rotate(o.rot);
        g.shadowColor = col; g.shadowBlur = 16;
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(0, -o.r); g.lineTo(o.r * 0.7, 0); g.lineTo(0, o.r); g.lineTo(-o.r * 0.7, 0);
        g.closePath(); g.fill();
        g.shadowBlur = 0;
        g.fillStyle = 'rgba(255,255,255,.7)';
        g.beginPath();
        g.moveTo(0, -o.r * 0.45); g.lineTo(o.r * 0.32, 0); g.lineTo(0, o.r * 0.45); g.lineTo(-o.r * 0.32, 0);
        g.closePath(); g.fill();
        g.restore();
      }
    }
    // player orb + trail glow
    const p = st.player;
    const pg = g.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34);
    pg.addColorStop(0, 'rgba(125,249,255,.9)');
    pg.addColorStop(0.4, 'rgba(125,249,255,.28)');
    pg.addColorStop(1, 'rgba(125,249,255,0)');
    g.fillStyle = pg;
    g.beginPath(); g.arc(p.x, p.y, 34, 0, 7); g.fill();
    g.shadowColor = '#7df9ff'; g.shadowBlur = 22;
    g.fillStyle = '#d8fbff';
    g.beginPath(); g.arc(p.x, p.y, ND.PR, 0, 7); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#0a8a9e';
    g.beginPath(); g.arc(p.x, p.y, ND.PR * 0.45, 0, 7); g.fill();
  }

  // particles
  for (const pt of particles) {
    g.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
    g.fillStyle = pt.color;
    g.beginPath(); g.arc(pt.x, pt.y, pt.r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  // floating texts
  g.textAlign = 'center';
  for (const f of floats) {
    g.globalAlpha = Math.max(0, 1 - f.t / 0.8);
    g.fillStyle = '#ffe08a';
    g.font = '800 22px -apple-system, sans-serif';
    g.fillText(f.txt, f.x, f.y - f.t * 46);
  }
  g.globalAlpha = 1;
  // death flash
  if (flash > 0) {
    g.fillStyle = 'rgba(255,60,90,' + (flash * 0.28) + ')';
    g.fillRect(-20, -20, VW + 40, VH + 40);
    flash = Math.max(0, flash - dt * 2.5);
  }
  g.restore();
}

function frame(timeMs) {
  requestAnimationFrame(frame);
  const time = timeMs / 1000;
  const dt = Math.min(0.05, 1 / 60);
  if (screen === 'play' && st) {
    score = Math.floor(st.score);
    $('hudScore').textContent = score;
    ND.step(st, dt);
    checkTimeAch();
    drainEvents();
    // player trail
    const p = st.player;
    if (Math.random() < 0.85) {
      particles.push({ x: p.x + (Math.random() - 0.5) * 10, y: p.y + (Math.random() - 0.5) * 10,
                       vx: (Math.random() - 0.5) * 30, vy: 60 + Math.random() * 40,
                       t: 0, life: 0.45, r: 2 + Math.random() * 3, color: '#7df9ff' });
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    if (pt.t >= pt.life) particles.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    floats[i].t += dt;
    if (floats[i].t >= 0.8) floats.splice(i, 1);
  }
  render(time, dt);
}

// ---------- HUD / panels ----------
function applyTexts() {
  document.documentElement.lang = lang === 'id' ? 'id' : 'en';
  $('titleMain').textContent = t('title');
  $('titleSub').textContent = t('subtitle');
  $('howto').innerHTML = STR[lang].howto.map((l) => '<div class="hrow">' + l + '</div>').join('');
  $('tapStart').textContent = t('tapStart');
  $('menuBest').textContent = t('best') + ' ' + best;
  $('overKicker').textContent = t('gameOver');
  $('tapRetry').textContent = t('tapRetry');
  $('shareBtn').textContent = t('shareScore');
  $('achGalTitle').textContent = t('achTitle');
  $('achClose').textContent = t('achClose');
  $('langBtn').textContent = lang === 'en' ? 'ID' : 'EN';
  const newAch = Object.keys(achUnlocked).length - achAtStart;
  if ($('overAch')) $('overAch').textContent = newAch > 0 ? t('newAch', newAch) : '';
  syncMuteUI();
  if (!$('achGal').classList.contains('hidden')) renderAchGrid();
}

// ---------- share card ----------
function drawShareCard(c2d) {
  const W2 = 1080, H2 = 1350;
  const bg = c2d.createLinearGradient(0, 0, 0, H2);
  bg.addColorStop(0, '#0a0a1e'); bg.addColorStop(1, '#141432');
  c2d.fillStyle = bg; c2d.fillRect(0, 0, W2, H2);
  // neon obstacles motif
  c2d.save();
  c2d.shadowBlur = 24;
  const items = [
    { y: 420, w: 420, hue: 320 }, { y: 560, w: 300, hue: 280 }, { y: 700, w: 480, hue: 190 },
  ];
  items.forEach((it) => {
    const col = 'hsl(' + it.hue + ',95%,62%)';
    c2d.shadowColor = col; c2d.fillStyle = col;
    c2d.beginPath();
    const x = (W2 - it.w) / 2, r = 18;
    c2d.moveTo(x + r, it.y);
    c2d.arcTo(x + it.w, it.y, x + it.w, it.y + 34, r); c2d.arcTo(x + it.w, it.y + 34, x, it.y + 34, r);
    c2d.arcTo(x, it.y + 34, x, it.y, r); c2d.arcTo(x, it.y, x + it.w, it.y, r);
    c2d.closePath(); c2d.fill();
  });
  // player orb dodging between them
  c2d.shadowColor = '#7df9ff'; c2d.fillStyle = '#d8fbff';
  c2d.beginPath(); c2d.arc(W2 / 2 + 130, 490, 34, 0, 7); c2d.fill();
  c2d.restore();
  c2d.textAlign = 'center';
  c2d.fillStyle = '#fff';
  c2d.font = '800 92px -apple-system, "Segoe UI", Roboto, sans-serif';
  c2d.fillText('NEON DODGE', W2 / 2, 180);
  c2d.shadowColor = '#7df9ff'; c2d.shadowBlur = 30;
  c2d.fillStyle = '#d8fbff';
  c2d.font = '800 260px -apple-system, "Segoe UI", Roboto, sans-serif';
  c2d.fillText(String(score), W2 / 2, 1020);
  c2d.shadowBlur = 0;
  c2d.fillStyle = 'rgba(255,255,255,.8)';
  c2d.font = '700 52px -apple-system, "Segoe UI", Roboto, sans-serif';
  c2d.fillText(t('best') + ' ' + best, W2 / 2, 1110);
  c2d.fillStyle = 'rgba(255,255,255,.6)';
  c2d.font = '600 40px -apple-system, "Segoe UI", Roboto, sans-serif';
  c2d.fillText(t('cardCta'), W2 / 2, 1200);
  c2d.fillStyle = '#7df9ff';
  c2d.font = '700 36px -apple-system, "Segoe UI", Roboto, sans-serif';
  c2d.fillText('alamaby.github.io/html5-games/neon-dodge/', W2 / 2, 1268);
}

async function shareScore() {
  sfx.ui();
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  drawShareCard(c.getContext('2d'));
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'neon-dodge.png', { type: 'image/png' });
  const text = t('shareText', { t: st ? st.time.toFixed(1) : 0, s: score });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Neon Dodge', text });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'neon-dodge-' + score + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- input ----------
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  const cx = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  const cy = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  return { x: (cx - r.left) / r.width * VW, y: (cy - r.top) / r.height * VH };
}
let dragging = false;
// menu overlay covers the whole canvas and eats pointer events — it needs its own start tap
$('menuEl').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (screen !== 'menu' || !$('overEl').classList.contains('hidden')) return;
  ac(); // unlock audio on first gesture
  sfx.ui();
  newGame();
  const { x, y } = canvasPos(e);
  ND.setTarget(st, x, y);
  dragging = true;
});
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  ac(); // unlock audio on first gesture
  if (screen === 'play' && st && st.status === 'play') {
    const { x, y } = canvasPos(e);
    ND.setTarget(st, x, y);
    dragging = true;
  }
});
window.addEventListener('pointermove', (e) => {
  if (!dragging || screen !== 'play' || !st) return;
  const { x, y } = canvasPos(e);
  ND.setTarget(st, x, y);
});
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointercancel', () => { dragging = false; });

// ---------- buttons ----------
function syncMuteUI() {
  const b = $('sndBtn');
  if (b) b.textContent = isMuted() ? '✕' : '♪';
}
$('sndBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const m = !isMuted();
  try { localStorage.setItem('nd_mute', m ? '1' : '0'); } catch (err) {}
  syncMuteUI(); sfx.ui();
});
$('langBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  lang = lang === 'en' ? 'id' : 'en';
  try { localStorage.setItem('nd_lang', lang); } catch (err) {}
  applyTexts(); sfx.ui();
});
$('trophyBtn').addEventListener('click', (e) => {
  e.stopPropagation(); sfx.ui(); renderAchGrid(); show($('achGal'));
});
$('achGal').addEventListener('pointerdown', (e) => {
  e.preventDefault(); sfx.ui(); hide($('achGal'));
});
$('overEl').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sfx.ui();
  newGame();
});
$('shareBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); shareScore(); });

// ---------- boot ----------
fitCanvas();
applyTexts();
show($('menuEl'));
requestAnimationFrame(frame);

if (typeof module !== 'undefined') {
  module.exports = { ND, newGame, drawShareCard, shareScore, unlock, applyTexts,
    achState: () => ({ unlocked: Object.keys(achUnlocked).sort(), total: ACHS.length }),
    state: () => ({ screen, score, best, status: st && st.status }) };
}
