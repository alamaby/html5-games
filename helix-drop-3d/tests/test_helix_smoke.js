// Smoke test for helix-drop-3d game.js with stubbed THREE/DOM.
// Catches reference errors + validates boot -> play -> dying -> over flow.
// Run: node tests/test_helix_smoke.js
const fs = require('fs');
const vm = require('vm');

const gameSrc = fs.readFileSync(process.env.HOME + '/workspace/html5-games/helix-drop-3d/src/game.js', 'utf8');

// ---- THREE stub ----
function mkObj3d() {
  return {
    children: [], visible: true,
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { set() {} },
    add(c) { this.children.push(c); },
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); },
    traverse(fn) { fn(this); this.children.slice().forEach((c) => (c.traverse ? c.traverse(fn) : fn(c))); },
    lookAt() {},
  };
}
class Color {
  constructor(v) { this.v = v; }
  getHex() { return 0xffffff; }
}
const THREE = {
  WebGLRenderer: class { constructor() { this.domElement = fakeEl('canvas'); } setPixelRatio() {} setSize() {} render() {} },
  Scene: class { constructor() { Object.assign(this, mkObj3d()); } },
  Color,
  Fog: class { constructor() {} },
  PerspectiveCamera: class { constructor() { Object.assign(this, mkObj3d()); this.aspect = 1; } updateProjectionMatrix() {} },
  HemisphereLight: class { constructor() {} },
  DirectionalLight: class { constructor() { this.position = { set() {} }; } },
  Group: class { constructor() { return mkObj3d(); } },
  Mesh: class { constructor(g, m) { const o = mkObj3d(); o.geometry = g; o.material = m; return o; } },
  CylinderGeometry: class { constructor() {} dispose() {} },
  SphereGeometry: class { constructor() {} dispose() {} },
  BoxGeometry: class { constructor() {} dispose() {} },
  Shape: class { constructor() {} absarc() {} closePath() {} },
  ExtrudeGeometry: class { constructor() {} rotateX() {} translate() {} dispose() {} },
  MeshStandardMaterial: class { constructor() {} dispose() {} },
  MeshBasicMaterial: class { constructor() {} dispose() {} },
  Clock: class { getDelta() { return 0.016; } },
};

// ---- DOM stub ----
function fakeEl(id) {
  return {
    id, textContent: '', innerHTML: '', style: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener() {}, offsetWidth: 0,
    setPointerCapture() {},
    remove() {},
    appendChild(c) { (this._kids = this._kids || []).push(c); },
    removeChild(c) { const k = (this._kids || []).indexOf(c); if (k >= 0) this._kids.splice(k, 1); },
  };
}
function ctx2dStub() {
  const texts = [];
  return {
    texts,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', font: '', textAlign: '', globalAlpha: 1,
    fillRect() {}, save() {}, restore() {}, beginPath() {}, closePath() {},
    arc() {}, stroke() {}, fill() {}, moveTo() {}, lineTo() {},
    fillText(t) { texts.push(String(t)); },
    createLinearGradient() { return { addColorStop() {} }; },
  };
}
function canvasStub() {
  return { width: 0, height: 0, _ctx: null,
           getContext() { return this._ctx || (this._ctx = ctx2dStub()); },
           toBlob(cb) { cb(null); } };
}
const elements = {};
const store = {};
const sandbox = {
  console, JSON, Math, Object, Array, String, Number, setTimeout, clearTimeout,
  requestAnimationFrame: () => {},
  THREE, HDLogic: require(process.env.HOME + '/workspace/html5-games/helix-drop-3d/src/logic.js'),
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  window: { innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, addEventListener() {} },
  document: {
    getElementById: (id) => elements[id] || (elements[id] = fakeEl(id)),
    createElement: (tag) => tag === 'canvas' ? canvasStub() : fakeEl(tag),
    addEventListener() {},
    documentElement: { lang: '' },
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const moduleShim = { exports: {} };
sandbox.module = moduleShim;
vm.runInContext(gameSrc, sandbox);
const G = moduleShim.exports;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' — got ' + g + ', want ' + w); }
}
function ok(name, cond) { eq(name, !!cond, true); }

eq('boot: 14 platforms built', G.state().platforms, 14);
eq('boot: mode menu', G.state().mode, 'menu');

G.newGame();
eq('newGame: mode play', G.state().mode, 'play');
eq('newGame: score 0', G.state().score, 0);

// game-over achievement summary (regression: t('newAch', n) call shape)
G.newGame();
G.die();
G.gameOver();
ok('overAch summary shown for fresh unlock', /🏆/.test(elements['overAch'].textContent));
eq('overAch text', elements['overAch'].textContent, '🏆 1 new achievement!');

// Guided descent: align platform 0's gap under the ball and verify the ball
// actually drops, lands and scores. If the landing sector on platform 1 is a
// kill sector the ball dies instead (valid flow, covered below) — retry with a
// fresh random layout until 5 clean descents are observed.
const SEG = (Math.PI * 2) / 10;
let threw = null, descents = 0, attempts = 0;
try {
  while (descents < 5 && attempts < 15) {
    attempts++;
    G.newGame();
    const gap = G.platTypes(0).indexOf('gap');
    G.setRot(-(gap + 0.5) * SEG); // put the gap under the ball
    let f = 0;
    while (G.state().mode === 'play' && G.state().curIndex === 0 && f++ < 400) {
      G.stepPlay(0.016);
      const st = G.state();
      if (!isFinite(st.ballY) || !isFinite(st.score) || !isFinite(st.rotY))
        throw new Error('non-finite state');
    }
    const s = G.state();
    if (s.mode === 'play' && s.curIndex > 0) {
      descents++;
      if (s.score < 1) throw new Error('descent without score');
    }
    // else: ball died on a kill sector — valid flow, retry fresh
  }
} catch (e) { threw = e; }
if (threw) { fail++; console.log('  FAIL guided descent threw:\n' + (threw && threw.stack ? threw.stack.split('\n').slice(0, 4).join('\n') : threw)); }
else { pass++; console.log('  ok  guided descent: no exception'); }
eq('5 clean descents observed', descents, 5);

// achievements (guided descent above already earned first_drop)
const ach = G.achState();
eq('11 achievements defined', ach.total, 11);
ok('first_drop unlocked by guided descent', ach.unlocked.includes('first_drop'));
G.unlock('marathon');
ok('manual unlock persists', G.achState().unlocked.includes('marathon'));
ok('toast shown for unlock(s)', G.achState().shows >= 1);
G.renderAchGrid();
eq('gallery renders 11 cards', (G.achState().grid.match(/class="achcard/g) || []).length, 11);

// share card (1080x1350)
const card = ctx2dStub();
let cardThrew = null;
try { G.drawShareCard(card); } catch (e) { cardThrew = e; }
eq('share card: no exception', cardThrew, null);
ok('share card: title drawn', card.texts.includes('HELIX DROP 3D'));
ok('share card: score drawn', card.texts.includes(String(G.state().score)));
ok('share card: game URL drawn', card.texts.includes('alamaby.github.io/html5-games/helix-drop-3d/'));

// dying -> over flow
G.newGame();
G.die();
eq('die(): mode dying', G.state().mode, 'dying');
G.gameOver();
const so = G.state();
eq('gameOver(): mode over', so.mode, 'over');
ok('over panel shown (no .hidden)', !elements['over'].classList.contains('hidden'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
