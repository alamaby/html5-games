#!/usr/bin/env node
/**
 * Offline validator for the Jellometry campaign.
 *
 * Proves, without a browser, that every course is geometrically completable
 * inside the player's movement envelope and that the difficulty curve rises in
 * small measured steps.
 *
 * Run: node scripts/validate-levels.mjs
 *
 * Exit code 0 = all hard checks pass. Warnings do not fail the run.
 */

import { LEVELS } from '../src/entities/PresetLevels.js';

const GRAVITY = 24;
const HALF_G = GRAVITY / 2;
const JUMP_V = 12.6;
const MAX_SPEED = 10.8;
const PLATFORM_HALF_HEIGHT = 0.325; // moving_platform height is fixed at 0.65 in the factory
const MAX_RAMP_ANGLE = 6;
const STRUCTURAL_WALL_HEIGHT = 3.4; // jump apex is 3.31 m; anything taller cannot be cleared
const EPS = 0.2;

const problems = [];
const warnings = [];
const fail = (level, msg) => problems.push(`${level.id}: ${msg}`);
const warn = (level, msg) => warnings.push(`${level.id}: ${msg}`);
const round = (n, d = 2) => Number(n.toFixed(d));

/* ------------------------------------------------------------------ *
 * Geometry extraction
 * ------------------------------------------------------------------ */

function liftWindow(v, dh) {
  const disc = v * v - 4 * HALF_G * dh;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  return { t1: (v - root) / GRAVITY, t2: (v + root) / GRAVITY, apex: (v * v) / (2 * GRAVITY) };
}

