// Neon Dodge — logic tests.
'use strict';
const ND = require('../src/logic.js');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' — got ' + g + ', want ' + w); }
}
function ok(name, cond) { eq(name, !!cond, true); }

// boot + target clamp
{
  const st = ND.createGame();
  eq('status play', st.status, 'play');
  ND.setTarget(st, -100, 9999);
  eq('target clamped x', st.player.tx, 24);
  eq('target clamped y', st.player.ty, ND.H - 40);
}

// player follows target
{
  const st = ND.createGame();
  ND.setTarget(st, 100, 300);
  for (let f = 0; f < 120; f++) ND.step(st, 1 / 60);
  ok('player reaches target', Math.hypot(st.player.x - 100, st.player.y - 300) < 4);
}

// score accumulates ~10/s
{
  const st = ND.createGame();
  st.spawnT = 9999; // no spawns
  for (let f = 0; f < 600; f++) ND.step(st, 1 / 60);
  ok('score ~100 after 10s', Math.abs(st.score - 100) < 2);
}

// difficulty ramps
{
  const d0 = ND.difficulty(0), d60 = ND.difficulty(60), d120 = ND.difficulty(120);
  ok('interval shrinks', d60.interval < d0.interval);
  ok('interval floored', d120.interval === 0.32);
  ok('speed grows', d60.speed > d0.speed);
  ok('speed capped', d120.speed === 720);
}

// collision -> dying -> over
{
  const st = ND.createGame();
  ND.setTarget(st, 210, 620);
  for (let f = 0; f < 30; f++) ND.step(st, 1 / 60); // let player settle
  st.obstacles.push({ kind: 'orb', x: st.player.x, y: st.player.y - 5, vx: 0, vy: 50,
                      r: 14, hue: 0, scored: false, ph: 0 });
  ND.step(st, 1 / 60);
  eq('collision -> dying', st.status, 'dying');
  ok('die event', st.events.some((e) => e.t === 'die'));
  for (let f = 0; f < 60; f++) ND.step(st, 1 / 60);
  eq('dying -> over', st.status, 'over');
  ok('over event', st.events.some((e) => e.t === 'over'));
}

// near miss: orb passes 40px to the side
{
  const st = ND.createGame();
  ND.setTarget(st, 210, 620);
  for (let f = 0; f < 30; f++) ND.step(st, 1 / 60);
  st.spawnT = 9999;
  const px = st.player.x, py = st.player.y;
  st.obstacles.push({ kind: 'orb', x: px + 40, y: py - 100, vx: 0, vy: 300,
                      r: 14, hue: 0, scored: false, ph: 0 });
  const s0 = st.score;
  for (let f = 0; f < 120 && st.status === 'play'; f++) ND.step(st, 1 / 60);
  eq('near miss counted', st.nearMiss, 1);
  ok('near miss bonus', st.score > s0 + 20);
  eq('still alive', st.status, 'play');
}

// far pass: no near miss
{
  const st = ND.createGame();
  ND.setTarget(st, 210, 620);
  for (let f = 0; f < 30; f++) ND.step(st, 1 / 60);
  st.spawnT = 9999;
  st.obstacles.push({ kind: 'orb', x: st.player.x + 200, y: st.player.y - 100, vx: 0, vy: 300,
                      r: 14, hue: 0, scored: false, ph: 0 });
  for (let f = 0; f < 120 && st.status === 'play'; f++) ND.step(st, 1 / 60);
  eq('far pass: no near miss', st.nearMiss, 0);
}

// 60s stability sim with moving target, no exceptions
{
  const st = ND.createGame();
  let threw = null;
  try {
    for (let f = 0; f < 3600; f++) {
      ND.setTarget(st, 210 + Math.sin(f * 0.02) * 150, 620);
      ND.step(st, 1 / 60);
      if (st.status === 'over') break;
      for (const o of st.obstacles) {
        if (!isFinite(o.x) || !isFinite(o.y)) throw new Error('non-finite obstacle');
      }
    }
  } catch (e) { threw = e && e.message; }
  eq('60s sim: no exception', threw, null);
  ok('obstacles cleaned up', st.obstacles.length < 60);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
