/**
 * Random course generator.
 *
 * Builds a course as a chain of decks marching down −Z, then validates it with
 * the same 1-D model the campaign uses. Data only: nothing here imports Three.js,
 * so generation is sub-millisecond and runs in Node for the fuzz test.
 *
 * Determinism: every attempt is seeded by `hash(optionsKey + ':' + attempt)`, so
 * the same options always produce the same course, including which attempt
 * succeeded.
 */

import { validateLevel } from './LevelValidator.js';
import { createRng, hashId } from './Rng.js';
import {
  normalizeOptions,
  optionsKey,
  paletteFor,
  isDifficultyReachable,
  DIFFICULTIES,
  LENGTHS,
  CHECKPOINTS
} from './CourseOptions.js';

const DECK_HEIGHT = 0.8;
const RAMP_MAX_DEG = 6;
const JUMP_V = 12.6;
const GRAVITY = 24;
const MAX_SPEED = 10.8;

// Fraction of the theoretical reach a generated jump is allowed to use. The
// validator proves the rest; this keeps the margin for imperfect play.
const SAFETY = 0.76;
const MAX_TOP = 11;
const STEP_MAX = 2.3;
const MAX_ATTEMPTS = 120;
const MAX_WARNINGS = 2;

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const PROFILES = {
  0: { sweepers: [1, 2], platforms: [0, 1], gates: [2, 3], pads: [0, 1], width: [6.6, 7.5], speed: [1.1, 1.5], arm: [4.0, 5.0], dist: [2.0, 3.0], topMax: 3, pack: 1.0 },
  1: { sweepers: [2, 3], platforms: [0, 1], gates: [2, 3], pads: [0, 1], width: [6.2, 7.2], speed: [1.4, 1.9], arm: [4.4, 5.6], dist: [2.4, 3.4], topMax: 6, pack: 0.92 },
  2: { sweepers: [3, 4], platforms: [1, 2], gates: [1, 2], pads: [1, 2], width: [5.8, 6.6], speed: [1.6, 2.1], arm: [5.0, 6.4], dist: [2.6, 3.8], topMax: 9, pack: 0.84 },
  3: { sweepers: [4, 5], platforms: [2, 3], gates: [2, 3], pads: [1, 2], width: [5.3, 6.2], speed: [1.9, 2.4], arm: [5.6, 7.0], dist: [2.8, 4.0], topMax: 12, pack: 0.74 }
};

/**
 * Hazard density multipliers tried across attempts. Threat rises roughly
 * linearly with hazard count, so sweeping this axis finds the band far more
 * reliably than re-rolling random parameters at a fixed density.
 */
const DENSITIES = [1.0, 0.8, 1.2, 0.9, 1.4, 1.1, 1.6, 1.3, 1.8, 1.5, 2.0, 2.2, 2.4, 2.6];

/** Horizontal distance covered by a jump that rises `dh` metres. */
function jumpReach(dh, v = JUMP_V) {
  const disc = v * v - 2 * GRAVITY * dh;
  if (disc < 0) return null;
  const t2 = (v + Math.sqrt(disc)) / GRAVITY;
  return MAX_SPEED * t2;
}

function titleFromSeed(seed) {
  const title = String(seed)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
  // A seed made only of separators ("---") title-cases to nothing; the HUD
  // would then show an empty course name.
  return title || 'Random Course';
}

class CourseBuilder {
  constructor(rng, options, profile) {
    this.rng = rng;
    this.options = options;
    this.profile = profile;
    this.palette = paletteFor(options);

    this.obstacles = [];
    this.counter = 0;
    this.cursor = null;
    this.lastDeck = null;

    this.counts = { sweepers: 0, gates: 0, platforms: 0, pads: 0 };
    this.checkpoints = 0;
    this.queue = [];
  }

  nextId(prefix) {
    this.counter += 1;
    return `${prefix}${this.counter}`;
  }

  push(obstacle) {
    this.obstacles.push({ id: this.nextId('o'), ...obstacle });
  }

  get length() {
    return this.cursor ? -this.cursor.z : 0;
  }

  pickWidth() {
    const [lo, hi] = this.profile.width;
    return Math.max(3.6, r3(this.rng.range(lo, hi)));
  }

