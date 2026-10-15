/* Helix Drop 3D — pure game logic (no DOM, no THREE). Testable in Node. */
'use strict';

const HDLogic = (() => {
  const SECTORS = 10;
  const TAU = Math.PI * 2;

  // Platform descriptor: array of 10 sector types.
  // index 0 = tutorial platform (no kill sectors, gap never under the ball spawn).
  function genPlatform(index, rand) {
    const types = new Array(SECTORS).fill('safe');
    const killCount = index === 0 ? 0 : index < 8 ? 1 : index < 20 ? 2 : 3;
    let gapIdx = Math.floor(rand() * SECTORS);
    // Tutorial platform: the gap must never sit under the ball spawn (sector 0).
    if (index === 0 && gapIdx === 0) gapIdx = 1 + Math.floor(rand() * (SECTORS - 1));
    types[gapIdx] = 'gap';
    // Keep kill sectors away from the gap so a safe landing always exists nearby.
    let placed = 0, guard = 0;
    while (placed < killCount && guard++ < 200) {
      const k = Math.floor(rand() * SECTORS);
      if (types[k] !== 'safe') continue;
      const d = Math.min((k - gapIdx + SECTORS) % SECTORS, (gapIdx - k + SECTORS) % SECTORS);
      if (d < 2) continue;
      types[k] = 'kill';
      placed++;
    }
    // Fallback: relax the adjacency rule rather than dropping kill sectors.
    guard = 0;
    while (placed < killCount && guard++ < 200) {
      const k = Math.floor(rand() * SECTORS);
      if (types[k] === 'safe') { types[k] = 'kill'; placed++; }
    }
    if (index === 0) types[0] = 'safe'; // ball spawns above sector 0
    return types;
  }

  // Which sector sits under the ball? Ball is at world angle 0;
  // tower rotated by rotY about Y maps local angle θ -> world angle θ + rotY.
  function sectorAt(types, rotY) {
    let a = (-rotY) % TAU;
    if (a < 0) a += TAU;
    const idx = Math.floor((a / TAU) * SECTORS) % SECTORS;
    return types[idx];
  }

  // Points for passing `n` platforms in a single fall (1 each + combo bonus from 3 up).
  function fallScore(n) {
    return n + (n >= 3 ? n : 0);
  }

  function countType(types, t) {
    let n = 0;
    for (const x of types) if (x === t) n++;
    return n;
  }

  return { SECTORS, TAU, genPlatform, sectorAt, fallScore, countType };
})();

if (typeof module !== 'undefined') module.exports = HDLogic;
