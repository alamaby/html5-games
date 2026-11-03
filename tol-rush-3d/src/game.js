'use strict';
/* Tol Rush 3D — browser shell: THREE render, input, audio, i18n, SDK.
 * Logic lives in TR (logic.js). No portal SDK is required to run locally:
 * the CrazyGames calls below are guarded and no-op when the SDK is absent.
 */

// ---------- CrazyGames SDK (guarded) ----------
const CG = { game: null, ready: false, muted: false };
(function initCG() {
  function boot() {
    if (CG.ready || !window.CrazyGames || !window.CrazyGames.SDK) return;
    try {
      window.CrazyGames.SDK.init().then(() => {
        CG.ready = true; CG.game = window.CrazyGames.SDK.game;
        try {
          const go = CG.game && CG.game.settings;
          CG.muted = !!(go && go.muteAudio);
          if (CG.game && CG.game.onMuteStateChanged) CG.game.onMuteStateChanged((m) => { CG.muted = !!m; syncMuteUI(); });
        } catch (e) {}
        syncMuteUI();
      }).catch(() => {});
    } catch (e) {}
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  setTimeout(boot, 1500);
})();
function cgStart() { try { if (CG.ready && CG.game && CG.game.gameplayStart) CG.game.gameplayStart(); } catch (e) {} }
function cgStop() { try { if (CG.ready && CG.game && CG.game.gameplayStop) CG.game.gameplayStop(); } catch (e) {} }
function requestMidgameAd(onDone) {
  const done = () => { if (onDone) onDone(); };
  if (!CG.ready || !CG.game || !CG.game.midgame) { done(); return; }
  let finished = false;
  const finish = () => { if (!finished) { finished = true; done(); } };
  const watchdog = setTimeout(finish, 8000);
  try {
    CG.game.midgame('midgame', () => {
      clearTimeout(watchdog); cgStop(); setTimeout(finish, 50);
    }, () => { clearTimeout(watchdog); finish(); });
  } catch (e) { clearTimeout(watchdog); finish(); }
}

// ---------- helpers / i18n ----------
const $ = (id) => document.getElementById(id);
const I18N = {
  id: {
    tagline: 'Selesaikan rute tol, putuskan mampir rest area atau kejar bonus waktu, dan finis di exit — atau melaju tanpa finis di Endless.',
    how1: '◀ ▶ / swipe: pindah jalur — hindari mobil yang lebih lambat',
    how2: '⚠️ Sein berkedip = mobil itu akan pindah jalur. Jangan tutup semua jalur.',
    how3: '♥ 3 HP, bensin habis = melambat. Rest area: HP + bensin penuh (+250).',
    shopTitle: 'UPGRADE', coins: 'KOIN', buy: 'BELI', shopMax: 'MAX', shopNeed: 'Koin kurang',
    bought: 'Upgrade dibeli!', fuelPlus: '+30 BENSIN', fuelLow: 'Bensin menipis!',
    fuelCrit: 'Bensin hampir habis — cari pickup atau rest area!',
    condLabel: 'KONDISI:', condDay: 'SIANG', condNight: 'MALAM', condRain: 'HUJAN', condRandom: 'ACAK',
    menu: 'MENU', restTitle: 'REST AREA', restSub: 'Belok kiri • isi bensin',
    restInfo: 'HP penuh + bensin penuh (+250)', restSkip: 'SKIP ⏭',
    lanes: 'JALUR', lanesBecome: '⚠️ JALAN MENJADI', lanesNow: 'JALAN',
    how4: 'Salip mepet = combo + nitro. REM untuk manuver sempit.',
    start: '▶ MULAI', again: '↻ MAIN LAGI', brake: 'REM',
    modePick: 'Pilih rute:', modeShort: 'RUTE 5 KM', modeLong: 'RUTE 10 KM', modeEndless: 'ENDLESS',
    travelled: 'Jarak tempuh',
    rotate: 'Putar HP ke landscape untuk pengalaman terbaik',
    best: 'SKOR TERBAIK: ',
    finish: 'EXIT TERCAPAI', over: 'MOBIL MOGOK',
    finishSub: 'RUTE SELESAI', overSub: 'RUN BERAKHIR',
    score: 'Skor', dist: 'Jarak', left: 'Sisa',
    restOpen: 'Rest area di depan! Tekan REST AREA untuk mampir.',
    restDone: 'Rest area! HP penuh, +250 poin.',
    restMissed: 'Rest area terlewat.',
    combo: 'COMBO x',
    restSoon: 'REST AREA', exitSoon: 'EXIT',
    threeMissing: 'Three.js gagal dimuat. Periksa koneksi lalu muat ulang halaman.',
  },
  en: {
    tagline: 'Finish a toll route, decide whether to stop at the rest area or chase the time bonus, and reach the exit — or drive with no finish in Endless.',
    how1: '◀ ▶ / swipe: change lane — dodge slower traffic',
    how2: '⚠️ Blinking indicator = that car is about to change lane. Never block every lane.',
    how3: '♥ 3 HP, empty tank = crawl. Rest area: full HP + full fuel (+250).',
    shopTitle: 'UPGRADES', coins: 'COINS', buy: 'BUY', shopMax: 'MAX', shopNeed: 'Not enough coins',
    bought: 'Upgrade bought!', fuelPlus: '+30 FUEL', fuelLow: 'Fuel low!',
    fuelCrit: 'Fuel almost empty — find a pickup or rest area!',
    condLabel: 'CONDITIONS:', condDay: 'DAY', condNight: 'NIGHT', condRain: 'RAIN', condRandom: 'RANDOM',
    menu: 'MENU', restTitle: 'REST AREA', restSub: 'Turn left • refuel',
    restInfo: 'Full HP + full fuel (+250)', restSkip: 'SKIP ⏭',
    lanes: 'LANES', lanesBecome: '⚠️ ROAD BECOMES', lanesNow: 'ROAD',
    how4: 'Close overtake = combo + nitro. BRAKE for tight gaps.',
    start: '▶ START', again: '↻ PLAY AGAIN', brake: 'BRAKE',
    modePick: 'Pick a route:', modeShort: 'ROUTE 5 KM', modeLong: 'ROUTE 10 KM', modeEndless: 'ENDLESS',
    travelled: 'Distance',
    rotate: 'Rotate your phone to landscape for the best experience',
    best: 'BEST SCORE: ',
    finish: 'EXIT REACHED', over: 'BROKEN DOWN',
    finishSub: 'ROUTE COMPLETE', overSub: 'RUN OVER',
    score: 'Score', dist: 'Distance', left: 'Left',
    restOpen: 'Rest area ahead! Tap REST AREA to stop.',
    restDone: 'Rest area! Full HP, +250 points.',
    restMissed: 'Rest area missed.',
    combo: 'COMBO x',
    restSoon: 'REST AREA', exitSoon: 'EXIT',
    threeMissing: 'Three.js failed to load. Check your connection and reload.',
  },
};
let lang = 'id';
try { lang = localStorage.getItem('tr_lang') || 'id'; } catch (e) {}
function t(k) { return (I18N[lang] && I18N[lang][k]) || I18N.id[k] || k; }
let currentCondition = 'day';
try {
  const c = localStorage.getItem('tr_condition');
  if (['day', 'night', 'rain', 'random'].includes(c)) currentCondition = c;
} catch (e) {}
function updateConditionUI() {
  document.querySelectorAll('[data-cond]').forEach((btn) => btn.classList.toggle('sel', btn.dataset.cond === currentCondition));
}
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('langBtn').textContent = lang === 'id' ? 'EN' : 'ID';
  updateBestLine();
  renderShop();
  updateConditionUI();
}

