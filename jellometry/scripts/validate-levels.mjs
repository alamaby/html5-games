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
import { validateLevel } from '../src/core/LevelValidator.js';

const problems = [];
const warnings = [];
const rows = [];

console.log(`Jellometry level validator — ${LEVELS.length} courses\n`);

const seenIds = new Set();

for (const level of LEVELS) {
  if (seenIds.has(level.id)) problems.push(`${level.id}: duplicate course id "${level.id}"`);
  seenIds.add(level.id);

  const result = validateLevel(level);
  problems.push(...result.problems);
  warnings.push(...result.warnings);

  const m = result.metrics;
  rows.push({
    index: rows.length + 1,
    id: level.id,
    name: level.name,
    stars: level.difficulty,
    length: m.length,
    stages: m.stages,
    sweepers: m.sweepers,
    platforms: m.platforms,
    gates: m.gates,
    pads: m.pads,
    duckable: m.duckable,
    score: m.threat,
    ratio: 0
  });
}

// Difficulty curve: strictly increasing, small bounded step. This only means
// something for an ordered campaign, so it stays in the CLI and out of the
// shared validator module.
for (let i = 1; i < rows.length; i++) {
  const prev = rows[i - 1];
  const cur = rows[i];
  cur.ratio = Number((cur.score / prev.score).toFixed(3));
  if (cur.score <= prev.score) {
    problems.push(`curve: ${cur.name} (${cur.score}) is not harder than ${prev.name} (${prev.score})`);
  } else if (cur.ratio > 1.4) {
    problems.push(`curve: step ${prev.name} -> ${cur.name} jumps ${cur.ratio}x, above the 1.40 ceiling`);
  } else if (cur.ratio < 1.03) {
    problems.push(`curve: step ${prev.name} -> ${cur.name} is only ${cur.ratio}x, below the 1.03 floor`);
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
