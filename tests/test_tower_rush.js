// Headless logic test for Tower Rush (achievements + share + i18n + CrazyGames SDK).
// Run: node ~/workspace/html5-games/tests/test_tower_rush.js
// Set NO_CG_SDK=1 to simulate adblock / foreign domain (SDK absent).
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(process.env.HOME + '/workspace/html5-games/tower-rush/index.html', 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id) {
  return {
    id, textContent: '', innerHTML: '', style: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener() {}, click() {}, remove() {},
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
elements['game'] = Object.assign(makeEl('game'), {
  getContext: () => ctxStub, width: 0, height: 0, style: {},
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
  JSON, Math, Object, Array, String, Number, Promise, File: class { constructor(p, n, o) { this.name = n; } },
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
;globalThis.__T = {
  newGame, place, shareScore, renderAchGrid, t, setLang, ACHS, CG,
  getLang: () => lang,
  setBest: (v) => { best = v; },
  cgState: () => ({ ready: CG.ready, adPaused, cgAudioMuted, sdkForceMute, muted }),
  overHidden: () => document.getElementById('overOverlay').classList.contains('hidden'),
  setPerfect() { const p = layers[layers.length-1]; const ax = cur.axis; cur.pos = (ax==='x'?p.x:p.z); syncCur(); },
  setCut(off)  { const p = layers[layers.length-1]; const ax = cur.axis; cur.pos = (ax==='x'?p.x:p.z)+off; syncCur(); },
  setMiss()    { const p = layers[layers.length-1]; const ax = cur.axis; const s = (ax==='x'?cur.w:cur.d); cur.pos = (ax==='x'?p.x:p.z)+s+1; syncCur(); },
  state: () => ({ score, combo, layers: layers.length, mode,
                  ach: Object.keys(achUnlocked).sort(), minW: runStats && runStats.minW,
                  perfects: runStats && runStats.perfects, toastQ: toastQueue.length, toastBusy,
                  menuHint: document.getElementById('menuHint').textContent,
                  langBtn: document.getElementById('langBtn').innerHTML }),
  gridHTML: () => { renderAchGrid(); return achGrid.innerHTML; },
};`;
vm.runInContext(src + driver, sandbox);
const T = sandbox.__T;
const HAS_SDK = !process.env.NO_CG_SDK;
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' — got ' + g + ', want ' + w); }
}
function has(id) { return T.state().ach.includes(id); }

console.log('— syntax + boot: OK (script evaluated, no TDZ crash)');

// Core gameplay + achievements
T.newGame();
for (let i = 0; i < 12; i++) { T.setPerfect(); T.place(); }
let s = T.state();
eq('12 perfects → score', s.score, 27);
eq('first_perfect unlocked', has('first_perfect'), true);
eq('first_steps unlocked (11 layers)', has('first_steps'), true);
eq('streak_5 unlocked', has('streak_5'), true);
eq('streak_10 unlocked', has('streak_10'), true);
eq('tower_25 unlocked', has('tower_25'), true);
eq('streak_20 NOT yet', has('streak_20'), false);
eq('perfect_25 NOT yet', has('perfect_25'), false);
eq('combo is 12', s.combo, 12);

T.newGame();
T.setPerfect(); T.place(); T.setPerfect(); T.place();
T.setCut(0.5); T.place();
T.setPerfect(); T.place(); T.setPerfect(); T.place(); T.setPerfect(); T.place();
eq('comeback unlocked', has('comeback'), true);

T.newGame();
T.setMiss(); T.place();
eq('miss → mode over', T.state().mode, 'over');

(async () => {
  await new Promise(r => setTimeout(r, 80)); // let CG.init() settle

  if (HAS_SDK) {
    const cgs = T.cgState();
    eq('CG ready via mock SDK', cgs.ready, true);
    eq('SDK muteAudio=true forces mute', cgs.muted, true);
    eq('sdkForceMute set', cgs.sdkForceMute, true);
    eq('gameplayStart called on newGame', cgCalls.includes('gameplayStart'), true);

    T.setBest(0);
    T.newGame();
    T.setPerfect(); T.place();
    T.setMiss(); T.place();
    eq('miss → gameplayStop', cgCalls.includes('gameplayStop'), true);
    eq('miss → midroll requested', cgCalls.includes('requestAd:midgame'), true);
    eq('panel hidden while ad plays', T.overHidden(), true);
    await new Promise(r => setTimeout(r, 900));
    eq('panel shown after ad', T.overHidden(), false);
    eq('happytime on new best', cgCalls.includes('happytime'), true);

    sandbox.__cgSettingsListener({ muteAudio: false });
    eq('sdkForceMute cleared by platform', T.cgState().sdkForceMute, false);
  } else {
    eq('CG not ready without SDK', T.cgState().ready, false);
    T.newGame(); T.setPerfect(); T.place(); T.setMiss(); T.place();
    await new Promise(r => setTimeout(r, 900));
    eq('panel shown without ad (no SDK)', T.overHidden(), false);
  }

  // Share fallback
  T.newGame();
  T.setPerfect(); T.place();
  await T.shareScore();
  const st = T.state();
  eq('share → toast queued/busy', st.toastQ + (st.toastBusy ? 1 : 0) >= 1, true);

  // Gallery
  const grid = T.gridHTML();
  eq('gallery has 11 cards', (grid.match(/class="ach/g) || []).length, 11);

  // i18n
  eq('default lang is en', T.getLang(), 'en');
  eq('en tapStart', T.t('tapStart'), 'TAP TO START');
  T.setLang('id');
  eq('lang switched to id', T.getLang(), 'id');
  eq('id tapStart', T.t('tapStart'), 'KETUK UNTUK MULAI');
  eq('id ach name', T.ACHS[0].name.id, 'Sentuhan Pertama');
  eq('id share text', T.t('shareText', { s: 42 }), 'Skor Tower Rush-ku: 42! Bisa kalahkan?');
  eq('id persisted', sandbox.localStorage.getItem('towerrush_lang'), 'id');
  T.setLang('en');
  eq('back to en', T.t('tapStart'), 'TAP TO START');

  // Rename checks
  eq('no "Stack Rush" text in menu', !document_title_has_stack(), true);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

function document_title_has_stack() {
  // reached via closure over html source; ignore the one-time storage migration block
  const stripped = html.replace(/\/\* One-time migration[\s\S]*?\}\)\(\);/, '');
  return /Stack Rush|STACK RUSH|stack-rush|stackrush_|Dewa Stack|Stack God/i.test(stripped);
}