  /**
   * Append a deck. Returns the deck with its measured surfaces, which differ
   * from the nominal `top` on a ramp.
   */
  addDeck({ gap = 0, rise = 0, length, width, slope = 0 }) {
    const prev = this.cursor;
    const len = Math.max(2, length);
    const wid = Math.max(3.5, width);

    const zMax = prev ? prev.z - gap : 0;
    const zMin = zMax - len;
    const zc = (zMax + zMin) / 2;

    const h2 = DECK_HEIGHT / 2;
    const l2 = len / 2;
    const rad = (slope * Math.PI) / 180;

    let y;
    if (slope > 0 && prev) {
      y = prev.top - h2 * Math.cos(rad) + l2 * Math.sin(rad);
    } else {
      y = (prev ? prev.top + rise : 0) - h2;
    }
    y = r3(y);

    const topNear = slope > 0 && prev ? y + h2 * Math.cos(rad) - l2 * Math.sin(rad) : y + h2;
    const topFar = slope > 0 && prev ? y + h2 * Math.cos(rad) + l2 * Math.sin(rad) : y + h2;

    this.push({
      type: 'track_block',
      position: [0, y, r3(zc)],
      params: {
        width: r2(wid),
        length: r2(len),
        height: DECK_HEIGHT,
        slopeAngle: slope > 0 ? r2(slope) : 0,
        color: this.palette.deck
      }
    });

    const deck = {
      zMax,
      zMin,
      z: zc,
      width: wid,
      length: len,
      topNear,
      topFar,
      top: topFar,
      isRamp: slope > 0,
      hasHazard: false
    };
    this.cursor = { z: zMin, top: topFar, width: wid };
    this.lastDeck = deck;
    return deck;
  }

  addPlainRun() {
    const rng = this.rng;
    const rise = this.cursor.top < MAX_TOP - 2 ? rng.range(0, 0.5) : 0;
    this.addDeck({
      gap: rng.range(0, 2.5),
      rise,
      length: rng.range(10, 16),
      width: this.pickWidth()
    });
  }

  addStep() {
    const rng = this.rng;
    const room = MAX_TOP - this.cursor.top;
    const rise = Math.min(rng.range(1.4, STEP_MAX), room - 0.5);
    if (rise < 0.6) return this.addPlainRun();
    this.addDeck({ gap: 0, rise, length: rng.range(9, 13), width: this.pickWidth() });
  }

  addRampRun() {
    const rng = this.rng;
    const room = MAX_TOP - this.cursor.top;
    const length = rng.range(16, 22);
    const maxByAngle = length * Math.sin((RAMP_MAX_DEG * Math.PI) / 180);
    const rise = Math.min(rng.range(1.2, 2.0), maxByAngle * 0.95, room - 0.8);
    if (rise < 0.6) return this.addPlainRun();

    // The validator only recognises the feeding deck when the gap is under
    // 0.6 m, so ramps are always flush.
    const angle = (Math.asin(rise / length) * 180) / Math.PI;
    this.addDeck({ gap: 0, rise, length, width: this.pickWidth(), slope: angle });
  }

  addSweeperRun() {
    const rng = this.rng;
    const count = rng.int(1, 2);
    const width = this.pickWidth();
    const length = 13 + count * 6;
    const deck = this.addDeck({ gap: rng.range(0, 2), rise: rng.range(0, 0.5), length, width });
    deck.hasHazard = true;

    for (let i = 0; i < count; i++) {
      // Arms may overhang the deck — the campaign does this deliberately so a
      // bar can swing clear off the edge. Only the hub needs to be on the deck.
      const arm = rng.range(this.profile.arm[0], this.profile.arm[1]);
      const speed = rng.range(this.profile.speed[0], this.profile.speed[1]) * (rng.chance(0.5) ? 1 : -1);
      const barHeight = rng.chance(0.25) ? 1.05 : 0.85;

      this.push({
        type: 'spinning_sweeper',
        position: [0, r3(deck.top), r3(deck.zMax - 6 - i * 7)],
        params: {
          armLength: r2(arm),
          speed: r2(speed),
          barHeight,
          color: i % 2 === 0 ? '#ff4d6d' : '#ff9f1c'
        }
      });
      this.counts.sweepers += 1;
    }
  }

