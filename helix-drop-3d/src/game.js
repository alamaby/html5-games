'use strict';
/* Helix Drop 3D — game code. Globals: THREE (inlined r149 UMD), HDLogic (inlined logic.js). */
(function () {

/* ============================== i18n ============================== */
const STR = {
  en: {
    tapStart: 'TAP TO START', best: 'BEST', gameOver: 'GAME OVER', newBest: '★ NEW BEST ★',
    tapRetry: 'TAP TO RETRY',
    menuHint: 'Drag to rotate the tower. Drop through the gaps — never touch red!',
    combo: (n) => 'COMBO ×' + n,
  },
  id: {
    tapStart: 'KETUK UNTUK MULAI', best: 'TERBAIK', gameOver: 'GAME OVER', newBest: '★ REKOR BARU ★',
    tapRetry: 'KETUK UNTUK ULANGI',
    menuHint: 'Seret untuk memutar menara. Jatuh melewati celah — jangan sentuh yang merah!',
    combo: (n) => 'KOMBO ×' + n,
  },
};
let lang = 'en';
try { lang = localStorage.getItem('helixdrop_lang') || 'en'; } catch (e) {}
if (!STR[lang]) lang = 'en';
const t = (k, arg) => { const v = STR[lang][k]; return typeof v === 'function' ? v(arg) : v; };

/* ============================== CrazyGames SDK ============================== */
const CG = { ready: false, game: null, ad: null, forceMute: false };
let adPlaying = false, adMuted = false;
async function cgInit() {
  try {
    if (!window.CrazyGames || !window.CrazyGames.SDK) return;
    const SDK = window.CrazyGames.SDK;
    await SDK.init();
    CG.ready = true; CG.game = SDK.game; CG.ad = SDK.ad;
    const applyPlatMute = () => { CG.forceMute = !!(SDK.game.settings && SDK.game.settings.muteAudio); };
    applyPlatMute();
    if (SDK.game.addSettingsChangeListener) SDK.game.addSettingsChangeListener(applyPlatMute);
  } catch (e) { CG.ready = false; }
}
function requestMidgameAd(onDone) {
  let done = false;
  const finish = () => { if (!done) { done = true; adPlaying = false; adMuted = false; onDone(); } };
  if (!CG.ready || !CG.ad) { finish(); return; }
  try {
    adPlaying = true;
    const watchdog = setTimeout(finish, 8000);
    CG.ad.requestAd('midgame', {
      adStarted: () => { adMuted = true; },
      adFinished: () => { clearTimeout(watchdog); finish(); },
      adError: () => { clearTimeout(watchdog); finish(); },
    });
  } catch (e) { finish(); }
}

/* ============================== audio ============================== */
let AC = null, master = null, userMute = false;
function ac() {
  if (!AC) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    AC = new Ctx();
    master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
const isMuted = () => userMute || CG.forceMute || adMuted;
function beep(freq, dur, type, vol, slideTo) {
  if (isMuted() || !ac()) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, AC.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, AC.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.5, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime + dur);
}
function noiseBurst(dur, vol) {
  if (isMuted() || !ac()) return;
  const len = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const g = AC.createGain(); g.gain.value = vol || 0.6;
  src.connect(g); g.connect(master); src.start();
}
const sfx = {
  bounce: (combo) => beep(300 + Math.min(combo, 12) * 28, 0.09, 'square', 0.22, 420 + Math.min(combo, 12) * 28),
  pass: () => beep(660, 0.05, 'sine', 0.12),
  combo: (n) => { beep(520, 0.1, 'triangle', 0.35); setTimeout(() => beep(660 + n * 20, 0.12, 'triangle', 0.35), 70); },
  death: () => { noiseBurst(0.35, 0.7); beep(220, 0.3, 'sawtooth', 0.3, 60); },
  ui: () => beep(500, 0.06, 'sine', 0.25),
  fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'triangle', 0.4), i * 95)); },
};

/* ============================== three.js setup ============================== */
const container = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.Fog(0x0b1020, 20, 54);
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 220);
scene.add(new THREE.HemisphereLight(0x9db4ff, 0x1a1430, 1.05));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight.position.set(6, 12, 8);
scene.add(dirLight);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

