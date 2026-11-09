'use strict';
/* Tol Rush 3D — browser shell: THREE render, input, audio, i18n, SDK.
 * Logic lives in TR (logic.js). No portal SDK is required to run locally:
 * the CrazyGames calls below are guarded and no-op when the SDK is absent.
 */

// ---------- CrazyGames SDK (guarded) ----------
// v3 modules: game (gameplayStart/Stop) + ad (requestAd). Everything is
// guarded: without the SDK (Pages, local file) every call is a no-op.
const CG = { game: null, ad: null, ready: false, muted: false };
(function initCG() {
  function boot() {
    if (CG.ready || !window.CrazyGames || !window.CrazyGames.SDK) return;
    try {
      window.CrazyGames.SDK.init().then(() => {
        CG.ready = true; CG.game = window.CrazyGames.SDK.game;
        CG.ad = window.CrazyGames.SDK.ad || null;
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
  if (!CG.ready) { done(); return; }
  cgStop(); // gameplay already stopped at run end; stop again for the ad break
  let finished = false;
  const finish = () => { if (!finished) { finished = true; done(); } };
  const watchdog = setTimeout(finish, 8000);
  try {
    // SDK v3: ad.requestAd('midgame', { adFinished, adError }). A dismissed
    // or failed ad arrives as adError: never punish, just continue.
    if (CG.ad && CG.ad.requestAd) {
      CG.ad.requestAd('midgame', {
        adFinished: () => { clearTimeout(watchdog); finish(); },
        adError: () => { clearTimeout(watchdog); finish(); },
      });
      return;
    }
    // Legacy fallback (older SDK shape): game.midgame, if present.
    if (CG.game && CG.game.midgame) {
      CG.game.midgame('midgame', () => {
        clearTimeout(watchdog); setTimeout(finish, 50);
      }, () => { clearTimeout(watchdog); finish(); });
      return;
    }
  } catch (e) {}
  clearTimeout(watchdog); finish();
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
    roadworkWarn: 'PERBAIKAN JALAN', laneWord: 'JALUR', closedWord: 'DITUTUP', convoyToast: 'Konvoi di depan — cari celah!', nudgedToast: 'Dipindahkan — jalur ditutup', laneClosedToast: 'Jalur ditutup!', laneClosingToast: 'Jalur akan ditutup!',
    pauseTitle: 'JEDA', pauseSub: 'Run dijeda', pauseNote: 'Tidak ada koin yang hilang — lanjutkan kapan saja.', resume: '▶ LANJUT',
    shieldToast: 'Perisai aktif! Menahan satu tabrakan.', shieldDup: 'Perisai sudah aktif (+25).', shieldSaveToast: 'Perisai menahan tabrakan!',
    bought: 'Upgrade dibeli!', fuelPlus: '+30 BENSIN', fuelLow: 'Bensin menipis!',
    fuelCrit: 'Bensin hampir habis — cari pickup atau rest area!',
    condLabel: 'KONDISI:', condDay: 'SIANG', condNight: 'MALAM', condRain: 'HUJAN', condRandom: 'ACAK',
    menu: 'MENU', restTitle: 'REST AREA', restSub: 'Belok kiri • isi bensin',
    restInfo: 'HP penuh + bensin penuh (+250)', restSkip: 'SKIP ⏭',
    restS1: 'Keluar dari tol…', restS2: 'Mengelilingi rest area…', restS3: 'Antri di SPBU…', restS4: 'Mengisi bensin…', restS5: 'Kembali ke jalan tol…',
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
    roadworkWarn: 'ROADWORKS', laneWord: 'LANE', closedWord: 'CLOSED', convoyToast: 'Convoy ahead — find the gap!', nudgedToast: 'Moved — lane closed', laneClosedToast: 'Lane closed!', laneClosingToast: 'Lane closing ahead!',
    pauseTitle: 'PAUSED', pauseSub: 'Run paused', pauseNote: 'No coins lost — resume anytime.', resume: '▶ RESUME',
    shieldToast: 'Shield active! Absorbs one crash.', shieldDup: 'Shield already active (+25).', shieldSaveToast: 'Shield absorbed the crash!',
    bought: 'Upgrade bought!', fuelPlus: '+30 FUEL', fuelLow: 'Fuel low!',
    fuelCrit: 'Fuel almost empty — find a pickup or rest area!',
    condLabel: 'CONDITIONS:', condDay: 'DAY', condNight: 'NIGHT', condRain: 'RAIN', condRandom: 'RANDOM',
    menu: 'MENU', restTitle: 'REST AREA', restSub: 'Turn left • refuel',
    restInfo: 'Full HP + full fuel (+250)', restSkip: 'SKIP ⏭',
    restS1: 'Leaving the highway…', restS2: 'Driving through the rest area…', restS3: 'Queuing at the fuel station…', restS4: 'Refuelling…', restS5: 'Merging back onto the highway…',
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
  playerMesh = makeCar(car.kind, car.color, true);
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
function syncMuteUI() {
  const ico = isMuted() ? '🔇' : '🔊';
  $('muteBtn').textContent = ico;
  const m2 = $('muteBtn2');
  if (m2) m2.textContent = ico; // Fase 2O: in-HUD mute mirrors the corner one
}
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
// ---------- visual polish (Fase 2L, view-only, no logic) ----------
let skyDome = null, starPoints = null, moonMesh = null, nitroFlame = null;
const debrisBursts = [];
const debrisGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
function setSkyColors(topHex, bottomHex) {
  if (!skyDome) return;
  const pos = skyDome.geometry.attributes.position, col = skyDome.geometry.attributes.color;
  const top = new THREE.Color(topHex), bottom = new THREE.Color(bottomHex), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / 320 + 1) / 2;
    c.copy(bottom).lerp(top, Math.max(0, Math.min(1, t)));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}
function spawnDebris(x, z) {
  if (!scene) return;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 1 });
  const parts = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(debrisGeo, mat);
    m.position.set(x + (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, z + (Math.random() - 0.5) * 1.2);
    scene.add(m);
    parts.push({ m, vx: (Math.random() - 0.5) * 8, vy: 3 + Math.random() * 5, vz: (Math.random() - 0.5) * 8 + 4 });
  }
  debrisBursts.push({ mat, parts, life: 0.7 });
}
function updateDebris(dt) {
  for (let i = debrisBursts.length - 1; i >= 0; i--) {
    const b = debrisBursts[i];
    b.life -= dt;
    for (const p of b.parts) {
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.vy -= 12 * dt;
      if (p.m.position.y < 0.15) { p.m.position.y = 0.15; p.vy = 0; }
    }
    b.mat.opacity = Math.max(0, b.life / 0.7);
    if (b.life <= 0) {
      for (const p of b.parts) scene.remove(p.m);
      debrisBursts.splice(i, 1);
    }
  }
}
function clearDebris() {
  for (const b of debrisBursts) for (const p of b.parts) scene.remove(p.m);
  debrisBursts.length = 0;
}
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

// Taper markings (Fase 2Q): shown INSTEAD of the static groups while the
// road tapers into a new lane count. The group sits at the segment line
// (like the gantry) and extends 200 m toward the camera plus 100 m beyond
// the line at the new layout; each line is cut into short segments running
// from its new-layout x (at the line) to its old-layout x (at the zone
// start), so dividers visibly converge or fork instead of swapping instantly.
let taperGroup = null, taperKey = '';
function syncTaperGroup(from, to) {
  const key = from + '>' + to;
  if (taperGroup && taperKey === key) return;
  if (taperGroup) scene.remove(taperGroup);
  taperGroup = new THREE.Group();
  // Fase 2S: 40 short (5 m) segments per line, each rotated to the line's
  // direction, lateral position eased (smoothstep) — so the line bends
  // gradually instead of a staircase of straight 20 m boxes. k = -20..-1
  // extends 100 m BEYOND the line at the new layout (road ahead keeps its
  // markings while the zone tapers); k >= 0 covers the 200 m zone.
  const SEG = 40, LEN = TR.TRANSITION_LEN / SEG;
  const ease = (f) => f * f * (3 - 2 * f);
  for (const [x0, x1] of TR.taperLines(from, to)) {
    for (let k = -20; k < SEG; k++) {
      const f0 = Math.max(0, k / SEG), f1 = Math.max(0, (k + 1) / SEG);
      const xa = x1 + (x0 - x1) * ease(f0), xb = x1 + (x0 - x1) * ease(f1);
      const m = box(0.18, 0.02, LEN + 0.3, 0xffffff, (xa + xb) / 2, 0.02, (k + 0.5) * LEN);
      m.rotation.y = Math.atan2(xb - xa, LEN);
      taperGroup.add(m);
    }
  }
  taperGroup.visible = false; scene.add(taperGroup);
  taperKey = key;
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
// Fase 2T: high-poly player bodies — extruded side profiles with a bevel,
// replacing the hard body/cabin boxes. pts are [x = world z (front is
// negative), y = height]; width is the extrude depth across the car.
const PLAYER_PROFILES = {
  sedan: {
    body: [[-2.2, 0.35], [-2.2, 0.68], [-2.02, 0.84], [-1.0, 0.9], [1.2, 0.9], [1.98, 0.86], [2.2, 0.78], [2.2, 0.35]],
    cabin: [[-1.05, 0.88], [-0.62, 1.3], [0.62, 1.3], [1.15, 0.9]],
    wBody: 1.8, wCabin: 1.6,
  },
  hatch: {
    body: [[-1.8, 0.35], [-1.8, 0.68], [-1.58, 0.84], [-0.8, 0.88], [1.2, 0.88], [1.8, 0.8], [1.8, 0.35]],
    cabin: [[-0.95, 0.86], [-0.5, 1.42], [0.55, 1.42], [1.0, 0.88]],
    wBody: 1.8, wCabin: 1.6,
  },
  suv: {
    body: [[-2.3, 0.35], [-2.3, 0.85], [-2.0, 1.0], [-0.9, 1.02], [1.6, 1.02], [2.3, 0.9], [2.3, 0.35]],
    cabin: [[-1.25, 1.0], [-0.8, 1.62], [0.8, 1.62], [1.3, 1.0]],
    wBody: 1.9, wCabin: 1.7,
  },
  sport: {
    body: [[-2.3, 0.3], [-2.3, 0.58], [-1.95, 0.7], [-0.6, 0.74], [1.5, 0.74], [2.3, 0.66], [2.3, 0.3]],
    cabin: [[-1.0, 0.72], [-0.5, 1.12], [0.6, 1.12], [1.1, 0.74]],
    wBody: 1.9, wCabin: 1.5,
  },
};
function extrudeBody(pts, width, color) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const depth = width - 0.16; // bevel 0.08 each side keeps total width exact
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 12 });
  geo.rotateY(-Math.PI / 2); // shape x -> world z (front = -z), extrude z -> world x
  geo.translate(depth / 2, 0, 0);
  return new THREE.Mesh(geo, mat(color));
}
function makeCar(kind, colorHex, highPoly) {
  const g = new THREE.Group();
  const col = colorHex;
  const P = highPoly ? PLAYER_PROFILES[kind] : null;
  if (P) {
    g.add(extrudeBody(P.body, P.wBody, col));
    g.add(extrudeBody(P.cabin, P.wCabin, 0x1a2b45));
  } else if (kind === 'truck') {
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
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, highPoly ? 32 : 14);
  const wheelMat = mat(0x111111);
  let zs;
  if (kind === 'truck') zs = [-3.2, -1.2, 1.2, 3.2];
  else if (kind === 'bus') zs = [-2.8, 2.8];
  else if (kind === 'hatch') zs = [-1.15, 1.15];
  else if (kind === 'suv' || kind === 'sport') zs = [-1.5, 1.5];
  else zs = [-1.45, 1.45];
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.34, highPoly ? 20 : 10);
  const hubMat = mat(0x8a8f9a);
  // Fase 2U: front wheels (z = zs[0], the front axle) sit in steering pivots
  // on the player car, so they visibly turn into a lane change; rear wheels
  // stay fixed. wheelNodes tracks every wheel part for the body-group split.
  const wheelNodes = [], steerPivots = [];
  for (const z of zs) for (const x of [-0.92, 0.92]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    const h = new THREE.Mesh(hubGeo, hubMat);
    h.rotation.z = Math.PI / 2;
    if (highPoly && z === zs[0]) {
      const pv = new THREE.Group();
      pv.position.set(x, 0.38, z);
      pv.add(w); pv.add(h); g.add(pv);
      wheelNodes.push(pv); steerPivots.push(pv);
    } else {
      w.position.set(x, 0.38, z); h.position.set(x, 0.38, z);
      g.add(w); g.add(h);
      wheelNodes.push(w, h);
    }
  }
  if (steerPivots.length) g.userData.steer = steerPivots;
  // headlights (front = -z) and taillights (rear = +z); basic material so they
  // glow at night instead of going dark with the scene lights
  const front = kind === 'sedan' ? -2.2 : (kind === 'bus' ? -4.25 : (kind === 'truck' ? -4.55 : (kind === 'hatch' ? -1.8 : -2.3)));
  const rear = -front;
  const tails = [];
  for (const x of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    hl.position.set(x, 0.7, front); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2a3c }));
    tl.position.set(x, 0.7, rear); g.add(tl); tails.push(tl.material);
  }
  g.userData.tails = tails; // brake lights, brightened by the loop while braking
  // ---- extra body detail (Fase 2M, view-only) ----
  // All boxes overlap the body slightly (never exactly coplanar) so no
  // face ever z-fights with the panel it sits on.
  const dark = 0x1a1d24;
  const bw = (kind === 'truck' || kind === 'bus') ? 2.05 : ((kind === 'hatch' || kind === 'sedan') ? 1.85 : 1.95);
  g.add(box(bw, 0.22, 0.3, dark, 0, 0.32, front - 0.08)); // front bumper
  g.add(box(bw, 0.22, 0.3, dark, 0, 0.32, rear + 0.08)); // rear bumper
  const grilleY = kind === 'truck' ? 0.7 : (kind === 'bus' ? 0.8 : 0.55);
  g.add(box(bw * 0.7, 0.22, 0.12, 0x14161c, 0, grilleY, front - 0.05)); // grille
  const mirZ = kind === 'truck' ? -4.1 : (kind === 'bus' ? -3.9 : -1.0);
  const mirY = kind === 'truck' ? 1.35 : (kind === 'bus' ? 1.5 : 1.05);
  const mirX = kind === 'truck' ? 1.12 : (kind === 'bus' ? 1.1 : 1.0);
  for (const sx of [-1, 1]) g.add(box(0.22, 0.18, 0.3, dark, sx * mirX, mirY, mirZ)); // mirrors
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10), mat(0x555555));
  ex.rotation.x = Math.PI / 2; ex.position.set(0.6, 0.25, rear + 0.15); g.add(ex); // exhaust
  if (kind === 'sedan') g.add(box(1.7, 0.14, 1.0, col, 0, 0.96, -1.65)); // hood step
  if (kind === 'hatch') g.add(box(1.5, 0.08, 1.6, 0x1a2b45, 0, 1.46, 0.1)); // glass roof
  if (kind === 'suv') for (const sx of [-1, 1]) g.add(box(0.12, 0.1, 2.0, dark, sx * 0.6, 1.68, 0)); // roof rails
  if (kind === 'sport') {
    g.add(box(0.5, 0.06, 1.3, 0x14161c, 0, highPoly ? 0.77 : 0.81, -1.6)); // racing stripe, hood
    g.add(box(0.5, 0.06, 1.8, 0x14161c, 0, highPoly ? 1.14 : 1.18, 0.3)); // racing stripe, roof
    for (const sx of [-1, 1]) g.add(box(0.15, 0.18, 3.2, dark, sx * 0.95, 0.32, 0)); // side skirts
  }
  if (kind === 'truck') {
    for (const z of [-2.4, -1.2, 0, 1.2, 2.4, 3.6]) for (const sx of [-1, 1]) g.add(box(0.06, 2.2, 0.25, dark, sx * 1.06, 1.45, z)); // container ribs
    for (const sx of [-1, 1]) g.add(box(0.5, 0.5, 0.08, 0x111111, sx * 0.8, 0.35, 4.25)); // mudflaps
  }
  if (kind === 'bus') {
    for (const z of [-3.2, -1.6, 0, 1.6, 3.2]) g.add(box(2.08, 0.72, 0.12, col, 0, 1.85, z)); // window dividers
    for (const sx of [-1, 1]) g.add(box(0.06, 1.9, 0.9, 0x14161c, sx * 1.02, 1.05, -3.4)); // doors
  }
  // indicators on the rear corners, blinked by the sync loop
  const sigL = box(0.3, 0.18, 0.06, 0xffb020, -0.6, 0.95, rear + 0.04);
  const sigR = box(0.3, 0.18, 0.06, 0xffb020, 0.6, 0.95, rear + 0.04);
  sigL.visible = sigR.visible = false;
  g.add(sigL); g.add(sigR);
  g.userData.signals = { left: sigL, right: sigR };
  // Fase 2U: on the player car, everything except the wheels lives in a
  // body subgroup, so the body can roll/shift against the wheels mid-turn
  // instead of the whole car moving as one rigid piece.
  if (highPoly) {
    const body = new THREE.Group();
    for (const child of [...g.children]) {
      if (wheelNodes.includes(child)) continue;
      g.remove(child); body.add(child);
    }
    g.add(body);
    g.userData.body = body;
  }
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

  // gradient sky dome (fog-proof, covers the whole view) + night stars/moon
  {
    const geo = new THREE.SphereGeometry(320, 24, 16);
    const colors = new Float32Array(geo.attributes.position.count * 3).fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    skyDome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, fog: false, depthWrite: false }));
    skyDome.renderOrder = -10; scene.add(skyDome);
    setSkyColors(0x3f8fe0, 0xcfe8ff);
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 260; i++) sp.push((Math.random() - 0.5) * 320, 25 + Math.random() * 130, -200 + Math.random() * 220);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false }));
    starPoints.visible = false; scene.add(starPoints);
    moonMesh = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xf4f1de, fog: false }));
    moonMesh.position.set(-60, 55, -220); moonMesh.visible = false; scene.add(moonMesh);
  }
  // nitro flame, synced to st.nitroOn in the loop (separate mesh: the
  // player mesh is rebuilt on car change, so it cannot own the flame)
  nitroFlame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 12),
    new THREE.MeshBasicMaterial({ color: 0xff9a1f, transparent: true, opacity: 0.9, fog: false }));
  nitroFlame.rotation.x = Math.PI / 2; nitroFlame.visible = false; scene.add(nitroFlame);

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
    tree.add(box(2.2, 2.2, 2.2, Math.random() < 0.5 ? 0x2f6b2f : 0x357a35, 0, 3.0, 0));
    const ts = 0.8 + Math.random() * 0.6;
    tree.scale.set(ts, ts, ts);
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
  restSeqGroup = buildRestSeqGroup();
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

  { const _sc = TR.CARS[loadSelectedCar()]; playerMesh = makeCar(_sc.kind, _sc.color, true); }
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
    setSkyColors(0x050914, 0x1b2b4d);
    if (starPoints) starPoints.visible = true;
    if (moonMesh) moonMesh.visible = true;
  } else if (cond === 'rain') {
    scene.background.set(0x5a6a7d); scene.fog.color.set(0x5a6a7d); scene.fog.near = 25; scene.fog.far = 130;
    hemiLight.intensity = 0.6; sunLight.intensity = 0.35;
    if (roadMat) roadMat.color.set(0x1d2126);
    if (headlight) headlight.intensity = 0;
    if (rainPoints) rainPoints.visible = true;
    setSkyColors(0x55606e, 0x8d97a3);
    if (starPoints) starPoints.visible = false;
    if (moonMesh) moonMesh.visible = false;
  } else {
    scene.background.set(0x87b5e0); scene.fog.color.set(0x87b5e0); scene.fog.near = 30; scene.fog.far = 170;
    hemiLight.intensity = 0.95; sunLight.intensity = 0.7;
    if (roadMat) roadMat.color.set(0x2b3038);
    if (headlight) headlight.intensity = 0;
    if (rainPoints) rainPoints.visible = false;
    setSkyColors(0x3f8fe0, 0xcfe8ff);
    if (starPoints) starPoints.visible = false;
    if (moonMesh) moonMesh.visible = false;
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
    $('prog').parentElement.style.display = 'none';
  } else {
    const remain = Math.max(0, st.routeLen - st.dist) / 1000;
    $('dist').textContent = t('left') + ' ' + remain.toFixed(1) + ' km';
    $('prog').parentElement.style.display = 'flex';
    $('progFill').style.setProperty('--fill', Math.min(100, (st.dist / st.routeLen) * 100) + '%');
  }
  $('nitroFill').style.width = Math.round(st.nitro) + '%';
  $('fuelFill').style.setProperty('--fill', Math.round((st.fuel / st.maxFuel) * 100) + '%');
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
      spawnDebris(st.player.x, 0);
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
      spawnDebris(st.player.x, 0);
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
    cgStop(); // official docs: gameplayStop on every break, including pause
    beep(500, 0.1, 'sine', 0.15);
  } else {
    cgStart(); // ...and gameplayStart when play resumes after the break
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
  clearDebris();
  if (restAnim) { restAnim = null; clearRestSeq(); $('restOverlay').classList.add('hidden'); }
  if (st && st.score > bestScore()) { try { localStorage.setItem('tr_best_score', String(st.score)); } catch (e) {} }
  if (running) foldOdometer();
  running = false; cgStop(); engineUpdate(0, false);
  for (const mesh of roadworkMeshes.values()) scene.remove(mesh);
  roadworkMeshes.clear();
  if (playerMesh) { playerMesh.position.set(0, 0, 0); playerMesh.rotation.set(0, 0, 0); }
  $('hud').classList.add('hidden'); $('controls').classList.add('hidden'); $('endOverlay').classList.add('hidden');
  $('startOverlay').classList.remove('hidden');
  document.body.classList.remove('playing'); // Fase 2O: menu-only UI returns
  setLaneMarkings(3);
  if (lanesGroup) lanesGroup.visible = false;
  updateBestLine(); renderShop(); renderCars(); renderMissions(); renderAchievements(); refreshPlayerMesh();
  applyCondition(currentCondition === 'random' ? 'day' : currentCondition);
}