// ---------- upgrades + coins (localStorage, no server) ----------
const UPGRADE_DEFS = [
  { key: 'handling', id: 'Handling', en: 'Handling', descId: 'Pindah jalur lebih cepat', descEn: 'Faster lane change' },
  { key: 'brake', id: 'Rem', en: 'Brakes', descId: 'Rem lebih pakem', descEn: 'Stronger braking' },
  { key: 'armor', id: 'Armor', en: 'Armor', descId: '+1 HP', descEn: '+1 HP' },
  { key: 'tank', id: 'Tangki', en: 'Tank', descId: '+20 bensin maks', descEn: '+20 max fuel' },
];
function clampLvl(v) { return Math.max(0, Math.min(TR.UPGRADE_MAX, Math.floor(v || 0))); }
function loadUpgrades() {
  try {
    const u = JSON.parse(localStorage.getItem('tr_upgrades_v1') || '{}');
    return { handling: clampLvl(u.handling), brake: clampLvl(u.brake), armor: clampLvl(u.armor), tank: clampLvl(u.tank) };
  } catch (e) { return { handling: 0, brake: 0, armor: 0, tank: 0 }; }
}
function saveUpgrades(u) { try { localStorage.setItem('tr_upgrades_v1', JSON.stringify(u)); } catch (e) {} }
function loadCoins() { try { return parseInt(localStorage.getItem('tr_coins') || '0', 10) || 0; } catch (e) { return 0; } }
function saveCoins(n) { try { localStorage.setItem('tr_coins', String(n)); } catch (e) {} }
function renderShop() {
  const ups = loadUpgrades(), coins = loadCoins();
  const coinEl = $('coinLine');
  if (coinEl) coinEl.textContent = t('coins') + ': ' + coins.toLocaleString('id-ID');
  const list = $('shopList');
  if (!list) return;
  list.innerHTML = UPGRADE_DEFS.map((d) => {
    const lvl = ups[d.key];
    const maxed = lvl >= TR.UPGRADE_MAX;
    const cost = maxed ? 0 : TR.UPGRADE_COSTS[lvl];
    const name = lang === 'id' ? d.id : d.en;
    const desc = lang === 'id' ? d.descId : d.descEn;
    return '<div class="shoprow"><span><b>' + name + '</b> — ' + desc +
      ' <span class="lvl">' + '●'.repeat(lvl) + '○'.repeat(TR.UPGRADE_MAX - lvl) + '</span></span>' +
      '<button class="shopbuy" data-buy="' + d.key + '"' + (maxed ? ' disabled' : '') + '>' +
      (maxed ? t('shopMax') : t('buy') + ' ' + cost) + '</button></div>';
  }).join('');
  list.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => buyUpgrade(btn.dataset.buy));
  });
}
function buyUpgrade(key) {
  const ups = loadUpgrades();
  let coins = loadCoins();
  const lvl = ups[key];
  if (lvl >= TR.UPGRADE_MAX) return;
  const cost = TR.UPGRADE_COSTS[lvl];
  if (coins < cost) {
    const msg = $('shopMsg'); if (msg) msg.textContent = t('shopNeed');
    beep(200, 0.15, 'square', 0.15);
    return;
  }
  coins -= cost; ups[key] = lvl + 1;
  saveCoins(coins); saveUpgrades(ups);
  renderShop();
  const msg = $('shopMsg'); if (msg) msg.textContent = t('bought');
  beep(880, 0.12, 'sine', 0.2); setTimeout(() => beep(1174, 0.15, 'sine', 0.2), 120);
}
function bestScore() { try { return parseInt(localStorage.getItem('tr_best_score') || '0', 10) || 0; } catch (e) { return 0; } }
function updateBestLine() {
  const b = bestScore();
  $('bestLine').textContent = b > 0 ? t('best') + b.toLocaleString('id-ID') : '';
}

