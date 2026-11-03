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
  eq('rest window opens', !!TR.openRestStop(st), true);
  st.hp = 1;
  ok('rest accepted in window', TR.tryRest(st));
  eq('rest heals to full', st.hp, 3);
  eq('rest used', st.restStops[0].state, 'used');
  ok('rest bonus applied', st.bonus >= 250);

  const st2 = TR.createGame(); quiet(st2);
  st2.dist = TR.REST_AT + TR.REST_CLOSE_AFTER + 50;
  TR.step(st2, 1 / 60);
  eq('rest missed after window', st2.restStops[0].state, 'missed');
  ok('missed rest rejected', !TR.tryRest(st2));
}

// Long route: 10 km, 2 rest areas, no finish at the old 5 km mark
{
  const st = TR.createGame({ mode: 'long' }); quiet(st);
  eq('long route length', st.routeLen, 10000);
  eq('long route rest stops', st.restStops.map((s) => s.at).join(','), '3000,6500');
  st.dist = 4990;
  for (let i = 0; i < 120 && st.status === 'play'; i++) TR.step(st, 1 / 60);
  ok('long route not finished at 5 km', st.status === 'play' && st.dist > 5000);
  // first rest area usable, second still upcoming
  const st3 = TR.createGame({ mode: 'long' }); quiet(st3);
  st3.dist = 2950;
  TR.step(st3, 1 / 60);
  ok('long first rest opens', !!TR.openRestStop(st3));
  ok('long first rest accepted', TR.tryRest(st3));
  eq('long second rest still upcoming', st3.restStops[1].state, 'upcoming');
}

