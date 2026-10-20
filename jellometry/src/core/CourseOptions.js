/**
 * Options for a generated course: defaults, validation, URL encoding and the
 * readable seed names the UI offers.
 *
 * Every option is an index into a fixed list, so a shared URL stays short and
 * a malformed parameter degrades to the default instead of throwing.
 */

import { createRng } from './Rng.js';

/**
 * Difficulty is expressed as threat per metre, not absolute threat.
 *
 * Absolute threat scales with course length: a 65 m course physically cannot
 * reach the same score as a 146 m one, so a fixed band would make "Brutal +
 * Short" unreachable by construction. The campaign's own courses sit between
 * 0.053 and 0.138 threat/metre, and these bands are taken from that spread.
 *
 * The bands overlap substantially on purpose. Hazard count is an integer, so
 * achievable density moves in coarse steps that vary with course length; abutting
 * bands would turn a near-miss into a failure instead of a neighbouring preset.
 * The presets stay ordered because the generator aims for the middle of the
 * requested band, not its edge.
 */
export const DIFFICULTIES = [
  { key: 'chill', label: 'Chill', density: [0.044, 0.070], stars: 1 },
  { key: 'normal', label: 'Normal', density: [0.064, 0.099], stars: 2 },
  { key: 'spicy', label: 'Spicy', density: [0.088, 0.122], stars: 4 },
  { key: 'brutal', label: 'Brutal', density: [0.106, 0.156], stars: 5 }
];

export const LENGTHS = [
  { key: 'short', label: 'Short', budget: [65, 85] },
  { key: 'medium', label: 'Medium', budget: [95, 115] },
  { key: 'long', label: 'Long', budget: [125, 150] }
];

export const CHECKPOINTS = [
  { key: 'minimal', label: 'Minimal', count: 1 },
  { key: 'normal', label: 'Normal', count: 2 },
  { key: 'generous', label: 'Generous', count: 3 }
];

export const HAZARDS = [
  { key: 'sweepers', label: 'Sweepers' },
  { key: 'gates', label: 'Gates' },
  { key: 'platforms', label: 'Bridges' },
  { key: 'pads', label: 'Pads' }
];

export const PALETTES = [
  { key: 'frost', label: 'Frost', deck: '#e2e8f0', accent: '#3a86ff', accentAlt: '#ff9f1c' },
  { key: 'slime', label: 'Slime', deck: '#d8f3dc', accent: '#2ec4b6', accentAlt: '#f4a261' },
  { key: 'sunset', label: 'Sunset', deck: '#fde2c8', accent: '#ff9f1c', accentAlt: '#e76f51' },
  { key: 'midnight', label: 'Midnight', deck: '#cbd5e1', accent: '#8b5cf6', accentAlt: '#06b6d4' }
];

export const DEFAULT_OPTIONS = Object.freeze({
  seed: 'misty-otter-42',
  difficulty: 1,
  length: 1,
  hazards: { sweepers: true, gates: true, platforms: true, pads: true },
  checkpoints: 1,
  palette: 0
});

const ADJECTIVES = [
  'misty', 'brisk', 'sunken', 'velvet', 'nimble', 'quiet', 'amber', 'frosty',
  'molten', 'lucid', 'wobbly', 'spry', 'hollow', 'gilded', 'plucky', 'murky'
];

const NOUNS = [
  'otter', 'lantern', 'cinder', 'harbour', 'marmot', 'trellis', 'grotto', 'kestrel',
  'sorbet', 'tundra', 'beacon', 'thicket', 'gantry', 'pebble', 'mirage', 'fathom'
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const asIndex = (value, list, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), 0, list.length - 1);
};

/** Produce a readable seed such as `misty-otter-42`. */
export function randomSeedName() {
  const rng = createRng(`${Date.now()}:${Math.random()}`);
  const adjective = rng.pick(ADJECTIVES);
  const noun = rng.pick(NOUNS);
  const number = rng.int(2, 99);
  return `${adjective}-${noun}-${number}`;
}

/** Coerce anything into a usable option object. Never throws. */
export function normalizeOptions(raw = {}) {
  const hazards = raw.hazards && typeof raw.hazards === 'object' ? raw.hazards : {};
  const normalizedHazards = {};
  for (const hazard of HAZARDS) {
    normalizedHazards[hazard.key] = hazards[hazard.key] !== false;
  }

  const seed = typeof raw.seed === 'string' && raw.seed.trim() ? raw.seed.trim().slice(0, 40) : DEFAULT_OPTIONS.seed;

  return {
    seed,
    difficulty: asIndex(raw.difficulty, DIFFICULTIES, DEFAULT_OPTIONS.difficulty),
    length: asIndex(raw.length, LENGTHS, DEFAULT_OPTIONS.length),
    hazards: normalizedHazards,
    checkpoints: asIndex(raw.checkpoints, CHECKPOINTS, DEFAULT_OPTIONS.checkpoints),
    palette: asIndex(raw.palette, PALETTES, DEFAULT_OPTIONS.palette)
  };
}