// ---------- audio (WebAudio synth, no assets) ----------
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
  try { return localStorage.getItem('tr_mute') === '1'; } catch (e) { return false; }
}
function syncMuteUI() { $('muteBtn').textContent = isMuted() ? '🔇' : '🔊'; }
function beep(freq, dur, type, vol, slideTo) {
  if (isMuted()) return;
  const c = ac(); if (!c) return;
  try {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  } catch (e) {}
}
let engineOsc = null, engineGain = null;
function engineStart() {
  const c = ac(); if (!c || engineOsc) return;
  try {
    engineOsc = c.createOscillator(); engineGain = c.createGain();
    engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 70;
    engineGain.gain.value = 0.0;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(c.destination);
    engineOsc.start();
  } catch (e) {}
}
function engineUpdate(speed, running) {
  if (!engineOsc || !engineGain) return;
  try {
    const c = ac();
    engineOsc.frequency.setValueAtTime(55 + speed * 2.2, c.currentTime);
    engineGain.gain.setValueAtTime(isMuted() || !running ? 0 : 0.035, c.currentTime);
  } catch (e) {}
}

// ---------- state ----------
let st = TR.createGame();
let running = false;
let currentMode = 'short';
let toastTimer = null;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function comboPop(msg) {
  const el = $('comboPop'); el.textContent = msg;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

// ---------- THREE scene ----------
let renderer, scene, camera, playerMesh;
let hemiLight = null, sunLight = null, roadMat = null, headlight = null, rainPoints = null;
const trafficMeshes = new Map(); // vehicle object -> group
const pickupMeshes = new Map(); // pickup object -> group
let dashes = [];
const posts = [], trees = [];
let restGroup = null, exitGroup = null, lanesGroup = null, lanesSignMat = null;
let markingGroups = {}, dashesByCount = {}, currentMarkings = 3;
const lanesTex = {};
// Road markings per lane count: edge lines + dividers between lane centres.
function setLaneMarkings(count) {
  for (const c of [2, 3, 4]) if (markingGroups[c]) markingGroups[c].visible = c === count;
  if (dashesByCount[count]) dashes = dashesByCount[count];
  currentMarkings = count;
}

function mat(color) { return new THREE.MeshLambertMaterial({ color }); }
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z); return m;
}
function makeSignTexture(line1, line2) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#0a7a3d'; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(8, 8, 496, 240);
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.font = '900 72px Arial';
  g.fillText(line1, 256, 110);
  g.font = '700 44px Arial'; g.fillText(line2 || '', 256, 190);
  const tex = new THREE.CanvasTexture(cv); return tex;
}
function makeCar(kind, colorHex) {
  const g = new THREE.Group();
  const col = colorHex;
  if (kind === 'truck') {
    g.add(box(2.0, 1.7, 1.9, 0xd8dee9, 0, 1.15, -3.6)); // cab
    g.add(box(2.1, 2.3, 7.2, col, 0, 1.45, 0.6)); // container
    g.add(box(1.9, 0.7, 0.2, 0x223044, 0, 0.9, -4.6)); // windshield
  } else if (kind === 'bus') {
    g.add(box(2.0, 2.1, 8.5, col, 0, 1.35, 0));
    g.add(box(2.02, 0.7, 7.6, 0x1a2b45, 0, 1.85, 0)); // windows
  } else {
    g.add(box(1.8, 0.55, 4.4, col, 0, 0.62, 0)); // body
    g.add(box(1.6, 0.5, 2.2, 0x1a2b45, 0, 1.12, 0.2)); // cabin
    g.add(box(1.85, 0.18, 0.9, col, 0, 0.95, 1.9)); // spoiler-ish tail
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
  const wheelMat = mat(0x111111);
  const zs = kind === 'sedan' ? [-1.45, 1.45] : [-3.2, -1.2, 1.2, 3.2];
  if (kind === 'bus') zs.length = 0, zs.push(-2.8, 2.8);
  for (const z of zs) for (const x of [-0.92, 0.92]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w);
  }
  // headlights (front = -z) and taillights (rear = +z); basic material so they
  // glow at night instead of going dark with the scene lights
  const front = kind === 'sedan' ? -2.2 : (kind === 'bus' ? -4.25 : -4.55);
  const rear = -front;
  for (const x of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    hl.position.set(x, 0.7, front); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2a3c }));
    tl.position.set(x, 0.7, rear); g.add(tl);
  }
  // indicators on the rear corners, blinked by the sync loop
  const sigL = box(0.3, 0.18, 0.06, 0xffb020, -0.6, 0.95, rear + 0.04);
  const sigR = box(0.3, 0.18, 0.06, 0xffb020, 0.6, 0.95, rear + 0.04);
  sigL.visible = sigR.visible = false;
  g.add(sigL); g.add(sigR);
  g.userData.signals = { left: sigL, right: sigR };
  return g;
}
function initThree() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  $('c').appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x87b5e0, 30, 170);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
  hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a2a, 0.95);
  scene.add(hemiLight);
  sunLight = new THREE.DirectionalLight(0xffffff, 0.7);
  sunLight.position.set(20, 40, 10); scene.add(sunLight);

  // road
  roadMat = new THREE.MeshLambertMaterial({ color: 0x2b3038 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14.5, 400), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -90); scene.add(road);
  const grassL = new THREE.Mesh(new THREE.PlaneGeometry(60, 400), mat(0x4a7a3a));
  grassL.rotation.x = -Math.PI / 2; grassL.position.set(-37.5, -0.05, -90); scene.add(grassL);
  const grassR = grassL.clone(); grassR.position.x = 37.5; scene.add(grassR);
  // road markings, one group per lane count (only the current one is visible)
  const MARKINGS = { 2: { edges: [-3.4, 3.4], dividers: [0] }, 3: { edges: [-5.1, 5.1], dividers: [-1.7, 1.7] }, 4: { edges: [-6.8, 6.8], dividers: [-3.4, 0, 3.4] } };
  for (const count of [2, 3, 4]) {
    const grp = new THREE.Group();
    for (const x of MARKINGS[count].edges) grp.add(box(0.22, 0.02, 400, 0xffffff, x, 0.02, -90));
    const ds = [];
    for (const x of MARKINGS[count].dividers) {
      for (let i = 0; i < 16; i++) {
        const d = box(0.16, 0.02, 3.2, 0xffffff, x, 0.02, -12 - i * 12);
        grp.add(d); ds.push(d);
      }
    }
    grp.visible = count === 3; scene.add(grp);
    markingGroups[count] = grp; dashesByCount[count] = ds;
  }
  dashes = dashesByCount[3];
  // guard posts + side trees, recycled
  for (let i = 0; i < 10; i++) {
    for (const x of [-7.6, 7.6]) {
      const p = box(0.25, 0.9, 0.25, 0xd8dee9, x, 0.45, -10 - i * 20);
      scene.add(p); posts.push(p);
    }
  }
  for (let i = 0; i < 22; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const tree = new THREE.Group();
    tree.add(box(0.5, 2.2, 0.5, 0x6b4a2a, 0, 1.1, 0));
    tree.add(box(2.2, 2.2, 2.2, 0x2f6b2f, 0, 3.0, 0));
    tree.position.set(side * (10 + Math.random() * 6), 0, -10 - i * 9);
    scene.add(tree); trees.push(tree);
  }
  // rest-area buildings (right side, shown near the rest zone)
  restGroup = new THREE.Group();
  restGroup.add(box(10, 3, 8, 0xe8e2d2, 13, 1.5, 0));
  restGroup.add(box(11, 0.5, 9, 0x2a6b4a, 13, 3.2, 0));
  const restSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 4),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('REST AREA', '') }));
  restSign.position.set(13, 4.5, 0); restGroup.add(restSign);
  restGroup.visible = false; scene.add(restGroup);
  // exit gantry (shown near the finish)
  exitGroup = new THREE.Group();
  exitGroup.add(box(0.5, 6, 0.5, 0xdddddd, -7, 3, 0));
  exitGroup.add(box(0.5, 6, 0.5, 0xdddddd, 7, 3, 0));
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.2),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('EXIT', 'TOL SELESAI') }));
  exitSign.position.set(0, 5, 0); exitGroup.add(exitSign);
  exitGroup.visible = false; scene.add(exitGroup);
  // lane-count gantry: overhead sign at the next segment line
  lanesGroup = new THREE.Group();
  lanesGroup.add(box(0.5, 6, 0.5, 0xdddddd, -7.5, 3, 0));
  lanesGroup.add(box(0.5, 6, 0.5, 0xdddddd, 7.5, 3, 0));
  for (const c of [2, 3, 4]) lanesTex[c] = makeSignTexture(c + ' JALUR', '');
  lanesSignMat = new THREE.MeshBasicMaterial({ map: lanesTex[3] });
  const lanesSign = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.2), lanesSignMat);
  lanesSign.position.set(0, 5, 0); lanesGroup.add(lanesSign);
  lanesGroup.visible = false; scene.add(lanesGroup);

  playerMesh = makeCar('sedan', 0xff6a1a);
  scene.add(playerMesh);

  // player headlight beam (night only; intensity set by applyCondition)
  headlight = new THREE.SpotLight(0xfff2c8, 0, 70, 0.55, 0.4, 1);
  headlight.position.set(0, 1.2, 0);
  scene.add(headlight); scene.add(headlight.target);
  // rain particles (rain only; positions recycled in the loop)
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 50;
    rainPos[i * 3 + 1] = Math.random() * 16;
    rainPos[i * 3 + 2] = -80 + Math.random() * 90;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainPoints = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xbcd6ff, size: 0.18, transparent: true, opacity: 0.75 }));
  rainPoints.visible = false;
  scene.add(rainPoints);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