// Endless: no finish past 5 km, rest areas keep recurring
{
  const st = TR.createGame({ mode: 'endless' }); quiet(st);
  eq('endless route length', st.routeLen, Infinity);
  st.dist = 4990;
  for (let i = 0; i < 300 && st.status === 'play'; i++) TR.step(st, 1 / 60);
  ok('endless never finishes', st.status === 'play' && st.dist > 5000);
  ok('endless rest stops recur', st.restStops.length > 1 && st.restStops[st.restStops.length - 1].at > st.dist);
  // unknown mode falls back to short
  const st2 = TR.createGame({ mode: 'nope' }); quiet(st2);
  eq('unknown mode falls back to short', st2.mode, 'short');
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

// Fuel: drains per metre, nitro burns double, braking sips, empty = crawl
{
  function runWith(flag, seconds) {
    const st = TR.createGame(); quiet(st);
    if (flag === 'nitro') TR.setNitro(st, true);
    if (flag === 'brake') TR.setBrake(st, true);
    for (let i = 0; i < seconds * 60; i++) TR.step(st, 1 / 60);
    return st;
  }
  const normal = runWith('normal', 10);
  const nitro = runWith('nitro', 10);
  const brake = runWith('brake', 10);
  ok('fuel drains over distance', normal.fuel < 100 && normal.fuel > 90);
  ok('nitro drains more than normal', nitro.fuel < normal.fuel);
  ok('braking drains less than normal', brake.fuel > normal.fuel);
  ok('fuel low warning fires', normal.fuel <= 100); // flag path covered below
  const low = TR.createGame(); quiet(low);
  low.fuel = 20; low.fuelLow = false;
  TR.step(low, 1 / 60);
  ok('fuelLow event at 25%', low.events.some((e) => e.t === 'fuelLow'));
  const empty = TR.createGame(); quiet(empty);
  empty.fuel = 0;
  TR.step(empty, 1 / 60);
  eq('empty tank crawls at 8 m/s', empty.speed, 8);
}

// Fuel pickup: same lane collects +30 and +25 bonus; rest refills fuel
{
  const st = TR.createGame(); quiet(st);
  st.fuel = 50;
  st.pickups.push({ lane: 1, s: st.dist + 6, x: 0, taken: false });
  for (let i = 0; i < 60; i++) TR.step(st, 1 / 60);
  eq('pickup collected', st.pickups.length, 0);
  ok('pickup refills fuel', st.fuel > 50);
  ok('pickup pays bonus', st.bonus >= 25);
  ok('fuel event fired', st.events.some((e) => e.t === 'fuel'));

  const st2 = TR.createGame(); quiet(st2);
  st2.dist = TR.REST_AT - 100;
  TR.step(st2, 1 / 60);
  st2.fuel = 20; st2.hp = 1;
  ok('rest accepted with low fuel', TR.tryRest(st2));
  eq('rest refills fuel to full', st2.fuel, st2.maxFuel);
  eq('rest heals to max HP', st2.hp, st2.maxHp);
}

// Upgrades: handling / brake / armor / tank, clamped to max level
{
  const up = TR.createGame({ upgrades: { handling: 3, brake: 3, armor: 2, tank: 2 } });
  eq('handling lvl3 move time', up.moveTime, 0.13);
  eq('brake lvl3 factor', up.brakeFactor, 0.34);
  eq('armor lvl2 max HP', up.maxHp, 5);
  eq('armor lvl2 HP', up.hp, 5);
  eq('tank lvl2 max fuel', up.maxFuel, 140);
  eq('tank lvl2 fuel', up.fuel, 140);
  const over = TR.createGame({ upgrades: { handling: 99, brake: 99, armor: 99, tank: 99 } });
  eq('levels clamped to 3', over.upgrades.handling, 3);
  eq('armor clamped HP', over.maxHp, 6);
  const def = TR.createGame();
  eq('no upgrades = defaults', def.moveTime, 0.22);
  eq('no upgrades brake', def.brakeFactor, 0.55);
}

// Conditions: day default, night shortens sight range, rain slows snap + weakens brakes
{
  const day = TR.createGame();
  eq('default condition is day', day.condition, 'day');
  eq('day sight range', day.sightRange, 190);
  const night = TR.createGame({ condition: 'night' });
  eq('night condition', night.condition, 'night');
  eq('night sight range', night.sightRange, 110);
  const rain = TR.createGame({ condition: 'rain' });
  eq('rain condition', rain.condition, 'rain');
  ok('rain lane change slower', rain.moveTime > TR.createGame().moveTime);
  ok('rain brakes weaker', rain.brakeFactor > TR.createGame().brakeFactor);
  const unk = TR.createGame({ condition: 'salju' });
  eq('unknown condition falls back to day', unk.condition, 'day');
  const seen = new Set();
  for (let i = 0; i < 30; i++) seen.add(TR.createGame({ condition: 'random' }).condition);
  ok('random picks a real condition', [...seen].every((c) => ['day', 'night', 'rain'].includes(c)));
  ok('random varies', seen.size > 1);
}

// Lane-count segments: short route changes 3 -> 4 -> 2 -> 3
{
  const st = TR.createGame({ mode: 'short' }); quiet(st);
  eq('short starts 3 lanes', st.laneCount, 3);
  eq('laneCountAt 0 m', TR.laneCountAt(st, 0), 3);
  eq('laneCountAt 1500 m', TR.laneCountAt(st, 1500), 4);
  eq('laneCountAt 3000 m', TR.laneCountAt(st, 3000), 2);
  eq('laneCountAt 4000 m', TR.laneCountAt(st, 4000), 3);
  eq('next change from start', TR.nextSegmentChange(st).lanes, 4);

  // warning fires 300 m before the line
  const w = TR.createGame({ mode: 'short' }); quiet(w);
  w.dist = 1150;
  TR.step(w, 1 / 60);
  ok('no warning 350 m out', !w.events.some((e) => e.t === 'lanesAhead'));
  w.dist = 1250;
  TR.step(w, 1 / 60);
  ok('warning within 300 m', w.events.some((e) => e.t === 'lanesAhead'));

  // transition clamps the player into the narrower road
  const n = TR.createGame({ mode: 'short' }); quiet(n);
  n.dist = 2000; TR.step(n, 1 / 60); // onto the 4-lane stretch
  eq('4 lanes at 2000 m', n.laneCount, 4);
  n.player.lane = 3; n.player.targetLane = 3; n.player.x = 5.1; n.player.moveT = 1;
  n.dist = 2999.8; TR.step(n, 1 / 60); // crosses the 3000 m line
  eq('player clamped to 2 lanes', n.player.lane, 1);
  eq('player x on new centre', n.player.x, 1.7);
  ok('lanesChanged event', n.events.some((e) => e.t === 'lanesChanged' && e.lanes === 2));

  // traffic in a disappearing lane is dropped at the line
  const t = TR.createGame({ mode: 'short' }); quiet(t);
  t.dist = 2000; TR.step(t, 1 / 60); // 4 lanes
  const mkCar = (lane, x) => ({ kind: 'sedan', lane, targetLane: lane, s: 3200, x, startX: x, speed: 14, len: 4.4, moving: false, signalT: 0, changeCd: 99, passed: false, moveT: 1 });
  t.traffic.push(mkCar(3, 5.1), mkCar(1, 0));
  eq('traffic kept on 4-lane stretch', t.traffic.length, 2);
  t.dist = 2999.8; TR.step(t, 1 / 60);
  eq('vanishing-lane traffic dropped', t.traffic.length, 1);
  eq('remaining traffic reseated', t.traffic[0].lane, 1);

  // moveLane clamps to the current lane count
  const m = TR.createGame({ mode: 'short' }); quiet(m);
  m.dist = 1600; TR.step(m, 1 / 60); // now 4 lanes
  eq('4 lanes after line', m.laneCount, 4);
  ok('can move to lane 1', TR.moveLane(m, 1));
  m.player.moveT = 1; m.player.lane = m.player.targetLane = 1;
  ok('can move to lane 2', TR.moveLane(m, 1));
  m.player.moveT = 1; m.player.lane = m.player.targetLane = 2;
  ok('can move to lane 3', TR.moveLane(m, 1));
  m.player.moveT = 1; m.player.lane = m.player.targetLane = 3;
  ok('cannot move past lane 3', !TR.moveLane(m, 1));
  m.dist = 3100; TR.step(m, 1 / 60); // now 2 lanes, player auto-clamped
  eq('2 lanes after line', m.laneCount, 2);
  eq('player auto-clamped', m.player.lane, 1);
  ok('cannot move past lane 1 on 2-lane road', !TR.moveLane(m, 1));

  // wall rule generalises: on 2 lanes, the single other lane blocked = wall
  const wl = TR.createGame({ mode: 'short' }); quiet(wl);
  wl.dist = 3100; TR.step(wl, 1 / 60);
  wl.traffic.push({ lane: 1, targetLane: 1, s: wl.dist + 180, x: 1.7, moving: false });
  ok('2-lane wall blocks spawn', TR.spawnVehicle(wl, { lane: 0, gapAhead: 180 }) === null);

  // endless lane cycle: 3 -> 4 -> 2 -> 3 every 2000 m
  const e = TR.createGame({ mode: 'endless' }); quiet(e);
  const drive = (st, target) => { let guard = 0; while (st.dist < target && guard++ < 2000) TR.step(st, 1); };
  drive(e, 2100);
  eq('endless 4 lanes at ~2100 m', e.laneCount, 4);
  drive(e, 6100);
  eq('endless back to 3 lanes at ~6100 m', e.laneCount, 3);
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
