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
function quiet(st) { st.spawnT = 9999; st.nextRoadworkAt = 99999; st.nextConvoyAt = 99999; }

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
  st.traffic.length = 0; // drop the pre-seeded cars: this test sets up its own gaps
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
    st.traffic.length = 0; // a moving car from the previous hit lingers behind
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
  st.traffic.length = 0; // drop the pre-seeded cars: this test sets up its own gap
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

  // Fase 2AI: driving past an OPEN rest window earns the non-stop bonus;
  // teleporting past a never-opened window earns nothing, and the bonus
  // is granted exactly once per stop.
  {
    const st3 = TR.createGame(); quiet(st3);
    st3.traffic = []; st3.pickups = []; st3.nextPickupAt = 99999; st3.nextShieldAt = 99999;
    st3.dist = TR.REST_AT - 100;
    TR.step(st3, 1 / 60);
    eq('skip case: window open', !!TR.openRestStop(st3), true);
    const bonusBefore = st3.bonus;
    for (let i = 0; i < 30 && st3.restStops[0].state === 'open'; i++) TR.step(st3, 0.5);
    eq('skip case: stop missed', st3.restStops[0].state, 'missed');
    eq('skip bonus is 150', st3.bonus - bonusBefore, TR.SKIP_REST_BONUS);
    eq('skip counted', st3.skipRestCount, 1);
    ok('skip event carries the bonus', st3.events.some((e) => e.t === 'restMissed' && e.bonus === 150));
    for (let i = 0; i < 10; i++) TR.step(st3, 0.5);
    eq('skip bonus granted once', st3.bonus - bonusBefore, TR.SKIP_REST_BONUS);
  }
  {
    const st4 = TR.createGame(); quiet(st4);
    st4.traffic = []; // else the teleported pre-seed cars count as near-misses (+150) and pollute the bonus measurement
    const bonusBefore = st4.bonus;
    st4.dist = TR.REST_AT + TR.REST_CLOSE_AFTER + 50; // teleport: window never opened
    TR.step(st4, 1 / 60);
    eq('teleport case: stop missed', st4.restStops[0].state, 'missed');
    eq('teleport case: no skip bonus', st4.bonus - bonusBefore, 0);
    eq('teleport case: not counted', st4.skipRestCount, 0);
  }
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

// Fase 2AL: beating the par time pays a time bonus (+10/s under par);
// missing par pays nothing. (st.time advances by dt during the step,
// so the time is set 0.5 s under the target before stepping.)
{
  const st = TR.createGame({ mode: 'short' }); quiet(st);
  st.traffic = []; st.pickups = []; st.nextPickupAt = 99999; st.nextShieldAt = 99999;
  st.dist = TR.ROUTE_LEN - 5; st.time = 179.5; // finishes at 180 s: 10 s under the 190 s par
  TR.step(st, 0.5);
  eq('finished under par', st.status, 'finished');
  eq('time bonus is 100', st.timeBonus, 100);
  eq('score includes time bonus', st.score, 5000 + 500 + 3 * 200 + 100);
  ok('finish event carries time bonus', st.events.some((e) => e.t === 'finish' && e.timeBonus === 100));
  const st2 = TR.createGame({ mode: 'short' }); quiet(st2);
  st2.traffic = []; st2.dist = TR.ROUTE_LEN - 5; st2.time = 250; // 60 s over par
  TR.step(st2, 0.5);
  eq('finished over par', st2.status, 'finished');
  eq('no time bonus over par', st2.timeBonus, 0);
  const st3 = TR.createGame({ mode: 'long' }); quiet(st3);
  st3.traffic = []; st3.pickups = []; st3.nextPickupAt = 99999; st3.nextShieldAt = 99999;
  st3.dist = 9995; st3.time = 369.5; // finishes at 370 s: 10 s under the 380 s par
  TR.step(st3, 0.5);
  eq('long route time bonus is 100', st3.timeBonus, 100);
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
  eq('brake lvl3 factor', up.brakeFactor, 0.24);
  eq('armor lvl2 max HP', up.maxHp, 5);
  eq('armor lvl2 HP', up.hp, 5);
  eq('tank lvl2 max fuel', up.maxFuel, 140);
  eq('tank lvl2 fuel', up.fuel, 140);
  const over = TR.createGame({ upgrades: { handling: 99, brake: 99, armor: 99, tank: 99 } });
  eq('levels clamped to 3', over.upgrades.handling, 3);
  eq('armor clamped HP', over.maxHp, 6);
  const def = TR.createGame();
  eq('no upgrades = defaults', def.moveTime, 0.22);
  eq('no upgrades brake', def.brakeFactor, 0.36);
}

// Fase 2AG economy: upgrade costs raised so maxing is a long-term goal
// (was 60/120/200 = 380/track, 1520 total — the one-time rewards alone
// covered the whole tree, so a car maxed out in ~15-20 km of running)
{
  eq('upgrade costs are [150, 300, 600]', TR.UPGRADE_COSTS, [150, 300, 600]);
  eq('costs have exactly 3 entries (no dead tier)', TR.UPGRADE_COSTS.length, TR.UPGRADE_MAX);
  const perTrack = TR.UPGRADE_COSTS.reduce((a, b) => a + b, 0);
  eq('one track costs 1050 to max', perTrack, 1050);
  eq('all four tracks cost 4200 to max', perTrack * 4, 4200);
  ok('maxing costs more than all one-time rewards (1600)', perTrack * 4 > 1600);
}

// Fase 2N balance: braking must hold behind the slowest truck (speed 12)
// even at max base speed (32), and spawn must stay sparser than before
{
  const maxBase = 20 + 12; // baseSpeed cap
  for (let lvl = 0; lvl <= 3; lvl++) {
    const g = TR.createGame({ upgrades: { brake: lvl } });
    ok('brake lvl' + lvl + ' holds behind slowest truck at max speed',
      maxBase * g.brakeFactor < 12);
  }
  eq('spawn interval at start', TR.spawnInterval(0), 2.6);
  eq('spawn interval floor', TR.spawnInterval(99999), 1.8);
  ok('spawn sparser than old floor', TR.spawnInterval(99999) > 0.65);
}

// Fase 2AJ: spawn interval scales with the lane count, so the spawn rate
// PER LANE stays constant (a 2-lane stretch no longer packs the same cars
// into half the road). 3 lanes is the reference, unchanged.
{
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  ok('interval at start, 2 lanes', near(TR.spawnInterval(0, 2), 3.9));
  ok('interval at start, 4 lanes', near(TR.spawnInterval(0, 4), 1.95));
  ok('interval floor, 2 lanes', near(TR.spawnInterval(99999, 2), 2.7));
  ok('interval floor, 4 lanes', near(TR.spawnInterval(99999, 4), 1.35));
  const rate = (d, l) => 1 / (TR.spawnInterval(d, l) * l);
  ok('per-lane rate equal at start', near(rate(0, 2), rate(0, 3)) && near(rate(0, 3), rate(0, 4)));
  ok('per-lane rate equal at floor', near(rate(99999, 2), rate(99999, 4)));
}