/**
 * Highest threat/metre each hazard family reliably reaches on its own.
 *
 * Measured by running the generator with only that family enabled across a
 * 40-seed sweep at every difficulty and taking the sustained maximum, not the
 * single best outlier. Sweepers dominate because they are the only hazard the
 * threat model scores on both arm length and rotation speed; gates, platforms
 * and pads are all cheaper per metre and plateau below Spicy.
 *
 * This is what makes a difficulty *unreachable* for a given hazard selection,
 * and it is why the UI has to say so instead of silently missing the band.
 */
export const FAMILY_CEILING = {
  sweepers: 0.148,
  gates: 0.079,
  platforms: 0.090,
  // Measured, not assumed: a pads-only course spends 30-40 m of deck per 0.25
  // threat, so it tops out near 0.06/m. Claiming more made the UI offer Normal
  // on pads alone and then fail to deliver it.
  pads: 0.060
};

/** Best achievable density for the active hazard families. */
export function densityCeiling(options) {
  const o = normalizeOptions(options);
  let best = 0;
  for (const hazard of HAZARDS) {
    if (o.hazards[hazard.key]) best = Math.max(best, FAMILY_CEILING[hazard.key] ?? 0);
  }
  return best;
}

/**
 * True when this difficulty is reachable with the active hazard families.
 * Sweepers are effectively mandatory above Normal.
 */
export function isDifficultyReachable(difficulty, options) {
  const ceiling = densityCeiling(options);
  const band = DIFFICULTIES[difficulty]?.density;
  if (!band) return false;
  // No fudge factor: the band's lower edge has to be genuinely reachable, or
  // the UI would promise a difficulty the generator cannot deliver.
  return ceiling >= band[0];
}

/** Number of hazard families switched on. */
export function activeHazardCount(options) {
  return HAZARDS.reduce((sum, hazard) => sum + (options.hazards[hazard.key] ? 1 : 0), 0);
}

/**
 * The canonical key for a course. Two option sets that differ only in ways the
 * generator ignores must produce the same key, so best times stay attached to
 * the same course.
 *
 * The palette is deliberately absent. It only recolours the result, so keeping
 * it here would reseed the RNG and silently hand the player a different course
 * (and a different best-time slot) for pressing a colour swatch.
 */
export function optionsKey(options) {
  const o = normalizeOptions(options);
  const hazards = HAZARDS.map((h) => (o.hazards[h.key] ? '1' : '0')).join('');
  return `${o.seed}|${o.difficulty}|${o.length}|${hazards}|${o.checkpoints}`;
}

export function encodeOptions(options) {
  const o = normalizeOptions(options);
  const hazards = HAZARDS.map((h) => (o.hazards[h.key] ? '1' : '0')).join('');
  const params = new URLSearchParams();
  params.set('course', o.seed);
  params.set('diff', String(o.difficulty));
  params.set('len', String(o.length));
  params.set('haz', hazards);
  params.set('cp', String(o.checkpoints));
  params.set('pal', String(o.palette));
  return params.toString();
}

export function decodeOptions(search) {
  let params;
  try {
    params = new URLSearchParams(search || '');
  } catch {
    return null;
  }

  const course = params.get('course');
  if (!course) return null;

  const hazRaw = params.get('haz');
  const hazards = {};
  HAZARDS.forEach((hazard, index) => {
    if (hazRaw && hazRaw.length >= HAZARDS.length) {
      hazards[hazard.key] = hazRaw[index] !== '0';
    } else {
      hazards[hazard.key] = true;
    }
  });

  return normalizeOptions({
    seed: course,
    difficulty: params.get('diff'),
    length: params.get('len'),
    hazards,
    checkpoints: params.get('cp'),
    palette: params.get('pal')
  });
}

/** Palette entry for an option set. */
export function paletteFor(options) {
  return PALETTES[normalizeOptions(options).palette];
}

export function difficultyFor(options) {
  return DIFFICULTIES[normalizeOptions(options).difficulty];
}

export function lengthFor(options) {
  return LENGTHS[normalizeOptions(options).length];
}

export function checkpointsFor(options) {
  return CHECKPOINTS[normalizeOptions(options).checkpoints];
}