function extract(level) {
  const decks = [];
  const pads = [];
  const sweepers = [];
  const platforms = [];
  const gates = [];
  const points = [];

  for (const obs of level.obstacles) {
    const p = obs.params || {};
    const [x, y, z] = obs.position || [0, 0, 0];

    if (obs.type === 'track_block') {
      const len = Number(p.length) || 10;
      const h = Number(p.height) || 0.8;
      const angle = ((Number(p.slopeAngle) || 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      decks.push({
        id: obs.id,
        x,
        zMin: z - len / 2,
        zMax: z + len / 2,
        topNear: y + (h / 2) * cos - (len / 2) * sin,
        topFar: y + (h / 2) * cos + (len / 2) * sin,
        width: Number(p.width) || 6,
        length: len,
        height: h,
        isRamp: Math.abs(p.slopeAngle || 0) > 0.01
      });
    } else if (obs.type === 'bouncy_pad') {
      pads.push({
        id: obs.id,
        x,
        z,
        zMin: z - (Number(p.length) || 3.4) / 2,
        zMax: z + (Number(p.length) || 3.4) / 2,
        top: y + 0.65,
        force: Number(p.bounceForce) || 19.5,
        length: Number(p.length) || 3.4
      });
    } else if (obs.type === 'spinning_sweeper') {
      sweepers.push({
        id: obs.id,
        x,
        z,
        y,
        arm: Number(p.armLength) || 5.4,
        speed: Number(p.speed) || 2.4,
        barHeight: Number(p.barHeight) || 0.9
      });
    } else if (obs.type === 'moving_platform') {
      const len = Number(p.length) || 5.5;
      const dist = Number(p.distance) ?? 4.5;
      const axis = ['x', 'y', 'z'].includes(p.axis) ? p.axis : 'x';
      const zTravel = axis === 'z' ? dist : 0;
      const yTravel = axis === 'y' ? dist : 0;
      platforms.push({
        id: obs.id,
        x,
        axis,
        zMin: z - zTravel - len / 2,
        zMax: z + zTravel + len / 2,
        yMin: y - yTravel + PLATFORM_HALF_HEIGHT,
        yMax: y + yTravel + PLATFORM_HALF_HEIGHT,
        width: Number(p.width) || 4.5,
        length: len,
        distance: dist,
        speed: Number(p.speed) || 1.6
      });
    } else if (obs.type === 'shape_gate') {
      gates.push({
        id: obs.id,
        x,
        z,
        y,
        shape: p.cutoutShape === 'tall_narrow' ? 'tall_narrow' : 'flat_wide',
        wallWidth: Number(p.wallWidth) || 6,
        wallHeight: Number(p.wallHeight) || 3.4
      });
    } else if (obs.type === 'checkpoint_finish') {
      points.push({
        id: obs.id,
        z,
        y,
        variant: p.variant === 'finish' ? 'finish' : 'checkpoint',
        width: Number(p.width) || 5.5
      });
    } else {
      fail(level, `unknown obstacle type "${obs.type}" on ${obs.id}`);
    }
  }

  return { decks, pads, sweepers, platforms, gates, points };
}

/* ------------------------------------------------------------------ *
 * Traversal model
 *
 * A "stage" is anything the player can stand on. Stages are walked in entry
 * order (descending z, because the race runs toward -z) and each consecutive
 * pair is tested against the ballistic envelope.
 * ------------------------------------------------------------------ */

function buildStages(geo) {
  const stages = [
    ...geo.decks.map((d) => ({
      kind: 'deck',
      id: d.id,
      entry: d.zMax,
      exit: d.zMin,
      // A ramp is entered at its near (+z) edge and left at its far (-z) edge,
      // so entry and exit surfaces differ by length * sin(angle).
      entryY: d.topNear,
      exitY: d.topFar,
      width: d.width,
      length: d.length
    })),
    ...geo.platforms.map((p) => ({
      kind: 'platform',
      id: p.id,
      entry: p.zMax,
      exit: p.zMin,
      entryY: p.yMin,
      exitY: p.yMax,
      width: p.width,
      length: p.length
    }))
  ];
  stages.sort((a, b) => b.entry - a.entry);
  return stages;
}

function padFor(stage, geo) {
  if (stage.kind !== 'deck') return null;
  return (
    geo.pads.find(
      (pad) =>
        pad.z >= stage.exit - EPS &&
        pad.z <= stage.entry + EPS &&
        Math.abs(pad.top - stage.entryY - 0.65) <= 0.2
    ) || null
  );
}

function checkTransition(level, from, to, geo) {
  const gap = from.exit - to.entry;
  const pad = padFor(from, geo);

  const options = [];
  // Plain jump from the surface of `from`.
  options.push({
    label: 'jump',
    launchY: from.exitY,
    launchZ: from.exit,
    v: JUMP_V
  });
  // Pad-assisted launch from the middle of the pad.
  if (pad) {
    options.push({
      label: `pad(${pad.id})`,
      launchY: pad.top,
      launchZ: pad.z,
      v: pad.force
    });
  }

  let best = null;
  for (const opt of options) {
    const flightGap = opt.launchZ - to.entry;
    const dh = to.entryY - opt.launchY;
    const win = liftWindow(opt.v, dh);
    if (!win) continue;
    if (dh > win.apex - 0.15) continue;
    const reach = MAX_SPEED * win.t2;
    if (reach + 0.2 < flightGap) continue;
    const score = flightGap;
    if (!best || score < best.score) {
      best = { ...opt, dh, win, reach, flightGap, score };
    }
  }

  if (gap <= 0.05) {
    const step = to.entryY - from.exitY;
    if (step > 3.0) {
      fail(level, `step from ${from.id} to ${to.id} is ${round(step)} m (max jump rise 3.31 m)`);
    } else if (step > 2.4) {
      warn(level, `step from ${from.id} to ${to.id} is ${round(step)} m (tight for a single jump)`);
    }
    if (Math.abs(gap) > 0.05 && to.entry < from.exit) {
      warn(level, `${from.id} and ${to.id} overlap in z by ${round(-gap)} m`);
    }
    return;
  }

  if (!best) {
    const dh = to.entryY - from.exitY;
    fail(
      level,
      `cannot cross ${from.id} -> ${to.id}: gap ${round(gap)} m, rise ${round(dh)} m` +
        (pad ? ' even with ' + pad.id : '') +
        ` (plain jump reaches ${round(JUMP_V * JUMP_V / (2 * GRAVITY))} m; ${pad || 'no pad'} available)`
    );
    return;
  }

  if (best.reach > gap + to.length + 3.0) {
    warn(
      level,
      `${from.id} -> ${to.id} via ${best.label}: full-speed landing may overshoot the far edge (reach ${round(best.reach)} m vs deck ${round(gap + to.length)} m)`
    );
  }
}

/* ------------------------------------------------------------------ *
 * Structural checks
 * ------------------------------------------------------------------ */

function deckAt(geo, z, y) {
  return geo.decks.find(
    (d) => z >= d.zMin - EPS && z <= d.zMax + EPS && Math.abs(Math.max(d.topNear, d.topFar) - y) <= 0.35
  );
}

function checkStructure(level, geo) {
  const { decks, gates, pads, sweepers, points } = geo;

  for (const d of decks) {
    if (d.length < 2) fail(level, `deck ${d.id} is shorter than 2 m`);
    if (d.width < 3.5) fail(level, `deck ${d.id} is narrower than 3.5 m`);
  }

  // Ramp entry alignment: the near edge must sit flush with the deck it follows.
  for (const d of decks.filter((x) => x.isRamp)) {
    const angle = Math.atan2(d.topFar - d.topNear, d.length);
    if ((angle * 180) / Math.PI > MAX_RAMP_ANGLE + 0.01) {
      fail(level, `ramp ${d.id} exceeds ${MAX_RAMP_ANGLE} degrees`);
    }
    const prev = decks
      .filter((o) => o.id !== d.id && o.zMin >= d.zMax - 0.6)
      .sort((a, b) => a.zMin - b.zMin)[0];
    if (!prev) {
      warn(level, `ramp ${d.id} has no deck feeding into it`);
      continue;
    }
    const delta = Math.abs(d.topNear - prev.topFar);
    if (delta > 0.3) {
      fail(
        level,
        `ramp ${d.id} near edge is ${round(delta)} m off ${prev.id} far edge (${round(d.topNear)} vs ${round(prev.topFar)})`
      );
    }
  }

  const finish = points.filter((p) => p.variant === 'finish');
  if (finish.length !== 1) fail(level, `expected exactly 1 finish arch, found ${finish.length}`);
  if (!points.some((p) => p.variant === 'checkpoint')) fail(level, 'no checkpoint in course');

  for (const p of points) {
    const host = deckAt(geo, p.z, p.y);
    if (!host) {
      fail(level, `${p.variant} ${p.id} is not anchored on any deck (z ${p.z}, y ${p.y})`);
      continue;
    }
    if (p.variant === 'finish') {
      const lastDeck = decks.reduce((a, b) => (b.zMin < a.zMin ? b : a), decks[0]);
      if (host.id !== lastDeck.id) {
        warn(level, `finish ${p.id} sits on ${host.id} but the course continues to ${lastDeck.id}`);
      }
    }
  }

  for (const g of gates) {
    const host = deckAt(geo, g.z, g.y);
    if (!host) {
      fail(level, `gate ${g.id} (${g.shape}) is not anchored on any deck (z ${g.z}, y ${g.y})`);
      continue;
    }
    if (g.wallWidth > host.width + 0.05) {
      fail(level, `gate ${g.id} is wider than ${host.id} (${g.wallWidth} m wall vs ${host.width} m deck) — walk-around possible`);
    }
    if (g.wallHeight < STRUCTURAL_WALL_HEIGHT) {
      fail(level, `gate ${g.id} wall is only ${round(g.wallHeight)} m tall — a 3.31 m jump can clear it, bypassing the morph`);
    }
    if (host.width - g.wallWidth > 1.0) {
      warn(level, `gate ${g.id} leaves ${round(host.width - g.wallWidth)} m of walkable gap beside it on ${host.id}`);
    }
  }

  for (const pad of pads) {
    const host = deckAt(geo, pad.z, pad.top - 0.65);
    if (!host) {
      fail(level, `pad ${pad.id} is not anchored on any deck (z ${pad.z}, y ${round(pad.top)})`);
      continue;
    }
    if (pad.zMin < host.zMin - 0.05 || pad.zMax > host.zMax + 0.05) {
      warn(level, `pad ${pad.id} hangs off ${host.id} (pad ${round(pad.zMin)}..${round(pad.zMax)} vs deck ${round(host.zMin)}..${round(host.zMax)})`);
    }
  }

  for (const s of sweepers) {
    const host = deckAt(geo, s.z, s.y);
    if (!host) {
      fail(level, `sweeper ${s.id} is not anchored on any deck (z ${s.z}, y ${s.y})`);
      continue;
    }
    const bandLow = s.barHeight - 0.28;
    const bandHigh = s.barHeight + 0.28;
    if (bandLow < 0.05) {
      warn(level, `sweeper ${s.id} bar band starts ${round(bandLow)} m above the deck — it may clip into the floor`);
    }
    // A duck-under bar: the flat morph is 0.643 m tall, so the bar band must
    // start above that for the flat morph to slip underneath.
    if (bandLow > 0.65) {
      s.duckable = true;
    }
  }

  // Solid overlap: two decks at similar height overlapping in x and z creates
  // z-fighting geometry and an ambiguous hidden path.
  for (let i = 0; i < decks.length; i++) {
    for (let j = i + 1; j < decks.length; j++) {
      const a = decks[i];
      const b = decks[j];
      const zOverlap = Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin);
      if (zOverlap <= 0.25) continue;
      if (Math.abs(a.topNear - b.topNear) > 0.6) continue;
      const aHalf = a.width / 2;
      const bHalf = b.width / 2;
      const xOverlap = Math.min(a.x + aHalf, b.x + bHalf) - Math.max(a.x - aHalf, b.x - bHalf);
      if (xOverlap > 0.3) {
        fail(level, `decks ${a.id} and ${b.id} overlap in z by ${round(zOverlap)} m at the same height`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Difficulty model
 * ------------------------------------------------------------------ */

/*
 * Weights encode what actually costs a player a life:
 *   - timing-dependent hazards (sweepers) dominate, scaled sub-linearly so a
 *     fast bar is not worth triple a slow one;
 *   - moving platforms are fall risk with a boarding commitment;
 *   - gates are a knowledge test, not a timing test, so they are cheap;
 *   - pads are assists and cost almost nothing;
 *   - narrow decks, wide gaps and tall steps are precision and fall risk.
 * These constants are a design aid, not ground truth. They are re-tuned from
 * playtest data, never from wishful thinking.
 */
function threat(level, geo) {
  let score = 0;

  for (const s of geo.sweepers) {
    const arm = Math.pow(s.arm / 5.4, 0.8);
    const rate = Math.pow(Math.abs(s.speed) / 2.4, 0.9);
    score += 2.0 * arm * rate;
    if (s.duckable) score += 0.7; // forces an active morph while moving
  }

  for (const p of geo.platforms) {
    const axisMul = p.axis === 'y' ? 1.15 : p.axis === 'z' ? 1.25 : 1.0;
    score += 2.2 * Math.pow(p.distance / 4.5, 0.9) * Math.pow(p.speed / 1.6, 0.8) * axisMul;
  }

  const gateZ = geo.gates.map((g) => g.z).sort((a, b) => b - a);
  for (let i = 0; i < gateZ.length; i++) {
    score += 0.8;
    const neighbour = gateZ.find((z, k) => k !== i && Math.abs(z - gateZ[i]) < 8);
    if (neighbour !== undefined) score += 0.35;
  }

  score += 0.25 * geo.pads.length;

  let minWidth = Infinity;
  let topMax = -Infinity;
  let topMin = Infinity;
  for (const deck of geo.decks) {
    minWidth = Math.min(minWidth, deck.width);
    topMax = Math.max(topMax, deck.topNear, deck.topFar);
    topMin = Math.min(topMin, deck.topNear, deck.topFar);
  }
  score += 0.9 * Math.max(0, 7.0 - minWidth);
  score += 0.05 * Math.max(0, topMax - topMin); // elevation gain = fall risk

  const stages = buildStages(geo);
  for (let i = 1; i < stages.length; i++) {
    const gap = stages[i - 1].exit - stages[i].entry;
    if (gap > 3.5) score += 0.35 * (gap - 3.5);
    const step = stages[i].entryY - stages[i - 1].exitY;
    if (step > 1.8) score += 0.4 * (step - 1.8);
  }

  const zTop = Math.max(...geo.decks.map((d) => d.zMax), 0);
  const zBottom = Math.min(...geo.decks.map((d) => d.zMin));
  score += 0.010 * (zTop - zBottom);

  return score;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

console.log(`Jellometry level validator — ${LEVELS.length} courses\n`);

const seenIds = new Set();
const rows = [];

for (const level of LEVELS) {
  if (seenIds.has(level.id)) fail(level, `duplicate course id "${level.id}"`);
  seenIds.add(level.id);

  if (!level.name) fail(level, 'missing name');
  if (!level.objective) fail(level, 'missing objective');
  if (!Array.isArray(level.spawnPoint) || level.spawnPoint.length !== 3) fail(level, 'spawnPoint must be [x, y, z]');
  if (!Number.isInteger(level.difficulty) || level.difficulty < 1 || level.difficulty > 5) {
    fail(level, `difficulty must be an integer 1..5 (got ${level.difficulty})`);
  }
  if (!Array.isArray(level.obstacles) || level.obstacles.length < 5) fail(level, 'a course needs at least 5 obstacles');

  const localIds = new Set();
  for (const obs of level.obstacles) {
    if (localIds.has(obs.id)) fail(level, `duplicate obstacle id "${obs.id}"`);
    localIds.add(obs.id);
    if (!Array.isArray(obs.position) || obs.position.length !== 3) fail(level, `${obs.id} has an invalid position`);
  }

  const geo = extract(level);
  checkStructure(level, geo);

  const stages = buildStages(geo);
  for (let i = 1; i < stages.length; i++) {
    checkTransition(level, stages[i - 1], stages[i], geo);
  }

  // Nothing may require a vertical climb no platform can serve.
  for (const p of geo.platforms) {
    if (p.yMax - p.yMin > 5.0) {
      warn(level, `platform ${p.id} travels ${round(p.yMax - p.yMin)} m vertically`);
    }
  }

  const duckable = geo.sweepers.filter((s) => s.duckable).length;
  rows.push({
    index: rows.length + 1,
    id: level.id,
    name: level.name,
    stars: level.difficulty,
    length: round(
      Math.max(...geo.decks.map((d) => d.zMax), 0) - Math.min(...geo.decks.map((d) => d.zMin)),
      0
    ),
    stages: stages.length,
    sweepers: geo.sweepers.length,
    platforms: geo.platforms.length,
    gates: geo.gates.length,
    pads: geo.pads.length,
    duckable,
    score: round(threat(level, geo), 2),
    ratio: 0
  });
}

// Difficulty curve: strictly increasing, small bounded step.
for (let i = 1; i < rows.length; i++) {
  const prev = rows[i - 1];
  const cur = rows[i];
  cur.ratio = round(cur.score / prev.score, 3);
  if (cur.score <= prev.score) {
    problems.push(
      `curve: ${cur.name} (${cur.score}) is not harder than ${prev.name} (${prev.score})`
    );
  } else if (cur.ratio > 1.4) {
    problems.push(
      `curve: step ${prev.name} -> ${cur.name} jumps ${cur.ratio}x, above the 1.40 ceiling`
    );
  } else if (cur.ratio < 1.03) {
    problems.push(
      `curve: step ${prev.name} -> ${cur.name} is only ${cur.ratio}x, below the 1.03 floor`
    );
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

console.log(
  pad('#', 3) +
    pad('course', 22) +
    padL('★', 3) +
    padL('len', 6) +
    padL('stage', 6) +
    padL('swp', 5) +
    padL('plat', 6) +
    padL('gate', 6) +
    padL('pad', 5) +
    padL('duck', 6) +
    padL('threat', 8) +
    padL('x prev', 8)
);
console.log('-'.repeat(96));
for (const r of rows) {
  console.log(
    pad(String(r.index).padStart(2, '0'), 3) +
      pad(r.name, 22) +
      padL(r.stars, 3) +
      padL(`${r.length}m`, 6) +
      padL(r.stages, 6) +
      padL(r.sweepers, 5) +
      padL(r.platforms, 6) +
      padL(r.gates, 6) +
      padL(r.pads, 5) +
      padL(r.duckable, 6) +
      padL(r.score, 8) +
      padL(r.ratio ? `${r.ratio}x` : '—', 8)
  );
}

console.log('');
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ~ ${w}`);
  console.log('');
}

if (problems.length) {
  console.log(`FAILED — ${problems.length} problem(s):`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}

console.log(`OK — ${rows.length} courses validated, curve rises ${rows[1].ratio}x..${rows[rows.length - 1].ratio}x per step.`);
