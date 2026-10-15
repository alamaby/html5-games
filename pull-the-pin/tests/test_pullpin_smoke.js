// Pull the Pin — shell smoke test: boot, level flow, share card, achievements.
// Gameplay physics is covered by test_pullpin_logic.js.
'use strict';
const fs = require('fs'), vm = require('vm');
const DIR = process.env.HOME + '/workspace/html5-games/pull-the-pin/src/';

function fakeEl(id) {
  return {
    id, textContent: '', innerHTML: '', style: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener() {}, offsetWidth: 0,
    appendChild(c) { (this._kids = this._kids || []).push(c); },
    removeChild(c) {},
    getContext() { return ctxStub(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 420, height: 740 }; },
  };
}
function ctxStub() {
  const texts = [];
  return {
    texts,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', font: '', textAlign: '', globalAlpha: 1,
    fillRect() {}, clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {},
    beginPath() {}, closePath() {}, arc() {}, arcTo() {}, stroke() {}, fill() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    fillText(t) { texts.push(String(t)); },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
}
function canvasEl() {
  const el = fakeEl('canvas');
  el.width = 0; el.height = 0; el._ctx = null;
  el.getContext = () => el._ctx || (el._ctx = ctxStub());
  el.toBlob = (cb) => cb(null);
  return el;
}

const elements = {}, store = {};
const sandbox = {
  console, JSON, Math, Object, Array, String, Number, setTimeout, clearTimeout,
  requestAnimationFrame: () => {},
  localStorage: { getItem: (k) => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); } },
  window: { innerWidth: 420, innerHeight: 800, addEventListener() {} },
  document: {
    getElementById: (id) => elements[id] || (elements[id] = fakeEl(id)),
    createElement: (tag) => tag === 'canvas' ? canvasEl() : fakeEl(tag),
    addEventListener() {},
    documentElement: { lang: '' },
    body: fakeEl('body'),
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const ms = { exports: {} };
sandbox.module = ms;
vm.runInContext(fs.readFileSync(DIR + 'logic.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(DIR + 'game.js', 'utf8'), sandbox);
const G = ms.exports;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' — got ' + g + ', want ' + w); }
}
function ok(name, cond) { eq(name, !!cond, true); }

eq('boot: menu screen', G.state().screen, 'menu');
ok('boot: menu visible', !elements['menuEl'].classList.contains('hidden'));
// every $('id') used in game.js must exist in template.html (regression: retryBtn crash)
{
  const tplSrc = fs.readFileSync(DIR + 'template.html', 'utf8');
  const gameSrc = fs.readFileSync(DIR + 'game.js', 'utf8');
  const tplIds = new Set([...tplSrc.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const usedIds = new Set([...gameSrc.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  const missing = [...usedIds].filter((id) => !tplIds.has(id));
  eq('all game.js element ids exist in template', missing, []);
}
ok('boot: 5 level cards', (elements['levelGrid']._kids || []).length === 5);

G.startLevel(0);
eq('startLevel: screen play', G.state().screen, 'play');
eq('startLevel: status aim', G.state().status, 'aim');
ok('startLevel: hud level set', elements['hudLevel'].textContent.includes('1'));

// share card draws without throwing and contains key texts
const c2d = ctxStub();
let threw = null;
try { G.drawShareCard(c2d); } catch (e) { threw = e && e.message; }
eq('share card: no exception', threw, null);
ok('share card: title', c2d.texts.includes('PULL THE PIN'));
ok('share card: progress', c2d.texts.some((t) => t.includes('/5')));
ok('share card: url', c2d.texts.includes('alamaby.github.io/html5-games/pull-the-pin/'));

// shareScore early-returns safely when toBlob yields null (no navigator needed)
(async () => {
  let shareThrew = null;
  try { await G.shareScore(); } catch (e) { shareThrew = e && e.message; }
  eq('shareScore: safe early return', shareThrew, null);

  // achievements persist
  G.unlock('first_pull');
  ok('unlock persists', (store['ppp_ach'] || '').includes('first_pull'));

  // startLevel for each level works
  for (let i = 0; i < 5; i++) {
    G.startLevel(i);
    eq('startLevel(' + i + ') aim', G.state().status, 'aim');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