  addGateRun() {
    const rng = this.rng;
    const count = rng.int(1, 3);
    const width = this.pickWidth();
    const length = 11 + count * 8;
    const deck = this.addDeck({ gap: rng.range(0, 1.5), rise: rng.range(0, 0.4), length, width });
    deck.hasHazard = true;

    const startFlat = rng.chance(0.5);
    for (let i = 0; i < count; i++) {
      const flat = startFlat ? i % 2 === 0 : i % 2 === 1;
      this.push({
        type: 'shape_gate',
        position: [0, r3(deck.top), r3(deck.zMax - 6 - i * 8)],
        params: {
          cutoutShape: flat ? 'flat_wide' : 'tall_narrow',
          wallWidth: r2(Math.max(4.5, width - 0.4)),
          wallHeight: 4.0,
          color: flat ? this.palette.accentAlt : this.palette.accent
        }
      });
      this.counts.gates += 1;
    }
  }

  addBridge() {
    const rng = this.rng;
    const prev = this.cursor;
    const axis = rng.pick(['x', 'z', 'y']);

    const dist = rng.range(this.profile.dist[0], this.profile.dist[1]);
    const width = clamp(prev.width - rng.range(1.2, 2.2), 4.2, 5.4);
    const length = rng.range(6, 9);
    const gapIn = axis === 'z' ? dist + rng.range(1.6, 2.6) : rng.range(2.0, 3.4);

    const zMax = prev.z - gapIn;
    let zc;
    if (axis === 'z') {
      // entry is fixed at zMax; the platform retreats away from the player.
      zc = zMax - dist - length / 2;
    } else {
      zc = zMax - length / 2;
    }

    const platformTop = prev.top;
    const nextTop = axis === 'y' ? prev.top + dist : prev.top;

    if (nextTop > MAX_TOP) return this.addPlainRun();

    this.push({
      type: 'moving_platform',
      position: [0, r3(platformTop - 0.325), r3(zc)],
      params: {
        width: r2(width),
        length: r2(length),
        axis,
        distance: r2(dist),
        speed: r2(rng.range(1.1, this.profile.speed[1])),
        color: this.palette.accent
      }
    });
    this.counts.platforms += 1;

    const platformExitZ = axis === 'z' ? zMax - 2 * dist - length : zMax - length;
    this.cursor = { z: platformExitZ, top: nextTop, width };

    const gapOut = rng.range(1.5, 3.0);
    this.addDeck({
      gap: gapOut,
      rise: 0,
      length: rng.range(12, 18),
      width: Math.max(5.2, width + 1.2)
    });
  }

  addPadHop() {
    const rng = this.rng;
    const launch = this.addDeck({
      gap: rng.range(0, 2),
      rise: rng.range(0, 0.4),
      length: rng.range(11, 15),
      width: this.pickWidth()
    });

    const force = rng.range(16, 22);
    // 3 m before the far edge: close enough that a bounce carries the player
    // over the gap instead of dropping them back onto the same deck.
    const padZ = launch.zMin + 3;

    this.push({
      type: 'bouncy_pad',
      position: [0, r3(launch.top), r3(padZ)],
      params: { width: 3.4, length: 3.0, bounceForce: r2(force), color: '#2ec4b6' }
    });
    this.counts.pads += 1;

    // The gap is sized from the *plain* jump, not the pad. The validator treats
    // the pad as an alternative, and if the deck edge could not clear it either
    // the course would only be completable by hitting the pad perfectly — the
    // pad is an assist, exactly as the campaign uses it.
    const rise = rng.range(1.2, 2.2);
    const gap = clamp((jumpReach(rise) ?? 0) * SAFETY, 4, 8.5);

    this.cursor = { z: launch.zMin, top: launch.top, width: launch.width };
    this.addDeck({
      gap,
      rise,
      length: rng.range(14, 20),
      width: Math.max(5.2, launch.width - rng.range(0, 0.8))
    });
  }

  /**
   * Place a checkpoint on the deck that was just built.
   *
   * Returns false when there is no room: on a ramp (the arch is anchored at one
   * height, so it would float at the low end) or when the deck's slots are full.
   * The caller defers to the next deck instead of spending a whole extra deck
   * per arch.
   */
  addCheckpointOnLastDeck() {
    const deck = this.lastDeck;
    if (!deck || deck.isRamp) return false;

    // A hazard template starts 6 m in, so only the first arch (3 m in) is clear
    // of sweepers and gates. A second one would drop the respawn point next to a
    // spinning bar, and its pillars would grow through a gate wall. Empty decks
    // have no such limit; the finish arch owns the last 5 m either way.
    const limit = deck.hasHazard ? 1 : 3;
    const slot = deck.checkpointSlots ?? 0;
    if (slot >= limit) return false;

    const z = deck.zMax - 3 - slot * 4;
    if (z < deck.zMin + 5) return false;

    deck.checkpointSlots = slot + 1;
    this.push({
      type: 'checkpoint_finish',
      position: [0, r3(deck.top), r3(z)],
      params: { variant: 'checkpoint', width: r2(Math.max(5.0, deck.width - 0.4)), color: '#2ec4b6' }
    });
    this.checkpoints += 1;
    return true;
  }