// Fase 2AK: Endless keeps escalating past 5 km (interval + traffic speed);
// mission routes never escalate.
{
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  eq('endless interval at 5 km', TR.spawnInterval(5000, 3, 'endless'), 1.8);
  ok('endless interval at 15 km', near(TR.spawnInterval(15000, 3, 'endless'), 1.3));
  eq('endless interval floor at 25 km', TR.spawnInterval(25000, 3, 'endless'), 1.2);
  eq('short route never escalates', TR.spawnInterval(15000, 3, 'short'), 1.8);
  const e5 = TR.createGame({ mode: 'endless' }); e5.dist = 5000;
  eq('no speed escalation at 5 km', TR.endlessEscalation(e5), 0);
  const e15 = TR.createGame({ mode: 'endless' }); e15.dist = 15000;
  eq('speed escalation +2 at 15 km', TR.endlessEscalation(e15), 2);
  const e25 = TR.createGame({ mode: 'endless' }); e25.dist = 25000;
  eq('speed escalation caps at +3', TR.endlessEscalation(e25), 3);
  const s15 = TR.createGame({ mode: 'short' }); s15.dist = 15000;
  eq('no speed escalation on mission routes', TR.endlessEscalation(s15), 0);
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

// Lane-count segments: short route changes 3 -> 4 -> 3 -> 2 (Fase 2Q:
// decreases are at most 1, so the old 4 -> 2 jump is gone)
{
  const st = TR.createGame({ mode: 'short' }); quiet(st);
  eq('short starts 3 lanes', st.laneCount, 3);
  eq('laneCountAt 0 m', TR.laneCountAt(st, 0), 3);
  eq('laneCountAt 1500 m', TR.laneCountAt(st, 1500), 4);
  eq('laneCountAt 3000 m', TR.laneCountAt(st, 3000), 3);
  eq('laneCountAt 4000 m', TR.laneCountAt(st, 4000), 2);
  eq('next change from start', TR.nextSegmentChange(st).lanes, 4);

  // warning fires 300 m before the line
  const w = TR.createGame({ mode: 'short' }); quiet(w);
  w.dist = 1150;
  TR.step(w, 1 / 60);
  ok('no warning 350 m out', !w.events.some((e) => e.t === 'lanesAhead'));
  w.dist = 1250;
  TR.step(w, 1 / 60);
  ok('warning within 300 m', w.events.some((e) => e.t === 'lanesAhead'));

  // line remap: old lane 3 -> new lane 2 (4 -> 3 closes the leftmost lane)
  const n = TR.createGame({ mode: 'short' }); quiet(n);
  n.dist = 2000; TR.step(n, 1 / 60); // onto the 4-lane stretch
  eq('4 lanes at 2000 m', n.laneCount, 4);
  n.player.lane = 3; n.player.targetLane = 3; n.player.x = 5.1; n.player.moveT = 1;
  n.dist = 2999.8; TR.step(n, 1 / 60); // crosses the 3000 m line
  eq('player remapped to new lane 2', n.player.lane, 2);
  eq('player x on new centre', n.player.x, 3.4);
  ok('lanesChanged event', n.events.some((e) => e.t === 'lanesChanged' && e.lanes === 3));

  // safety net: a player still in the doomed lane at the line merges
  const d = TR.createGame({ mode: 'short' }); quiet(d);
  d.dist = 2000; TR.step(d, 1 / 60);
  d.player.lane = 0; d.player.targetLane = 0; d.player.x = -5.1; d.player.moveT = 1;
  d.dist = 2999.8; TR.step(d, 1 / 60);
  eq('doomed-lane player merged to new lane 0', d.player.lane, 0);
  eq('merged player x on new centre', d.player.x, -3.4);

  // traffic remap: beyond-line cars remap (lane 3 -> 2, lane 1 -> 0);
  // a doomed-lane car still BEFORE the line is the rare fallback drop
  const t = TR.createGame({ mode: 'short' }); quiet(t);
  t.dist = 2000; TR.step(t, 1 / 60); // 4 lanes
  const mkCar = (lane, x, s) => ({ kind: 'sedan', lane, targetLane: lane, s, x, startX: x, speed: 14, len: 4.4, moving: false, signalT: 0, changeCd: 99, passed: false, moveT: 1 });
  t.traffic.push(mkCar(3, 5.1, 3200), mkCar(1, 0, 3200), mkCar(0, -5.1, 2900));
  eq('traffic kept on 4-lane stretch', t.traffic.length, 3);
  t.dist = 2999.8; TR.step(t, 1 / 60);
  eq('beyond-line traffic remapped, before-line doomed dropped', t.traffic.length, 2);
  // (match on x: cars advance a little each step now, so s is 3200.23, not 3200)
  eq('old lane 3 is now lane 2', t.traffic.find((v) => v.x === 3.4).lane, 2);
  eq('old lane 1 is now lane 0', t.traffic.find((v) => v.x === -3.4).lane, 0);

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
  m.dist = 3100; TR.step(m, 1 / 60); // now 3 lanes, player remapped
  eq('3 lanes after line', m.laneCount, 3);
  eq('player remapped', m.player.lane, 2);
  ok('cannot move past lane 2 on 3-lane road', !TR.moveLane(m, 1));
  m.dist = 4100; TR.step(m, 1 / 60); // now 2 lanes
  eq('2 lanes after line', m.laneCount, 2);
  eq('player remapped to lane 1', m.player.lane, 1);

  // wall rule generalises: on 2 lanes, the single other lane blocked = wall
  const wl = TR.createGame({ mode: 'short' }); quiet(wl);
  wl.dist = 4100; TR.step(wl, 1 / 60);
  wl.traffic.push({ lane: 1, targetLane: 1, s: wl.dist + 180, x: 1.7, moving: false });
  ok('2-lane wall blocks spawn', TR.spawnVehicle(wl, { lane: 0, gapAhead: 180 }) === null);

  // endless lane cycle: 3 -> 4 -> 3 -> 2 every 2000 m
  const e = TR.createGame({ mode: 'endless' }); quiet(e);
  const drive = (st, target) => { let guard = 0; while (st.dist < target && guard++ < 2000) TR.step(st, 1); };
  drive(e, 2100);
  eq('endless 4 lanes at ~2100 m', e.laneCount, 4);
  drive(e, 4100);
  eq('endless 3 lanes at ~4100 m', e.laneCount, 3);
  drive(e, 6100);
  eq('endless 2 lanes at ~6100 m', e.laneCount, 2);
  drive(e, 8100);
  eq('endless 4 lanes again at ~8100 m', e.laneCount, 4);
}

// --- cars (Fase 2G) ---
{
  const city = TR.createGame({ mode: 'short' });
  eq('default car is city', city.car, 'city');
  eq('city speed factor', city.speedFactor, 1.0);
  eq('city fuel factor', city.fuelFactor, 1.0);
  eq('city maxHp', city.maxHp, 3);
  const bad = TR.createGame({ mode: 'short', car: 'nope' });
  eq('unknown car falls back to city', bad.car, 'city');
  const suv = TR.createGame({ mode: 'short', car: 'suv' });
  eq('suv maxHp 4', suv.maxHp, 4);
  eq('suv kind', suv.carKind, 'suv');
  ok('suv slower lane change', suv.moveTime > city.moveTime);
  const swift = TR.createGame({ mode: 'short', car: 'lincah' });
  ok('lincah faster lane change', swift.moveTime < city.moveTime);
  eq('lincah kind', swift.carKind, 'hatch');
  const sport = TR.createGame({ mode: 'short', car: 'sport' });
  eq('sport speed factor', sport.speedFactor, 1.12);
  eq('sport kind', sport.carKind, 'sport');
  // speed: same distance, sport runs faster than city
  const sc = TR.createGame({ mode: 'short', car: 'sport' }); quiet(sc);
  const cc = TR.createGame({ mode: 'short' }); quiet(cc);
  TR.step(sc, 1); TR.step(cc, 1);
  ok('sport faster than city', sc.speed > cc.speed);
  // fuel: sport drains more over the same distance
  const sf = TR.createGame({ mode: 'short', car: 'sport' }); quiet(sf);
  const cf = TR.createGame({ mode: 'short' }); quiet(cf);
  TR.step(sf, 1); TR.step(cf, 1);
  ok('sport thirstier than city', sf.fuel < cf.fuel);
  // costs are positive and ordered city < lincah < suv < sport
  eq('city free', TR.CARS.city.cost, 0);
  ok('car costs ordered', TR.CARS.lincah.cost > 0 && TR.CARS.suv.cost > TR.CARS.lincah.cost && TR.CARS.sport.cost > TR.CARS.suv.cost);
}

// --- missions + achievements (Fase 2H) ---
{
  // metrics are tracked during a run
  const m = TR.createGame({ mode: 'short' }); quiet(m);
  eq('metrics start at zero', [m.crashes, m.pickupCount, m.nearMisses, m.maxCombo, m.restCount].join(','), '0,0,0,0,0');
  eq('fuelEmpty starts false', m.fuelEmpty, false);
  m.fuel = 0.01; TR.step(m, 1);
  eq('fuelEmpty set when tank hits zero', m.fuelEmpty, true);
  // pickup + near-miss + crash metrics via driven state
  const p = TR.createGame({ mode: 'short' }); quiet(p);
  p.pickups.push({ s: p.dist + 2, x: 0, taken: false });
  TR.step(p, 1 / 60);
  eq('pickup counted', p.pickupCount, 1);
  const n = TR.createGame({ mode: 'short' }); quiet(n);
  n.traffic.push({ lane: 0, targetLane: 0, s: n.dist - 10, x: -3.4, len: 4.4, kind: 'sedan', passed: false, moving: false });
  TR.step(n, 1 / 60);
  eq('near-miss counted', n.nearMisses, 1);
  eq('maxCombo tracks combo', n.maxCombo, 1);
  const c = TR.createGame({ mode: 'short' }); quiet(c);
  c.traffic.push({ lane: 1, targetLane: 1, s: c.dist + 1, x: 0, len: 4.4, kind: 'sedan', passed: false, moving: false });
  TR.step(c, 1 / 60);
  eq('crash counted', c.crashes, 1);
  const r = TR.createGame({ mode: 'short' }); quiet(r);
  r.restStops[0].state = 'open';
  ok('rest counted', TR.tryRest(r) && r.restCount === 1);

  // daily missions: 3 distinct valid keys, deterministic per day, rotate
  const t0 = TR.todaysMissions(0);
  eq('3 missions per day', t0.length, 3);
  eq('missions distinct', new Set(t0).size, 3);
  ok('missions are real keys', t0.every((k) => TR.MISSION_DEFS.some((d) => d.key === k)));
  eq('same day same missions', TR.todaysMissions(0).join(','), t0.join(','));
  ok('missions rotate next day', TR.todaysMissions(1).join(',') !== t0.join(','));

  // checkMissions: all-satisfied run completes exactly today's 3
  const full = TR.createGame({ mode: 'short' });
  Object.assign(full, { pickupCount: 99, maxCombo: 5, nearMisses: 99, dist: 99999, crashes: 0, restCount: 9, fuelEmpty: false, condition: 'rain' });
  eq('all-satisfied run completes today 3', TR.checkMissions(full, true, 0, []).sort().join(','), t0.slice().sort().join(','));
  eq('already-done today excluded', TR.checkMissions(full, true, 0, [t0[0]]).length, 2);
  // day 4 includes bersih (index 4): finish-gated, excluded when not finished
  const t4 = TR.todaysMissions(4);
  ok('day 4 includes bersih', t4.includes('bersih'));
  ok('bersih excluded when not finished', !TR.checkMissions(full, false, 4, []).includes('bersih'));
  ok('bersih included when finished', TR.checkMissions(full, true, 4, []).includes('bersih'));

  // checkAchievements: all-satisfied run unlocks all 8; unlocked ones excluded
  eq('all 8 achievements', TR.checkAchievements(full, true, { odoKm: 150, ownedCars: 4 }, []).length, 8);
  eq('unlocked excluded', TR.checkAchievements(full, true, { odoKm: 150, ownedCars: 4 }, ['finis1']).length, 7);
  eq('odo100 needs 100 km', TR.checkAchievements(full, true, { odoKm: 99, ownedCars: 4 }, []).includes('odo100'), false);
  eq('kolektor needs 4 cars', TR.checkAchievements(full, true, { odoKm: 150, ownedCars: 3 }, []).includes('kolektor'), false);
}

// --- roadworks + convoys (Fase 2I) ---
{
  // zone lookup + next
  const z = TR.createGame({ mode: 'short' }); quiet(z);
  z.roadworks.push({ at: 1500, len: 220, lane: 1 });
  eq('zoneAt inside', TR.zoneAt(z, 1600) !== null, true);
  eq('zoneAt before', TR.zoneAt(z, 1400), null);
  eq('zoneAt at end', TR.zoneAt(z, 1720), null);
  z.dist = 1400;
  eq('nextRoadwork', TR.nextRoadwork(z).at, 1500);

  // moveLane into a closed lane is refused; open moves still work
  const m = TR.createGame({ mode: 'short' }); quiet(m);
  m.roadworks.push({ at: 1500, len: 220, lane: 1 });
  m.dist = 1600; m.laneCount = 4; m.laneXs = TR.LANE_X[4];
  m.player.lane = m.player.targetLane = 2; m.player.x = m.laneXs[2];
  ok('move into closed lane refused', !TR.moveLane(m, -1));
  m.player.lane = m.player.targetLane = 3; m.player.x = m.laneXs[3];
  ok('move into open lane accepted', TR.moveLane(m, -1));

  // auto-nudge when the zone starts under the player
  const n = TR.createGame({ mode: 'short' }); quiet(n);
  n.roadworks.push({ at: 1000, len: 220, lane: 1 });
  n.dist = 999.9; n.player.lane = n.player.targetLane = 1; n.player.x = 0;
  TR.step(n, 1);
  eq('nudged out of closed lane', n.player.lane, 0);
  ok('nudged event fired', n.events.some((e) => e.t === 'nudged'));

  // spawn exclusion inside a closed lane
  const s = TR.createGame({ mode: 'short' }); quiet(s);
  s.roadworks.push({ at: 1500, len: 220, lane: 1 });
  s.dist = 1400;
  eq('spawn in closed lane blocked', TR.spawnVehicle(s, { lane: 1, gapAhead: 100 }), null);
  ok('spawn in open lane allowed', TR.spawnVehicle(s, { lane: 0, gapAhead: 100 }) !== null);

  // wall rule counts only open lanes: cars in lanes 2+3 wall lane 0
  // even though lane 1 is closed (not an escape lane)
  const w = TR.createGame({ mode: 'short' }); quiet(w);
  w.roadworks.push({ at: 1600, len: 220, lane: 1 });
  w.traffic.push({ lane: 2, targetLane: 2, s: 1600, x: 1.7, moving: false });
  w.traffic.push({ lane: 3, targetLane: 3, s: 1600, x: 5.1, moving: false });
  ok('open lanes all occupied = wall', TR.wallAt(w, 1600, 0, null));
  w.traffic.pop();
  ok('one open lane free = no wall', !TR.wallAt(w, 1600, 0, null));

  // sedans never change into a closed lane
  const c = TR.createGame({ mode: 'short' }); quiet(c);
  c.roadworks.push({ at: 1600, len: 220, lane: 1 });
  c.dist = 1400;
  const v = { lane: 0, targetLane: 0, s: 1600, x: -5.1, moving: false };
  ok('sedan change into closed lane refused', !TR.canChangeLane(c, v, 1));

  // zone generation skipped where the road has only 2 lanes
  const g = TR.createGame({ mode: 'short' }); quiet(g);
  g.nextRoadworkAt = 4100; g.nextConvoyAt = 99999;
  g.dist = 3800;
  TR.step(g, 1 / 60);
  ok('no zone on 2-lane stretch', !g.roadworks.some((rz) => rz.at === 4100));
  ok('generator advanced past skipped zone', g.nextRoadworkAt > 3100);

  // Fase 2I fix: the generator only ever closes an EDGE lane (0 or last).
  // A middle closure strands the player: with 3 lanes the two open lanes
  // are not adjacent, so a player behind a slow car in either lane has no
  // dodge; with 4 lanes an inner closure isolates the neighbouring edge
  // lane the same way. Edge closure keeps the open lanes connected.
  {
    let edgeOnly3 = true, edgeOnly4 = true, seen0 = false, seenLast = false;
    for (let i = 0; i < 200; i++) {
      const g3 = TR.createGame({ mode: 'short' }); quiet(g3);
      g3.nextRoadworkAt = 1200; g3.dist = 900; // 3 lanes at 1200
      TR.step(g3, 1 / 60);
      const z3 = g3.roadworks.find((rz) => rz.at === 1200);
      if (!z3 || (z3.lane !== 0 && z3.lane !== 2)) edgeOnly3 = false;
      if (z3 && z3.lane === 0) seen0 = true;
      if (z3 && z3.lane === 2) seenLast = true;
      const g4 = TR.createGame({ mode: 'short' }); quiet(g4);
      g4.nextRoadworkAt = 2000; g4.dist = 1700; // 4 lanes at 2000
      TR.step(g4, 1 / 60);
      const z4 = g4.roadworks.find((rz) => rz.at === 2000);
      if (!z4 || (z4.lane !== 0 && z4.lane !== 3)) edgeOnly4 = false;
    }
    ok('3-lane zones close an edge lane only (200 runs)', edgeOnly3);
    ok('4-lane zones close an edge lane only (200 runs)', edgeOnly4);
    ok('both edges occur (not stuck on one side)', seen0 && seenLast);
    // connectivity: with an edge closure every open lane has an adjacent open lane
    for (const lanes of [3, 4]) {
      for (const closed of [0, lanes - 1]) {
        const open = [];
        for (let l = 0; l < lanes; l++) if (l !== closed) open.push(l);
        ok('open lanes connected, ' + lanes + ' lanes, closed ' + closed,
          open.every((l) => open.includes(l - 1) || open.includes(l + 1)));
      }
    }
    // the trap, demonstrated: 3 lanes, middle closed, truck ahead in lane 0
    const t = TR.createGame({ mode: 'short' }); quiet(t);
    t.roadworks.push({ at: 1500, len: 220, lane: 1 });
    t.dist = 1600; t.laneCount = 3; t.laneXs = TR.LANE_X[3];
    t.player.lane = t.player.targetLane = 0; t.player.x = t.laneXs[0];
    ok('trap: middle closed, no dodge from lane 0', !TR.moveLane(t, 1) && !TR.moveLane(t, -1));
  }

  // convoy: one gap lane, trucks/buses only, convoy event fired
  // (spawned 100 m ahead so no member can collide with the player mid-test)
  const cv = TR.createGame({ mode: 'short' }); quiet(cv);
  cv.traffic.length = 0; // drop the pre-seeded cars: they would fill the
  cv.nextConvoyAt = cv.dist + 100; cv.nextRoadworkAt = 99999; // wall rule and block a member
  TR.step(cv, 1 / 60);
  const members = cv.traffic.filter((t) => t.convoy);
  eq('convoy members = lanes - 1', members.length, 2);
  ok('convoy kinds are truck/bus', members.every((t) => t.kind === 'truck' || t.kind === 'bus'));
  eq('convoy leaves one gap lane', new Set(members.map((t) => t.lane)).size, 2);
  ok('convoy event fired', cv.events.some((e) => e.t === 'convoy'));
  ok('convoy generator advanced', cv.nextConvoyAt > 100);
}

// Penghadang (Fase 2AC): aggressive sedan, one deliberate swerve into the
// player's lane, only while the player is 40-70 m behind in an adjacent lane.
{
  function penghadangGame(dist, pLane, aLane, gapAhead) {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.dist = dist; st.laneCount = 4; st.laneXs = TR.LANE_X[4]; // 4 lanes at 2000-2800 m
    st.player.lane = st.player.targetLane = pLane; st.player.x = st.laneXs[pLane];
    const v = TR.spawnVehicle(st, { kind: 'aggressive', lane: aLane, gapAhead, speed: 16 });
    return { st, v };
  }
  // fires in the window: signal starts, chance spent, horn sounds
  {
    const { st, v } = penghadangGame(2000, 1, 0, 50);
    TR.step(st, 1 / 60);
    ok('penghadang fires at 50 m', v.signalT > 0 && v.targetLane === 1 && v.swerveUsed);
    ok('penghadang horn sounds', st.events.some((e) => e.t === 'horn'));
  }
  // too close: no swerve below 40 m
  {
    const { st, v } = penghadangGame(2000, 1, 0, 30);
    TR.step(st, 1 / 60);
    ok('penghadang silent below 40 m', v.signalT === 0 && !v.swerveUsed);
  }
  // too far: no swerve above 70 m
  {
    const { st, v } = penghadangGame(2000, 1, 0, 100);
    TR.step(st, 1 / 60);
    ok('penghadang silent above 70 m', v.signalT === 0 && !v.swerveUsed);
  }
  // player in the same lane: nothing to swerve into
  {
    const { st, v } = penghadangGame(2000, 0, 0, 50);
    TR.step(st, 1 / 60);
    ok('penghadang silent in same lane', v.signalT === 0 && !v.swerveUsed);
  }
  // one chance only: after the swerve completes, no second signal
  {
    const { st, v } = penghadangGame(2000, 1, 0, 50);
    TR.step(st, 1 / 60);
    ok('first swerve fires', v.signalT > 0);
    v.signalT = 0; v.moving = true; v.moveT = 1; // complete the move
    TR.step(st, 1 / 60);
    eq('swerve completes into player lane', v.lane, 1);
    v.lane = v.targetLane = 0; v.x = v.startX = st.laneXs[0]; v.s = st.dist + 50;
    st.player.lane = st.player.targetLane = 1; st.player.x = st.laneXs[1];
    st.events.length = 0;
    TR.step(st, 1 / 60);
    ok('no second swerve', v.signalT === 0 && !st.events.some((e) => e.t === 'horn'));
  }
  // blocked when the target lane is occupied within 45 m
  {
    const { st, v } = penghadangGame(2000, 1, 0, 50);
    TR.spawnVehicle(st, { kind: 'sedan', lane: 1, gapAhead: 70, speed: 16 });
    TR.step(st, 1 / 60);
    ok('penghadang blocked by car in target lane', v.signalT === 0 && !v.swerveUsed);
  }
  // blocked by the wall rule: middle lane, both escape lanes occupied
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.dist = 2000; st.laneCount = 4; st.laneXs = TR.LANE_X[4];
    st.player.lane = st.player.targetLane = 2; st.player.x = st.laneXs[2];
    const v = TR.spawnVehicle(st, { kind: 'aggressive', lane: 1, gapAhead: 50, speed: 16 });
    st.traffic.push({ kind: 'sedan', lane: 0, targetLane: 0, s: 2050, speed: 16, len: 4.4, x: st.laneXs[0], startX: st.laneXs[0], moveT: 1, moving: false, signalT: 0, changeCd: 99, passed: false, swerveUsed: false, color: 0 });
    st.traffic.push({ kind: 'sedan', lane: 1, targetLane: 1, s: 2070, speed: 16, len: 4.4, x: st.laneXs[1], startX: st.laneXs[1], moveT: 1, moving: false, signalT: 0, changeCd: 99, passed: false, swerveUsed: false, color: 0 });
    st.traffic.push({ kind: 'sedan', lane: 3, targetLane: 3, s: 2050, speed: 16, len: 4.4, x: st.laneXs[3], startX: st.laneXs[3], moveT: 1, moving: false, signalT: 0, changeCd: 99, passed: false, swerveUsed: false, color: 0 });
    TR.step(st, 1 / 60);
    ok('penghadang blocked by wall', v.signalT === 0 && !v.swerveUsed);
  }
  // blocked into a roadwork-closed lane
  {
    const { st, v } = penghadangGame(2000, 1, 0, 50);
    st.roadworks.push({ at: 2000, len: 220, lane: 1 });
    TR.step(st, 1 / 60);
    ok('penghadang blocked by closed lane', v.signalT === 0 && !v.swerveUsed);
  }
  // blocked into a doomed lane (decrease approach, lane 0 vanishing at 3000 m)
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.dist = 2800; st.laneCount = 4; st.laneXs = TR.LANE_X[4];
    st.player.lane = st.player.targetLane = 0; st.player.x = st.laneXs[0];
    const v = TR.spawnVehicle(st, { kind: 'aggressive', lane: 1, gapAhead: 50, speed: 16 });
    TR.step(st, 1 / 60);
    ok('penghadang blocked by doomed lane', v.signalT === 0 && !v.swerveUsed);
  }
  // never changes lanes randomly like a sedan: 10 s with the player two lanes over
  {
    const { st, v } = penghadangGame(2000, 2, 0, 200);
    for (let i = 0; i < 600; i++) TR.step(st, 1 / 60);
    ok('penghadang never wanders', v.signalT === 0 && v.targetLane === 0 && !st.events.some((e) => e.t === 'signal'));
  }
  // spawn gating: 500 rolled spawns each — none aggressive before 1500 m,
  // none while one is live, none on a 2-lane stretch
  {
    const g1 = TR.createGame({ mode: 'short' }); quiet(g1); g1.dist = 1000;
    for (let i = 0; i < 500; i++) TR.spawnVehicle(g1);
    eq('no penghadang before 1500 m (500 rolls)', g1.traffic.filter((t) => t.kind === 'aggressive').length, 0);
    const g2 = TR.createGame({ mode: 'short' }); quiet(g2); g2.dist = 2000;
    TR.spawnVehicle(g2, { kind: 'aggressive', lane: 0, gapAhead: 200, speed: 16 });
    for (let i = 0; i < 500; i++) TR.spawnVehicle(g2);
    eq('at most one penghadang live (500 rolls)', g2.traffic.filter((t) => t.kind === 'aggressive').length, 1);
    const g3 = TR.createGame({ mode: 'short' }); quiet(g3); g3.dist = 4100;
    for (let i = 0; i < 500; i++) TR.spawnVehicle(g3);
    eq('no penghadang on 2 lanes (500 rolls)', g3.traffic.filter((t) => t.kind === 'aggressive').length, 0);
    // explicit kind bypasses gating (so tests can build one anywhere)
    const g4 = TR.createGame({ mode: 'short' }); quiet(g4); g4.dist = 0;
    g4.traffic.length = 0; // drop the pre-seeded cars: they would fill the wall rule here
    ok('explicit aggressive kind allowed', TR.spawnVehicle(g4, { kind: 'aggressive', lane: 0, gapAhead: 100 }) !== null);
  }
}