// Sky, fog, lights and road for a condition; also called on the start screen
// so the menu previews the saved condition (random previews as day).
function applyCondition(cond) {
  if (!scene || !hemiLight || !sunLight) return;
  if (cond === 'night') {
    scene.background.set(0x0b1226); scene.fog.color.set(0x0b1226); scene.fog.near = 20; scene.fog.far = 120;
    hemiLight.intensity = 0.25; sunLight.intensity = 0.15;
    if (roadMat) roadMat.color.set(0x23262c);
    if (headlight) headlight.intensity = 1.6;
    if (rainPoints) rainPoints.visible = false;
  } else if (cond === 'rain') {
    scene.background.set(0x5a6a7d); scene.fog.color.set(0x5a6a7d); scene.fog.near = 25; scene.fog.far = 130;
    hemiLight.intensity = 0.6; sunLight.intensity = 0.35;
    if (roadMat) roadMat.color.set(0x1d2126);
    if (headlight) headlight.intensity = 0;
    if (rainPoints) rainPoints.visible = true;
  } else {
    scene.background.set(0x87b5e0); scene.fog.color.set(0x87b5e0); scene.fog.near = 30; scene.fog.far = 170;
    hemiLight.intensity = 0.95; sunLight.intensity = 0.7;
    if (roadMat) roadMat.color.set(0x2b3038);
    if (headlight) headlight.intensity = 0;
    if (rainPoints) rainPoints.visible = false;
  }
}
function syncTrafficMeshes() {
  const alive = new Set(st.traffic);
  for (const [v, mesh] of trafficMeshes) {
    if (!alive.has(v)) { scene.remove(mesh); trafficMeshes.delete(v); }
  }
  for (const v of st.traffic) {
    let mesh = trafficMeshes.get(v);
    if (!mesh) {
      mesh = makeCar(v.kind, new THREE.Color().setHSL(v.color / 360, 0.55, 0.45).getHex());
      scene.add(mesh); trafficMeshes.set(v, mesh);
    }
    const gap = v.s - st.dist;
    mesh.position.set(v.x, 0, -gap);
    mesh.visible = gap > -25 && gap < (st.sightRange || 190);
    const sig = mesh.userData.signals;
    const blinking = (v.signalT > 0 || v.moving) && (Math.floor(st.time * 4) % 2 === 0);
    const toRight = v.targetLane > v.lane;
    sig.left.visible = blinking && !toRight;
    sig.right.visible = blinking && toRight;
  }
}
function syncPickups() {
  const alive = new Set(st.pickups);
  for (const [pk, mesh] of pickupMeshes) {
    if (!alive.has(pk)) { scene.remove(mesh); pickupMeshes.delete(pk); }
  }
  for (const pk of st.pickups) {
    let mesh = pickupMeshes.get(pk);
    if (!mesh) {
      mesh = new THREE.Group();
      mesh.add(box(0.9, 0.7, 0.5, 0xffc21a, 0, 0.55, 0));
      mesh.add(box(0.4, 0.25, 0.3, 0xd92b2b, 0, 1.0, 0));
      scene.add(mesh); pickupMeshes.set(pk, mesh);
    }
    const gap = pk.s - st.dist;
    mesh.position.set(pk.x, 0, -gap);
    mesh.visible = gap > -25 && gap < (st.sightRange || 190);
    mesh.rotation.y = st.time * 2;
  }
}

