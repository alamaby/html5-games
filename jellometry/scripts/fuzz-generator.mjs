#!/usr/bin/env node
/**
 * Fuzz test for the random course generator.
 *
 * Proves, without a browser, that generated courses are geometrically
 * completable, land inside their difficulty band and stay inside their length
 * budget.
 *
 * Run: node scripts/fuzz-generator.mjs [--seeds 500]
 */

import { generateCourse } from '../src/core/LevelGenerator.js';
import { validateLevel } from '../src/core/LevelValidator.js';
import {
  normalizeOptions,
  isDifficultyReachable,
  DIFFICULTIES,
  LENGTHS,
  HAZARDS,
  CHECKPOINTS
} from '../src/core/CourseOptions.js';

const args = process.argv.slice(2);
const seedFlag = args.indexOf('--seeds');
const SEEDS = seedFlag >= 0 ? Number(args[seedFlag + 1]) || 500 : 500;

const problems = [];
const failures = { invalid: 0, outOfBand: 0, outOfBudget: 0, null: 0, tooManyWarnings: 0 };
const clearanceFailures = [];

const rows = [];
const attemptCounts = [];
const threatByDifficulty = new Map();
let total = 0;

const rngFor = (index) => {
  // Deterministic seed names so a failure can be reproduced exactly.
  const adjectives = ['misty', 'brisk', 'sunken', 'velvet', 'nimble', 'quiet', 'amber', 'frosty'];
  const nouns = ['otter', 'lantern', 'cinder', 'harbour', 'marmot', 'trellis', 'grotto', 'kestrel'];
  return `${adjectives[index % adjectives.length]}-${nouns[Math.floor(index / adjectives.length) % nouns.length]}-${index}`;
};

console.log(`Jellometry generator fuzz — ${SEEDS} seeds × ${DIFFICULTIES.length} difficulties × ${LENGTHS.length} lengths\n`);

for (let difficulty = 0; difficulty < DIFFICULTIES.length; difficulty++) {
  for (let length = 0; length < LENGTHS.length; length++) {
    for (let seedIndex = 0; seedIndex < SEEDS; seedIndex++) {
      total += 1;
      const options = normalizeOptions({ seed: rngFor(seedIndex), difficulty, length });

      // Every hazard family on, so the band is reachable; hazard toggles are
      // covered separately below.
      const result = generateCourse(options);

      if (!result) {
        failures.null += 1;
        problems.push(`${options.seed} d${difficulty} l${length}: generator returned null`);
        continue;
      }

      attemptCounts.push(result.attempts);

      const revalidation = validateLevel(result.level);
      if (revalidation.problems.length) {
        failures.invalid += 1;
        problems.push(`${options.seed} d${difficulty} l${length}: ${revalidation.problems[0]}`);
        continue;
      }
      if (revalidation.warnings.length > 2) {
        failures.tooManyWarnings += 1;
        problems.push(`${options.seed} d${difficulty} l${length}: ${revalidation.warnings.length} warnings`);
      }

      const [bandMin, bandMax] = DIFFICULTIES[difficulty].density;
      const [lenMin, lenMax] = LENGTHS[length].budget;
      const threat = result.metrics.threat;
      const len = result.metrics.length;
      const density = threat / Math.max(1, len);

      if (!result.inBand || density < bandMin || density > bandMax) {
        failures.outOfBand += 1;
        problems.push(`${options.seed} d${difficulty} l${length}: density ${density.toFixed(4)} outside ${bandMin}..${bandMax}`);
      }
      if (len < lenMin || len > lenMax) {
        failures.outOfBudget += 1;
        problems.push(`${options.seed} d${difficulty} l${length}: length ${len} outside ${lenMin}..${lenMax}`);
      }

      if (!threatByDifficulty.has(difficulty)) threatByDifficulty.set(difficulty, []);
      threatByDifficulty.get(difficulty).push(density);

      // A checkpoint respawn must not drop the player on top of a sweeper or a
      // gate; the arch is a sensor, so the validator cannot see this overlap.
      const hazardZ = result.level.obstacles
        .filter((o) => o.type === 'spinning_sweeper' || o.type === 'shape_gate')
        .map((o) => o.position[2]);
      for (const arch of result.level.obstacles) {
        if (arch.type !== 'checkpoint_finish' || arch.params.variant === 'finish') continue;
        for (const z of hazardZ) {
          if (Math.abs(arch.position[2] - z) < 2.9) {
            clearanceFailures.push(
              `${options.seed} d${difficulty} l${length}: checkpoint z ${arch.position[2]} within 2.9 m of a hazard at ${z}`
            );
          }
        }
      }
    }
  }

  const values = threatByDifficulty.get(difficulty) ?? [];
  const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  rows.push({
    difficulty: DIFFICULTIES[difficulty].label,
    band: DIFFICULTIES[difficulty].density.join('..'),
    avg: avg.toFixed(4),
    min: values.length ? Math.min(...values).toFixed(4) : '—',
    max: values.length ? Math.max(...values).toFixed(4) : '—'
  });
}

/* Hazard-toggle coverage: a course with only one hazard family active must
   still generate, or the UI has to warn the player. */
const toggleFailures = [];
const combos = [
  { sweepers: true, gates: false, platforms: false, pads: false },
  { sweepers: false, gates: true, platforms: false, pads: false },
  { sweepers: false, gates: false, platforms: true, pads: false },
  { sweepers: false, gates: false, platforms: false, pads: true },
  { sweepers: true, gates: true, platforms: false, pads: false },
  { sweepers: false, gates: true, platforms: true, pads: false }
];

