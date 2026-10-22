// Headless logic tests Fase 3 (Empire): formula biaya upgrade, efek upgrade,
// picker menghasilkan cherry tanpa pemain, offline earnings (cap 8 jam,
// doubler 2x), save lama Fase 2 -> load aman, batch roast per zona.
// Pola sama dengan test-wash-pour.mjs: ekstrak objek ASLI dari src/game.js.
import { readFileSync } from 'fs';
import * as THREE from './vendor/three.module.min.js';

const src = readFileSync(process.env.GAME_SRC || './src/game.js', 'utf8');

function extract(name, openCh, closeCh) {
  const start = src.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(name + ' tidak ketemu');
  let i = src.indexOf(openCh, start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === openCh) depth++;
    else if (src[i] === closeCh) { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
const extractObj = n => extract(n, '{', '}');

// --- stub global yang dirujuk metode-metode yang diuji ---
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};
global.document = { getElementById: () => null };
global.AudioSys = { pop() {}, click() {}, error() {}, upgrade() {}, cash() {}, splash() {} };
global.Hud = { dirty: false };
global.Player = { pos: { x: 0, z: 0 }, basketCherries: { count: 0 }, basketWorld(o) { return o; } };
global.Particles = { burst() {} };
global.Floaters = { spawn() {} };
global._dummy = new THREE.Object3D();

// World stub: 20 cherry matang zona 0 di sekitar pad; _setState asli-ala
const cherries = [];
for (let i = 0; i < 20; i++) {
  cherries.push({
    idx: i, inst: i, state: 3, at: 0, zone: 0,
    pos: new THREE.Vector3(10 + (i % 5) * 1.2, 1.1, 5 + Math.floor(i / 5) * 1.2),
    cluster: null,
  });
}
const washCalls = [];
global.World = {
  cherries,
  stations: [
    { zi: 0, padPos: new THREE.Vector3(11.1, 0, 9.1) },
    { zi: 1, padPos: new THREE.Vector3(49.1, 0, 9.1) },
    { zi: 2, padPos: new THREE.Vector3(87.1, 0, 9.1) },
  ],
  _setState(ch, st, at) { ch.state = st; ch.at = at; },
  activateZone() {},
};
global.WashSys = {
  beginPourBatch(good, defect, quality, zone) {
    washCalls.push({ good, defect, quality, zone });
    return true;
  },
  busy() { return false; },
};

// --- eval semua objek asli dalam satu scope ---
const prelude = `
let lang = 'en';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const t = k => k;
`;
const body = [
  extractObj('CFG'), extract('ZONES', '[', ']'),
  extractObj('SaveSys'), extractObj('UpgradeSys'), extractObj('OfflineSys'),
  extractObj('BasketSys'), extractObj('DrySys'), extractObj('PickerSys'),
].join('\n');
const M = eval(prelude + body +
  '\n;({ CFG, ZONES, SaveSys, UpgradeSys, OfflineSys, BasketSys, DrySys, PickerSys });');
const { CFG, ZONES, SaveSys, UpgradeSys, OfflineSys, BasketSys, DrySys, PickerSys } = M;

let fails = 0;
function eq(actual, expected, label) {
  const ok = Object.is(actual, expected) || Math.abs(actual - expected) < 1e-9;
  if (!ok) { console.log('FAIL:', label, '-> got', actual, 'want', expected); fails++; }
  else console.log('ok:', label);
}
function ok(cond, label) { if (!cond) { console.log('FAIL:', label); fails++; } else console.log('ok:', label); }

/* ---------- 1. formula biaya: Math.floor(BaseCost * 1.18^level) ---------- */
const expectCost = {
  pickSpeed: [50, 59, 69, 82, 96], basketCap: [75, 88, 104, 123, 145],
  dryerSpeed: [60, 70, 83, 98, 116], drumStability: [80, 94, 111, 131, 155],
  channelFlow: [60, 70, 83, 98, 116], picker: [150, 177, 208],
};
for (const key of Object.keys(expectCost)) {
  for (let lv = 0; lv < expectCost[key].length; lv++) {
    SaveSys.data.upg[key] = lv;
    eq(UpgradeSys.costOf(key), expectCost[key][lv], `cost ${key} lvl${lv}`);
    eq(UpgradeSys.costOf(key), Math.floor(UpgradeSys.defOf(key).base * Math.pow(1.18, lv)), `formula ${key} lvl${lv}`);
  }
  SaveSys.data.upg[key] = 0;
}

/* ---------- 2. efek upgrade (lvl 0 = perilaku Fase 2) ---------- */
eq(UpgradeSys.basketCap(), 40, 'basketCap lvl0 = 40');
SaveSys.data.upg.basketCap = 5; eq(UpgradeSys.basketCap(), 80, 'basketCap lvl5 = 80');
SaveSys.data.upg.basketCap = 0;
eq(UpgradeSys.pickCycle(), CFG.PICK_CYCLE, 'pickCycle lvl0 = 1.2');
SaveSys.data.upg.pickSpeed = 5;
ok(Math.abs(UpgradeSys.pickCycle() - 1.2 * Math.pow(0.92, 5)) < 1e-9, 'pickCycle lvl5 = 1.2*0.92^5');
SaveSys.data.upg.pickSpeed = 0;
eq(UpgradeSys.dryTime(), CFG.DRY_TIME, 'dryTime lvl0 = 20');
SaveSys.data.upg.dryerSpeed = 5;
ok(Math.abs(UpgradeSys.dryTime() - 20 * Math.pow(0.85, 5)) < 1e-9, 'dryTime lvl5');
SaveSys.data.upg.dryerSpeed = 0;
eq(UpgradeSys.flowTime(), CFG.WASH_FLOW_TIME, 'flowTime lvl0 = 6');
eq(UpgradeSys.greenLo(), 150, 'greenLo lvl0 = 150');
eq(UpgradeSys.greenHi(), 225, 'greenHi lvl0 = 225');
SaveSys.data.upg.drumStability = 5;
eq(UpgradeSys.greenLo(), 135, 'greenLo lvl5 = 135');
eq(UpgradeSys.greenHi(), 250, 'greenHi lvl5 = 250');
SaveSys.data.upg.drumStability = 0;
// BasketSys memakai cap efektif
SaveSys.data.upg.basketCap = 2; eq(BasketSys.cap(), 56, 'BasketSys.cap lvl2 = 56');
SaveSys.data.upg.basketCap = 0;

/* ---------- 3. alur beli (deduct, max, dana kurang) ---------- */
UpgradeSys.cashEl = { textContent: '' };
UpgradeSys.listEl = { innerHTML: '', querySelectorAll: () => [] };
SaveSys.data.cash = 1000;
UpgradeSys.buy('pickSpeed');
eq(SaveSys.data.upg.pickSpeed, 1, 'buy pickSpeed -> lvl1');
eq(SaveSys.data.cash, 950, 'buy pickSpeed -> cash 950');
SaveSys.data.cash = 10;
UpgradeSys.buy('pickSpeed');
eq(SaveSys.data.upg.pickSpeed, 1, 'dana kurang -> tidak naik level');
SaveSys.data.cash = 100000;
SaveSys.data.upg.picker = 3;
UpgradeSys.buy('picker');
eq(SaveSys.data.upg.picker, 3, 'picker sudah maks -> tetap 3');

/* ---------- 4. picker menghasilkan cherry TANPA pemain ---------- */
SaveSys.data.upg.picker = 1;
SaveSys.data.stats.picked = 0;
PickerSys.im = { setMatrixAt() {}, setColorAt() {}, instanceMatrix: {}, instanceColor: {} };
PickerSys.spawn();
eq(PickerSys.pickers.length, 1, 'picker spawn');
const dt = 1 / 60;
for (let f = 0; f < 60 * 120; f++) PickerSys.update(dt);   // 120 detik idle
const delivered = washCalls.reduce((s, c) => s + c.good, 0);
ok(washCalls.length >= 1, 'picker men-deliver ke wash (beginPourBatch terpanggil)');
eq(delivered, 20, 'semua 20 cherry matang ter-deliver picker');
eq(SaveSys.data.stats.picked, 20, 'stats.picked bertambah 20 dari picker');
ok(washCalls.every(c => c.quality === 100 && c.zone === 0), 'batch picker quality 100 zona 0');

/* ---------- 5. offline earnings ---------- */
SaveSys.data.upg.picker = 2;
SaveSys.data.zones = [true, true, false];       // terbaik terbuka: Robusta $20
const now = 1700000000000;
SaveSys.data.lastSave = now - 4 * 3600 * 1000;  // pergi 4 jam
let r = OfflineSys.compute(now);
eq(r.sec, 14400, 'offline 4 jam -> 14400 dtk');
ok(Math.abs(r.gain - 14400 * (2 * 0.20 * 20 / 60)) < 0.01, 'gain 4 jam = 14400 * rate ($' + r.gain.toFixed(2) + ')');
SaveSys.data.lastSave = now - 24 * 3600 * 1000; // pergi 24 jam -> cap 8 jam
r = OfflineSys.compute(now);
eq(r.sec, 28800, 'offline 24 jam -> cap 28800 dtk (8 jam)');
ok(Math.abs(r.gain - 28800 * (2 * 0.20 * 20 / 60)) < 0.01, 'gain cap 8 jam');
SaveSys.data.upg.picker = 0;
r = OfflineSys.compute(now);
eq(r.gain, 0, 'tanpa picker -> gain 0');
SaveSys.data.cash = 0;
OfflineSys.gain = 100; OfflineSys.modalEl = null;
OfflineSys.collect(2);                          // doubler 2x
eq(SaveSys.data.cash, 200, 'collect(2) -> 2x lipat masuk cash');

/* ---------- 6. save lama Fase 2 -> load aman ---------- */
store[CFG.SAVE_KEY] = JSON.stringify({
  v: 1, cash: 250.5, lang: 'id',
  stats: { picked: 500, perfect: 40, strips: 9, sold: 3, bestQ: 97 },
  sacks: 3, sackValue: 36, defect: 2, dryCount: 15, dryQSum: 1400, lastSave: 123456,
});   // TANPA field upg/zones/dryZones (save Fase 2 murni)
SaveSys.load();
eq(SaveSys.data.cash, 250.5, 'save lama: cash utuh');
eq(SaveSys.data.sacks, 3, 'save lama: sacks utuh');
eq(SaveSys.data.upg.picker, 0, 'save lama: upg default 0');
eq(SaveSys.data.upg.basketCap, 0, 'save lama: basketCap default 0');
ok(SaveSys.data.zones[0] === true && SaveSys.data.zones[1] === false && SaveSys.data.zones[2] === false,
  'save lama: zona default [true,false,false]');
eq(SaveSys.data.dryZones[0].c, 15, 'save lama: hopper lama migrasi ke zona 0');
eq(SaveSys.data.dryZones[0].q, 1400, 'save lama: qSum hopper migrasi');
eq(SaveSys.data.dryZones[1].c, 0, 'save lama: zona 1 kosong');
// nilai rusak di-clamp
store[CFG.SAVE_KEY] = JSON.stringify({ v: 1, cash: 5, upg: { picker: 99, basketCap: -3, pickSpeed: 2 }, zones: [false, true] });
SaveSys.load();
eq(SaveSys.data.upg.picker, 3, 'clamp picker 99 -> 3');
eq(SaveSys.data.upg.basketCap, 0, 'clamp basketCap -3 -> 0');
eq(SaveSys.data.upg.pickSpeed, 2, 'pickSpeed sah dipertahankan');
ok(SaveSys.data.zones[0] === true && SaveSys.data.zones[1] === true, 'zones[0] dipaksa true, zones[1] terbaca');

/* ---------- 7. batch roast per zona (harga ikut zona asal) ---------- */
DrySys.hop = [{ c: 5, q: 500 }, { c: 20, q: 1800 }, { c: 0, q: 0 }];
DrySys.syncTotals();
const b1 = DrySys.takeBatch();
eq(b1.zone, 1, 'takeBatch pilih zona stok terbanyak (Robusta)');
eq(b1.n, 20, 'takeBatch n = 20');
eq(b1.q, 90, 'takeBatch q rata-rata 90');
eq(ZONES[b1.zone].price, 20, 'harga karung batch = $20 (Robusta)');
eq(DrySys.takeBatch(), null, 'sisa zona < 12 -> tidak ada batch');
const b2 = (() => { DrySys.hop[2] = { c: 30, q: 3000 }; DrySys.syncTotals(); return DrySys.takeBatch(); })();
eq(b2.zone, 2, 'takeBatch Liberika');
eq(b2.n, 24, 'takeBatch dibatasi ROAST_MAX_BEANS 24');
eq(ZONES[b2.zone].price, 35, 'harga karung Liberika $35');

console.log(fails === 0 ? '\nALL PASS' : '\n' + fails + ' FAIL');
process.exit(fails === 0 ? 0 : 1);
