/* Tol Rush 3D — pure game logic (no DOM, no THREE, no audio). Testable in Node.
 * Design rules (from the approved MVP proposal):
 *  - 3 lanes, lane-snap controls, mission route 5000 m with one rest area.
 *  - Damage: 3 HP, a crash costs 1 HP, 0 HP = run over. No 1-hit death.
 *  - Fairness: a lane-changing car must signal first, may not close the
 *    last escape lane, and may not move into the player's lane when the
 *    player is close behind it. Spawns may never build a 3-lane wall.
 *  - Rest area: a timed decision window, not a lane-ramp puzzle. While the
 *    window is open the player may enter (button / R) to heal to full HP,
 *    gain bonus points and clear traffic just ahead. Missing it costs
 *    nothing except the bonus.
 */
'use strict';

const TR = {
  LANES: [-3.4, 0, 3.4],
  ROUTE_LEN: 5000,
  REST_AT: 2500,
  REST_OPEN_BEFORE: 300,   // window opens 300 m before the rest area
  REST_CLOSE_AFTER: 150,   // window closes 150 m after it
  SIGNAL_TIME: 0.9,        // seconds of indicator before a car starts moving
  LANE_MOVE_TIME: 0.9,     // seconds for a traffic car to finish changing lane
  PLAYER_MOVE_TIME: 0.22,  // seconds for the player to snap to a new lane
  MAX_HP: 3,
  CRASH_INVULN: 2.0,

  createGame() {
    return {
      status: 'play', // play | finished | over
      time: 0,
      dist: 0,
      speed: 20,
      hp: TR.MAX_HP,
      score: 0,
      bonus: 0,
      combo: 0,
      comboT: 0,
      nitro: 50,
      nitroOn: false,
      brake: false,
      player: { lane: 1, targetLane: 1, x: 0, startX: 0, moveT: 1 },
      traffic: [],
      spawnT: 1.2,
      rest: 'upcoming', // upcoming | open | used | missed
      crashT: 0,
      invuln: 0,
      events: [],
    };
  },

  baseSpeed(dist) {
    return 20 + Math.min(12, dist / 400);
  },

  spawnInterval(dist) {
    return Math.max(0.65, 1.5 - dist / 6000);
  },

  laneX(lane) { return TR.LANES[lane]; },

  moveLane(st, dir) {
    if (st.status !== 'play') return false;
    const p = st.player;
    if (p.moveT < 1) return false; // already snapping; input is short (0.22 s)
    const next = Math.max(0, Math.min(2, p.targetLane + dir));
    if (next === p.targetLane) return false;
    p.startX = p.x;
    p.targetLane = next;
    p.moveT = 0;
    return true;
  },

  setBrake(st, on) { st.brake = !!on; },
  setNitro(st, on) { st.nitroOn = !!on; },

  // Rest-area decision. Returns true only when the window is open.
  tryRest(st) {
    if (st.status !== 'play' || st.rest !== 'open') return false;
    st.rest = 'used';
    st.hp = TR.MAX_HP;
    st.bonus += 250;
    st.invuln = Math.max(st.invuln, 3);
    // Clear traffic just ahead so leaving the rest area is never an instant crash.
    st.traffic = st.traffic.filter((v) => (v.s - st.dist) < 0 || (v.s - st.dist) > 80);
    st.events.push({ t: 'rest', dist: st.dist });
    return true;
  },

  // Wall rule shared by spawns and lane changes: at position s, are the two
  // lanes other than `lane` both occupied within `win` metres?
  wallAt(st, s, lane, exclude) {
    const occupied = new Set();
    for (const v of st.traffic) {
      if (v === exclude) continue;
      if (Math.abs(v.s - s) <= 25 && v.lane !== lane) occupied.add(v.lane);
      // A car mid-change also occupies its target lane for fairness purposes.
      if (v.moving && Math.abs(v.s - s) <= 25 && v.targetLane !== lane) occupied.add(v.targetLane);
    }
    return occupied.size >= 2;
  },

  canChangeLane(st, v, target) {
    if (target < 0 || target > 2 || target === v.lane) return false;
    for (const o of st.traffic) {
      if (o === v) continue;
      if (o.lane === target && Math.abs(o.s - v.s) < 45) return false;
      if (o.moving && o.targetLane === target && Math.abs(o.s - v.s) < 45) return false;
    }
    // Never close the last escape lane.
    if (TR.wallAt(st, v.s, target, v)) return false;
    // Never cut into the player's lane when the player is close behind.
    const gapToPlayer = v.s - st.dist;
    if (target === st.player.targetLane && gapToPlayer > -5 && gapToPlayer < 40) return false;
    return true;
  },

  // Deterministic spawn used by tests and the live spawner. Returns the
  // vehicle, or null when a fairness rule blocks the spawn.
  spawnVehicle(st, opts) {
    const o = opts || {};
    const lane = o.lane !== undefined ? o.lane : Math.floor(Math.random() * 3);
    const gapAhead = o.gapAhead !== undefined ? o.gapAhead : 180 + Math.random() * 80;
    const s = st.dist + gapAhead;
    for (const v of st.traffic) {
      if (v.lane === lane && Math.abs(v.s - s) < 40) return null;
      if (v.moving && v.targetLane === lane && Math.abs(v.s - s) < 40) return null;
    }
    if (TR.wallAt(st, s, lane, null)) return null;
    const kind = o.kind || (Math.random() < 0.3 ? 'truck' : (Math.random() < 0.35 ? 'bus' : 'sedan'));
    const len = kind === 'truck' ? 10 : (kind === 'bus' ? 8.5 : 4.4);
    const speed = o.speed !== undefined ? o.speed
      : (kind === 'truck' ? 12 + Math.random() * 3
      : (kind === 'bus' ? 13 + Math.random() * 3 : 14 + Math.random() * 5));
    const v = {
      kind, lane, targetLane: lane, s, speed, len,
      x: TR.LANES[lane], startX: TR.LANES[lane], moveT: 1, moving: false,
      signalT: 0, changeCd: 2 + Math.random() * 4, passed: false,
      color: o.color !== undefined ? o.color : Math.floor(Math.random() * 360),
    };
    st.traffic.push(v);
    return v;
  },

  step(st, dt) {
    if (st.status !== 'play' || dt <= 0) return;
    st.time += dt;
    if (st.crashT > 0) st.crashT -= dt;
    if (st.invuln > 0) st.invuln -= dt;
    if (st.comboT > 0) {
      st.comboT -= dt;
      if (st.comboT <= 0) st.combo = 0;
    }

    // Speed: base rises with distance, brake slows, nitro boosts.
    let speed = TR.baseSpeed(st.dist);
    if (st.brake) speed *= 0.55;
    if (st.nitroOn && st.nitro > 0) {
      speed += 10;
      st.nitro = Math.max(0, st.nitro - 25 * dt);
    }
    if (st.crashT > 0) speed = Math.min(speed, 12);
    st.speed = speed;
    st.dist += speed * dt;

    // Player lane snap.
    const p = st.player;
    if (p.moveT < 1) {
      p.moveT = Math.min(1, p.moveT + dt / TR.PLAYER_MOVE_TIME);
      const e = 1 - Math.pow(1 - p.moveT, 2);
      p.x = p.startX + (TR.LANES[p.targetLane] - p.startX) * e;
      if (p.moveT >= 1) p.lane = p.targetLane;
    }

    // Rest-area window.
    if (st.rest === 'upcoming' && st.dist > TR.REST_AT + TR.REST_CLOSE_AFTER) {
      st.rest = 'missed'; // jumped past the window (e.g. a test teleport)
      st.events.push({ t: 'restMissed', dist: st.dist });
    } else if (st.rest === 'upcoming' && st.dist >= TR.REST_AT - TR.REST_OPEN_BEFORE) {
      st.rest = 'open';
      st.events.push({ t: 'restOpen', dist: st.dist });
    } else if (st.rest === 'open' && st.dist > TR.REST_AT + TR.REST_CLOSE_AFTER) {
      st.rest = 'missed';
      st.events.push({ t: 'restMissed', dist: st.dist });
    }

    // Spawner.
    st.spawnT -= dt;
    if (st.spawnT <= 0) {
      TR.spawnVehicle(st);
      st.spawnT = TR.spawnInterval(st.dist) * (0.8 + Math.random() * 0.4);
    }

    // Traffic update, lane changes, collisions, overtakes.
    for (const v of st.traffic) {
      if (v.signalT > 0) {
        v.signalT -= dt;
        if (v.signalT <= 0) {
          v.moving = true; v.moveT = 0; v.startX = v.x;
        }
      } else if (v.moving) {
        v.moveT = Math.min(1, v.moveT + dt / TR.LANE_MOVE_TIME);
        const e = v.moveT * v.moveT * (3 - 2 * v.moveT);
        v.x = v.startX + (TR.LANES[v.targetLane] - v.startX) * e;
        if (v.moveT >= 1) { v.lane = v.targetLane; v.moving = false; }
      } else if ((v.kind === 'sedan') && st.status === 'play') {
        // Only sedans change lanes, and only after signalling.
        v.changeCd -= dt;
        if (v.changeCd <= 0) {
          v.changeCd = 3 + Math.random() * 5;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const target = v.lane + dir;
          if (TR.canChangeLane(st, v, target)) {
            v.targetLane = target;
            v.signalT = TR.SIGNAL_TIME;
            st.events.push({ t: 'signal', lane: v.lane, target });
          }
        }
      }

      const gap = v.s - st.dist;
      const dx = Math.abs(st.player.x - v.x);
      if (st.invuln <= 0 && Math.abs(gap) < (v.len / 2 + 2.2) && dx < 1.7) {
        st.hp -= 1;
        st.crashT = 1.0;
        st.invuln = TR.CRASH_INVULN;
        st.combo = 0; st.comboT = 0;
        st.events.push({ t: 'crash', hp: st.hp });
        v.passed = true; // do not also count this car as a near-miss
        v.s = st.dist - 100; // drop it behind so it cannot hit twice
        if (st.hp <= 0) {
          st.status = 'over';
          st.events.push({ t: 'over', dist: st.dist });
        }
        continue;
      }
      if (!v.passed && gap < -(v.len / 2 + 2.2)) {
        v.passed = true;
        if (dx >= 1.7 && dx <= 4.5) {
          st.combo = Math.min(5, st.combo + 1);
          st.comboT = 6;
          const pts = 50 * st.combo;
          st.bonus += pts;
          st.nitro = Math.min(100, st.nitro + 20);
          st.events.push({ t: 'near', combo: st.combo, pts });
        }
      }
    }
    st.traffic = st.traffic.filter((v) => (v.s - st.dist) > -30);

    st.score = Math.floor(st.dist) + st.bonus;

    if (st.status === 'play' && st.dist >= TR.ROUTE_LEN) {
      st.dist = TR.ROUTE_LEN;
      st.bonus += 500 + st.hp * 200;
      st.score = Math.floor(st.dist) + st.bonus;
      st.status = 'finished';
      st.events.push({ t: 'finish', score: st.score, hp: st.hp });
    }
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = TR;