// ---------- rest-area drive-through set (Fase 2P) ----------
// A full rest complex staged to the LEFT of the highway, in view space. The
// car stays near z=0 while the set scrolls past it (the same trick as the
// main road scroll), so each element passes the car in order — entrance,
// buildings, parked cars, SPBU, exit — and the sequence ends exactly back on
// the player's lane with no snap.
const REST_SEQ_PARK_COLORS = [0xd8402e, 0x2e6fd8, 0xe8e2d2, 0x333333, 0x2a6b4a, 0xe0a52e];
const REST_SEQ_PARK_SLOTS = [
  { x: -20, z: -30 }, { x: -20, z: -36 }, { x: -20, z: -52 }, { x: -20, z: -58 },
  { x: -24, z: -66, kind: 'truck' },
];
let restSeqGroup = null, restSeqParked = null, restSeqQueueCar = null;
function buildRestSeqGroup() {
  const g = new THREE.Group();
  g.add(box(34, 0.3, 130, 0x3a3f46, -20, -0.15, -60)); // area ground pad, top at y=0
  // entrance gantry (local z=-12; plane faces +z, toward the arriving car)
  g.add(box(0.5, 5, 0.5, 0xdddddd, -20, 2.5, -12));
  g.add(box(0.5, 5, 0.5, 0xdddddd, -8, 2.5, -12));
  const entSign = new THREE.Mesh(new THREE.PlaneGeometry(10, 3),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('REST AREA', '') }));
  entSign.position.set(-14, 4.5, -12); g.add(entSign);
  // drive-lane dashes along x=-14 (entrance -> SPBU -> exit)
  for (let i = 0; i < 11; i++) g.add(box(0.3, 0.12, 2.5, 0xdddddd, -14, 0.06, -18 - i * 6));
  for (let i = 0; i < 5; i++) g.add(box(0.3, 0.12, 3, 0xdddddd, -14, 0.06, -94 - i * 5));
  // main building + roof + road-facing sign (Fase 2S: moved 2 m closer to
  // the drive lane and enlarged so the complex reads bigger on a phone)
  g.add(box(15, 4.5, 11, 0xe8e2d2, -27, 2.25, -45));
  g.add(box(16, 0.5, 12, 0x2a6b4a, -27, 4.7, -45));
  const bldSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('REST AREA', '') }));
  bldSign.rotation.y = Math.PI / 2; bldSign.position.set(-19.3, 2.8, -45); g.add(bldSign);
  // musholla + toilet block
  g.add(box(6, 3, 6, 0xf2ede2, -29, 1.5, -62));
  g.add(box(7, 0.5, 7, 0x2a6b4a, -29, 3.2, -62));
  g.add(box(0.8, 5, 0.8, 0xf2ede2, -25.5, 2.5, -62));
  g.add(box(8, 2.5, 4, 0x9fb6c3, -29, 1.25, -30));
  // SPBU: canopy + pillars + pump beside the drive lane + kiosk + sign
  // (Fase 2S: canopy enlarged so it reads bigger on a phone)
  g.add(box(16, 0.6, 10, 0xcc2222, -16, 4.5, -85));
  for (const px of [-21, -11]) for (const pz of [-88, -82])
    g.add(box(0.5, 4.5, 0.5, 0xeeeeee, px, 2.25, pz));
  g.add(box(1.2, 2.2, 0.8, 0xf2f2f2, -17.5, 1.1, -85));
  g.add(box(3, 2.5, 3, 0xe8e2d2, -22, 1.25, -85));
  const spbuSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('SPBU', '') }));
  spbuSign.position.set(-16, 4.5, -80.4); g.add(spbuSign);
  // exit sign + lamp posts (basic-material heads glow at night)
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('KELUAR', '') }));
  exitSign.position.set(-14, 4, -108); g.add(exitSign);
  for (const lz of [-30, -55, -75]) {
    g.add(box(0.3, 5, 0.3, 0x888888, -10, 2.5, lz));
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
    head.position.set(-10, 5.1, lz); g.add(head);
  }
  restSeqParked = new THREE.Group(); g.add(restSeqParked);
  g.visible = false; scene.add(g);
  return g;
}
function rebuildRestSeqParked() {
  if (!restSeqParked) return;
  while (restSeqParked.children.length) restSeqParked.remove(restSeqParked.children[0]);
  for (const slot of REST_SEQ_PARK_SLOTS) {
    const kind = slot.kind || ['sedan', 'suv', 'hatch', 'sport'][Math.floor(Math.random() * 4)];
    const car = makeCar(kind, REST_SEQ_PARK_COLORS[Math.floor(Math.random() * REST_SEQ_PARK_COLORS.length)]);
    car.rotation.y = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    car.position.set(slot.x, 0, slot.z);
    restSeqParked.add(car);
  }
}
function clearRestSeq() {
  if (restSeqGroup) {
    restSeqGroup.visible = false; restSeqGroup.position.z = 0;
    if (restSeqQueueCar) { restSeqGroup.remove(restSeqQueueCar); restSeqQueueCar = null; }
  }
}

