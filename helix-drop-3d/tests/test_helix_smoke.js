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
    appendChild(c) { (this._kids = this._kids || []).push(c); },
    removeChild(c) { const k = (this._kids || []).indexOf(c); if (k >= 0) this._kids.splice(k, 1); },
  };
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

// Simulate play: wiggle rotation, step physics. Must not throw; state stays finite.
let threw = null, sawScore = false, sawLand = false;
try {
  for (let f = 0; f < 1500; f++) {
    G.setRot(Math.sin(f * 0.05) * 2.5); // gentle rotation wiggle
    G.stepPlay(0.016);
    const s = G.state();
    if (!isFinite(s.ballY) || !isFinite(s.score) || !isFinite(s.rotY)) throw new Error('non-finite state at frame ' + f);
    if (s.score > 0) sawScore = true;
    if (s.curIndex > 0) sawLand = true;
    if (s.mode !== 'play') break;
  }
} catch (e) { threw = e; }
eq('1500 frames: no exception', threw, null);
ok('ball eventually landed below start (curIndex>0) or scored', sawLand || sawScore);

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