  placeDueCheckpoints(thresholds) {
    while (this.checkpoints < thresholds.length && this.length >= thresholds[this.checkpoints]) {
      if (!this.addCheckpointOnLastDeck()) break;
    }
  }

  /** Place the finish arch on the final deck. */
  addFinishOnLastDeck() {
    const deck = this.lastDeck;
    if (!deck) return;

    this.push({
      type: 'checkpoint_finish',
      position: [0, r3(deck.top), r3(deck.zMin + 3)],
      params: { variant: 'finish', width: r2(Math.max(5.5, deck.width - 0.3)), color: '#ff9f1c' }
    });
  }

  /** Deck footprint multiplier — harder presets pack hazards closer together. */
  get pack() {
    return this.profile.pack ?? 1;
  }

  /**
   * Plan the hazard sequence from the target length.
   *
   * Threat is roughly additive per hazard segment while course length grows by
   * the segment's footprint, so density is controlled by *how many* hazard
   * segments there are, not by how lucky the parameter rolls were. Filler is
   * deliberately rare: every filler metre dilutes density without adding risk.
   */
  buildQueue(targetLength, density = 1) {
    const avgSegment = 19 * this.pack;
    const plannedCount = Math.max(3, Math.round(targetLength / avgSegment));

    const available = [];
    if (this.options.hazards.sweepers) available.push({ kind: 'sweeper', weight: this.profile.sweepers[1] });
    if (this.options.hazards.gates) available.push({ kind: 'gate', weight: this.profile.gates[1] });
    if (this.options.hazards.platforms) available.push({ kind: 'bridge', weight: this.profile.platforms[1] * 1.2 });
    if (this.options.hazards.pads) available.push({ kind: 'pad', weight: this.profile.pads[1] * 0.7 });

    const out = [];
    if (!available.length) return out;

    // Scale the segment budget by density, clamped so a low-density preset
    // still produces a course rather than an empty runway.
    const count = Math.max(2, Math.round(plannedCount * Math.min(density, 1.6)));
    const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);

    const bag = [];
    for (const item of available) {
      const share = Math.max(1, Math.round((item.weight / totalWeight) * count));
      for (let i = 0; i < share; i++) bag.push(item.kind);
    }

    const shuffled = this.rng.shuffle(bag);
    for (const kind of shuffled) {
      out.push(kind);
      if (this.rng.chance(0.22)) out.push(this.rng.pick(['plain', 'step', 'ramp']));
    }
    return out;
  }

  addNext() {
    const kind = this.queue.shift() ?? 'plain';
    switch (kind) {
      case 'sweeper':
        return this.addSweeperRun();
      case 'gate':
        return this.addGateRun();
      case 'bridge':
        return this.addBridge();
      case 'pad':
        return this.addPadHop();
      case 'step':
        return this.addStep();
      case 'ramp':
        return this.addRampRun();
      default:
        return this.addPlainRun();
    }
  }

  objective() {
    const parts = [];
    if (this.counts.sweepers) parts.push(`${this.counts.sweepers} sweeper${this.counts.sweepers > 1 ? 's' : ''}`);
    if (this.counts.gates) parts.push(`${this.counts.gates} gate${this.counts.gates > 1 ? 's' : ''}`);
    if (this.counts.platforms) parts.push(`${this.counts.platforms} bridge${this.counts.platforms > 1 ? 's' : ''}`);
    if (this.counts.pads) parts.push(`${this.counts.pads} pad${this.counts.pads > 1 ? 's' : ''}`);
    if (!parts.length) return 'A clean run to the finish arch.';

    const last = parts.pop();
    const joined = parts.length ? `${parts.join(', ')} and ${last}` : last;
    return `Clear ${joined}.`;
  }
}