// ---------- HUD / overlays ----------
function updateHUD() {
  $('hp').textContent = '♥'.repeat(Math.max(0, st.hp)) + '♡'.repeat(Math.max(0, st.maxHp - st.hp));
  $('score').textContent = st.score.toLocaleString('id-ID');
  $('speed').textContent = Math.round(st.speed * 3.6) + ' km/h';
  const endless = st.mode === 'endless';
  if (endless) {
    $('dist').textContent = t('travelled') + ' ' + (st.dist / 1000).toFixed(1) + ' km';
    $('prog').style.display = 'none';
  } else {
    const remain = Math.max(0, st.routeLen - st.dist) / 1000;
    $('dist').textContent = t('left') + ' ' + remain.toFixed(1) + ' km';
    $('prog').style.display = 'block';
    $('progFill').style.width = Math.min(100, (st.dist / st.routeLen) * 100) + '%';
  }
  $('nitroFill').style.width = Math.round(st.nitro) + '%';
  $('fuelFill').style.width = Math.round((st.fuel / st.maxFuel) * 100) + '%';
  $('fuelFill').style.background = (st.fuel / st.maxFuel) < 0.25 ? '#ff3d5e' : '#ffb020';
  $('comboLabel').textContent = st.combo > 1 ? t('combo') + st.combo : '';
  $('laneLabel').textContent = st.laneCount + ' ' + t('lanes');
  const nextRest = TR.nextRestStop(st);
  const restGap = nextRest ? nextRest.at - st.dist : Infinity;
  const nextSeg = TR.nextSegmentChange(st);
  const segGap = nextSeg ? nextSeg.at - st.dist : Infinity;
  let sign = '';
  if (nextSeg && segGap > 0 && segGap <= 300) sign = '▶ ' + t('lanesBecome') + ' ' + nextSeg.lanes + ' ' + t('lanes') + ' ' + Math.round(segGap) + ' m';
  else if (st.dist - st.laneChangedDist < 150) sign = t('lanesNow') + ' ' + st.laneCount + ' ' + t('lanes');
  else if (TR.openRestStop(st)) sign = '▶ ' + t('restSoon') + ' ' + Math.max(0, Math.round(restGap)) + ' m';
  else if (nextRest && restGap > 0 && restGap <= 300) sign = '▶ ' + t('restSoon') + ' ' + Math.round(restGap) + ' m';
  else if (!endless && st.routeLen - st.dist < 300) sign = '▶ ' + t('exitSoon') + ' ' + Math.round(st.routeLen - st.dist) + ' m';
  $('sign').textContent = sign;
  $('restBtn').classList.toggle('show', !!TR.openRestStop(st));
}
function handleEvents() {
  for (const e of st.events) {
    if (e.t === 'crash') {
      beep(120, 0.35, 'square', 0.3, 40);
      const f = $('flash'); f.classList.add('show');
      setTimeout(() => f.classList.remove('show'), 220);
    } else if (e.t === 'near') {
      beep(900, 0.18, 'sine', 0.18, 1500);
      comboPop(t('combo') + e.combo + '  +' + e.pts);
    } else if (e.t === 'restOpen') {
      toast(t('restOpen')); beep(660, 0.15, 'sine', 0.2);
    } else if (e.t === 'rest') {
      toast(t('restDone')); beep(660, 0.15, 'sine', 0.2); setTimeout(() => beep(880, 0.2, 'sine', 0.2), 160);
    } else if (e.t === 'lanesAhead') {
      toast(t('lanesBecome') + ' ' + e.lanes + ' ' + t('lanes')); beep(700, 0.15, 'square', 0.15);
    } else if (e.t === 'lanesChanged') {
      toast(t('lanesNow') + ' ' + e.lanes + ' ' + t('lanes'));
    } else if (e.t === 'restMissed') {
      toast(t('restMissed'));
    } else if (e.t === 'fuel') {
      toast(t('fuelPlus')); beep(880, 0.12, 'sine', 0.2);
    } else if (e.t === 'fuelLow') {
      toast(t('fuelLow')); beep(300, 0.2, 'square', 0.18);
    } else if (e.t === 'fuelCritical') {
      toast(t('fuelCrit')); beep(220, 0.25, 'square', 0.2);
    } else if (e.t === 'finish' || e.t === 'over') {
      endGame(e.t === 'finish');
    }
  }
  st.events.length = 0;
}
function endGame(finished) {
  running = false; cgStop(); engineUpdate(0, false);
  $('hud').classList.add('hidden'); $('controls').classList.add('hidden');
  $('endKicker').textContent = finished ? t('finishSub') : t('overSub');
  $('endTitle').textContent = finished ? t('finish') : t('over');
  const isNewBest = st.score > bestScore();
  if (isNewBest) { try { localStorage.setItem('tr_best_score', String(st.score)); } catch (e) {} }
  const coinsEarned = Math.floor(st.score / 50) + (finished ? 50 : 0);
  const coinsTotal = loadCoins() + coinsEarned;
  saveCoins(coinsTotal);
  $('endStats').innerHTML =
    '<b>' + t('score') + ':</b> ' + st.score.toLocaleString('id-ID') +
    (isNewBest ? ' ★' : '') + '<br><b>' + t('dist') + ':</b> ' +
    (Math.floor(st.dist) / 1000).toFixed(2) + ' km' +
    '<br><b>HP:</b> ' + st.hp + '/' + st.maxHp +
    '<br><b>' + t('coins') + ':</b> +' + coinsEarned + ' (total ' + coinsTotal.toLocaleString('id-ID') + ')';
  $('endOverlay').classList.remove('hidden');
  updateBestLine();
  renderShop();
  if (finished) { beep(523, 0.18, 'sine', 0.22); setTimeout(() => beep(659, 0.18, 'sine', 0.22), 180); setTimeout(() => beep(784, 0.3, 'sine', 0.22), 360); }
}
// Back to the start screen (= the upgrade shop). Mid-run, the run is abandoned:
// no coins for an unfinished run, but a beaten best score is still saved.
function goToMenu() {
  if (restAnim) { restAnim = null; $('restOverlay').classList.add('hidden'); }
  if (st && st.score > bestScore()) { try { localStorage.setItem('tr_best_score', String(st.score)); } catch (e) {} }
  running = false; cgStop(); engineUpdate(0, false);
  if (playerMesh) { playerMesh.position.set(0, 0, 0); playerMesh.rotation.set(0, 0, 0); }
  $('hud').classList.add('hidden'); $('controls').classList.add('hidden'); $('endOverlay').classList.add('hidden');
  $('startOverlay').classList.remove('hidden');
  setLaneMarkings(3);
  if (lanesGroup) lanesGroup.visible = false;
  updateBestLine(); renderShop();
  applyCondition(currentCondition === 'random' ? 'day' : currentCondition);
}