// Moving traffic (Fase 2AD): cars advance at their own speed, follow the
// car ahead, convoys hold formation, braking really holds now.
{
  // a car advances at its speed: 16 m/s for 1 s
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    const v = TR.spawnVehicle(st, { kind: 'sedan', lane: 0, gapAhead: 300, speed: 16 });
    TR.step(st, 1);
    eq('car advances at its speed', Math.round(v.s), 316);
  }
  // Fase 2AN: platoon breaker — a sedan stuck behind a slower leader for
  // 4 s signals and moves to a freer lane; a follower behind a faster
  // leader never accumulates followT; an aggressive car never breaks;
  // a blocked sedan waits (no signal) instead of forcing its way out.
  // (The player brakes throughout, so the cars stay ahead of it.)
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.traffic = [];
    TR.setBrake(st, true);
    const leader = TR.spawnVehicle(st, { kind: 'truck', lane: 1, gapAhead: 80, speed: 13 });
    const follower = TR.spawnVehicle(st, { kind: 'sedan', lane: 1, gapAhead: 40, speed: 17 });
    follower.changeCd = 999; // no random lane change during the test
    for (let i = 0; i < 60; i++) TR.step(st, 0.1); // 6 s: gap 40 -> 30, then ~3.5 s clamped (a boundary blip or two costs a little via the decay)
    ok('followT accumulates while clamped', follower.followT >= 3.0 && follower.followT <= 3.6);
    eq('no signal before 4 s of following', follower.signalT, 0);
    for (let i = 0; i < 12; i++) TR.step(st, 0.1); // past 4 s
    ok('platoon breaker signals after 4 s', follower.signalT > 0);
    eq('breaker moves to the freer lane (left)', follower.targetLane, 0);
    ok('followT resets when the signal starts', follower.followT < 1);
  }
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.traffic = [];
    TR.setBrake(st, true);
    TR.spawnVehicle(st, { kind: 'truck', lane: 1, gapAhead: 80, speed: 17 });
    const follower = TR.spawnVehicle(st, { kind: 'sedan', lane: 1, gapAhead: 40, speed: 13 });
    follower.changeCd = 999;
    for (let i = 0; i < 70; i++) TR.step(st, 0.1);
    eq('no followT behind a faster leader', follower.followT, 0);
    eq('no signal behind a faster leader', follower.signalT, 0);
  }
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.traffic = [];
    TR.setBrake(st, true);
    TR.spawnVehicle(st, { kind: 'truck', lane: 1, gapAhead: 80, speed: 13 });
    const agg = TR.spawnVehicle(st, { kind: 'aggressive', lane: 1, gapAhead: 40, speed: 17 });
    agg.changeCd = 999;
    for (let i = 0; i < 70; i++) TR.step(st, 0.1);
    eq('aggressive car never platoon-breaks', agg.signalT, 0);
  }
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.traffic = [];
    TR.setBrake(st, true);
    TR.spawnVehicle(st, { kind: 'truck', lane: 1, gapAhead: 80, speed: 13 });
    const follower = TR.spawnVehicle(st, { kind: 'sedan', lane: 1, gapAhead: 40, speed: 17 });
    follower.changeCd = 999;
    const b0 = TR.spawnVehicle(st, { kind: 'sedan', lane: 0, gapAhead: 45, speed: 13 });
    // b2 sits 30 m behind the follower (still inside the 45 m clearance
    // check) — a blocker at the same s as b0 would trip the spawn wall rule.
    const b2 = TR.spawnVehicle(st, { kind: 'sedan', lane: 2, gapAhead: 10, speed: 13 });
    b0.changeCd = 999; b2.changeCd = 999;
    for (let i = 0; i < 70; i++) TR.step(st, 0.1);
    eq('blocked sedan waits (no signal)', follower.signalT, 0);
    ok('blocked sedan keeps waiting', follower.followT >= TR.PLATOON_BREAK_TIME);
  }
  // braking holds behind a truck: gap grows while braking
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.dist = 2000; // base speed 25, braked 25 x 0.36 = 9 < truck 13
    st.player.lane = st.player.targetLane = 1; st.player.x = 0;
    const truck = TR.spawnVehicle(st, { kind: 'truck', lane: 1, gapAhead: 30, speed: 13 });
    TR.setBrake(st, true);
    for (let i = 0; i < 5; i++) TR.step(st, 1);
    ok('braking holds, gap grows', (truck.s - st.dist) > 30);
  }
  // sport brake edge: fastest braked player speed (32 x 1.12 x 0.36 = 12.9)
  // is still below the slowest traffic (13), so the gap grows, thinly
  {
    const st = TR.createGame({ mode: 'short', car: 'sport' }); quiet(st);
    st.dist = 4800; // base speed 32
    st.player.lane = st.player.targetLane = 1; st.player.x = 0;
    const truck = TR.spawnVehicle(st, { kind: 'truck', lane: 1, gapAhead: 30, speed: 13 });
    TR.setBrake(st, true);
    for (let i = 0; i < 10; i++) TR.step(st, 1);
    ok('sport braking holds, gap grows', (truck.s - st.dist) > 30);
  }
  // pre-seed: the road starts with cars on it, lane 1 clear at the start
  {
    const st = TR.createGame({ mode: 'short' });
    eq('three pre-seeded cars', st.traffic.length, 3);
    ok('pre-seed lane 1 clear at the start', !st.traffic.some((v) => v.lane === 1 && v.s < 60));
    ok('pre-seed cars ahead, within sight', st.traffic.every((v) => v.s > 0 && v.s <= 150));
  }
  // no accumulation: a long run with the spawner on stays bounded
  {
    const st = TR.createGame({ mode: 'short' });
    let maxLive = 0;
    for (let i = 0; i < 120 * 60; i++) { // 120 s of game time
      TR.step(st, 1 / 60);
      if (st.traffic.length > maxLive) maxLive = st.traffic.length;
      if (st.status !== 'play') break; // finished/over: stop counting
    }
    ok('live traffic stays bounded', maxLive <= 26);
  }
  // convoy holds formation: one speed for all members, spread unchanged
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.traffic.length = 0; // drop the pre-seeded cars: they would fill the wall rule
    st.nextConvoyAt = st.dist + 100;
    TR.step(st, 1 / 60);
    const members = st.traffic.filter((t) => t.convoy);
    ok('convoy spawned', members.length >= 2);
    eq('convoy members share one speed', new Set(members.map((v) => v.speed)).size, 1);
    const spread0 = Math.max(...members.map((v) => v.s)) - Math.min(...members.map((v) => v.s));
    TR.step(st, 1); TR.step(st, 1); // 2 s: old per-member speeds would spread ~4 m
    const spread1 = Math.max(...members.map((v) => v.s)) - Math.min(...members.map((v) => v.s));
    ok('convoy formation holds', Math.abs(spread1 - spread0) < 0.01);
  }
}