/* ============================== world ============================== */
const R_OUT = 3.4, R_COL = 1.15, PLAT_DY = 4, BALL_R = 0.36, BALL_RING = 2.25;
const TAU = Math.PI * 2;
const tower = new THREE.Group();
scene.add(tower);

const column = new THREE.Mesh(
  new THREE.CylinderGeometry(R_COL, R_COL, 600, 24),
  new THREE.MeshStandardMaterial({ color: 0x1a2138, roughness: 0.6, metalness: 0.3 })
);
tower.add(column);

const platforms = []; // {i, y, group, types, safeMat, killMat}
const hueFor = (i) => (205 + i * 7) % 360;
const topY = (p) => p.y + 0.275 + BALL_R;

function makePlatform(i) {
  const types = HDLogic.genPlatform(i, Math.random);
  const y = -i * PLAT_DY;
  const group = new THREE.Group();
  group.position.y = y;
  const safeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('hsl(' + hueFor(i) + ',72%,56%)'), roughness: 0.45, metalness: 0.15,
  });
  const killMat = new THREE.MeshStandardMaterial({
    color: 0xff2d55, roughness: 0.4, emissive: 0x550008, emissiveIntensity: 0.6,
  });
  const seg = TAU / HDLogic.SECTORS;
  for (let s = 0; s < HDLogic.SECTORS; s++) {
    if (types[s] === 'gap') continue;
    const geo = new THREE.CylinderGeometry(R_OUT, R_OUT, 0.55, 7, 1, false, s * seg, seg);
    group.add(new THREE.Mesh(geo, types[s] === 'kill' ? killMat : safeMat));
  }
  tower.add(group);
  const p = { i, y, group, types, safeMat, killMat };
  platforms.push(p);
  return p;
}

function removePlatform(p) {
  tower.remove(p.group);
  p.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  p.safeMat.dispose(); p.killMat.dispose();
  const k = platforms.indexOf(p);
  if (k >= 0) platforms.splice(k, 1);
}

function clearPlatforms() {
  while (platforms.length) removePlatform(platforms[0]);
}

/* ============================== ball ============================== */
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_R, 24, 18),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, emissive: 0x8899ff, emissiveIntensity: 0.35 })
);
ball.position.set(0, 2, BALL_RING);
scene.add(ball);

/* ============================== particles ============================== */
const particles = [];
const partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
function spawnBurst(x, y, z, colorHex, n, speed) {
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: colorHex }));
    m.position.set(x, y, z);
    const a = Math.random() * TAU, r = speed * (0.4 + Math.random() * 0.6);
    scene.add(m);
    particles.push({
      m, vx: Math.cos(a) * r, vy: Math.random() * speed * 0.9 + 1,
      vz: Math.sin(a) * r, life: 0.6 + Math.random() * 0.5, max: 1.1,
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.m); p.m.material.dispose();
      particles.splice(i, 1);
      continue;
    }
    p.vy -= 20 * dt;
    p.m.position.x += p.vx * dt;
    p.m.position.y += p.vy * dt;
    p.m.position.z += p.vz * dt;
    const s = Math.max(0.01, p.life / p.max);
    p.m.scale.set(s, s, s);
  }
}

/* ============================== game state ============================== */
let mode = 'menu';           // menu | play | dying | over
let rotY = 0, targetRotY = 0;
let ballY = 2, vy = 0, curIndex = 0;
let score = 0, best = 0, fallPass = 0, dieTimer = 0;
let shake = 0, camY = 2;
let newBestFlag = false, overShown = false;
try { best = parseInt(localStorage.getItem('helixdrop_best') || '0', 10) || 0; } catch (e) {}

const G = 30, BOUNCE_V = 11.5;

function ensurePlatforms() {
  let maxI = -1;
  for (const p of platforms) maxI = Math.max(maxI, p.i);
  for (let i = maxI + 1; i <= curIndex + 14; i++) makePlatform(i);
}

