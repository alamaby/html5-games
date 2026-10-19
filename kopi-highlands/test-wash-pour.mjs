// Regression test: wash-pour deadlock (laporan user 2026-10-19 — stuck di pad,
// keranjang 40/40, hint wash muncul, channel kosong).
// Me-replay HutSys.update ASLI (diekstrak verbatim dari src/game.js) dengan stub.
import { readFileSync } from 'fs';
import * as THREE from './vendor/three.module.min.js';

const GAME_SRC = process.env.GAME_SRC || './src/game.js';
const src = readFileSync(GAME_SRC, 'utf8');

// --- ekstrak objek HutSys verbatim (balanced braces dari "const HutSys = {") ---
function extractObj(name) {
  const start = src.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(name + ' tidak ketemu');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

// --- stub minimal ---
const V3 = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
global._v1 = V3(); global._v3 = V3(); global._v4 = V3();

const CFG = { HUT_RADIUS: 2.6 };
global.CFG = CFG;

const BasketSys = { count: 40, get full() { return this.count >= 40; },
  reset() { this.count = 0; } };
global.BasketSys = BasketSys;

const WashSys = {
  _pouring: false, _flowing: false,
  pourQueue: new Array(40).fill(true), pourLen: 0,
  POUR: V3(9.5, 0, 9.1),
  busy() { return this._pouring || this._flowing; },
  beginPour() { this._pouring = true; this.pourLen = Math.min(BasketSys.count, 40); },
  endPour() { this._pouring = false; this._flowing = true; this.endPourCalled = true; },
  onPourArrived() {},
  endPourCalled: false,
};
global.WashSys = WashSys;

const Player = { pos: V3(11.1, 0, 9.1), basketCherries: { count: 40 },
  basketWorld(out) { return out.set(0, 1.35, -0.42); } };
global.Player = Player;

const World = { hutPos: V3(11.1, 0, 9.1),
  hutPad: { scale: { set(){} }, material: { opacity: 0 } } };
global.World = World;

// Flyers stub: spawn sukses & arrival sinkron (simulasi flyer selesai instan)
let spawned = 0;
const Flyers = { spawn() { spawned++; WashSys.onPourArrived(true); HutSys.pourInflight--; return true; } };
global.Flyers = Flyers;

const AudioSys = { splash(){} };
global.AudioSys = AudioSys;
const Hud = { set dirty(v){} };
global.Hud = Hud;
// project() butuh kamera asli; stub jadi no-op untuk test logika
THREE.Vector3.prototype.project = function(){ return this; };
global.Engine = { camera: {} };
global.window = { innerWidth: 400, innerHeight: 800 };

// --- eval HutSys asli (kembalikan objeknya; eval module-scope tidak leak binding) ---
const hutSrc = extractObj('HutSys');
const HutSys = eval(hutSrc + '\n;HutSys;');
HutSys.markerEl = { style: {} };
HutSys.pouring = false; HutSys.pourAcc = 0; HutSys.pourInflight = 0;

// sanity: pastikan kode yang di-fix ada
if (!hutSrc.includes('|| this.pouring')) {
  console.log('FAIL: fix belum ada di HutSys.update');
  process.exit(1);
}

// --- replay: 40 frame @60fps berdiri di pad ---
const dt = 1/60, now0 = 100;
for (let f = 0; f < 600; f++) HutSys.update(dt, now0 + f * dt);

console.log('flyers spawned:', spawned);
console.log('BasketSys.count:', BasketSys.count);
console.log('WashSys.endPour called:', WashSys.endPourCalled);
console.log('WashSys.pouring:', WashSys._pouring, '| flowing:', WashSys._flowing);

let ok = true;
if (BasketSys.count !== 0) { console.log('FAIL: keranjang tidak kosong (deadlock!)'); ok = false; }
if (!WashSys.endPourCalled) { console.log('FAIL: endPour tidak pernah dipanggil'); ok = false; }
if (spawned < 40) { console.log('FAIL: flyer kurang dari 40'); ok = false; }
console.log(ok ? 'PASS: pour selesai tanpa deadlock' : 'FAIL');
process.exit(ok ? 0 : 1);
