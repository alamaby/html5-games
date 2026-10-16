// Headless logic test for Pour & Pressure (sim engine, scoring, i18n, achievements, SDK).
// Run: node ~/workspace/html5-games/tests/test_pour_pressure.js
// Set NO_CG_SDK=1 to simulate adblock / foreign domain (SDK absent).
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(process.env.HOME + '/workspace/html5-games/pour-pressure/index.html', 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id) {
  return {
    id, textContent: '', innerHTML: '', style: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener() {}, click() {}, remove() {}, appendChild() {}, removeChild() {},
    getContext: () => ctxStub,
  };
}
const elements = {};
const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (k === 'measureText') return () => ({ width: 10 });
    return () => {};
  },
  set() { return true; },
});
const store = {};
const cgCalls = [];
const mockGame = {
  gameplayStart: () => cgCalls.push('gameplayStart'),
  gameplayStop: () => cgCalls.push('gameplayStop'),
  happytime: () => cgCalls.push('happytime'),
  settings: { muteAudio: true },
  addSettingsChangeListener: (fn) => { sandbox.__cgSettingsListener = fn; },
};
const mockAd = {
  requestAd: (type, cb) => {
    cgCalls.push('requestAd:' + type);
    cb.adStarted();
    setTimeout(() => cb.adFinished(), 20);
  },
};
const sandbox = {
  console,
  JSON, Math, Object, Array, String, Number, Promise,
  setTimeout, clearTimeout,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => {},
  URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  navigator: {},
  window: Object.assign(
    { innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, addEventListener() {} },
    process.env.NO_CG_SDK ? {} : { CrazyGames: { SDK: { init: () => Promise.resolve(), environment: 'crazygames', game: mockGame, ad: mockAd } } }
  ),
  document: {
    getElementById: (id) => elements[id] || (elements[id] = makeEl(id)),
    createElement: (tag) => {
      if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ctxStub, toBlob: (cb) => cb({ size: 1 }) };
      return makeEl(tag);
    },
    addEventListener() {},
    documentElement: { lang: '' },
    body: { appendChild() {}, removeChild() {} },
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const driver = `
;globalThis.__PP = window.__PP_TEST__;
;globalThis.__PPD = {
  showOrder, showShifts, startBrew, finishOrder, shareCard, simUpdate,
  setShiftOrder(si, oi) { curShift = si; curOrder = oi; },
  setSim(patch) { if (S) Object.assign(S, patch); },
  pokeLastMT(v) { lastMT = v; },
  getMode: () => mode,
  simState: () => S ? { mode: S.mode, E: S.E, W: S.W, C: S.C, G: S.G, pourOn: S.pourOn } : null,
  adState: () => ({ adPaused, cgAudioMuted }),
  midroll: (cb) => Ads.midroll(cb),
  cgState: () => ({ ready: CG.ready, sdkForceMute, muted }),
};`;
vm.runInContext(src + driver, sandbox);
const T = sandbox.__PP;
const D = sandbox.__PPD;
const HAS_SDK = !process.env.NO_CG_SDK;
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' — got ' + g + ', want ' + w); }
}
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function approx(name, got, want, tol) {
  ok(name + ' (got ' + got.toFixed(2) + ' ≈ ' + want + ')', Math.abs(got - want) <= tol);
}

console.log('— boot');
ok('script evaluated, __PP_TEST__ present', !!T);

// CONFIG spot checks (§4.2)
console.log('— CONFIG');
eq('DOSE', T.CONFIG.DOSE, 20);
eq('POUR_RATE', T.CONFIG.POUR_RATE, 8);
eq('EXT_BASE', T.CONFIG.EXT_BASE, 0.55);
eq('BLOOM_WATER', T.CONFIG.BLOOM_WATER, 60);
eq('BLOOM_WAIT', T.CONFIG.BLOOM_WAIT, 8);
eq('MAX_WATER', T.CONFIG.MAX_WATER, 360);
eq('GRIND_EXT.fine', T.CONFIG.GRIND_EXT.fine, 1.4);
eq('GRIND_EXT.medium', T.CONFIG.GRIND_EXT.medium, 1.0);
eq('GRIND_EXT.coarse', T.CONFIG.GRIND_EXT.coarse, 0.75);