function newGame() {
  clearPlatforms();
  for (let i = 0; i <= 13; i++) makePlatform(i);
  rotY = 0; targetRotY = 0; tower.rotation.y = 0;
  curIndex = 0; ballY = topY(platforms[0]) + 1.6; vy = 0;
  score = 0; fallPass = 0; newBestFlag = false; overShown = false;
  shake = 0; camY = ballY;
  ball.visible = true;
  mode = 'play';
  if (CG.game) { try { CG.game.gameplayStart(); } catch (e) {} }
  updateScoreHud();
}

function onLandSafe(p, passedCount) {
  curIndex = p.i;
  ballY = topY(p);
  vy = BOUNCE_V;
  score += passedCount;
  fallPass += passedCount;
  spawnBurst(0, ballY - BALL_R, BALL_RING, new THREE.Color('hsl(' + hueFor(p.i) + ',80%,62%)').getHex(), 7, 4);
  if (fallPass >= 3) {
    const bonus = HDLogic.fallScore(fallPass) - fallPass;
    score += bonus;
    showCombo(fallPass);
    sfx.combo(fallPass);
  } else {
    sfx.bounce(fallPass);
  }
  if (passedCount > 0) sfx.pass();
  fallPass = 0;
  // recycle: drop platforms above, extend below
  for (let i = platforms.length - 1; i >= 0; i--) {
    if (platforms[i].i < curIndex - 1) removePlatform(platforms[i]);
  }
  ensurePlatforms();
  updateScoreHud();
}

function die() {
  mode = 'dying';
  dieTimer = 0.75;
  shake = 1;
  ball.visible = false;
  spawnBurst(0, ballY, BALL_RING, 0xff2d55, 22, 8);
  spawnBurst(0, ballY, BALL_RING, 0xffffff, 10, 6);
  sfx.death();
  if (CG.game) { try { CG.game.gameplayStop(); } catch (e) {} }
}

function gameOver() {
  mode = 'over';
  newBestFlag = score > best;
  if (newBestFlag) {
    best = score;
    try { localStorage.setItem('helixdrop_best', String(best)); } catch (e) {}
    if (CG.game) { try { CG.game.happytime(); } catch (e) {} }
    sfx.fanfare();
  }
  requestMidgameAd(showOverPanel);
}

function stepPlay(dt) {
  rotY += (targetRotY - rotY) * Math.min(1, dt * 16);
  tower.rotation.y = rotY;
  const prevY = ballY;
  vy -= G * dt;
  ballY += vy * dt;

  // Find platforms crossed while falling this frame (only below current).
  let landed = null;
  const passed = [];
  for (const p of platforms) {
    if (p.i <= curIndex) continue;
    const ty = topY(p);
    if (prevY >= ty && ballY <= ty) {
      const sec = HDLogic.sectorAt(p.types, rotY);
      if (sec === 'gap') { passed.push(p); continue; }
      landed = { p, sec };
      break;
    }
  }
  if (landed) {
    if (landed.sec === 'kill') { score += passed.length; die(); return; }
    onLandSafe(landed.p, passed.length);
  } else if (passed.length) {
    // still falling through gaps — count when we eventually land or die
    score += passed.length;
    fallPass += passed.length;
    for (const p of passed) sfx.pass();
    updateScoreHud();
  }

  // Safety: ball fell below all generated platforms (shouldn't happen) — extend.
  ensurePlatforms();
}

/* ============================== UI ============================== */
const $ = (id) => document.getElementById(id);
const menuEl = $('menu'), overEl = $('over'), scoreEl = $('score'), comboEl = $('comboPop');
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

function updateScoreHud() { scoreEl.textContent = score; }

function showCombo(n) {
  comboEl.textContent = t('combo')(n);
  comboEl.classList.remove('show');
  void comboEl.offsetWidth;
  comboEl.classList.add('show');
}

function applyTexts() {
  document.documentElement.lang = lang === 'id' ? 'id' : 'en';
  $('menuHint').textContent = t('menuHint');
  $('tapStart').textContent = t('tapStart');
  $('menuBest').textContent = t('best') + ': ' + best;
  $('overKicker').textContent = t('gameOver');
  $('tapRetry').textContent = t('tapRetry');
  $('langBtn').textContent = lang === 'en' ? 'ID' : 'EN';
  if (overShown) {
    $('overBest').textContent = t('best') + ': ' + best;
    $('newBest').textContent = newBestFlag ? t('newBest') : '';
  }
}

