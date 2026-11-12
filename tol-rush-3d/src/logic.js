/* Tol Rush 3D — pure game logic (no DOM, no THREE, no audio). Testable in Node.
 * Design rules (from the approved MVP proposal, extended in Fase 2A):
 *  - 3 lanes, lane-snap controls. Modes: 'short' (5 km, 1 rest area),
 *    'long' (10 km, 2 rest areas), 'endless' (no finish, rest areas recur).
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
  LANES: [-3.4, 0, 3.4], // default 3-lane layout, kept for callers/tests
  // Lane-centre x per lane count (spacing stays 3.4 m, road stays centred).
  LANE_X: { 2: [-1.7, 1.7], 3: [-3.4, 0, 3.4], 4: [-5.1, -1.7, 1.7, 5.1] },
  SEGMENT_WARN: 300, // gantry/HUD warning this far before a lane-count change
  TRANSITION_LEN: 200, // taper zone before a lane-count line: centres interpolate over this distance
  ROUTE_LEN: 5000, // default (short) route, kept for callers/tests
  REST_AT: 2500,   // default (short) route rest area, kept for callers/tests
  ROUTES: {
    // segments: lane count from `at` (metres) until the next segment line
    short: { len: 5000, rests: [2500], segments: [{ at: 0, lanes: 3 }, { at: 1500, lanes: 4 }, { at: 3000, lanes: 3 }, { at: 4000, lanes: 2 }] },
    long: { len: 10000, rests: [3000, 6500], segments: [{ at: 0, lanes: 3 }, { at: 2000, lanes: 4 }, { at: 4500, lanes: 3 }, { at: 6000, lanes: 2 }, { at: 8000, lanes: 4 }] },
    endless: { len: Infinity, rests: [2500], restEvery: 3500, segments: [{ at: 0, lanes: 3 }] },
  },
  REST_OPEN_BEFORE: 300,   // window opens 300 m before the rest area
  REST_CLOSE_AFTER: 150,   // window closes 150 m after it
  SIGNAL_TIME: 0.9,        // seconds of indicator before a car starts moving
  LANE_MOVE_TIME: 0.9,     // seconds for a traffic car to finish changing lane
  PLAYER_MOVE_TIME: 0.22,  // seconds for the player to snap to a new lane
  MAX_HP: 3,
  CRASH_INVULN: 2.0,
  // Fuel: litres-equivalent points, drained per metre travelled.
  FUEL_DRAIN: 0.022,        // normal driving
  FUEL_DRAIN_NITRO: 0.045,  // nitro burns roughly double
  FUEL_DRAIN_BRAKE: 0.012,  // coasting/braking sips fuel
  FUEL_PICKUP: 30,
  FUEL_LIMP_SPEED: 8,       // crawl speed on an empty tank (not instant death)
  UPGRADE_COSTS: [60, 120, 200, 300], // per level 1..3, same for every track
  UPGRADE_MAX: 3,
  // Roadworks + convoys (Fase 2I): a roadwork zone closes ONE lane over a
  // stretch; convoys are slow truck/bus groups leaving exactly one gap lane.
  ROADWORK_LEN: 220, ROADWORK_GAP_MIN: 1500, ROADWORK_GAP_MAX: 2600,
  ROADWORK_FIRST: 1200, ROADWORK_WARN: 300,
  CONVOY_FIRST: 1800, CONVOY_GAP_MIN: 2500, CONVOY_GAP_MAX: 4500,
  // Shield pickup (Fase 2K): rare, absorbs exactly one crash, never stacks.
  SHIELD_FIRST: 900, SHIELD_GAP_MIN: 2500, SHIELD_GAP_MAX: 4500, SHIELD_DUP_BONUS: 25,
  // Cars: cost in coins; speed/move/fuel are multipliers on the base values,
  // hp is bonus max HP on top of the Armor upgrade.
  CARS: {
    city: { cost: 0, speed: 1.0, move: 1.0, fuel: 1.0, hp: 0, kind: 'sedan', color: 0xff6a1a },
    lincah: { cost: 300, speed: 0.95, move: 0.85, fuel: 1.0, hp: 0, kind: 'hatch', color: 0x2bd9a8 },
    suv: { cost: 500, speed: 0.92, move: 1.10, fuel: 1.15, hp: 1, kind: 'suv', color: 0x4a7dff },
    sport: { cost: 800, speed: 1.12, move: 0.90, fuel: 1.25, hp: 0, kind: 'sport', color: 0xe03131 },
  },

  createGame(opts) {
    const o = opts || {};
    const mode = TR.ROUTES[o.mode] ? o.mode : 'short';
    const route = TR.ROUTES[mode];
    const up = o.upgrades || {};
    const lvl = (v) => Math.max(0, Math.min(TR.UPGRADE_MAX, Math.floor(v || 0)));
    const upgrades = { handling: lvl(up.handling), brake: lvl(up.brake), armor: lvl(up.armor), tank: lvl(up.tank) };
    const carKey = TR.CARS[o.car] ? o.car : 'city';
    const car = TR.CARS[carKey];
    const maxHp = TR.MAX_HP + upgrades.armor + car.hp;
    const maxFuel = 100 + upgrades.tank * 20;
    // Condition: day / night / rain; 'random' picks one per run, unknown falls back to day.
    const conds = ['day', 'night', 'rain'];
    let condition = conds.includes(o.condition) ? o.condition : 'day';
    if (o.condition === 'random') condition = conds[Math.floor(Math.random() * conds.length)];
    let moveTime = Math.max(0.10, Math.max(0.13, TR.PLAYER_MOVE_TIME - upgrades.handling * 0.03) * car.move);
    // Fase 2N balance: base brake must hold behind the slowest truck (12)
    // even at max base speed (32): 32 * 0.36 = 11.5 < 12. The old 0.55 gave
    // 17.6 at max speed, so braking behind a truck still closed in at
    // ~5 m/s and walls became unavoidable crashes.
    let brakeFactor = 0.36 - upgrades.brake * 0.04;
    let sightRange = 190;
    if (condition === 'night') sightRange = 110; // headlight range: cars appear later
    if (condition === 'rain') { moveTime += 0.04; brakeFactor = Math.min(0.9, brakeFactor * 1.15); } // wet grip: slower snap, weaker brakes
    return {
      status: 'play', // play | finished | over
      mode,
      condition,
      sightRange,
      segments: route.segments.map((s) => ({ at: s.at, lanes: s.lanes })),
      laneCount: route.segments[0].lanes,
      laneXs: TR.LANE_X[route.segments[0].lanes],
      laneChangedDist: -1e9,
      warnedSegmentAt: null,
      routeLen: route.len,
      upgrades,
      car: carKey, carKind: car.kind, carColor: car.color,
      speedFactor: car.speed, fuelFactor: car.fuel,
      moveTime,
      brakeFactor,
      time: 0,
      dist: 0,
      speed: 20,
      hp: maxHp,
      maxHp,
      fuel: maxFuel,
      maxFuel,
      pickups: [],
      nextPickupAt: 700 + Math.random() * 300,
      shield: false, shieldPickups: 0, shieldSaves: 0,
      nextShieldAt: TR.SHIELD_FIRST + Math.random() * 300,
      fuelLow: false,
      fuelCritical: false,
      score: 0,
      bonus: 0,
      // run metrics for missions + achievements (Fase 2H) + challenges (2W)
      crashes: 0, pickupCount: 0, nearMisses: 0, maxCombo: 0, restCount: 0, fuelEmpty: false, brakeUsed: false,
      combo: 0,
      comboT: 0,
      nitro: 50,
      nitroOn: false,
      brake: false,
      player: { lane: 1, targetLane: 1, x: 0, startX: 0, moveT: 1 },
      traffic: [],
      spawnT: 1.2,
      restStops: route.rests.map((at) => ({ at, state: 'upcoming' })),
      roadworks: [],
      nextRoadworkAt: TR.ROADWORK_FIRST,
      nextConvoyAt: TR.CONVOY_FIRST,
      crashT: 0,
      invuln: 0,
      events: [],
    };
  },

  // The rest stop whose window is currently open, or null.
  openRestStop(st) {
    return st.restStops.find((s) => s.state === 'open') || null;
  },

  // The next rest stop the player has not passed yet (upcoming or open).
  nextRestStop(st) {
    return st.restStops.find((s) => s.state === 'upcoming' || s.state === 'open') || null;
  },

  // True when `lane` at route position `s` is a lane about to vanish: the
  // next decrease line after `s` lies within warning distance ahead of it.
  // (The line considered is the first one after `s`, not after the player,
  // so spawns and cars ahead of the player are judged by their own spot.)
  isDoomedLaneAt(st, lane, s) {
    if (lane !== 0) return false;
    const seg = st.segments.find((sg) => sg.at > s);
    if (!seg) return false;
    return seg.lanes < TR.laneCountAt(st, s) && seg.at - s <= TR.SEGMENT_WARN;
  },

  // Lane count at a distance (last segment line at or before it).
  laneCountAt(st, dist) {
    let lanes = st.segments[0].lanes;
    for (const seg of st.segments) {
      if (dist >= seg.at) lanes = seg.lanes; else break;
    }
    return lanes;
  },

  // The next lane-count change ahead of the player, or null.
  nextSegmentChange(st) {
    return st.segments.find((seg) => seg.at > st.dist) || null;
  },

  // ---------- gradual lane-count transitions (Fase 2Q) ----------
  // The road stays centred on a 3.4 m lattice, so a one-step change shifts
  // every lane centre by 1.7 m. Mapping across a line:
  //   -1: the LEFTMOST lane (index 0) closes; survivors shift down one index.
  //   +1: a lane opens on the RIGHT; old indices stay.
  //   +2: one lane opens on EACH side (only 2 -> 4); old indices shift +1.
  // A decrease of 2+ never occurs: the route tables and a test guard forbid it.
  mapLane(from, to, oldLane) {
    if (to === from - 1) return oldLane === 0 ? -1 : oldLane - 1;
    if (to === from + 1) return oldLane;
    if (to === from + 2) return oldLane + 1;
    return oldLane;
  },

  // The transition being approached (within warning distance) or tapered
  // through, or null. `p` is taper progress: 0 during approach, 0..1 in the
  // 200 m zone, and the caller handles the line itself via laneCountAt.
  // `doomed` is the vanishing lane index in the OLD layout, or -1.
  transitionInfo(st) {
    const next = TR.nextSegmentChange(st);
    if (!next || next.lanes === st.laneCount) return null;
    const gap = next.at - st.dist;
    if (gap > TR.SEGMENT_WARN) return null;
    const p = gap <= 0 ? 1 : Math.max(0, 1 - gap / TR.TRANSITION_LEN);
    return { from: st.laneCount, to: next.lanes, line: next.at, p, doomed: next.lanes < st.laneCount ? 0 : -1 };
  },

  // Lane centres (OLD-indexed) at taper progress p: each surviving lane
  // interpolates to its new centre; the doomed lane converges onto the new
  // lane 0, i.e. it merges into its neighbour over the zone. The progress
  // is eased (smoothstep) so lanes bend gradually — straight at both ends
  // of the zone — matching the taper marking lines. p=0/0.5/1 are unchanged.
  taperLaneXs(from, to, p) {
    const fromXs = TR.LANE_X[from], toXs = TR.LANE_X[to];
    const e = p * p * (3 - 2 * p);
    const out = [];
    for (let i = 0; i < from; i++) {
      const j = TR.mapLane(from, to, i);
      const dest = j < 0 ? toXs[0] : toXs[j];
      out.push(fromXs[i] + (dest - fromXs[i]) * e);
    }
    return out;
  },

  // Marking lines for the taper visuals: each [xAtZoneStart, xAtLine].
  // Edges always interpolate; the doomed divider pinches into the new left
  // edge on a decrease; a new divider forks from the old right edge on a
  // +1; on a +2 the new dividers start pinched at the old edges.
  MARKINGS: { 2: { edges: [-3.4, 3.4], dividers: [0] }, 3: { edges: [-5.1, 5.1], dividers: [-1.7, 1.7] }, 4: { edges: [-6.8, 6.8], dividers: [-3.4, 0, 3.4] } },
  taperLines(from, to) {
    const M = TR.MARKINGS, o = M[from], n = M[to];
    const lines = [[o.edges[0], n.edges[0]], [o.edges[1], n.edges[1]]];
    if (to === from - 1) {
      lines.push([o.dividers[0], n.edges[0]]);
      for (let i = 1; i < o.dividers.length; i++) lines.push([o.dividers[i], n.dividers[i - 1]]);
    } else if (to === from + 1) {
      for (let i = 0; i < o.dividers.length; i++) lines.push([o.dividers[i], n.dividers[i]]);
      lines.push([o.edges[1], n.dividers[n.dividers.length - 1]]);
    } else if (to === from + 2) {
      lines.push([o.dividers[0], n.dividers[1]]);
      lines.push([o.edges[0], n.dividers[0]]);
      lines.push([o.edges[1], n.dividers[2]]);
    }
    return lines;
  },

  baseSpeed(dist) {
    return 20 + Math.min(12, dist / 400);
  },

  spawnInterval(dist) {
    // Fase 2N balance: sparser traffic (was 1.5 s -> 0.65 s floor) so
    // all-lanes-blocked walls form less often and leave real gaps.
    return Math.max(1.0, 1.9 - dist / 6000);
  },

  laneX(lane) { return TR.LANES[lane]; },

  // Roadwork zone covering position s, or null. A zone only counts where
  // its closed lane still exists in the lane layout at s (a segment line
  // inside a zone can shrink the road below the closed lane's index).
  zoneAt(st, s) {
    return st.roadworks.find((z) => s >= z.at && s < z.at + z.len && z.lane < TR.laneCountAt(st, s)) || null;
  },
  nextRoadwork(st) {
    return st.roadworks.find((z) => z.at > st.dist) || null;
  },

  moveLane(st, dir) {
    if (st.status !== 'play') return false;
    const p = st.player;
    if (p.moveT < 1) return false; // already snapping; input is short (0.22 s)
    const next = Math.max(0, Math.min(st.laneCount - 1, p.targetLane + dir));
    if (next === p.targetLane) return false;
    // Cannot move into a lane closed by roadworks at the player's position.
    const zone = TR.zoneAt(st, st.dist);
    if (zone && next === zone.lane) return false;
    // Cannot move into a lane that is about to vanish (decrease approach/taper).
    const info = TR.transitionInfo(st);
    if (info && info.doomed >= 0 && next === info.doomed) return false;
    p.startX = p.x;
    p.targetLane = next;
    p.moveT = 0;
    return true;
  },

  setBrake(st, on) { st.brake = !!on; if (on) st.brakeUsed = true; }, // brakeUsed feeds the Tanpa Rem challenge (2W)
  setNitro(st, on) { st.nitroOn = !!on; },

  // Rest-area decision. Returns true only when a stop's window is open.
  tryRest(st) {
    if (st.status !== 'play') return false;
    const stop = TR.openRestStop(st);
    if (!stop) return false;
    stop.state = 'used';
    st.restCount += 1;
    st.hp = st.maxHp;
    st.fuel = st.maxFuel;
    st.bonus += 250;
    st.invuln = Math.max(st.invuln, 3);
    // Clear traffic just ahead so leaving the rest area is never an instant crash.
    st.traffic = st.traffic.filter((v) => (v.s - st.dist) < 0 || (v.s - st.dist) > 80);
    st.events.push({ t: 'rest', dist: st.dist, at: stop.at });
    return true;
  },

  // Wall rule shared by spawns and lane changes: at position s, are ALL
  // lanes other than `lane` occupied within 25 metres? (2 lanes: the other
  // lane alone is a wall; 4 lanes: all three others must be blocked.)
  wallAt(st, s, lane, exclude) {
    // Open lanes at s: a roadwork-closed lane is neither an escape lane nor
    // an occupied lane for fairness purposes. A lane about to vanish counts
    // the same way during a decrease approach (it is no escape lane).
    const zone = TR.zoneAt(st, s);
    const lanes = TR.laneCountAt(st, s);
    const doomed = TR.isDoomedLaneAt(st, 0, s) ? 0 : -1;
    const closedCount = (zone ? 1 : 0) + (doomed >= 0 ? 1 : 0);
    const openCount = lanes - closedCount;
    const occupied = new Set();
    for (const v of st.traffic) {
      if (v === exclude) continue;
      if (zone && v.lane === zone.lane) continue;
      if (doomed >= 0 && v.lane === doomed) continue;
      if (Math.abs(v.s - s) <= 25 && v.lane !== lane) occupied.add(v.lane);
      // A car mid-change also occupies its target lane for fairness purposes.
      if (v.moving && Math.abs(v.s - s) <= 25 && v.targetLane !== lane && !(zone && v.targetLane === zone.lane) && v.targetLane !== doomed) occupied.add(v.targetLane);
    }
    return occupied.size >= openCount - 1;
  },

  canChangeLane(st, v, target) {
    if (target < 0 || target > st.laneCount - 1 || target === v.lane) return false;
    // Sedans never change into a roadwork-closed lane.
    const zone = TR.zoneAt(st, v.s);
    if (zone && target === zone.lane) return false;
    // Never change into a lane that is about to vanish (decrease approach).
    if (TR.isDoomedLaneAt(st, target, v.s)) return false;
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
    const lane = o.lane !== undefined ? o.lane : Math.floor(Math.random() * st.laneCount);
    const gapAhead = o.gapAhead !== undefined ? o.gapAhead : 180 + Math.random() * 80;
    const s = st.dist + gapAhead;
    // Never spawn traffic inside a roadwork-closed lane.
    const zoneAtS = TR.zoneAt(st, s);
    if (zoneAtS && lane === zoneAtS.lane) return null;
    // Never spawn in a lane that is about to vanish (decrease approach/taper).
    if (TR.isDoomedLaneAt(st, lane, s)) return null;
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
      x: st.laneXs[lane], startX: st.laneXs[lane], moveT: 1, moving: false,
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
    let speed = TR.baseSpeed(st.dist) * st.speedFactor;
    const nitroActive = st.nitroOn && st.nitro > 0;
    if (st.brake) speed *= st.brakeFactor;
    if (nitroActive) {
      speed += 10;
      st.nitro = Math.max(0, st.nitro - 25 * dt);
    }
    if (st.crashT > 0) speed = Math.min(speed, 12);
    if (st.fuel <= 0) speed = Math.min(speed, TR.FUEL_LIMP_SPEED); // empty tank: crawl, not instant death
    st.speed = speed;
    const travelled = speed * dt;
    st.dist += travelled;

    // Fuel: drained per metre; nitro burns double, braking sips.
    if (st.fuel > 0) {
      const rate = (nitroActive ? TR.FUEL_DRAIN_NITRO : (st.brake ? TR.FUEL_DRAIN_BRAKE : TR.FUEL_DRAIN)) * st.fuelFactor;
      st.fuel = Math.max(0, st.fuel - travelled * rate);
      if (st.fuel === 0) st.fuelEmpty = true;
    }
    if (!st.fuelLow && st.fuel <= st.maxFuel * 0.25) {
      st.fuelLow = true;
      st.events.push({ t: 'fuelLow', fuel: st.fuel });
    }
    if (!st.fuelCritical && st.fuel <= st.maxFuel * 0.10) {
      st.fuelCritical = true;
      st.events.push({ t: 'fuelCritical', fuel: st.fuel });
    }

    // Lane-count segments (Fase 2Q): warn 300 m ahead, taper the lane
    // centres over the last 200 m, then remap indices at the segment line.
    // The warning was computed from the previous step's segments, which for
    // endless already extend 3000 m ahead, so the next change is always known.
    const nextSeg = TR.nextSegmentChange(st);
    if (nextSeg && nextSeg.at - st.dist <= TR.SEGMENT_WARN && st.warnedSegmentAt !== nextSeg.at) {
      st.warnedSegmentAt = nextSeg.at;
      st.events.push({ t: 'lanesAhead', lanes: nextSeg.lanes, at: nextSeg.at });
    }
    const newCount = TR.laneCountAt(st, st.dist);
    if (newCount !== st.laneCount) {
      // Line crossed: remap every lane index across it. The taper already
      // drifted every x to (almost) its new centre, so this is not a snap
      // except for the safety nets below.
      const from = st.laneCount, to = newCount;
      const crossedSeg = [...st.segments].reverse().find((sg) => sg.at <= st.dist);
      const line = crossedSeg ? crossedSeg.at : st.dist;
      st.laneCount = to;
      st.laneXs = TR.LANE_X[to];
      st.laneChangedDist = st.dist;
      // Player: remap indices. A doomed lane merges into new lane 0 (not
      // the old clamp-to-last-lane); a doomed target means stay in the
      // remapped current lane; out-of-range indices clamp to the last lane.
      // A clean mid-move keeps animating to its remapped target, which it
      // already nearly reached during the taper.
      const p0 = st.player;
      const pl = TR.mapLane(from, to, p0.lane), pt = TR.mapLane(from, to, p0.targetLane);
      const nl = pl < 0 ? 0 : Math.min(pl, to - 1);
      const nt = pt < 0 ? nl : Math.min(pt, to - 1);
      const changed = (nl !== pl || nt !== pt);
      p0.lane = nl; p0.targetLane = nt;
      if (p0.moveT >= 1 || changed) { p0.x = st.laneXs[nl]; if (changed) p0.moveT = 1; }
      // Traffic: remap; a doomed-lane car still before the line vanishes
      // (rare fallback — forced merges normally vacate it during approach).
      // A doomed-lane car already beyond the line is already in new lane 0.
      const kept = [];
      for (const v of st.traffic) {
        const nl = TR.mapLane(from, to, v.lane), nt = TR.mapLane(from, to, v.targetLane);
        if (nl >= to || nt >= to) continue;
        if ((nl < 0 || nt < 0) && v.s < line) continue;
        v.lane = nl < 0 ? 0 : nl;
        v.targetLane = nt < 0 ? 0 : nt;
        if (!v.moving && v.signalT <= 0) { v.x = v.startX = st.laneXs[v.lane]; }
        kept.push(v);
      }
      st.traffic = kept;
      // Pickups: same remap (doomed-lane pickups before the line go away).
      st.pickups = st.pickups.filter((pk) => {
        const nl = TR.mapLane(from, to, pk.lane);
        if (nl < 0 && pk.s < line) return false;
        if (nl >= to) return false;
        pk.lane = nl < 0 ? 0 : nl; pk.x = st.laneXs[pk.lane];
        return true;
      });
      st.events.push({ t: 'lanesChanged', lanes: to });
    } else if (nextSeg && nextSeg.lanes !== st.laneCount && nextSeg.at - st.dist <= TR.TRANSITION_LEN) {
      // Inside the taper zone: interpolate centres (old-indexed) and drift
      // everything idle along with them, so the whole road bends smoothly.
      const p = 1 - (nextSeg.at - st.dist) / TR.TRANSITION_LEN;
      st.laneXs = TR.taperLaneXs(st.laneCount, nextSeg.lanes, p);
      const pp = st.player;
      if (pp.moveT >= 1) pp.x = st.laneXs[pp.lane];
      for (const v of st.traffic) if (!v.moving) { v.x = st.laneXs[v.lane]; v.startX = v.x; }
      for (const pk of st.pickups) pk.x = st.laneXs[pk.lane];
    }

    // Player lane snap.
    const p = st.player;
    if (p.moveT < 1) {
      p.moveT = Math.min(1, p.moveT + dt / st.moveTime);
      const e = 1 - Math.pow(1 - p.moveT, 2);
      p.x = p.startX + (st.laneXs[p.targetLane] - p.startX) * e;
      if (p.moveT >= 1) p.lane = p.targetLane;
    }

    // Entering a roadwork zone while sitting in the closed lane: auto-nudge
    // to the nearest open lane. The 300 m warning gave time to move first,
    // so this only fires for players who ignored it (or were mid-change).
    const zoneNow = TR.zoneAt(st, st.dist);
    if (zoneNow && p.lane === zoneNow.lane && p.targetLane === zoneNow.lane) {
      let best = -1, bestD = 99;
      for (let l = 0; l < st.laneCount; l++) {
        if (l !== zoneNow.lane && Math.abs(l - zoneNow.lane) < bestD) { best = l; bestD = Math.abs(l - zoneNow.lane); }
      }
      if (best >= 0) {
        p.lane = best; p.targetLane = best; p.x = st.laneXs[best]; p.moveT = 1;
        st.events.push({ t: 'nudged', lane: best });
      }
    }

    // Rest-area windows (one per stop; endless mode appends new stops).
    for (const stop of st.restStops) {
      if (stop.state === 'upcoming' && st.dist > stop.at + TR.REST_CLOSE_AFTER) {
        stop.state = 'missed'; // jumped past the window (e.g. a test teleport)
        st.events.push({ t: 'restMissed', dist: st.dist, at: stop.at });
      } else if (stop.state === 'upcoming' && st.dist >= stop.at - TR.REST_OPEN_BEFORE) {
        stop.state = 'open';
        st.events.push({ t: 'restOpen', dist: st.dist, at: stop.at });
      } else if (stop.state === 'open' && st.dist > stop.at + TR.REST_CLOSE_AFTER) {
        stop.state = 'missed';
        st.events.push({ t: 'restMissed', dist: st.dist, at: stop.at });
      }
    }
    if (st.mode === 'endless') {
      const every = TR.ROUTES.endless.restEvery;
      let last = st.restStops[st.restStops.length - 1];
      while (last.at < st.dist + 3000) {
        last = { at: last.at + every, state: 'upcoming' };
        st.restStops.push(last);
      }
      // Endless lane cycle: 3 -> 4 -> 3 -> 2 ... every 2000 m.
      // (Fase 2Q: decreases are at most 1, so 4 -> 2 is gone.)
      const cycle = [4, 3, 2];
      let lastSeg = st.segments[st.segments.length - 1];
      while (lastSeg.at < st.dist + 3000) {
        lastSeg = { at: lastSeg.at + 2000, lanes: cycle[(st.segments.length - 1) % 3] };
        st.segments.push(lastSeg);
      }
    }

    // Spawner.
    st.spawnT -= dt;
    if (st.spawnT <= 0) {
      TR.spawnVehicle(st);
      st.spawnT = TR.spawnInterval(st.dist) * (0.8 + Math.random() * 0.4);
    }

    // Fuel pickup spawner: never on top of a car in the same lane, and
    // never inside a roadwork-closed lane (the player cannot enter it).
    if (st.dist >= st.nextPickupAt) {
      const startLane = Math.floor(Math.random() * st.laneCount);
      for (let k = 0; k < st.laneCount; k++) {
        const lane = (startLane + k) % st.laneCount;
        const s = st.dist + 180 + Math.random() * 60;
        const pkZone = TR.zoneAt(st, s);
        const blocked = st.traffic.some((v) => v.lane === lane && Math.abs(v.s - s) < 25) || (pkZone && lane === pkZone.lane) || TR.isDoomedLaneAt(st, lane, s);
        if (!blocked) {
          st.pickups.push({ lane, s, x: st.laneXs[lane], taken: false, kind: 'fuel' });
          break;
        }
      }
      st.nextPickupAt = st.dist + 900 + Math.random() * 600;
    }

    // Shield pickup spawner (Fase 2K): separate from fuel so it never
    // starves the fuel economy, and at most one live shield on the road.
    // Same fairness guards as fuel: never on a car, never in a closed lane.
    if (st.dist >= st.nextShieldAt) {
      const hasLiveShield = st.pickups.some((pk) => !pk.taken && pk.kind === 'shield');
      if (!hasLiveShield) {
        const startLane = Math.floor(Math.random() * st.laneCount);
        for (let k = 0; k < st.laneCount; k++) {
          const lane = (startLane + k) % st.laneCount;
          const s = st.dist + 180 + Math.random() * 60;
          const pkZone = TR.zoneAt(st, s);
          const blocked = st.traffic.some((v) => v.lane === lane && Math.abs(v.s - s) < 25) || (pkZone && lane === pkZone.lane) || TR.isDoomedLaneAt(st, lane, s);
          if (!blocked) {
            st.pickups.push({ lane, s, x: st.laneXs[lane], taken: false, kind: 'shield' });
            break;
          }
        }
      }
      st.nextShieldAt = st.dist + TR.SHIELD_GAP_MIN + Math.random() * (TR.SHIELD_GAP_MAX - TR.SHIELD_GAP_MIN);
    }

    // Roadwork spawner: zones are created 400 m ahead so the 300 m warning
    // always precedes them. Only where the road has >= 3 lanes (closing one
    // must leave at least 2 open), and only if the whole zone fits before
    // a mission route's exit.
    if (st.dist + 400 >= st.nextRoadworkAt) {
      const at = st.nextRoadworkAt;
      const lanes = TR.laneCountAt(st, at);
      const fits = st.mode === 'endless' || at + TR.ROADWORK_LEN < st.routeLen;
      if (lanes >= 3 && fits) {
        // Close an EDGE lane only (0 or lanes-1). A middle closure strands
        // the player: with 3 lanes the two open lanes are not adjacent, so
        // a player behind a slow car in either lane has no dodge (moving
        // into the closed lane is refused); with 4 lanes an inner closure
        // isolates the neighbouring edge lane the same way. Edge closure
        // keeps the open lanes one connected chain, so there is always a
        // neighbouring open lane to dodge into.
        const closedLane = Math.random() < 0.5 ? 0 : lanes - 1;
        st.roadworks.push({ at, len: TR.ROADWORK_LEN, lane: closedLane });
      }
      st.nextRoadworkAt = at + TR.ROADWORK_LEN + TR.ROADWORK_GAP_MIN + Math.random() * (TR.ROADWORK_GAP_MAX - TR.ROADWORK_GAP_MIN);
    }
    st.roadworks = st.roadworks.filter((z) => z.at + z.len > st.dist - 50);

    // Convoy spawner: slow trucks/buses in every lane except one gap lane.
    // Trucks and buses never change lanes, so the formation holds.
    if (st.dist + (st.sightRange || 190) >= st.nextConvoyAt) {
      const at = st.nextConvoyAt;
      const lanes = TR.laneCountAt(st, at);
      const fits = st.mode === 'endless' || at < st.routeLen - 100;
      if (lanes >= 2 && fits) {
        const gapLane = Math.floor(Math.random() * lanes);
        for (let l = 0; l < lanes; l++) {
          if (l === gapLane) continue;
          const v = TR.spawnVehicle(st, { lane: l, gapAhead: at - st.dist + (Math.random() * 20 - 10), kind: Math.random() < 0.6 ? 'truck' : 'bus', speed: 11 + Math.random() * 2 });
          if (v) v.convoy = true;
        }
        st.events.push({ t: 'convoy', at });
      }
      st.nextConvoyAt = at + TR.CONVOY_GAP_MIN + Math.random() * (TR.CONVOY_GAP_MAX - TR.CONVOY_GAP_MIN);
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
        v.x = v.startX + (st.laneXs[v.targetLane] - v.startX) * e;
        if (v.moveT >= 1) { v.lane = v.targetLane; v.moving = false; }
      } else if (v.s >= st.dist && TR.isDoomedLaneAt(st, v.lane, v.s) && st.status === 'play') {
        // Forced merge (Fase 2Q): ANY vehicle stuck in a vanishing lane
        // must vacate it with a proper signal, whatever its kind (trucks
        // and buses included — the old sedan-only rule would strand them).
        // No speed tricks are needed: the deadline is the PLAYER crossing
        // the line (300 m of player travel from the warning), so a blocked
        // car simply waits and retries. Clearance mirrors canChangeLane
        // minus the wall rule (the lane is going away) but keeps the 45 m
        // gap and the player-proximity guard.
        const target = 1; // the doomed lane is always 0; its survivor is 1
        let clear = true;
        for (const o of st.traffic) {
          if (o === v) continue;
          if (o.lane === target && Math.abs(o.s - v.s) < 45) { clear = false; break; }
          if (o.moving && o.targetLane === target && Math.abs(o.s - v.s) < 45) { clear = false; break; }
        }
        const fz = TR.zoneAt(st, v.s);
        if (fz && target === fz.lane) clear = false;
        const gapToPlayer = v.s - st.dist;
        if (target === st.player.targetLane && gapToPlayer > -5 && gapToPlayer < 40) clear = false;
        if (clear) {
          v.targetLane = target;
          v.signalT = TR.SIGNAL_TIME;
          st.events.push({ t: 'signal', lane: v.lane, target });
        }
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
        if (st.shield) {
          // Shield absorbs exactly one crash: no HP loss, no crash count,
          // combo survives. Brief shake + invulnerability so the same car
          // cannot hit twice; the car is dropped behind like a real crash.
          st.shield = false; st.shieldSaves += 1;
          st.crashT = 0.6; st.invuln = TR.CRASH_INVULN;
          st.events.push({ t: 'shieldSave' });
          v.passed = true;
          v.s = st.dist - 100;
          continue;
        }
        st.hp -= 1;
        st.crashes += 1;
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
          st.nearMisses += 1;
          if (st.combo > st.maxCombo) st.maxCombo = st.combo;
          st.comboT = 6;
          const pts = 50 * st.combo;
          st.bonus += pts;
          st.nitro = Math.min(100, st.nitro + 20);
          st.events.push({ t: 'near', combo: st.combo, pts });
        }
      }
    }
    st.traffic = st.traffic.filter((v) => (v.s - st.dist) > -30);

    // Pickup collection: same lane, close gap. Fuel restores fuel;
    // a shield arms (once — a second shield while armed is +25 instead).
    for (const pk of st.pickups) {
      if (pk.taken) continue;
      const gap = pk.s - st.dist;
      if (Math.abs(gap) < 4 && Math.abs(st.player.x - pk.x) < 1.7) {
        pk.taken = true;
        if (pk.kind === 'shield') {
          st.shieldPickups += 1;
          if (st.shield) { st.bonus += TR.SHIELD_DUP_BONUS; st.events.push({ t: 'shieldDup' }); }
          else { st.shield = true; st.events.push({ t: 'shield' }); }
        } else {
          st.pickupCount += 1;
          st.fuel = Math.min(st.maxFuel, st.fuel + TR.FUEL_PICKUP);
          st.bonus += 25;
          st.events.push({ t: 'fuel', fuel: st.fuel });
        }
      }
    }
    st.pickups = st.pickups.filter((pk) => !pk.taken && (pk.s - st.dist) > -30);

    st.score = Math.floor(st.dist) + st.bonus;

    if (st.status === 'play' && st.mode !== 'endless' && st.dist >= st.routeLen) {
      st.dist = st.routeLen;
      st.bonus += 500 + st.hp * 200;
      st.score = Math.floor(st.dist) + st.bonus;
      st.status = 'finished';
      st.events.push({ t: 'finish', score: st.score, hp: st.hp });
    }
  },

  // ---------- daily missions + achievements (Fase 2H, pure) ----------
  // Missions: 3 per day, deterministic rotation over the 8-pool. Offsets
  // 0, 3, 5 stay distinct mod 8, so the three are never the same mission.
  MISSION_DEFS: [
    { key: 'jeriken3', coins: 25, check: (st) => st.pickupCount >= 3 },
    { key: 'combo3', coins: 25, check: (st) => st.maxCombo >= 3 },
    { key: 'mepet5', coins: 25, check: (st) => st.nearMisses >= 5 },
    { key: 'jauh5', coins: 25, check: (st) => st.dist >= 5000 },
    { key: 'bersih', coins: 25, check: (st, finished) => finished && st.crashes === 0 },
    { key: 'rest1', coins: 25, check: (st) => st.restCount >= 1 },
    { key: 'hemat3', coins: 25, check: (st) => st.dist >= 3000 && !st.fuelEmpty },
    { key: 'hujan2', coins: 25, check: (st) => st.condition === 'rain' && st.dist >= 2000 },
  ],
  todaysMissions(dayNum) {
    return [0, 3, 5].map((off) => TR.MISSION_DEFS[(dayNum + off) % TR.MISSION_DEFS.length].key);
  },
  // today's missions completed in this run, excluding ones already done today
  checkMissions(st, finished, dayNum, doneToday) {
    const today = new Set(TR.todaysMissions(dayNum));
    return TR.MISSION_DEFS.filter((m) => today.has(m.key) && m.check(st, finished) && !doneToday.includes(m.key)).map((m) => m.key);
  },
  ACH_DEFS: [
    { key: 'finis1', coins: 50, check: (st, finished) => finished },
    { key: 'bersihFinis', coins: 100, check: (st, finished) => finished && st.crashes === 0 },
    { key: 'jeriken5', coins: 50, check: (st) => st.pickupCount >= 5 },
    { key: 'kombo5', coins: 100, check: (st) => st.maxCombo >= 5 },
    { key: 'mepet10', coins: 100, check: (st) => st.nearMisses >= 10 },
    { key: 'jauh10', coins: 100, check: (st) => st.dist >= 10000 },
    { key: 'odo100', coins: 200, check: (st, finished, ctx) => ctx.odoKm >= 100 },
    { key: 'kolektor', coins: 200, check: (st, finished, ctx) => ctx.ownedCars >= 4 },
  ],
  checkAchievements(st, finished, ctx, unlocked) {
    return TR.ACH_DEFS.filter((a) => a.check(st, finished, ctx) && !unlocked.includes(a.key)).map((a) => a.key);
  },
  // ---------- permanent challenges (Fase 2W) ----------
  // One-time coin rewards + badges, checked at run end like achievements.
  // pickupCount counts jerrycans only (shields are shieldPickups); restCount
  // counts rest stops used (tryRest, incl. SKIP); brakeUsed is set by setBrake.
  CHALLENGE_DEFS: [
    { key: 'irit', coins: 100, check: (st, finished) => finished && st.mode === 'short' && st.pickupCount === 0 },
    { key: 'tanpaRem', coins: 100, check: (st, finished) => finished && st.mode === 'short' && !st.brakeUsed },
    { key: 'komboMaster', coins: 150, check: (st, finished) => finished && st.combo >= 5 },
    { key: 'badai', coins: 200, check: (st, finished) => finished && st.mode === 'short' && st.condition === 'rain' && st.crashes === 0 },
    { key: 'tamuRest', coins: 150, check: (st, finished) => finished && st.mode === 'long' && st.restCount >= 2 },
  ],
  checkChallenges(st, finished, unlocked) {
    return TR.CHALLENGE_DEFS.filter((c) => c.check(st, finished) && !unlocked.includes(c.key)).map((c) => c.key);
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = TR;