for (const hazards of combos) {
  const active = HAZARDS.filter((h) => hazards[h.key]).length;
  for (let difficulty = 0; difficulty < DIFFICULTIES.length; difficulty++) {
    const options = normalizeOptions({ seed: `toggle-${active}-${difficulty}`, difficulty, length: 1, hazards });

    // Reachability is checked against a seed sweep, not one seed: some bands
    // sit close to a family's ceiling, so an individual seed missing the band
    // is expected variance rather than a generator defect.
    let reached = false;
    let best = 0;
    for (let s = 0; s < 8 && !reached; s++) {
      const result = generateCourse({ ...options, seed: `toggle-${active}-${difficulty}-${s}` });
      if (!result) continue;
      const density = result.metrics.threat / result.metrics.length;
      best = Math.max(best, density);
      if (result.inBand) reached = true;
    }

    if (!best) {
      toggleFailures.push(`haz=${active} d${difficulty}: null`);
    } else if (!reached && isDifficultyReachable(difficulty, options)) {
      toggleFailures.push(`haz=${active} d${difficulty}: best density ${best.toFixed(4)} but band was reported reachable`);
    }
  }
}

/* Checkpoint counts. */
const checkpointFailures = [];
for (let cp = 0; cp < CHECKPOINTS.length; cp++) {
  for (let difficulty = 0; difficulty < DIFFICULTIES.length; difficulty++) {
    const result = generateCourse(normalizeOptions({ seed: `cp-${cp}-${difficulty}`, difficulty, checkpoints: cp, length: 1 }));
    if (!result) {
      checkpointFailures.push(`cp${cp} d${difficulty}: null`);
    } else if (result.metrics.checkpoints !== CHECKPOINTS[cp].count) {
      checkpointFailures.push(`cp${cp} d${difficulty}: got ${result.metrics.checkpoints} checkpoints`);
    }
  }
}

/* Palette is cosmetic: it must not reseed the layout or change the course id,
   otherwise picking a colour would detach the player from their best time. */
const paletteFailures = [];
const geometryOf = (level) =>
  JSON.stringify(
    level.obstacles.map(({ id, type, position, params }) => {
      const { color, ...rest } = params;
      return [id, type, position, rest];
    })
  );
const colorsOf = (level) => level.obstacles.map((o) => o.params.color).join(',');

for (let difficulty = 0; difficulty < DIFFICULTIES.length; difficulty++) {
  const base = normalizeOptions({ seed: 'palette-check', difficulty, length: 1, palette: 0 });
  const first = generateCourse(base);
  const repeat = generateCourse(base);
  const recoloured = generateCourse({ ...base, palette: 3 });

  if (!first || !repeat || !recoloured) {
    paletteFailures.push(`d${difficulty}: null`);
    continue;
  }
  if (geometryOf(first.level) !== geometryOf(repeat.level)) {
    paletteFailures.push(`d${difficulty}: same options produced two layouts`);
  }
  if (first.id !== recoloured.id) {
    paletteFailures.push(`d${difficulty}: id changed with palette (${first.id} vs ${recoloured.id})`);
  }
  if (geometryOf(first.level) !== geometryOf(recoloured.level)) {
    paletteFailures.push(`d${difficulty}: layout changed with palette`);
  }
  if (colorsOf(first.level) === colorsOf(recoloured.level)) {
    paletteFailures.push(`d${difficulty}: palette did not recolour anything`);
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

console.log(pad('difficulty', 12) + padL('band', 12) + padL('avg', 8) + padL('min', 8) + padL('max', 8));
console.log('-'.repeat(48));
for (const row of rows) {
  console.log(pad(row.difficulty, 12) + padL(row.band, 12) + padL(row.avg, 8) + padL(row.min, 8) + padL(row.max, 8));
}

const avgAttempts = attemptCounts.reduce((a, b) => a + b, 0) / (attemptCounts.length || 1);
const maxAttempts = attemptCounts.length ? Math.max(...attemptCounts) : 0;
console.log('');
console.log(`courses: ${total}   attempts avg ${avgAttempts.toFixed(1)}, max ${maxAttempts}`);
console.log(
  `failures: invalid ${failures.invalid}, out-of-band ${failures.outOfBand}, ` +
    `out-of-budget ${failures.outOfBudget}, warnings ${failures.tooManyWarnings}, null ${failures.null}`
);
console.log(`hazard-toggle failures: ${toggleFailures.length}`);
console.log(`checkpoint failures: ${checkpointFailures.length}`);
console.log(`palette failures: ${paletteFailures.length}`);
console.log(`checkpoint-clearance failures: ${clearanceFailures.length}`);

const all = [...problems, ...toggleFailures, ...checkpointFailures, ...paletteFailures, ...clearanceFailures];
if (all.length) {
  console.log(`\nFAILED — ${all.length} problem(s):`);
  for (const p of all.slice(0, 25)) console.log(`  x ${p}`);
  if (all.length > 25) console.log(`  ... and ${all.length - 25} more`);
  process.exit(1);
}

const passRate = ((total - failures.invalid - failures.null) / total) * 100;
console.log(`\nOK — ${passRate.toFixed(1)}% generated cleanly.`);
