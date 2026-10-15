// Pull the Pin — logic tests: scripted solver must WIN every level with the
// intended pin order. Deterministic physics => reproducible.
'use strict';
const PP = require('../src/logic.js');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' — got ' + g + ', want ' + w); }
}
function ok(name, cond) { eq(name, !!cond, true); }

function runSolver(levelIdx, order) {
  const st = PP.createGame(levelIdx);
  for (const pi of order) {
    if (!PP.pullPin(st, pi)) return { status: 'pull-failed', st };
    for (let f = 0; f < 90; f++) { // 1.5s between pulls
      PP.step(st, 1 / 60);
      if (st.status === 'won' || st.status === 'lost') break;
    }
    if (st.status === 'won' || st.status === 'lost') break;
  }
  for (let f = 0; f < 60 * 14 && st.status !== 'won' && st.status !== 'lost'; f++) {
    PP.step(st, 1 / 60);
  }
  return { status: st.status, st };
}

PP.LEVELS.forEach((L, i) => {
  const r = runSolver(i, L.solve);
  eq('L' + (i + 1) + ' "' + L.name.en + '" solvable (' + L.solve.join(',') + ')', r.status, 'won');
  if (r.status === 'won') {
    ok('L' + (i + 1) + ' cupCount >= target', r.st.cupCount >= L.target);
  }
});

// L2 wrong order must LOSE (order trap)
{
  const r = runSolver(1, [0, 1]);
  eq('L2 wrong order loses', r.status, 'lost');
}

// physics sanity: balls rest on a pin without tunneling
{
  const st = PP.createGame(0);
  for (let f = 0; f < 120; f++) PP.step(st, 1 / 60);
  const ys = st.balls.map((b) => b.y);
  ok('balls rest on pin (no tunneling)', ys.every((y) => y < 360));
  eq('status still aim before pull', st.status, 'aim');
}

// pin pull switches to sim
{
  const st = PP.createGame(0);
  eq('pullPin returns true', PP.pullPin(st, 0), true);
  eq('status sim after pull', st.status, 'sim');
  eq('pullPin twice returns false', PP.pullPin(st, 0), false);
}

// pinpull event must survive PP.step (frame order: tap -> step -> drainEvents).
// Regression: step() used to wipe st.events, killing the pin slide animation.
{
  const st = PP.createGame(0);
  PP.pullPin(st, 0);
  PP.step(st, 1 / 60);
  ok('pinpull event survives step', st.events.some((e) => e.t === 'pinpull'));
}

// bomb in cup = instant loss
{
  const st = PP.createGame(0);
  st.balls.push({ x: st.cup.x, y: st.cup.y - 30, px: st.cup.x, py: st.cup.y - 30,
                  vx: 0, vy: 400, kind: 'bomb', state: 'active' });
  PP.pullPin(st, 0);
  for (let f = 0; f < 120 && st.status !== 'lost'; f++) PP.step(st, 1 / 60);
  eq('bomb in cup loses', st.status, 'lost');
}

// bomb-good contact explodes both
{
  const st = PP.createGame(0);
  st.balls = [
    { x: 200, y: 300, px: 200, py: 300, vx: 60, vy: 0, kind: 'good', state: 'active' },
    { x: 230, y: 300, px: 230, py: 300, vx: -60, vy: 0, kind: 'bomb', state: 'active' },
  ];
  st.pins = [];
  for (let f = 0; f < 120; f++) PP.step(st, 1 / 60);
  eq('bomb-good contact destroys both', st.exploded, 1);
  ok('both dead', st.balls.every((b) => b.state === 'dead'));
}

// level count + data integrity
eq('5 levels', PP.LEVELS.length, 5);
ok('every level has solve order', PP.LEVELS.every((L) => Array.isArray(L.solve) && L.solve.length > 0));
ok('every level has bilingual name+hint',
   PP.LEVELS.every((L) => L.name.en && L.name.id && L.hint.en && L.hint.id));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
