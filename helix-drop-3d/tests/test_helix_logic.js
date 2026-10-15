// Unit tests for helix-drop-3d pure logic (src/logic.js). Run: node tests/test_helix_logic.js
const HD = require(process.env.HOME + '/workspace/html5-games/helix-drop-3d/src/logic.js');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' — got ' + g + ', want ' + w); }
}

// --- genPlatform ---
let p0 = HD.genPlatform(0, mulberry32(1));
eq('p0: 10 sectors', p0.length, 10);
eq('p0: 1 gap', HD.countType(p0, 'gap'), 1);
eq('p0: 0 kills (tutorial)', HD.countType(p0, 'kill'), 0);
eq('p0: spawn sector 0 safe', p0[0], 'safe');

for (const seed of [1, 2, 3, 42, 999]) {
  const p5 = HD.genPlatform(5, mulberry32(seed));
  eq(`p5 seed${seed}: 1 gap 1 kill`, [HD.countType(p5, 'gap'), HD.countType(p5, 'kill')].join(','), '1,1');
  const p15 = HD.genPlatform(15, mulberry32(seed));
  eq(`p15 seed${seed}: 1 gap 2 kills`, [HD.countType(p15, 'gap'), HD.countType(p15, 'kill')].join(','), '1,2');
  const p30 = HD.genPlatform(30, mulberry32(seed));
  eq(`p30 seed${seed}: 1 gap 3 kills`, [HD.countType(p30, 'gap'), HD.countType(p30, 'kill')].join(','), '1,3');
  // kill sectors keep distance >= 2 from the gap (fair landing zone)
  const gap = p5.indexOf('gap');
  for (let s = 0; s < 10; s++) {
    if (p5[s] !== 'kill') continue;
    const d = Math.min((s - gap + 10) % 10, (gap - s + 10) % 10);
    eq(`p5 seed${seed}: kill@${s} dist>=2 from gap@${gap}`, d >= 2, true);
  }
}

// --- sectorAt ---
const types = ['safe', 'kill', 'gap', 'safe', 'safe', 'safe', 'safe', 'safe', 'safe', 'safe'];
const seg = HD.TAU / 10;
eq('sectorAt rotY=0 -> sector 0', HD.sectorAt(types, 0), 'safe');
eq('sectorAt rotY=-seg -> sector 1', HD.sectorAt(types, -seg), 'kill');
eq('sectorAt rotY=-2seg -> sector 2', HD.sectorAt(types, -2 * seg), 'gap');
eq('sectorAt wraps large rotY', HD.sectorAt(types, 100 * HD.TAU + 0.05), HD.sectorAt(types, 0.05));
eq('sectorAt negative wrap', HD.sectorAt(types, -100 * HD.TAU - seg), 'kill');

// --- fallScore ---
eq('fallScore(1)=1', HD.fallScore(1), 1);
eq('fallScore(2)=2', HD.fallScore(2), 2);
eq('fallScore(3)=6 (3+3 bonus)', HD.fallScore(3), 6);
eq('fallScore(5)=10', HD.fallScore(5), 10);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
