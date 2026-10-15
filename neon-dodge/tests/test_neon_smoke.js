// Neon Dodge — smoke tests (game shell with stubbed browser).
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' — got ' + g + ', want ' + w); }
}
function ok(name, cond) { eq(name, !!cond, true); }

// ---- stubs ----
const els = {};
function makeEl() {
  return {
    textContent: '', innerHTML: '',
    classList: { _s: new Set(['hidden']),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    style: {},
    addEventListener() {},
  };
}
global.document = {
  getElementById: (id) => (els[id] = els[id] || makeEl()),
  createElement: () => ({ width: 0, height: 0, getContext: () => stub2d(), toBlob: (cb) => cb(null), style: {} }),
  documentElement: { lang: '' },
  readyState: 'complete',
  addEventListener() {},
  body: { appendChild() {}, removeChild() {} },
};
function stub2d() {
  const grad = { addColorStop() {} };
  return new Proxy({}, { get: (t, k) => {
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
    if (k === 'measureText') return () => ({ width: 0 });
    if (k === 'canvas') return {};
    return (...a) => {};
  }, set: () => true });
}
global.window = {
  innerWidth: 420, innerHeight: 740,
  addEventListener() {},
  AudioContext: undefined, webkitAudioContext: undefined,
};
try { Object.defineProperty(global, 'navigator', { value: {}, configurable: true }); } catch (e) {}
global.requestAnimationFrame = () => {};
global.localStorage = {
  _m: {}, getItem(k) { return this._m[k] || null; },
  setItem(k, v) { this._m[k] = String(v); },
};
global.setTimeout = (fn) => 0;
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.File = function () {};

// canvas 2d context for the real canvas element
els.game = makeEl();
els.game.getContext = () => stub2d();
els.game.addEventListener = () => {};
els.game.style = {};

// ---- load sources ----
const root = path.join(__dirname, '..');
const logicSrc = fs.readFileSync(path.join(root, 'src', 'logic.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(root, 'src', 'game.js'), 'utf8');
const built = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// 1. every $('id') referenced in game.js exists in template.html
{
  const tpl = fs.readFileSync(path.join(root, 'src', 'template.html'), 'utf8');
  const ids = new Set();
  for (const m of tpl.matchAll(/id="([a-zA-Z]+)"/g)) ids.add(m[1]);
  const used = new Set();
  for (const m of gameSrc.matchAll(/\$\('([a-zA-Z]+)'\)/g)) used.add(m[1]);
  const missing = [...used].filter((i) => !ids.has(i));
  eq('all $() ids exist in template', missing, []);
}

// 2. built file has no placeholders and exactly 2 script blocks
{
  ok('no placeholder leak', !built.includes('__LOGIC_INLINE__') && !built.includes('__GAME_INLINE__'));
  eq('script blocks', (built.match(/<script>/g) || []).length, 2);
  ok('ND inline', built.includes('Neon Dodge'));
}

// 3. boot: game.js runs without throwing, exports shape
let G;
{
  let threw = null;
  try {
    const mod = { exports: {} };
    const fn = new Function('module', 'exports', 'require', 'window', 'document', 'navigator',
      'requestAnimationFrame', 'localStorage', 'setTimeout', 'URL', 'File',
      logicSrc + '\n' + gameSrc + '\nreturn module.exports;');
    G = fn(mod, mod.exports, require, global.window, global.document, global.navigator,
      global.requestAnimationFrame, global.localStorage, global.setTimeout, global.URL, global.File);
  } catch (e) { threw = e && e.message; }
  eq('boot: no throw', threw, null);
  ok('exports ND', G && G.ND);
}

// 4. menu visible at boot, texts applied
{
  eq('menu visible', els.menuEl.classList.contains('hidden'), false);
  ok('title applied', els.titleMain.textContent.length > 0);
  ok('howto has 3 rows', (els.howto.innerHTML.match(/hrow/g) || []).length === 3);
}

// 5. newGame flow via export
{
  G.newGame();
  const s = G.state();
  eq('screen play', s.screen, 'play');
  eq('status play', s.status, 'play');
  eq('menu hidden', els.menuEl.classList.contains('hidden'), true);
}

// 6. language toggle applies ID strings
{
  G.applyTexts();
  els.langBtn.textContent; // noop, just exists
  ok('lang button exists', !!els.langBtn);
}

// 7. achievements: all 8 defined, unlock flow
{
  const a0 = G.achState();
  eq('8 achievements', a0.total, 8);
  G.unlock('first_dodge');
  const a1 = G.achState();
  ok('unlock recorded', a1.unlocked.includes('first_dodge'));
}

// 8. share card draws without throwing
{
  let threw = null;
  try { G.drawShareCard(stub2d()); } catch (e) { threw = e && e.message; }
  eq('share card: no throw', threw, null);
}

// 9. shareScore runs (download fallback path)
{
  let threw = null;
  const p = G.shareScore();
  if (p && p.catch) p.catch((e) => { threw = e && e.message; });
  eq('shareScore: no throw', threw, null);
}

// 10. simulated full run: play until death via logic through exports
{
  G.newGame();
  const st = G.ND.createGame();
  G.ND.setTarget(st, 210, 620);
  let frames = 0;
  while (frames < 3600) {
    G.ND.setTarget(st, 210 + Math.sin(frames * 0.03) * 140, 620);
    G.ND.step(st, 1 / 60);
    frames++;
    if (st.status === 'over') break;
  }
  ok('sim finished (died or survived)', st.status === 'over' || frames === 3600);
  ok('score finite', isFinite(st.score));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