// ---------- rest-area animation ----------
// The game pauses while the car turns left, fuel fills, then it merges back.
// Effects (heal, refill, +250, traffic clear) are applied by TR.tryRest at the
// end of the animation or on SKIP — the fill bar is the visual for that refill.
let restAnim = null;
function startRestAnim() {
  const stop = TR.openRestStop(st);
  if (!stop) return false;
  restAnim = { t: 0, stop, fromX: st.player.x, fromFuel: st.fuel, halfBeep: false };
  $('restFuelFill').style.width = Math.round((st.fuel / st.maxFuel) * 100) + '%';
  $('restFuelPct').textContent = Math.round((st.fuel / st.maxFuel) * 100) + '%';
  $('restOverlay').classList.remove('hidden');
  beep(600, 0.1, 'sine', 0.12);
  return true;
}
function finishRestAnim() {
  if (!restAnim) return;
  restAnim = null;
  $('restOverlay').classList.add('hidden');
  if (playerMesh) { playerMesh.position.set(st.player.x, 0, 0); playerMesh.rotation.set(0, 0, 0); }
  TR.tryRest(st); // toast for the +250/rest event is handled by handleEvents next frame
}
function updateRestAnim(dt) {
  restAnim.t += dt;
  const t = restAnim.t;
  const ease = (k) => 1 - Math.pow(1 - k, 2);
  if (t < 0.8) {
    // turn left off the toll road
    const k = ease(t / 0.8);
    playerMesh.position.x = restAnim.fromX + (-8 - restAnim.fromX) * k;
    playerMesh.rotation.y = 0.6 * k;
  } else if (t < 2.6) {
    // fuel filling
    playerMesh.position.x = -8; playerMesh.rotation.y = 0.6;
    const p = (t - 0.8) / 1.8;
    const pct = Math.round(((restAnim.fromFuel / st.maxFuel) + (1 - restAnim.fromFuel / st.maxFuel) * p) * 100);
    $('restFuelFill').style.width = pct + '%';
    $('restFuelPct').textContent = pct + '%';
    if (p > 0.5 && !restAnim.halfBeep) { restAnim.halfBeep = true; beep(760, 0.1, 'sine', 0.12); }
  } else if (t < 3.4) {
    // merge back onto the toll road
    const k = ease((t - 2.6) / 0.8);
    playerMesh.position.x = -8 + (st.player.x + 8) * k;
    playerMesh.rotation.y = 0.6 * (1 - k);
    $('restFuelFill').style.width = '100%'; $('restFuelPct').textContent = '100%';
  } else {
    finishRestAnim();
  }
  // keep the car in frame while it pulls off and merges back
  camera.position.set(playerMesh.position.x * 0.5, 5.4, 9);
  camera.lookAt(playerMesh.position.x * 0.65, 0.8, -12);
}
function startGame(mode) {
  currentMode = TR.ROUTES[mode] ? mode : 'short';
  restAnim = null; $('restOverlay').classList.add('hidden');
  for (const mesh of trafficMeshes.values()) scene.remove(mesh);
  trafficMeshes.clear();
  for (const mesh of pickupMeshes.values()) scene.remove(mesh);
  pickupMeshes.clear();
  st = TR.createGame({ mode: currentMode, upgrades: loadUpgrades(), condition: currentCondition });
  applyCondition(st.condition);
  setLaneMarkings(st.laneCount);
  running = true;
  $('startOverlay').classList.add('hidden');
  $('endOverlay').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('controls').classList.remove('hidden');
  engineStart(); cgStart(); updateHUD();
}