// Shield pickup (Fase 2K): arms on pickup, no stacking, absorbs one crash
{
  const st = TR.createGame(); quiet(st);
  st.nextPickupAt = 99999; st.nextShieldAt = 99999;
  st.pickups.push({ lane: 1, s: st.dist + 2, x: 0, taken: false, kind: 'shield' });
  TR.step(st, 1 / 60);
  eq('shield pickup arms shield', st.shield, true);
  eq('shield pickup counted', st.shieldPickups, 1);
  ok('shield event fired', st.events.some((e) => e.t === 'shield'));
  const bonusBefore = st.bonus;
  st.pickups.push({ lane: 1, s: st.dist + 2, x: 0, taken: false, kind: 'shield' });
  TR.step(st, 1 / 60);
  eq('second shield does not stack', st.shield, true);
  eq('second shield pays +25 instead', st.bonus, bonusBefore + TR.SHIELD_DUP_BONUS);
  ok('shieldDup event fired', st.events.some((e) => e.t === 'shieldDup'));

  // shield absorbs a crash: no HP loss, no crash count, combo survives
  st.combo = 3; st.invuln = 0;
  const v = TR.spawnVehicle(st, { lane: 1, gapAhead: 3, kind: 'sedan', speed: 15 });
  v.s = st.dist + 1;
  TR.step(st, 1 / 60);
  eq('shield save keeps HP', st.hp, 3);
  eq('shield save is not a crash', st.crashes, 0);
  eq('shield consumed', st.shield, false);
  eq('shield save counted', st.shieldSaves, 1);
  eq('shield save keeps combo', st.combo, 3);
  ok('shieldSave event fired', st.events.some((e) => e.t === 'shieldSave'));
  // the next crash, unshielded, costs HP again
  st.invuln = 0;
  const v2 = TR.spawnVehicle(st, { lane: 1, gapAhead: 3, kind: 'sedan', speed: 15 });
  v2.s = st.dist + 1;
  TR.step(st, 1 / 60);
  eq('unshielded crash costs HP', st.hp, 2);
}