// flavor curves (§4.4)
console.log('— flavorAt curves');
const f8 = T.flavorAt(8), f20 = T.flavorAt(20), f28 = T.flavorAt(28);
ok('acidity peaks early: f(8) > f(20)', f8.acidity > f20.acidity);
ok('sweetness max at 20 vs 8', f20.sweetness > f8.sweetness);
ok('sweetness max at 20 vs 28', f20.sweetness > f28.sweetness);
eq('sweetness(20) == 100', Math.round(f20.sweetness), 100);
ok('bitterness rises: f(28) > f(20)', f28.bitterness > f20.bitterness);
approx('acidity(8)', f8.acidity, 100, 0.5);
approx('bitterness(20)', f20.bitterness, 16.8, 0.5);

// body
console.log('— bodyAt');
approx('body R=15 medium E=20', T.bodyAt(15, 'medium', 20), 70, 0.5);
approx('body R=13.5 fine E=25.5', T.bodyAt(13.5, 'fine', 25.5), 97.75, 0.5);

// penalties
console.log('— applyPenalties');
const pen = T.applyPenalties({ acidity: 20, sweetness: 100, bitterness: 20, body: 70 }, 1, 1, false);
ok('C=1 raises acidity', pen.acidity > 20);
ok('C=1 raises bitterness', pen.bitterness > 20);
ok('C=1 lowers sweetness', pen.sweetness < 100);
eq('acidity +22*C', Math.round(pen.acidity), 42);
eq('sweetness *0.75', Math.round(pen.sweetness), 75);
const pen0 = T.applyPenalties({ acidity: 20, sweetness: 100, bitterness: 20, body: 70 }, 0, 0, false);
eq('no penalty passthrough acidity', Math.round(pen0.acidity), 20);

// scoring
console.log('— scoreAxis');
eq('exact target → 100', T.scoreAxis(50, 50, 12), 100);
eq('within tol → 100', T.scoreAxis(60, 50, 12), 100);
eq('far outside → 0', T.scoreAxis(0, 100, 12), 0);
eq('edge of tol → 100', T.scoreAxis(62, 50, 12), 100);

// scripted perfect-play scenarios
console.log('— scoreOrder scenarios');
const r4 = T.scoreOrder({ E: 20, W: 300, grind: 'medium', C: 0, G: 0, flooding: false, cust: T.CUSTOMERS[3] });
eq('perfect play #4 → ★★★', r4.stars, 3);
ok('perfect play #4 total ≥ 85', r4.total >= 85);
const r3 = T.scoreOrder({ E: 25.5, W: 270, grind: 'fine', C: 0, G: 0, flooding: false, cust: T.CUSTOMERS[2] });
ok('#3 scripted → ★★ or better', r3.stars >= 2);
const bad = T.scoreOrder({ E: 5, W: 120, grind: 'medium', C: 1, G: 1, flooding: true, cust: T.CUSTOMERS[3] });
ok('terrible brew → ≤ ★', bad.stars <= 1);

// data integrity
console.log('— data');
eq('5 customers', T.CUSTOMERS.length, 5);
T.CUSTOMERS.forEach((c, i) => {
  ok('cust ' + i + ' targets numeric', ['a','s','b','body'].every(k => typeof c.target[k] === 'number'));
  ok('cust ' + i + ' bilingual', c.name.en && c.name.id && c.quote.en && c.quote.id && c.tip.en && c.tip.id);
});
eq('5 shifts × 4 orders', T.SHIFTS.length, 5);
ok('all shifts have 4 orders', T.SHIFTS.every(s => s.length === 4));
ok('order specs valid', T.SHIFTS.every(s => s.every(o =>
  o.c >= 0 && o.c < 5 && ['fine','medium','coarse'].includes(o.g) && o.t >= 88 && o.t <= 98)));
eq('8 achievements', T.ACHIEVEMENTS.length, 8);
T.ACHIEVEMENTS.forEach((a, i) => {
  ok('ach ' + i + ' bilingual', a.id && a.ico && a.name.en && a.name.id && a.desc.en && a.desc.id);
});

// i18n parity
console.log('— i18n');
eq('en/id key sets identical',
  Object.keys(T.I18N.en).sort(), Object.keys(T.I18N.id).sort());