function buildOnce(rng, options, profile, targetLength, checkpointCount, density = 1) {
  const builder = new CourseBuilder(rng, options, profile);
  builder.queue = builder.buildQueue(targetLength, density);

  // A short opening deck keeps the hazard share of the course high. The
  // campaign's own openers are 10-14 m; on a 65 m course a longer one would
  // spend a fifth of the budget on nothing.
  builder.addDeck({ gap: 0, rise: 0, length: rng.range(8, 11), width: builder.pickWidth() });

  const thresholds = [];
  for (let i = 1; i <= checkpointCount; i++) {
    thresholds.push((targetLength * i) / (checkpointCount + 1));
  }

  // Fill up to the budget, then place the finish on whatever deck is last.
  // Checkpoints ride on hazard decks, so they cost no length.
  let guard = 0;
  while (builder.length < targetLength - 12 && guard < 40) {
    if (!builder.queue.length) builder.queue = builder.buildQueue(targetLength - builder.length, density);
    builder.addNext();
    guard += 1;

    builder.placeDueCheckpoints(thresholds);
  }

  // One short closing deck guarantees the finish sits on a real surface.
  builder.addDeck({ gap: 1.2, rise: 0, length: 11, width: Math.max(6.0, builder.cursor.width) });

  // A ramp-heavy tail can leave a checkpoint without a flat deck to land on.
  // Spend one flat deck per leftover rather than stacking arches on the finish.
  let checkpointGuard = 0;
  while (builder.checkpoints < thresholds.length && checkpointGuard < 8) {
    if (!builder.addCheckpointOnLastDeck()) {
      builder.addDeck({ gap: 1.2, rise: 0, length: 10, width: Math.max(6.0, builder.cursor.width) });
    }
    checkpointGuard += 1;
  }
  builder.addFinishOnLastDeck();

  return builder;
}

/**
 * Generate one course. Returns `{ level, metrics, attempts, id, inBand }` or
 * `null` when no valid course could be produced.
 */
export function generateCourse(rawOptions) {
  const options = normalizeOptions(rawOptions);
  const difficulty = DIFFICULTIES[options.difficulty];
  const lengthOption = LENGTHS[options.length];
  const checkpointOption = CHECKPOINTS[options.checkpoints];
  const profile = PROFILES[options.difficulty];

  const key = optionsKey(options);
  const id = `rnd_${hashId(key)}`;
  const reachable = isDifficultyReachable(options.difficulty, options);
  const [lengthMin, lengthMax] = lengthOption.budget;

  // When the hazard selection cannot physically reach the requested band, the
  // generator still returns a playable course but reports the band it actually
  // hit. The UI surfaces this rather than pretending the request was met.
  const [bandMin, bandMax] = reachable ? difficulty.density : [0, Infinity];
  let closest = null;
  let closestDistance = Infinity;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rng = createRng(`${key}:${attempt}`);
    const target = rng.range(lengthMin, lengthMax);

    // Density sweeps deterministically before falling back to fresh randomness,
    // so a band that is merely under-filled is reached by adding hazards rather
    // than by hoping a re-roll lands inside it. The sweep extends past 1.0
    // because short courses need extra hazard packing to reach a high band.
    const density = DENSITIES[(attempt - 1) % DENSITIES.length];
    const builder = buildOnce(rng, options, profile, target, checkpointOption.count, density);

    const level = {
      id,
      name: titleFromSeed(options.seed),
      difficulty: difficulty.stars,
      objective: builder.objective(),
      description: `Generated from the seed "${options.seed}".`,
      spawnPoint: [0, 1.8, -3],
      obstacles: builder.obstacles
    };

    const result = validateLevel(level);
    if (result.problems.length) continue;
    if (result.warnings.length > MAX_WARNINGS) continue;

    const { threat, length } = result.metrics;
    if (length < lengthMin || length > lengthMax) continue;

    // Compare density, not absolute threat — see DIFFICULTIES. The first
    // in-band course wins so generation stays fast; out-of-band attempts are
    // ranked by distance to the band's midpoint, which keeps a fallback as
    // close to the requested preset as possible.
    const densityScore = threat / Math.max(1, length);
    const mid = (bandMin + bandMax) / 2;
    const distance = densityScore < bandMin || densityScore > bandMax ? Math.abs(densityScore - mid) : 0;

    if (distance === 0) {
      return { level, metrics: result.metrics, attempts: attempt, id, inBand: true, reachable };
    }
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = { level, metrics: result.metrics, attempts: attempt, id, inBand: false, reachable };
    }
  }

  return closest;
}