// Shield spawner: rare, single live shield, never in a closed lane
{
  const st = TR.createGame(); quiet(st);
  st.nextPickupAt = 99999; st.nextShieldAt = st.dist;
  TR.step(st, 1 / 60);
  const shields = st.pickups.filter((pk) => pk.kind === 'shield');
  eq('one shield spawned', shields.length, 1);
  ok('shield generator advanced 2.5 km+', st.nextShieldAt >= st.dist + TR.SHIELD_GAP_MIN);
  st.nextShieldAt = st.dist; // generator fires again while one is live
  TR.step(st, 1 / 60);
  eq('no duplicate live shield', st.pickups.filter((pk) => pk.kind === 'shield').length, 1);

  const zw = TR.createGame(); quiet(zw);
  zw.nextPickupAt = 99999; zw.nextShieldAt = zw.dist;
  zw.roadworks.push({ at: zw.dist + 180, len: 220, lane: 1 }); // closes lane 1 across the spawn window
  TR.step(zw, 1 / 60);
  const zwShield = zw.pickups.find((pk) => pk.kind === 'shield');
  ok('shield spawned despite closed lane', !!zwShield);
  ok('shield avoids closed lane', zwShield && zwShield.lane !== 1);
}

// --- gradual lane-count transitions (Fase 2Q) ---
{
  // mapLane across every transition shape
  eq('mapLane 4->3 closes lane 0', TR.mapLane(4, 3, 0), -1);
  eq('mapLane 4->3 shifts lane 3 to 2', TR.mapLane(4, 3, 3), 2);
  eq('mapLane 3->4 keeps lane 1', TR.mapLane(3, 4, 1), 1);
  eq('mapLane 2->4 shifts lane 0 to 1', TR.mapLane(2, 4, 0), 1);
  eq('mapLane 2->4 shifts lane 1 to 2', TR.mapLane(2, 4, 1), 2);

  // taperLaneXs interpolates centres; the doomed lane converges onto new lane 0
  eq('taper midpoint 4->3', TR.taperLaneXs(4, 3, 0.5), [-4.25, -2.55, 0.85, 4.25]);
  eq('taper eased quarter 4->3', TR.taperLaneXs(4, 3, 0.25), [-4.834375, -1.965625, 1.434375, 4.834375]);
  eq('taper end 4->3', TR.taperLaneXs(4, 3, 1), [-3.4, -3.4, 0, 3.4]);
  eq('taper 2->4 keeps old lanes', TR.taperLaneXs(2, 4, 1), [-1.7, 1.7]);

  // taperLines: 4->3 pinches the doomed divider into the new left edge;
  // 3->4 forks a divider from the old right edge; 2->4 keeps the middle
  const l43 = TR.taperLines(4, 3);
  ok('4->3 pinch line', l43.some((l) => l[0] === -3.4 && l[1] === -5.1));
  const l34 = TR.taperLines(3, 4);
  ok('3->4 fork line', l34.some((l) => l[0] === 5.1 && l[1] === 3.4));
  const l24 = TR.taperLines(2, 4);
  ok('2->4 middle divider stays', l24.some((l) => l[0] === 0 && l[1] === 0));
  ok('2->4 left divider pinched at old edge', l24.some((l) => l[0] === -3.4 && l[1] === -3.4));

  // moveLane refuses the doomed lane during approach, allows leaving it
  const r = TR.createGame({ mode: 'short' }); quiet(r);
  r.dist = 2000; TR.step(r, 1 / 60); // 4 lanes, next line 3000 (4->3)
  r.dist = 2800; TR.step(r, 1 / 60); // inside the 300 m approach
  r.player.lane = 1; r.player.targetLane = 1; r.player.moveT = 1;
  ok('move into doomed lane refused', !TR.moveLane(r, -1));
  r.player.lane = 0; r.player.targetLane = 0; r.player.moveT = 1;
  ok('move out of doomed lane allowed', TR.moveLane(r, 1));

  // no spawn in the doomed lane during approach/taper
  const sp = TR.createGame({ mode: 'short' }); quiet(sp);
  sp.dist = 2800; TR.step(sp, 1 / 60);
  eq('doomed-lane spawn blocked', TR.spawnVehicle(sp, { lane: 0, gapAhead: 150, kind: 'sedan', speed: 15 }), null);
  ok('survivor-lane spawn allowed', !!TR.spawnVehicle(sp, { lane: 1, gapAhead: 150, kind: 'sedan', speed: 15 }));

  // forced merge: a TRUCK in the doomed lane signals right and moves out
  const f = TR.createGame({ mode: 'short' }); quiet(f);
  f.dist = 2000; TR.step(f, 1 / 60);
  f.dist = 2800; TR.step(f, 1 / 60);
  const truck = { kind: 'truck', lane: 0, targetLane: 0, s: 2900, x: -5.1, startX: -5.1, speed: 12, len: 10, moving: false, signalT: 0, changeCd: 99, passed: false, moveT: 1 };
  f.traffic.push(truck);
  TR.step(f, 1 / 60);
  eq('forced merge signals right', truck.targetLane, 1);
  ok('forced merge signal on', truck.signalT > 0);
  for (let i = 0; i < 120; i++) TR.step(f, 1 / 60); // signal 0.9 s + move 0.9 s
  eq('forced merge completed', truck.lane, 1);

  // forced merge waits when the survivor lane is blocked, then goes
  const b = TR.createGame({ mode: 'short' }); quiet(b);
  b.dist = 2000; TR.step(b, 1 / 60);
  b.dist = 2800; TR.step(b, 1 / 60);
  const stuck = { kind: 'sedan', lane: 0, targetLane: 0, s: 2900, x: -5.1, startX: -5.1, speed: 14, len: 4.4, moving: false, signalT: 0, changeCd: 99, passed: false, moveT: 1 };
  const blocker = { kind: 'sedan', lane: 1, targetLane: 1, s: 2910, x: -1.7, startX: -1.7, speed: 14, len: 4.4, moving: false, signalT: 0, changeCd: 99, passed: false, moveT: 1 };
  b.traffic.push(stuck, blocker);
  TR.step(b, 1 / 60);
  eq('blocked forced merge waits', stuck.signalT, 0);
  b.traffic = b.traffic.filter((v) => v !== blocker);
  TR.step(b, 1 / 60);
  ok('forced merge starts once clear', stuck.signalT > 0);

  // taper smoothness: idle player + car drift gradually, no snap at the line
  const sm = TR.createGame({ mode: 'short' }); quiet(sm);
  sm.dist = 2000; TR.step(sm, 1 / 60);
  sm.player.lane = 2; sm.player.targetLane = 2; sm.player.x = 1.7; sm.player.moveT = 1;
  const smCar = { kind: 'sedan', lane: 3, targetLane: 3, s: 3150, x: 5.1, startX: 5.1, speed: 14, len: 4.4, moving: false, signalT: 0, changeCd: 99, passed: false, moveT: 1 }; // 3150, not 3500: the forward cleanup drops cars > 350 m ahead (gap here is exactly 350 and only shrinks, the player is faster)
  sm.traffic.push(smCar);
  sm.dist = 2800;
  let maxJump = 0, prevPx = sm.player.x, prevCx = smCar.x, beforeLine = null;
  for (let i = 0; i < 6000 && sm.dist < 3000; i++) {
    TR.step(sm, 1 / 60);
    maxJump = Math.max(maxJump, Math.abs(sm.player.x - prevPx), Math.abs(smCar.x - prevCx));
    prevPx = sm.player.x; prevCx = smCar.x;
    if (sm.dist < 3000) beforeLine = { px: sm.player.x, cx: smCar.x };
  }
  TR.step(sm, 1 / 60); // cross the line
  ok('taper drift is smooth', maxJump < 0.1);
  ok('no snap at the line', Math.abs(sm.player.x - beforeLine.px) < 0.1 && Math.abs(smCar.x - beforeLine.cx) < 0.1);
  eq('player ends on new centre', sm.player.x, 0);
  eq('car ends on new centre', smCar.x, 3.4);

  // guard: no route ever decreases by 2+ (short, long, endless to 20 km)
  for (const mode of ['short', 'long']) {
    const g = TR.createGame({ mode }); quiet(g);
    let prev = g.segments[0].lanes;
    for (const sg of g.segments.slice(1)) { ok(mode + ' step down at most 1', sg.lanes >= prev - 1); prev = sg.lanes; }
  }
  const ge = TR.createGame({ mode: 'endless' }); quiet(ge);
  let guard = 0;
  while (ge.dist < 20000 && guard++ < 3000) {
    const before = ge.laneCount;
    TR.step(ge, 1);
    if (ge.laneCount !== before) { ok('endless step down at most 1', ge.laneCount >= before - 1); }
  }
  ok('endless driven to 20 km', ge.dist >= 20000);
}