// ---------- rest-area animation ----------
// The game pauses while the car drives the rest-area sequence, then merges
// back. Effects (heal, refill, +250, traffic clear) are applied by TR.tryRest
// at the end of the animation or on SKIP — the fill bar is the visual refill.
let restAnim = null;
let steerCur = 0; // Fase 2U: smoothed steering angle, driven by the lane gap
// Beat table: end time, scroll end, lane x (null = merge to player's lane), stage key.
// Fase 2S: beat 1 (entry ramp) lengthened 12 m / 2.5 s -> 30 m / 4 s so the
// car enters on a gentler, longer ramp; later beats shift +1.5 s (total 17.5 s).
const REST_BEATS = [
  { t1: 4.0, s1: 30, x1: -12, stage: 'restS1' },
  { t1: 9.0, s1: 78, x1: -14, stage: 'restS2', wander: true },
  { t1: 12.0, s1: 85, x1: -14, stage: 'restS3' },
  { t1: 15.0, s1: 85, x1: -14, stage: 'restS4', fuel: true },
  { t1: 17.5, s1: 110, x1: null, stage: 'restS5' },
];
function startRestAnim() {
  const stop = TR.openRestStop(st);
  if (!stop) return false;
  restAnim = { t: 0, stop, fromX: st.player.x, fromFuel: st.fuel, halfBeep: false, prevX: st.player.x, beat: -1 };
  rebuildRestSeqParked(); // parked cars reshuffle every visit
  restSeqQueueCar = makeCar('sedan', REST_SEQ_PARK_COLORS[Math.floor(Math.random() * REST_SEQ_PARK_COLORS.length)]);
  restSeqQueueCar.position.set(-14, 0, -85); restSeqGroup.add(restSeqQueueCar);
  restSeqGroup.visible = true; restSeqGroup.position.z = 0;
  restGroup.visible = false; // old right-side set piece hides during the sequence
  $('restFuelFill').style.width = Math.round((st.fuel / st.maxFuel) * 100) + '%';
  $('restFuelPct').textContent = Math.round((st.fuel / st.maxFuel) * 100) + '%';
  $('restStage').textContent = t('restS1');
  $('restOverlay').classList.remove('hidden');
  beep(600, 0.1, 'sine', 0.12);
  return true;
}
// Fase 2U: straighten the steering pivots and level the body after a
// sequence or a fresh start, so no stale lean survives into the next run.
function resetPlayerPose() {
  if (!playerMesh) return;
  if (playerMesh.userData.steer) for (const pv of playerMesh.userData.steer) pv.rotation.y = 0;
  const pb = playerMesh.userData.body;
  if (pb) { pb.rotation.z = 0; pb.position.x = 0; }
}
function finishRestAnim() {
  if (!restAnim) return;
  restAnim = null;
  clearRestSeq();
  $('restOverlay').classList.add('hidden');
  if (playerMesh) { playerMesh.position.set(st.player.x, 0, 0); playerMesh.rotation.set(0, 0, 0); }
  resetPlayerPose();
  TR.tryRest(st); // toast for the +250/rest event is handled by handleEvents next frame
}
function updateRestAnim(dt) {
  restAnim.t += dt;
  const t = restAnim.t;
  const ease = (k) => 1 - Math.pow(1 - k, 2);
  let bi = 0;
  while (bi < REST_BEATS.length - 1 && t >= REST_BEATS[bi].t1) bi++;
  const beat = REST_BEATS[bi];
  const t0 = bi === 0 ? 0 : REST_BEATS[bi - 1].t1;
  const s0 = bi === 0 ? 0 : REST_BEATS[bi - 1].s1;
  const x0 = bi === 0 ? restAnim.fromX : (REST_BEATS[bi - 1].x1 ?? restAnim.fromX);
  const k = Math.min(1, (t - t0) / (beat.t1 - t0));
  // scroll is linear per beat, so speed changes read as accel/decel
  const scroll = s0 + (beat.s1 - s0) * k;
  let carX;
  if (beat.wander) carX = -12 - 2 * k - 4 * Math.sin(Math.PI * k);
  else if (beat.x1 === null) carX = -14 + (st.player.x + 14) * ease(k);
  else carX = x0 + (beat.x1 - x0) * ease(k);
  // heading follows lateral velocity: moving left = positive rotation (turn left)
  const dxRate = dt > 0 ? (carX - restAnim.prevX) / dt : 0;
  restAnim.prevX = carX;
  playerMesh.position.set(carX, 0, 0);
  playerMesh.rotation.y = Math.max(-0.35, Math.min(0.35, -dxRate * 0.04));
  // Fase 2U: wheels steer and body leans with the lateral velocity, same as
  // a lane change — the car turns into the ramp instead of sliding sideways.
  const steerR = playerMesh.userData.steer;
  if (steerR) for (const pv of steerR) pv.rotation.y = Math.max(-0.35, Math.min(0.35, -dxRate * 0.03));
  const pbodyR = playerMesh.userData.body;
  if (pbodyR) { pbodyR.rotation.z = dxRate * 0.01; pbodyR.position.x = -dxRate * 0.01; }
  // queue car pulls away once the player has stopped behind it
  if (restSeqQueueCar) {
    const qk = Math.max(0, Math.min(1, (t - 9.5) / 1.5));
    restSeqQueueCar.position.z = -85 - 30 * ease(qk);
  }
  // fuel fills only during the SPBU beat; before it show current fuel, after it 100%
  if (beat.fuel) {
    const p = k;
    const pct = Math.round(((restAnim.fromFuel / st.maxFuel) + (1 - restAnim.fromFuel / st.maxFuel) * p) * 100);
    $('restFuelFill').style.width = pct + '%';
    $('restFuelPct').textContent = pct + '%';
    if (p > 0.5 && !restAnim.halfBeep) { restAnim.halfBeep = true; beep(760, 0.1, 'sine', 0.12); }
  } else if (bi === REST_BEATS.length - 1) {
    $('restFuelFill').style.width = '100%'; $('restFuelPct').textContent = '100%';
  }
  if (bi !== restAnim.beat) { restAnim.beat = bi; $('restStage').textContent = t(beat.stage); }
  restSeqGroup.position.z = scroll;
  if (shieldMesh) { shieldMesh.visible = !!st.shield; shieldMesh.position.set(carX, 1.0, 0); }
  if (headlight && st.condition === 'night') {
    headlight.position.set(carX, 1.2, 0);
    headlight.target.position.set(carX, 0.5, -40);
    headlight.target.updateMatrixWorld();
  }
  // Fase 2S: camera centres on the car through the whole sequence (full
  // carX follow, not the half-follow of normal play) so it never drifts
  // out of frame on a narrow portrait phone.
  camera.position.set(carX, 5.4, 9);
  camera.lookAt(carX, 0.8, -12);
  if (t >= REST_BEATS[REST_BEATS.length - 1].t1) finishRestAnim();
}
function startGame(mode) {
  currentMode = TR.ROUTES[mode] ? mode : 'short';
  restAnim = null; clearRestSeq(); $('restOverlay').classList.add('hidden');
  resetPlayerPose(); steerCur = 0;
  for (const mesh of trafficMeshes.values()) scene.remove(mesh);
  trafficMeshes.clear();
  for (const mesh of pickupMeshes.values()) scene.remove(mesh);
  pickupMeshes.clear();
  for (const mesh of roadworkMeshes.values()) scene.remove(mesh);
  roadworkMeshes.clear();
  clearDebris();
  st = TR.createGame({ mode: currentMode, upgrades: loadUpgrades(), condition: currentCondition, car: loadSelectedCar() });
  refreshPlayerMesh();
  missionToasted = new Set();
  paused = false; $('pauseOverlay').classList.add('hidden');
  odoRunStart = odoSaved;
  applyCondition(st.condition);
  setLaneMarkings(st.laneCount);
  running = true;
  document.body.classList.add('playing'); // Fase 2O: hide rotate + corners in-game
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
  // Fase 2Q: moving into a lane that is about to vanish is refused with an
  // explanation, instead of silently doing nothing (TR.moveLane also refuses
  // it as a backstop; this branch is what tells the player why).
  const info = TR.transitionInfo(st);
  if (info && info.doomed >= 0 && next === info.doomed && next !== st.player.targetLane) {
    toast(t('laneClosingToast')); beep(200, 0.15, 'square', 0.15);
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
function toggleMute() {
  try { localStorage.setItem('tr_mute', isMuted() ? '0' : '1'); } catch (e) {}
  syncMuteUI();
}
$('muteBtn').addEventListener('click', toggleMute);
$('muteBtn2').addEventListener('click', toggleMute);
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
    // Lane-count taper visuals (Fase 2Q): during the 200 m zone the static
    // marking groups hide and the taper group takes over, positioned at
    // the segment line like the gantry; otherwise the static group for the
    // current count shows as before.
    const tapSeg = TR.nextSegmentChange(st);
    const tapGap = tapSeg ? tapSeg.at - st.dist : Infinity;
    const tapering = !!tapSeg && tapSeg.lanes !== st.laneCount && tapGap <= TR.TRANSITION_LEN && tapGap > -30;
    if (tapering) {
      syncTaperGroup(st.laneCount, tapSeg.lanes);
      taperGroup.visible = true;
      taperGroup.position.z = -tapGap;
      for (const c of [2, 3, 4]) if (markingGroups[c]) markingGroups[c].visible = false;
    } else {
      if (taperGroup) taperGroup.visible = false;
      if (st.laneCount !== currentMarkings) setLaneMarkings(st.laneCount);
    }
    // scroll world props with player speed
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
    // player indicators (same 4 Hz blink as traffic) + brake lights
    const psig = playerMesh.userData.signals;
    if (psig) {
      const moving = st.player.moveT < 1;
      const blinking = moving && (Math.floor(st.time * 4) % 2 === 0);
      const toRight = st.player.targetLane > st.player.lane;
      psig.left.visible = blinking && !toRight;
      psig.right.visible = blinking && toRight;
    }
    const ptails = playerMesh.userData.tails;
    if (ptails) for (const m of ptails) m.color.set(st.brake ? 0xff7a85 : 0xff2a3c);
    // nitro flame, flickering while nitro is held
    if (nitroFlame) {
      nitroFlame.visible = !!st.nitroOn;
      nitroFlame.position.set(st.player.x, 0.6, 2.8);
      const f = 0.85 + 0.3 * Math.sin(st.time * 42);
      nitroFlame.scale.set(f, f, f);
    }
    updateDebris(dt);
    playerMesh.rotation.y = (st.laneXs[st.player.targetLane] - st.player.x) * -0.05;
    playerMesh.rotation.z = st.crashT > 0 ? (Math.random() - 0.5) * 0.06 : 0;
    // Fase 2U: front wheels steer into the lane change (smoothed so they
    // swing in instead of snapping), and the body rolls/shifts against the
    // wheels instead of moving as one rigid piece.
    const steerTarget = Math.max(-0.38, Math.min(0.38, (st.laneXs[st.player.targetLane] - st.player.x) * -0.1));
    steerCur += (steerTarget - steerCur) * Math.min(1, dt * 14);
    const steer = playerMesh.userData.steer;
    if (steer) for (const pv of steer) pv.rotation.y = steerCur;
    const pbody = playerMesh.userData.body;
    if (pbody) { pbody.rotation.z = -steerCur * 0.18; pbody.position.x = steerCur * 0.12; }
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
    if (nitroFlame) nitroFlame.visible = false;
    if (playerMesh && playerMesh.userData.signals) {
      playerMesh.userData.signals.left.visible = false;
      playerMesh.userData.signals.right.visible = false;
    }
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
