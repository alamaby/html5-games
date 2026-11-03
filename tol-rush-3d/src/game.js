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
    carTitle: 'MOBIL', carUse: 'PAKAI', carUsed: 'DIPAKAI',
    missionTitle: 'MISI HARI INI', achTitle: 'ACHIEVEMENT', missionLabel: 'MISI', achLabel: 'ACHIEVEMENT', missionToast: 'Misi tercapai',
    roadworkWarn: 'PERBAIKAN JALAN', laneWord: 'JALUR', closedWord: 'DITUTUP', convoyToast: 'Konvoi di depan — cari celah!', nudgedToast: 'Dipindahkan — jalur ditutup', laneClosedToast: 'Jalur ditutup!',
    pauseTitle: 'JEDA', pauseSub: 'Run dijeda', pauseNote: 'Tidak ada koin yang hilang — lanjutkan kapan saja.', resume: '▶ LANJUT',
    shieldToast: 'Perisai aktif! Menahan satu tabrakan.', shieldDup: 'Perisai sudah aktif (+25).', shieldSaveToast: 'Perisai menahan tabrakan!',
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
    carTitle: 'CARS', carUse: 'USE', carUsed: 'IN USE',
    missionTitle: "TODAY'S MISSIONS", achTitle: 'ACHIEVEMENTS', missionLabel: 'MISSIONS', achLabel: 'ACHIEVEMENTS', missionToast: 'Mission complete',
    roadworkWarn: 'ROADWORKS', laneWord: 'LANE', closedWord: 'CLOSED', convoyToast: 'Convoy ahead — find the gap!', nudgedToast: 'Moved — lane closed', laneClosedToast: 'Lane closed!',
    pauseTitle: 'PAUSED', pauseSub: 'Run paused', pauseNote: 'No coins lost — resume anytime.', resume: '▶ RESUME',
    shieldToast: 'Shield active! Absorbs one crash.', shieldDup: 'Shield already active (+25).', shieldSaveToast: 'Shield absorbed the crash!',
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
  renderCars();
  renderMissions();
  renderAchievements();
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
// ---------- cars (localStorage, bought with coins) ----------
const CAR_DEFS = [
  { key: 'city', id: 'City', en: 'City', descId: 'Standar seimbang', descEn: 'Balanced starter' },
  { key: 'lincah', id: 'Lincah', en: 'Swift', descId: 'Pindah jalur tercepat, top speed sedikit turun', descEn: 'Fastest lane change, slightly lower top speed' },
  { key: 'suv', id: 'SUV', en: 'SUV', descId: '+1 HP, lebih lambat & boros', descEn: '+1 HP, slower and thirstier' },
  { key: 'sport', id: 'Sport', en: 'Sport', descId: 'Top speed tertinggi, bensin boros', descEn: 'Highest top speed, thirsty' },
];
function loadOwnedCars() {
  try {
    const arr = JSON.parse(localStorage.getItem('tr_cars_owned') || '["city"]');
    const owned = arr.filter((k) => TR.CARS[k]);
    return owned.includes('city') ? owned : ['city'].concat(owned);
  } catch (e) { return ['city']; }
}
function saveOwnedCars(arr) { try { localStorage.setItem('tr_cars_owned', JSON.stringify(arr)); } catch (e) {} }
function loadSelectedCar() {
  try {
    const k = localStorage.getItem('tr_car');
    if (k && TR.CARS[k] && loadOwnedCars().includes(k)) return k;
  } catch (e) {}
  return 'city';
}
function saveSelectedCar(k) { try { localStorage.setItem('tr_car', k); } catch (e) {} }
function carName(key) {
  const d = CAR_DEFS.find((c) => c.key === key);
  return d ? (lang === 'id' ? d.id : d.en) : key;
}
function refreshPlayerMesh() {
  if (!scene || !playerMesh) return;
  const key = loadSelectedCar();
  const car = TR.CARS[key];
  scene.remove(playerMesh);
  playerMesh = makeCar(car.kind, car.color);
  scene.add(playerMesh);
}
function renderCars() {
  const owned = loadOwnedCars(), selected = loadSelectedCar(), coins = loadCoins();
  const list = $('carList');
  if (!list) return;
  list.innerHTML = CAR_DEFS.map((d) => {
    const car = TR.CARS[d.key];
    const isOwned = owned.includes(d.key), isSel = selected === d.key;
    const name = lang === 'id' ? d.id : d.en;
    const desc = lang === 'id' ? d.descId : d.descEn;
    const btn = isSel ? '<button class="shopbuy" disabled>' + t('carUsed') + '</button>'
      : isOwned ? '<button class="shopbuy" data-use-car="' + d.key + '">' + t('carUse') + '</button>'
      : '<button class="shopbuy" data-buy-car="' + d.key + '">' + t('buy') + ' ' + car.cost + '</button>';
    return '<div class="shoprow"><span><b>' + name + '</b> — ' + desc + '</span>' + btn + '</div>';
  }).join('');
  list.querySelectorAll('[data-buy-car]').forEach((btn) => {
    btn.addEventListener('click', () => buyCar(btn.dataset.buyCar));
  });
  list.querySelectorAll('[data-use-car]').forEach((btn) => {
    btn.addEventListener('click', () => selectCar(btn.dataset.useCar));
  });
  void coins;
}
function buyCar(key) {
  const car = TR.CARS[key];
  if (!car || loadOwnedCars().includes(key)) return;
  let coins = loadCoins();
  if (coins < car.cost) {
    const msg = $('carMsg'); if (msg) msg.textContent = t('shopNeed');
    beep(200, 0.15, 'square', 0.15);
    return;
  }
  coins -= car.cost;
  saveCoins(coins);
  saveOwnedCars(loadOwnedCars().concat([key]));
  saveSelectedCar(key);
  renderCars(); renderShop(); refreshPlayerMesh();
  if (loadOwnedCars().length >= 4) unlockAchievement('kolektor');
  renderAchievements();
  const msg = $('carMsg'); if (msg) msg.textContent = t('bought');
  beep(880, 0.12, 'sine', 0.2); setTimeout(() => beep(1174, 0.15, 'sine', 0.2), 120);
}
function selectCar(key) {
  if (!loadOwnedCars().includes(key)) return;
  saveSelectedCar(key);
  renderCars(); refreshPlayerMesh();
  beep(660, 0.08, 'sine', 0.15);
}
// ---------- daily missions + achievements (Fase 2H) ----------
const MISSION_TEXT = {
  jeriken3: { id: 'Kumpulkan 3 jeriken', en: 'Collect 3 jerrycans' },
  combo3: { id: 'Capai combo x3', en: 'Reach combo x3' },
  mepet5: { id: '5x salip mepet', en: '5 near-misses' },
  jauh5: { id: 'Tempuh 5 km dalam satu run', en: 'Drive 5 km in one run' },
  bersih: { id: 'Finis tanpa tabrakan (rute misi)', en: 'Finish without crashing (mission route)' },
  rest1: { id: 'Mampir 1 rest area', en: 'Stop at 1 rest area' },
  hemat3: { id: 'Tempuh 3 km tanpa bensin habis', en: 'Drive 3 km without running dry' },
  hujan2: { id: 'Tempuh 2 km di hujan', en: 'Drive 2 km in the rain' },
};
const ACH_TEXT = {
  finis1: { id: 'Finis Pertama', en: 'First Finish', descId: 'Finis di exit tol', descEn: 'Finish at a toll exit' },
  bersihFinis: { id: 'Finis Bersih', en: 'Clean Finish', descId: 'Finis tanpa satu pun tabrakan', descEn: 'Finish without a single crash' },
  jeriken5: { id: 'Pemburu Jeriken', en: 'Jerrycan Hunter', descId: '5 jeriken dalam satu run', descEn: '5 jerrycans in one run' },
  kombo5: { id: 'Kombo Penuh', en: 'Full Combo', descId: 'Capai combo x5', descEn: 'Reach combo x5' },
  mepet10: { id: 'Raja Salip Mepet', en: 'Near-Miss King', descId: '10 salip mepet dalam satu run', descEn: '10 near-misses in one run' },
  jauh10: { id: 'Penjelajah 10 km', en: '10 km Explorer', descId: '10 km dalam satu run', descEn: '10 km in one run' },
  odo100: { id: 'Odometer 100 km', en: '100 km Odometer', descId: 'Total 100 km di semua run', descEn: '100 km across all runs' },
  kolektor: { id: 'Kolektor Mobil', en: 'Car Collector', descId: 'Miliki semua 4 mobil', descEn: 'Own all 4 cars' },
};
function dayKey(d) { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function dayNum(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }
function loadMissionState() {
  try {
    const s = JSON.parse(localStorage.getItem('tr_missions_v1') || '{}');
    if (s.day === dayKey(new Date()) && Array.isArray(s.done)) return s;
  } catch (e) {}
  return { day: dayKey(new Date()), done: [] };
}
function saveMissionState(s) { try { localStorage.setItem('tr_missions_v1', JSON.stringify(s)); } catch (e) {} }
function loadAchievements() {
  try { const a = JSON.parse(localStorage.getItem('tr_achievements_v1') || '[]'); return a.filter((k) => TR.ACH_DEFS.some((d) => d.key === k)); } catch (e) { return []; }
}
function saveAchievements(a) { try { localStorage.setItem('tr_achievements_v1', JSON.stringify(a)); } catch (e) {} }
function missionName(key) { const m = MISSION_TEXT[key]; return m ? (lang === 'id' ? m.id : m.en) : key; }
function achName(key) { const a = ACH_TEXT[key]; return a ? (lang === 'id' ? a.id : a.en) : key; }
function renderMissions() {
  const list = $('missionList'); if (!list) return;
  const done = loadMissionState().done;
  const today = TR.todaysMissions(dayNum(new Date()));
  list.innerHTML = today.map((k) => {
    const def = TR.MISSION_DEFS.find((d) => d.key === k);
    const isDone = done.includes(k);
    return '<div class="shoprow"><span>' + (isDone ? '✓ ' : '○ ') + missionName(k) + '</span><span class="lvl">' + (isDone ? '✓' : '+' + def.coins) + '</span></div>';
  }).join('');
}
function renderAchievements() {
  const list = $('achList'); if (!list) return;
  const unlocked = loadAchievements();
  list.innerHTML = TR.ACH_DEFS.map((d) => {
    const a = ACH_TEXT[d.key]; const isU = unlocked.includes(d.key);
    const name = lang === 'id' ? a.id : a.en; const desc = lang === 'id' ? a.descId : a.descEn;
    return '<div class="shoprow"><span>' + (isU ? '🏆 ' : '🔒 ') + '<b>' + name + '</b> — ' + desc + '</span><span class="lvl">' + (isU ? '✓' : '+' + d.coins) + '</span></div>';
  }).join('');
}
// unlock one achievement outside a run (menu context): persist, grant coins, toast
function unlockAchievement(key) {
  const unlocked = loadAchievements();
  if (unlocked.includes(key)) return false;
  const def = TR.ACH_DEFS.find((d) => d.key === key); if (!def) return false;
  unlocked.push(key); saveAchievements(unlocked);
  saveCoins(loadCoins() + def.coins);
  toast('🏆 ' + achName(key) + ' (+' + def.coins + ')');
  beep(880, 0.12, 'sine', 0.2); setTimeout(() => beep(1174, 0.2, 'sine', 0.2), 130);
  return true;
}
let missionToasted = new Set();
function checkMissionsLive() {
  if (!st || !running) return;
  const ms = loadMissionState();
  for (const k of TR.todaysMissions(dayNum(new Date()))) {
    if (ms.done.includes(k) || missionToasted.has(k)) continue;
    const def = TR.MISSION_DEFS.find((d) => d.key === k);
    if (def && def.check(st, false)) { missionToasted.add(k); toast('✓ ' + t('missionToast') + ': ' + missionName(k)); beep(880, 0.1, 'sine', 0.15); }
  }
}
function bestScore() { try { return parseInt(localStorage.getItem('tr_best_score') || '0', 10) || 0; } catch (e) { return 0; } }
function updateBestLine() {
  const b = bestScore();
  $('bestLine').textContent = b > 0 ? t('best') + b.toLocaleString('id-ID') : '';
  const odoEl = $('odoLine');
  if (odoEl) odoEl.textContent = 'ODO ' + fmtKm(odoSaved);
}

// ---------- odometer (lifetime distance, localStorage, metres) ----------
// odoSaved = persisted total (already includes the current run up to the last
// 100 m milestone); odoRunStart = odoSaved snapshot at run start, so the live
// total is odoRunStart + st.dist and nothing is ever counted twice.
let odoSaved = 0, odoRunStart = 0;
try { odoSaved = parseFloat(localStorage.getItem('tr_odometer_m') || '0') || 0; } catch (e) {}
function saveOdometer(v) { odoSaved = v; try { localStorage.setItem('tr_odometer_m', String(v)); } catch (e) {} }
function fmtKm(m) { return (m / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km'; }
function currentOdometer() { return running && st ? odoRunStart + st.dist : odoSaved; }
function foldOdometer() {
  if (st) saveOdometer(odoRunStart + st.dist);
  // lifetime milestone: checked here so it also fires on an abandoned run
  if (odoSaved >= 100000) unlockAchievement('odo100');
}
window.addEventListener('pagehide', () => { if (running) foldOdometer(); });

// ---------- speedometer ticks (0-180 km/h, -120° to +120°) ----------
// (180 covers Sport + nitro, ~165 km/h, without pegging the needle)
function buildSpeedoTicks() {
  const g = $('speedTicks');
  if (!g) return;
  const NS = 'http://www.w3.org/2000/svg';
  for (let v = 0; v <= 180; v += 20) {
    const a = (-120 + (v / 180) * 240) * Math.PI / 180;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', 60 + 46 * Math.sin(a)); line.setAttribute('y1', 60 - 46 * Math.cos(a));
    line.setAttribute('x2', 60 + 52 * Math.sin(a)); line.setAttribute('y2', 60 - 52 * Math.cos(a));
    line.setAttribute('stroke', 'rgba(255,255,255,.7)'); line.setAttribute('stroke-width', v % 80 === 0 ? 3 : 2);
    g.appendChild(line);
  }
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
let shieldMesh = null; // translucent bubble around the player while shielded
const roadworkMeshes = new Map(); // zone object -> group
let coneGeo = null, coneMat = null;
function buildRoadworkGroup(zone) {
  // Two rows of cones flanking the closed lane, plus a striped barrier
  // board across the lane entrance. Group origin = zone start; children
  // extend backwards (negative z = ahead of the player).
  if (!coneGeo) coneGeo = new THREE.ConeGeometry(0.35, 0.9, 10);
  if (!coneMat) coneMat = new THREE.MeshLambertMaterial({ color: 0xff6a1a });
  const g = new THREE.Group();
  const laneX = st.laneXs[zone.lane];
  const step = 15, count = Math.floor(zone.len / step);
  for (let k = 0; k <= count; k++) {
    for (const side of [-1.7, 1.7]) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(laneX + side, 0.45, -k * step);
      g.add(cone);
    }
  }
  g.add(box(3.2, 0.5, 0.15, 0xffc21a, laneX, 0.9, 0)); // barrier board
  g.add(box(0.15, 0.9, 0.15, 0x223044, laneX - 1.5, 0.45, 0));
  g.add(box(0.15, 0.9, 0.15, 0x223044, laneX + 1.5, 0.45, 0));
  return g;
}
function syncRoadworkMeshes() {
  const sight = st.sightRange || 190;
  for (const [zone, group] of roadworkMeshes) {
    if (!st.roadworks.includes(zone) || zone.at + zone.len < st.dist - 30) {
      scene.remove(group); roadworkMeshes.delete(zone);
    }
  }
  for (const zone of st.roadworks) {
    if (zone.lane >= st.laneCount) continue; // closed lane not in current layout
    const gap = zone.at - st.dist;
    if (gap > sight + 50 || zone.at + zone.len < st.dist - 30) continue;
    let group = roadworkMeshes.get(zone);
    // Rebuild if the lane layout moved under the zone (segment change).
    if (group && group.userData.laneX !== st.laneXs[zone.lane]) {
      scene.remove(group); roadworkMeshes.delete(zone); group = null;
    }
    if (!group) {
      group = buildRoadworkGroup(zone);
      group.userData.laneX = st.laneXs[zone.lane];
      scene.add(group); roadworkMeshes.set(zone, group);
    }
    group.position.set(0, 0, -gap);
    group.visible = gap < sight;
  }
}
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
  } else if (kind === 'hatch') {
    g.add(box(1.8, 0.6, 3.6, col, 0, 0.65, 0)); // short body
    g.add(box(1.6, 0.5, 1.8, 0x1a2b45, 0, 1.18, 0.1)); // cabin
  } else if (kind === 'suv') {
    g.add(box(1.9, 0.75, 4.6, col, 0, 0.7, 0)); // tall body
    g.add(box(1.7, 0.6, 2.4, 0x1a2b45, 0, 1.35, 0)); // cabin
  } else if (kind === 'sport') {
    g.add(box(1.9, 0.45, 4.6, col, 0, 0.55, 0)); // low wide body
    g.add(box(1.5, 0.4, 1.8, 0x1a2b45, 0, 0.95, 0.3)); // cabin
    g.add(box(1.9, 0.15, 0.7, col, 0, 0.85, 2.0)); // spoiler
  } else {
    g.add(box(1.8, 0.55, 4.4, col, 0, 0.62, 0)); // body
    g.add(box(1.6, 0.5, 2.2, 0x1a2b45, 0, 1.12, 0.2)); // cabin
    g.add(box(1.85, 0.18, 0.9, col, 0, 0.95, 1.9)); // spoiler-ish tail
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
  const wheelMat = mat(0x111111);
  let zs;
  if (kind === 'truck') zs = [-3.2, -1.2, 1.2, 3.2];
  else if (kind === 'bus') zs = [-2.8, 2.8];
  else if (kind === 'hatch') zs = [-1.15, 1.15];
  else if (kind === 'suv' || kind === 'sport') zs = [-1.5, 1.5];
  else zs = [-1.45, 1.45];
  for (const z of zs) for (const x of [-0.92, 0.92]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w);
  }
  // headlights (front = -z) and taillights (rear = +z); basic material so they
  // glow at night instead of going dark with the scene lights
  const front = kind === 'sedan' ? -2.2 : (kind === 'bus' ? -4.25 : (kind === 'truck' ? -4.55 : (kind === 'hatch' ? -1.8 : -2.3)));
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

  { const _sc = TR.CARS[loadSelectedCar()]; playerMesh = makeCar(_sc.kind, _sc.color); }
  scene.add(playerMesh);
  // shield bubble (Fase 2K): shown only while st.shield, synced in the loop
  shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.9, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0x37e0ff, transparent: true, opacity: 0.22, depthWrite: false }));
  shieldMesh.visible = false; scene.add(shieldMesh);

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
      if (pk.kind === 'shield') {
        // cyan octahedron, floats above the road so it reads as special
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.8),
          new THREE.MeshBasicMaterial({ color: 0x37e0ff, transparent: true, opacity: 0.9 }));
        m.position.y = 0.9; mesh.add(m);
      } else {
        mesh.add(box(0.9, 0.7, 0.5, 0xffc21a, 0, 0.55, 0));
        mesh.add(box(0.4, 0.25, 0.3, 0xd92b2b, 0, 1.0, 0));
      }
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
  $('shieldLine').classList.toggle('hidden', !st.shield);
  $('score').textContent = st.score.toLocaleString('id-ID');
  // speedometer: needle 0-180 km/h over a 240° sweep, plus digital readout
  const kmh = Math.round(st.speed * 3.6);
  const clamped = Math.max(0, Math.min(180, kmh));
  const needle = $('needle');
  if (needle) {
    needle.setAttribute('transform', 'rotate(' + (-120 + (clamped / 180) * 240) + ' 60 60)');
    needle.setAttribute('stroke', kmh > 140 ? '#ff3d5e' : '#ffd76a');
  }
  const speedText = $('speedText');
  if (speedText) speedText.textContent = kmh;
  // odometer: live total, persisted every 100 m so a closed tab keeps most of it
  const total = odoRunStart + st.dist;
  if (Math.floor(total / 100) > Math.floor(odoSaved / 100)) saveOdometer(total);
  $('odo').textContent = 'ODO ' + fmtKm(total);
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
  const zoneNow = TR.zoneAt(st, st.dist);
  const nextRw = TR.nextRoadwork(st);
  const rwGap = nextRw ? nextRw.at - st.dist : Infinity;
  if (zoneNow) sign = '⚠️ ' + t('roadworkWarn') + ' — ' + t('laneWord') + ' ' + (zoneNow.lane + 1) + ' ' + t('closedWord');
  else if (nextRw && rwGap > 0 && rwGap <= TR.ROADWORK_WARN) sign = '▶ ' + t('roadworkWarn') + ' — ' + t('laneWord') + ' ' + (nextRw.lane + 1) + ' ' + t('closedWord') + ' ' + Math.round(rwGap) + ' m';
  else if (nextSeg && segGap > 0 && segGap <= 300) sign = '▶ ' + t('lanesBecome') + ' ' + nextSeg.lanes + ' ' + t('lanes') + ' ' + Math.round(segGap) + ' m';
  else if (st.dist - st.laneChangedDist < 150) sign = t('lanesNow') + ' ' + st.laneCount + ' ' + t('lanes');
  else if (TR.openRestStop(st)) sign = '▶ ' + t('restSoon') + ' ' + Math.max(0, Math.round(restGap)) + ' m';
  else if (nextRest && restGap > 0 && restGap <= 300) sign = '▶ ' + t('restSoon') + ' ' + Math.round(restGap) + ' m';
  else if (!endless && st.routeLen - st.dist < 300) sign = '▶ ' + t('exitSoon') + ' ' + Math.round(st.routeLen - st.dist) + ' m';
  $('sign').textContent = sign;
  $('restBtn').classList.toggle('show', !!TR.openRestStop(st));
  checkMissionsLive();
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
    } else if (e.t === 'convoy') {
      toast(t('convoyToast')); beep(700, 0.15, 'square', 0.15);
    } else if (e.t === 'nudged') {
      toast(t('nudgedToast')); beep(500, 0.15, 'square', 0.15);
    } else if (e.t === 'shield') {
      toast(t('shieldToast')); beep(880, 0.12, 'sine', 0.2); setTimeout(() => beep(1320, 0.15, 'sine', 0.2), 130);
    } else if (e.t === 'shieldDup') {
      toast(t('shieldDup')); beep(880, 0.12, 'sine', 0.2);
    } else if (e.t === 'shieldSave') {
      toast(t('shieldSaveToast')); beep(880, 0.15, 'sine', 0.25); setTimeout(() => beep(1320, 0.2, 'sine', 0.25), 140);
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
  foldOdometer();
  paused = false; $('pauseOverlay').classList.add('hidden');
  running = false; cgStop(); engineUpdate(0, false);
  $('hud').classList.add('hidden'); $('controls').classList.add('hidden');
  $('endKicker').textContent = finished ? t('finishSub') : t('overSub');
  $('endTitle').textContent = finished ? t('finish') : t('over');
  const isNewBest = st.score > bestScore();
  if (isNewBest) { try { localStorage.setItem('tr_best_score', String(st.score)); } catch (e) {} }
  // missions + achievements completed this run (granted once each)
  const ms = loadMissionState();
  const missionNew = TR.checkMissions(st, finished, dayNum(new Date()), ms.done);
  const missionCoins = missionNew.reduce((s, k) => s + TR.MISSION_DEFS.find((d) => d.key === k).coins, 0);
  if (missionNew.length) { ms.done = ms.done.concat(missionNew); saveMissionState(ms); }
  const achCtx = { odoKm: odoSaved / 1000, ownedCars: loadOwnedCars().length };
  const achNew = TR.checkAchievements(st, finished, achCtx, loadAchievements());
  const achCoins = achNew.reduce((s, k) => s + TR.ACH_DEFS.find((d) => d.key === k).coins, 0);
  if (achNew.length) saveAchievements(loadAchievements().concat(achNew));
  const coinsEarned = Math.floor(st.score / 50) + (finished ? 50 : 0) + missionCoins + achCoins;
  const coinsTotal = loadCoins() + coinsEarned;
  saveCoins(coinsTotal);
  $('endStats').innerHTML =
    '<b>' + t('score') + ':</b> ' + st.score.toLocaleString('id-ID') +
    (isNewBest ? ' ★' : '') + '<br><b>' + t('dist') + ':</b> ' +
    (Math.floor(st.dist) / 1000).toFixed(2) + ' km' +
    '<br><b>HP:</b> ' + st.hp + '/' + st.maxHp +
    (st.shieldSaves ? '<br><b>🛡:</b> ' + st.shieldSaves + 'x' : '') +
    '<br><b>' + t('coins') + ':</b> +' + coinsEarned + ' (total ' + coinsTotal.toLocaleString('id-ID') + ')' +
    (missionNew.length ? '<br><b>' + t('missionLabel') + ':</b> ' + missionNew.map(missionName).join(', ') + ' (+' + missionCoins + ')' : '') +
    (achNew.length ? '<br><b>' + t('achLabel') + ':</b> ' + achNew.map((k) => '🏆 ' + achName(k)).join(', ') + ' (+' + achCoins + ')' : '') +
    '<br><b>' + t('carTitle') + ':</b> ' + carName(st.car) +
    '<br><b>ODO:</b> ' + fmtKm(odoSaved);
  $('endOverlay').classList.remove('hidden');
  updateBestLine();
  renderShop();
  renderCars();
  renderMissions();
  renderAchievements();
  if (finished) { beep(523, 0.18, 'sine', 0.22); setTimeout(() => beep(659, 0.18, 'sine', 0.22), 180); setTimeout(() => beep(784, 0.3, 'sine', 0.22), 360); }
}
// ---------- pause / resume (Fase 2J) ----------
// Pausing freezes the loop: no logic stepping, no world scroll, no engine
// hum, no rest-animation progress. Nothing is saved or granted on pause;
// resume continues the exact same run, so no coins can be lost or gained.
let paused = false;
function setPaused(on) {
  if (!running || st.status !== 'play') return;
  if (on === paused) return;
  paused = on;
  $('pauseOverlay').classList.toggle('hidden', !paused);
  $('hud').classList.toggle('hidden', paused);
  $('controls').classList.toggle('hidden', paused);
  if (paused) {
    TR.setBrake(st, false); TR.setNitro(st, false);
    engineUpdate(0, false);
    beep(500, 0.1, 'sine', 0.15);
  } else {
    beep(700, 0.1, 'sine', 0.15);
  }
}
function togglePause() {
  if (running && st.status === 'play' && !restAnim) setPaused(!paused);
}
// Back to the start screen (= the upgrade shop). Mid-run, the run is abandoned:
// no coins for an unfinished run, but a beaten best score is still saved.
function goToMenu() {
  paused = false; $('pauseOverlay').classList.add('hidden');
  if (restAnim) { restAnim = null; $('restOverlay').classList.add('hidden'); }
  if (st && st.score > bestScore()) { try { localStorage.setItem('tr_best_score', String(st.score)); } catch (e) {} }
  if (running) foldOdometer();
  running = false; cgStop(); engineUpdate(0, false);
  for (const mesh of roadworkMeshes.values()) scene.remove(mesh);
  roadworkMeshes.clear();
  if (playerMesh) { playerMesh.position.set(0, 0, 0); playerMesh.rotation.set(0, 0, 0); }
  $('hud').classList.add('hidden'); $('controls').classList.add('hidden'); $('endOverlay').classList.add('hidden');
  $('startOverlay').classList.remove('hidden');
  setLaneMarkings(3);
  if (lanesGroup) lanesGroup.visible = false;
  updateBestLine(); renderShop(); renderCars(); renderMissions(); renderAchievements(); refreshPlayerMesh();
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
  for (const mesh of roadworkMeshes.values()) scene.remove(mesh);
  roadworkMeshes.clear();
  st = TR.createGame({ mode: currentMode, upgrades: loadUpgrades(), condition: currentCondition, car: loadSelectedCar() });
  refreshPlayerMesh();
  missionToasted = new Set();
  paused = false; $('pauseOverlay').classList.add('hidden');
  odoRunStart = odoSaved;
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
function lane(dir) {
  if (!running || restAnim || paused) return;
  // Moving into a roadwork-closed lane is refused with an explanation,
  // instead of silently doing nothing.
  const zone = TR.zoneAt(st, st.dist);
  const next = Math.max(0, Math.min(st.laneCount - 1, st.player.targetLane + dir));
  if (zone && next === zone.lane && next !== st.player.targetLane) {
    toast(t('laneClosedToast')); beep(200, 0.15, 'square', 0.15);
    return;
  }
  TR.moveLane(st, dir); beep(500, 0.06, 'sine', 0.08);
}
function rest() { if (running && !restAnim && !paused) startRestAnim(); }
$('leftBtn').addEventListener('click', () => lane(-1));
$('rightBtn').addEventListener('click', () => lane(1));
$('restBtn').addEventListener('click', rest);
function holdBtn(el, set) {
  const on = (e) => { e.preventDefault(); if (running && !restAnim && !paused) set(true); };
  const off = () => set(false);
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
}
holdBtn($('brakeBtn'), (on) => TR.setBrake(st, on));
holdBtn($('nitroBtn'), (on) => TR.setNitro(st, on));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (paused) setPaused(false); else if (restAnim) finishRestAnim(); else if (running) goToMenu(); }
  else if (e.key === 'p' || e.key === 'P') togglePause();
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
$('pauseBtn').addEventListener('click', togglePause);
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('menuBtn3').addEventListener('click', goToMenu);
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
  if (running && !paused && st.status === 'play') {
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
    // player mesh (+ shield bubble while shielded)
    playerMesh.position.set(st.player.x, 0, 0);
    if (shieldMesh) {
      shieldMesh.visible = !!st.shield;
      shieldMesh.position.set(st.player.x, 1.0, 0);
    }
    playerMesh.rotation.y = (st.laneXs[st.player.targetLane] - st.player.x) * -0.05;
    playerMesh.rotation.z = st.crashT > 0 ? (Math.random() - 0.5) * 0.06 : 0;
    syncTrafficMeshes();
    syncPickups();
    syncRoadworkMeshes();
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
  } else if (!paused) {
    // idle scene: slow drift so the start screen is not frozen
    // (skipped while paused so the frame stays frozen, not drifting)
    if (shieldMesh) shieldMesh.visible = false;
    for (const d of dashes) { d.position.z += 4 * dt; if (d.position.z > 12) d.position.z -= 192; }
    camera.position.set(0, 5.4, 9);
    camera.lookAt(0, 0.8, -12);
  }
  renderer.render(scene, camera);
}

// ---------- boot ----------
applyI18n(); syncMuteUI(); buildSpeedoTicks();
if (typeof THREE === 'undefined') {
  document.querySelector('[data-i18n="tagline"]').textContent = t('threeMissing');
} else {
  initThree();
  applyCondition(currentCondition === 'random' ? 'day' : currentCondition);
  requestAnimationFrame(loop);
}