function showOverPanel() {
  overShown = true;
  $('overScore').textContent = score;
  applyTexts();
  show(overEl);
}

/* ============================== input ============================== */
let dragging = false, lastX = 0;
const dom = renderer.domElement;
dom.style.touchAction = 'none';

menuEl.addEventListener('pointerdown', (e) => {
  e.preventDefault(); ac(); sfx.ui(); hide(menuEl); newGame();
});
overEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (!overShown) return;
  ac(); sfx.ui(); hide(overEl); newGame();
});
dom.addEventListener('pointerdown', (e) => {
  ac();
  if (mode !== 'play') return;
  dragging = true; lastX = e.clientX;
  try { dom.setPointerCapture(e.pointerId); } catch (err) {}
});
dom.addEventListener('pointermove', (e) => {
  if (!dragging || mode !== 'play') return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  targetRotY += dx * 0.011;
});
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointercancel', () => { dragging = false; });
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') targetRotY -= 0.35;
  else if (e.key === 'ArrowRight') targetRotY += 0.35;
  else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault(); ac();
    if (mode === 'menu') { sfx.ui(); hide(menuEl); newGame(); }
    else if (mode === 'over' && overShown) { sfx.ui(); hide(overEl); newGame(); }
  }
});

$('langBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  lang = lang === 'en' ? 'id' : 'en';
  try { localStorage.setItem('helixdrop_lang', lang); } catch (err) {}
  sfx.ui(); applyTexts();
});
$('sndBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  userMute = !userMute;
  $('sndBtn').textContent = userMute ? '✕' : '♪';
  if (!userMute) sfx.ui();
});

/* ============================== menu idle ============================== */
function stepMenu(dt) {
  targetRotY += dt * 0.35;
  rotY += (targetRotY - rotY) * Math.min(1, dt * 8);
  tower.rotation.y = rotY;
  const ty = topY(platforms[0]);
  vy -= G * dt;
  ballY += vy * dt;
  if (ballY <= ty && vy < 0) { ballY = ty; vy = BOUNCE_V; }
}

/* ============================== main loop ============================== */
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());

  if (mode === 'menu') stepMenu(dt);
  else if (mode === 'play') stepPlay(dt);
  else if (mode === 'dying') {
    dieTimer -= dt;
    rotY += (targetRotY - rotY) * Math.min(1, dt * 16);
    tower.rotation.y = rotY;
    if (dieTimer <= 0) gameOver();
  } else if (mode === 'over') {
    targetRotY += dt * 0.22;
    rotY += (targetRotY - rotY) * Math.min(1, dt * 8);
    tower.rotation.y = rotY;
  }

  updateParticles(dt);

  camY += (ballY - camY) * Math.min(1, dt * 5);
  shake = Math.max(0, shake - dt * 2.4);
  const sx = (Math.random() - 0.5) * shake * 0.8;
  const sy = (Math.random() - 0.5) * shake * 0.8;
  camera.position.set(sx, camY + 5.6 + sy, 10.8);
  camera.lookAt(0, camY - 0.8, 0);
  column.position.y = ballY - 260;
  ball.position.y = ballY;

  renderer.render(scene, camera);
}

/* ============================== boot ============================== */
// newGame() hides overlays itself so keyboard starts work too.
const _newGame = newGame;
newGame = function () { hide(menuEl); hide(overEl); _newGame(); };

for (let i = 0; i <= 13; i++) makePlatform(i);
ballY = topY(platforms[0]) + 1.6;
camY = ballY;
applyTexts();
cgInit();
frame();

// Test hooks (used by the Node harness; harmless in the browser).
if (typeof module !== 'undefined') {
  module.exports = { HDLogic, newGame, stepPlay, die, gameOver,
    setRot: (v) => { targetRotY = v; },
    state: () => ({ mode, score, ballY, curIndex, rotY, platforms: platforms.length }) };
}

})();
