// Tol Rush 3D — logic tests (Node, no DOM / no THREE).
'use strict';
const TR = require('../src/logic.js');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' — got ' + g + ', want ' + w); }
}
function ok(name, cond) { eq(name, !!cond, true); }
function quiet(st) { st.spawnT = 9999; }

// Boot + lane snap
{
  const st = TR.createGame(); quiet(st);
  eq('starts centre lane', st.player.lane, 1);
  eq('starts 3 HP', st.hp, 3);
  eq('route 5000 m', TR.ROUTE_LEN, 5000);
  ok('move right accepted', TR.moveLane(st, 1));
  for (let i = 0; i < 30; i++) TR.step(st, 1 / 60);
  eq('player settled in right lane', st.player.lane, 2);
  ok('move beyond edge rejected', !TR.moveLane(st, 1));
  eq('edge lane kept', st.player.targetLane, 2);
}

// Distance + speed rise, no traffic interference
{
  const st = TR.createGame(); quiet(st);
  for (let i = 0; i < 600; i++) TR.step(st, 1 / 60);
  ok('covers ground in 10 s', st.dist > 200 && st.dist < 300);
  ok('speed rises with distance', st.speed > 20);
  ok('score tracks distance', st.score >= Math.floor(st.dist));
}

// Brake slows the car
{
  const a = TR.createGame(); quiet(a);
  const b = TR.createGame(); quiet(b);
  TR.setBrake(b, true);
  for (let i = 0; i < 300; i++) { TR.step(a, 1 / 60); TR.step(b, 1 / 60); }
  ok('braking covers less distance', b.dist < a.dist * 0.8);
}

// Spawn wall rule: never a 3-lane wall within one window
{
  const st = TR.createGame(); quiet(st);
  const v0 = TR.spawnVehicle(st, { lane: 0, gapAhead: 180, kind: 'sedan', speed: 15 });
  const v1 = TR.spawnVehicle(st, { lane: 1, gapAhead: 180, kind: 'sedan', speed: 15 });
  ok('first two lanes spawn', !!v0 && !!v1);
  const v2 = TR.spawnVehicle(st, { lane: 2, gapAhead: 180, kind: 'sedan', speed: 15 });
  eq('third lane in same window blocked', v2, null);
  const vFar = TR.spawnVehicle(st, { lane: 2, gapAhead: 260, kind: 'sedan', speed: 15 });
  ok('third lane further away allowed', !!vFar);
}

// Same-lane proximity rule
{
  const st = TR.createGame(); quiet(st);
  TR.spawnVehicle(st, { lane: 1, gapAhead: 180, kind: 'sedan', speed: 15 });
  eq('same-lane close spawn blocked', TR.spawnVehicle(st, { lane: 1, gapAhead: 200, kind: 'sedan', speed: 15 }), null);
}

// Lane change: signal first, then move; never into player's close lane
{
  const st = TR.createGame(); quiet(st);
  const v = TR.spawnVehicle(st, { lane: 0, gapAhead: 30, kind: 'sedan', speed: 15 });
  ok('player-close lane change blocked', !TR.canChangeLane(st, v, 1));
  const far = TR.spawnVehicle(st, { lane: 0, gapAhead: 300, kind: 'sedan', speed: 15 });
  // move the first car out of the way for a clean far-car check
  far.s = st.dist + 300;
  ok('far lane change allowed', TR.canChangeLane(st, far, 1));
  far.targetLane = 1; far.signalT = TR.SIGNAL_TIME;
  const xBefore = far.x;
  for (let i = 0; i < 30; i++) TR.step(st, 1 / 60); // 0.5 s: still signalling
  eq('no movement during signal', far.x, xBefore);
  for (let i = 0; i < 120; i++) TR.step(st, 1 / 60);
  eq('car finished in target lane', far.lane, 1);
}

// Crash costs 1 HP, invulnerability prevents a double hit, 3rd crash ends run
{
  const st = TR.createGame(); quiet(st);
  function hit() {
    const v = TR.spawnVehicle(st, { lane: 1, gapAhead: 3, kind: 'sedan', speed: 15 });
    v.s = st.dist + 1; // overlap the player
    TR.step(st, 1 / 60);
  }
  hit(); eq('1st crash -> 2 HP', st.hp, 2);
  hit(); eq('invuln blocks 2nd instant crash', st.hp, 2);
  for (let i = 0; i < 180; i++) TR.step(st, 1 / 60); // 3 s: invuln gone
  hit(); eq('2nd real crash -> 1 HP', st.hp, 1);
  for (let i = 0; i < 180; i++) TR.step(st, 1 / 60);
  hit(); eq('3rd crash -> 0 HP', st.hp, 0);
  eq('run over after 3rd crash', st.status, 'over');
}

// Near-miss: adjacent overtake pays combo bonus and nitro
{
  const st = TR.createGame(); quiet(st);
  const v = TR.spawnVehicle(st, { lane: 0, gapAhead: 6, kind: 'sedan', speed: 10 });
  v.s = st.dist + 6;
  for (let i = 0; i < 120; i++) TR.step(st, 1 / 60);
  ok('near-miss event fired', st.events.some((e) => e.t === 'near'));
  eq('combo after one near-miss', st.combo, 1);
  ok('nitro topped up', st.nitro > 50);
}

// Rest area: window, heal, bonus, missed
{
  const st = TR.createGame(); quiet(st);
  ok('rest too early rejected', !TR.tryRest(st));
  st.dist = TR.REST_AT - 100;
  TR.step(st, 1 / 60);
  eq('rest window opens', st.rest, 'open');
  st.hp = 1;
  ok('rest accepted in window', TR.tryRest(st));
  eq('rest heals to full', st.hp, 3);
  eq('rest used', st.rest, 'used');
  ok('rest bonus applied', st.bonus >= 250);

  const st2 = TR.createGame(); quiet(st2);
  st2.dist = TR.REST_AT + TR.REST_CLOSE_AFTER + 50;
  TR.step(st2, 1 / 60);
  eq('rest missed after window', st2.rest, 'missed');
  ok('missed rest rejected', !TR.tryRest(st2));
}

// Finish: reaching the exit wins and pays the finish bonus
{
  const st = TR.createGame(); quiet(st);
  st.dist = TR.ROUTE_LEN - 5;
  for (let i = 0; i < 120 && st.status === 'play'; i++) TR.step(st, 1 / 60);
  eq('reaching exit finishes', st.status, 'finished');
  ok('finish bonus applied', st.bonus >= 500 + 3 * 200);
  ok('finish event fired', st.events.some((e) => e.t === 'finish'));
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