// Fase 2W challenges — one fresh state per case, fields set directly;
// checkChallenges returns only newly completed keys, in def order.
{
  const ch = (st, finished, done) => TR.checkChallenges(st, finished, done || []);
  // setBrake tracks brake use for Tanpa Rem
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    eq('brakeUsed starts false', st.brakeUsed, false);
    TR.setBrake(st, true);
    eq('setBrake(true) marks brakeUsed', st.brakeUsed, true);
    TR.setBrake(st, false);
    eq('setBrake(false) does not clear brakeUsed', st.brakeUsed, true);
  }
  // irit: short finish, zero jerrycans (brake used, so tanpaRem stays out)
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.brakeUsed = true;
    eq('irit passes on clean short finish', ch(st, true), ['irit']);
    st.pickupCount = 1;
    eq('irit fails after one jerrycan', ch(st, true), []);
  }
  // tanpaRem: short finish, brake never touched (one jerrycan, so irit stays out)
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.pickupCount = 1;
    eq('tanpaRem passes with no braking', ch(st, true), ['tanpaRem']);
    st.brakeUsed = true;
    eq('tanpaRem fails after braking', ch(st, true), []);
  }
  // komboMaster (Fase 2AM): reaching combo x5 once in the run is the
  // skill — holding it to the exact finish instant was mostly luck
  // (measured: x5 reached in 7/9 runs, held at finish in only 2/4).
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.pickupCount = 1; st.brakeUsed = true; st.maxCombo = 5; st.combo = 0;
    eq('komboMaster passes on maxCombo x5 even if combo dropped', ch(st, true), ['komboMaster']);
    st.maxCombo = 4;
    eq('komboMaster fails at maxCombo x4', ch(st, true), []);
  }
  // badai: short + rain + zero crashes (isolated by jerrycan + brake)
  {
    const st = TR.createGame({ mode: 'short', condition: 'rain' }); quiet(st);
    st.pickupCount = 1; st.brakeUsed = true;
    eq('badai passes on clean rain finish', ch(st, true), ['badai']);
    st.crashes = 1;
    eq('badai fails after one crash', ch(st, true), []);
    const sd = TR.createGame({ mode: 'short', condition: 'day' }); quiet(sd);
    sd.pickupCount = 1; sd.brakeUsed = true;
    eq('badai fails in dry weather', ch(sd, true), []);
  }
  // tamuRest: long route, both rest stops used (isolated by jerrycan + brake)
  {
    const st = TR.createGame({ mode: 'long' }); quiet(st);
    st.pickupCount = 1; st.brakeUsed = true; st.restCount = 2;
    eq('tamuRest passes with both rests', ch(st, true), ['tamuRest']);
    st.restCount = 1;
    eq('tamuRest fails with one rest', ch(st, true), []);
    const sh = TR.createGame({ mode: 'short' }); quiet(sh);
    sh.pickupCount = 1; sh.brakeUsed = true; sh.restCount = 2;
    eq('tamuRest fails on short route', ch(sh, true), []);
  }
  // unfinished run grants nothing, even with perfect metrics
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    eq('no challenge on unfinished run', ch(st, false), []);
  }
  // already unlocked challenges are excluded
  {
    const st = TR.createGame({ mode: 'short' }); quiet(st);
    st.brakeUsed = true;
    eq('unlocked irit excluded', ch(st, true, ['irit']), []);
  }
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