let empty = null;
for (const k of Object.keys(T.I18N.en)) {
  if (typeof T.I18N.en[k] !== 'string' || !T.I18N.en[k]) empty = 'en:' + k;
  if (typeof T.I18N.id[k] !== 'string' || !T.I18N.id[k]) empty = 'id:' + k;
  if (T.t(k, 'id') === k && T.I18N.id[k] === k) empty = 'leak:' + k; // true missing translation
}
eq('all i18n values non-empty, no raw-key leak', empty, null);
T.setLang('id');
eq('lang → id', T.getLang(), 'id');
eq('id startBrewing', T.t('startBrewing'), 'MULAI MENYEDUH');
eq('id persisted', sandbox.localStorage.getItem('pp_save_v1').includes('"lang":"id"'), true);
T.setLang('en');
eq('back to en', T.t('startBrewing'), 'START BREWING');

// achievements runtime
console.log('— achievements runtime');
eq('unlock sweet_spot', T.unlockAch('sweet_spot'), true);
ok('achUnlocked lists it', T.achUnlocked().includes('sweet_spot'));
eq('no double unlock', T.unlockAch('sweet_spot'), false);

(async () => {
  await new Promise(r => setTimeout(r, 80)); // let CG.init() settle

  // phase machine: bloom_pour → bloom_wait → extract
  console.log('— phase machine');
  D.setShiftOrder(0, 0);
  D.showOrder();
  eq('order card mode', D.getMode(), 'order');
  D.startBrew();
  eq('brew mode', D.getMode(), 'bloom_pour');
  await new Promise(r => setTimeout(r, 10)); // flush CG._call microtask
  if (HAS_SDK) eq('gameplayStart on brew start', cgCalls.includes('gameplayStart'), true);
  D.setSim({ pourOn: true });
  D.pokeLastMT(0);
  D.simUpdate(7.6); // 7.6s × 8g/s = 60.8g ≥ 60 → bloom_wait (bloomT left: 0.4s)
  eq('bloom_wait after 60g', D.simState().mode, 'bloom_wait');
  eq('module mode synced', D.getMode(), 'bloom_wait');
  D.simUpdate(0.5);
  eq('extract after bloom timer', D.simState().mode, 'extract');
  eq('module mode synced to extract', D.getMode(), 'extract');

  // channeling: finger parked while pouring
  D.setSim({ pourOn: true, v: 0 });
  D.pokeLastMT(0);
  D.simUpdate(1.3);
  const st1 = D.simState();
  ok('channeling event fired (C=0.2)', Math.abs(st1.C - 0.2) < 1e-9);
  ok('channel_chaos not yet (1 event)', !T.achUnlocked().includes('channel_chaos'));

  // agitation via wall zone
  D.setSim({ r: 1e9, pourOn: true }); // clamped? r set directly — agitNow uses r > 0.85*Rd
  D.pokeLastMT(Date.now());
  D.simUpdate(1.0);
  ok('agitation accumulates G', D.simState().G > 0);

  // finish → results + SDK stop/happytime
  D.setSim({ mode: 'extract', E: 20, W: 300, C: 0, G: 0, pouring: false,
             pourOn: false, pourT: 10, goodT: 9.6, t0: Date.now() - 30000 });
  D.finishOrder();
  await new Promise(r => setTimeout(r, 10)); // flush CG._call microtasks
  eq('result mode', D.getMode(), 'result');
  if (HAS_SDK) {
    eq('gameplayStop on results', cgCalls.includes('gameplayStop'), true);
    eq('happytime on ★★★', cgCalls.includes('happytime'), true);
  }
  ok('triple_star unlocked by flow', T.achUnlocked().includes('triple_star'));
  ok('surgeon unlocked by flow', T.achUnlocked().includes('surgeon'));

  // share card doesn't throw
  D.shareCard();
  ok('shareCard ran', true);

  // midroll abstraction (between shifts only)
  let adDone = false;
  await new Promise(res => D.midroll(() => { adDone = true; res(); }));
  eq('midroll onDone fires', adDone, true);
  if (HAS_SDK) {
    eq('midroll requested midgame ad', cgCalls.includes('requestAd:midgame'), true);
    eq('not trapped after ad', D.adState().adPaused, false);
  }
  const cgs = D.cgState();
  if (HAS_SDK) {
    eq('CG ready', cgs.ready, true);
    eq('SDK mute forces mute', cgs.muted, true);
    sandbox.__cgSettingsListener({ muteAudio: false });
    eq('platform unmute clears force', D.cgState().sdkForceMute, false);
  } else {
    eq('CG not ready without SDK', cgs.ready, false);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