// ---------- input ----------
function lane(dir) { if (running && !restAnim) { TR.moveLane(st, dir); beep(500, 0.06, 'sine', 0.08); } }
function rest() { if (running && !restAnim) startRestAnim(); }
$('leftBtn').addEventListener('click', () => lane(-1));
$('rightBtn').addEventListener('click', () => lane(1));
$('restBtn').addEventListener('click', rest);
function holdBtn(el, set) {
  const on = (e) => { e.preventDefault(); if (running && !restAnim) set(true); };
  const off = () => set(false);
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
}
holdBtn($('brakeBtn'), (on) => TR.setBrake(st, on));
holdBtn($('nitroBtn'), (on) => TR.setNitro(st, on));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (restAnim) finishRestAnim(); else if (running) goToMenu(); }
  else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') lane(-1);
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') lane(1);
  else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') TR.setBrake(st, true);
  else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') TR.setNitro(st, true);
  else if (e.key === 'r' || e.key === 'R') rest();
  else if (e.key === 'Enter') {
    if (!$('startOverlay').classList.contains('hidden')) startGame('short');
    else if (!$('endOverlay').classList.contains('hidden')) requestMidgameAd(() => startGame(currentMode));
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') TR.setBrake(st, false);
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') TR.setNitro(st, false);
});
let touchX = null;
$('c').addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
$('c').addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (dx > 40) lane(1); else if (dx < -40) lane(-1);
  touchX = null;
}, { passive: true });
document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => startGame(btn.dataset.mode));
});
document.querySelectorAll('[data-cond]').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentCondition = btn.dataset.cond;
    try { localStorage.setItem('tr_condition', currentCondition); } catch (e) {}
    updateConditionUI();
    if (!running) applyCondition(currentCondition === 'random' ? 'day' : currentCondition);
    beep(500, 0.06, 'sine', 0.08);
  });
});
$('againBtn').addEventListener('click', () => requestMidgameAd(() => startGame(currentMode)));
$('menuBtn').addEventListener('click', goToMenu);
$('menuBtn2').addEventListener('click', goToMenu);
$('restSkipBtn').addEventListener('click', finishRestAnim);
$('muteBtn').addEventListener('click', () => {
  try { localStorage.setItem('tr_mute', isMuted() ? '0' : '1'); } catch (e) {}
  syncMuteUI();
});
$('langBtn').addEventListener('click', () => {
  lang = lang === 'id' ? 'en' : 'id';
  try { localStorage.setItem('tr_lang', lang); } catch (e) {}
  applyI18n();
});

// ---------- main loop ----------
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!renderer) return;
  if (running && st.status === 'play') {
    if (restAnim) { updateRestAnim(dt); } else {
    TR.step(st, dt);
    handleEvents();
    // scroll world props with player speed
    if (st.laneCount !== currentMarkings) setLaneMarkings(st.laneCount);
    const move = st.speed * dt;
    for (const d of dashes) { d.position.z += move; if (d.position.z > 12) d.position.z -= 192; }
    for (const p of posts) { p.position.z += move; if (p.position.z > 12) p.position.z -= 200; }
    for (const tr of trees) { tr.position.z += move; if (tr.position.z > 12) { tr.position.z -= 198; tr.position.x = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 6); } }
    // rest + exit set pieces follow their route position
    const nextRest = TR.nextRestStop(st);
    const restGap = nextRest ? nextRest.at - st.dist : Infinity;
    restGroup.visible = restGap > -60 && restGap < 260;
    restGroup.position.z = -restGap;
    const exitGap = st.mode === 'endless' ? Infinity : st.routeLen - st.dist;
    exitGroup.visible = exitGap > -30 && exitGap < 260;
    exitGroup.position.z = -exitGap;
    // lane-count gantry follows the next segment line
    const nextSeg = TR.nextSegmentChange(st);
    const segGap = nextSeg ? nextSeg.at - st.dist : Infinity;
    lanesGroup.visible = !!nextSeg && segGap > -30 && segGap < 260;
    if (lanesGroup.visible) {
      lanesGroup.position.z = -segGap;
      if (lanesSignMat.map !== lanesTex[nextSeg.lanes]) {
        lanesSignMat.map = lanesTex[nextSeg.lanes]; lanesSignMat.needsUpdate = true;
      }
    }
    // player mesh
    playerMesh.position.set(st.player.x, 0, 0);
    playerMesh.rotation.y = (st.laneXs[st.player.targetLane] - st.player.x) * -0.05;
    playerMesh.rotation.z = st.crashT > 0 ? (Math.random() - 0.5) * 0.06 : 0;
    syncTrafficMeshes();
    syncPickups();
    if (headlight && st.condition === 'night') {
      headlight.position.set(st.player.x, 1.2, 0);
      headlight.target.position.set(st.player.x, 0.5, -40);
      headlight.target.updateMatrixWorld();
    }
    if (rainPoints && rainPoints.visible) {
      const pos = rainPoints.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 34 * dt;
        if (y < 0) { y = 16; pos.setX(i, (Math.random() - 0.5) * 50); pos.setZ(i, -80 + Math.random() * 90); }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    const shake = st.crashT > 0 ? (Math.random() - 0.5) * 0.3 : 0;
    camera.position.set(st.player.x * 0.5 + shake, 5.4, 9);
    camera.lookAt(st.player.x * 0.65, 0.8, -12);
    engineUpdate(st.speed, true);
    updateHUD();
    }
  } else {
    // idle scene: slow drift so the start screen is not frozen
    for (const d of dashes) { d.position.z += 4 * dt; if (d.position.z > 12) d.position.z -= 192; }
    camera.position.set(0, 5.4, 9);
    camera.lookAt(0, 0.8, -12);
  }
  renderer.render(scene, camera);
}

// ---------- boot ----------
applyI18n(); syncMuteUI();
if (typeof THREE === 'undefined') {
  document.querySelector('[data-i18n="tagline"]').textContent = t('threeMissing');
} else {
  initThree();
  applyCondition(currentCondition === 'random' ? 'day' : currentCondition);
  requestAnimationFrame(loop);
}
