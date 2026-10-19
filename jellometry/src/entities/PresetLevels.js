/**
 * Jellometry campaign content.
 *
 * Ten hand-authored courses. `scripts/validate-levels.mjs` proves each one is
 * completable inside the player envelope and that the difficulty curve rises in
 * small steps.
 *
 * Geometry conventions:
 *   - A track_block spans z from `z - length / 2` to `z + length / 2`; the
 *     walkable surface is `position.y + height / 2` (height 0.8 => top = y + 0.4).
 *   - Sweepers, pads and checkpoint arches are anchored at the receiving deck's top.
 *   - A sweeper bar collides inside `deckTop + barHeight +/- 0.28`.
 *   - Gate walls are 4.0 m+ proud of the deck so the 3.31 m jump cannot clear them.
 *   - Ramps pivot at their centre: `y = prevTop - h/2 + (length / 2) * sin(angle)`.
 */

const DECK = 0.8;

export const LEVELS = [
  {
    id: 'beginner_bounce',
    name: 'Jelly Sprout',
    difficulty: 1,
    objective: 'Bounce off the slime pad, then flatten and stretch through the two gates.',
    description: 'A gentle first run: one slow sweeper, two gates, one slime pad.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'a1', type: 'track_block', position: [0, 0, -4], params: { width: 7, length: 14, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'a2', type: 'bouncy_pad', position: [0, 0.4, -9.2], params: { width: 3.6, length: 3.2, bounceForce: 17, color: '#2ec4b6' } },
      { id: 'a3', type: 'track_block', position: [0, 1.8, -21], params: { width: 7, length: 16, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'a4', type: 'spinning_sweeper', position: [0, 2.2, -20.5], params: { armLength: 4.2, speed: 1.2, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'a5', type: 'checkpoint_finish', position: [0, 2.2, -27], params: { variant: 'checkpoint', width: 6.0, color: '#2ec4b6' } },
      { id: 'a6', type: 'track_block', position: [0, 1.8, -40], params: { width: 7, length: 18, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'a7', type: 'shape_gate', position: [0, 2.2, -36], params: { cutoutShape: 'flat_wide', wallWidth: 6.6, wallHeight: 4.0, color: '#ff9f1c' } },
      { id: 'a8', type: 'shape_gate', position: [0, 2.2, -45], params: { cutoutShape: 'tall_narrow', wallWidth: 6.6, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'a9', type: 'track_block', position: [0, 1.8, -56], params: { width: 7.5, length: 12, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'a10', type: 'checkpoint_finish', position: [0, 2.2, -59], params: { variant: 'finish', width: 6.5, color: '#ff9f1c' } }
    ]
  },

  {
    id: 'warmup_weave',
    name: 'Warm-Up Weave',
    difficulty: 1,
    objective: 'Climb the first ramp, then jump the wide gap in front of the tall gate.',
    description: 'Introduces ramps, a real gap and forced morph alternation.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'b1', type: 'track_block', position: [0, 0, -5], params: { width: 7.5, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'b2', type: 'track_block', position: [0, 0.84, -19], params: { width: 7.5, length: 16, height: DECK, slopeAngle: 6, color: '#dbe4f0' } },
      { id: 'b3', type: 'track_block', position: [0, 1.676, -33], params: { width: 7.5, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'b4', type: 'spinning_sweeper', position: [0, 2.076, -31], params: { armLength: 4.8, speed: 1.7, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'b5', type: 'bouncy_pad', position: [0, 2.076, -37], params: { width: 3.4, length: 3.0, bounceForce: 15, color: '#2ec4b6' } },
      { id: 'b6', type: 'track_block', position: [0, 1.676, -48], params: { width: 7, length: 10, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'b7', type: 'shape_gate', position: [0, 2.076, -46], params: { cutoutShape: 'flat_wide', wallWidth: 6.6, wallHeight: 4.0, color: '#ff9f1c' } },
      { id: 'b8', type: 'checkpoint_finish', position: [0, 2.076, -51], params: { variant: 'checkpoint', width: 6.0, color: '#2ec4b6' } },
      { id: 'b9', type: 'track_block', position: [0, 1.676, -60], params: { width: 7, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'b10', type: 'shape_gate', position: [0, 2.076, -57], params: { cutoutShape: 'tall_narrow', wallWidth: 6.4, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'b11', type: 'track_block', position: [0, 1.676, -72], params: { width: 7.5, length: 10, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'b12', type: 'checkpoint_finish', position: [0, 2.076, -74], params: { variant: 'finish', width: 6.5, color: '#ff9f1c' } }
    ]
  },

  {
    id: 'ripple_rhythm',
    name: 'Ripple Rhythm',
    difficulty: 2,
    objective: 'Two bars turn in opposite directions. Read the beat and slip through the middle.',
    description: 'Counter-rotating sweepers punish blind sprinting.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'c1', type: 'track_block', position: [0, 0, -5], params: { width: 7, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'c2', type: 'bouncy_pad', position: [0, 0.4, -8.5], params: { width: 3.4, length: 3.0, bounceForce: 17.5, color: '#2ec4b6' } },
      { id: 'c3', type: 'track_block', position: [0, 2.2, -19], params: { width: 7, length: 16, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'c4', type: 'spinning_sweeper', position: [0, 2.6, -16.5], params: { armLength: 4.4, speed: 1.5, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'c5', type: 'spinning_sweeper', position: [0, 2.6, -23.5], params: { armLength: 4.4, speed: -1.5, barHeight: 0.85, color: '#ff9f1c' } },
      { id: 'c6', type: 'track_block', position: [0, 2.2, -37], params: { width: 7, length: 14, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'c7', type: 'checkpoint_finish', position: [0, 2.6, -31.5], params: { variant: 'checkpoint', width: 6.0, color: '#2ec4b6' } },
      { id: 'c8', type: 'shape_gate', position: [0, 2.6, -36], params: { cutoutShape: 'tall_narrow', wallWidth: 6.6, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'c9', type: 'track_block', position: [0, 2.2, -54], params: { width: 7, length: 16, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'c10', type: 'shape_gate', position: [0, 2.6, -49], params: { cutoutShape: 'flat_wide', wallWidth: 6.6, wallHeight: 4.0, color: '#ff9f1c' } },
      { id: 'c11', type: 'track_block', position: [0, 2.2, -70], params: { width: 7, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'c12', type: 'checkpoint_finish', position: [0, 2.6, -73], params: { variant: 'finish', width: 6.5, color: '#ff9f1c' } }
    ]
  },

  {
    id: 'squeeze_corridor',
    name: 'Squeeze Corridor',
    difficulty: 2,
    objective: 'Three gates, eight metres apart. Flat, tall, flat - keep the rhythm going.',
    description: 'A narrow gate corridor with one bar waiting at the end.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'd1', type: 'track_block', position: [0, 0, -4], params: { width: 6.5, length: 10, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'd2', type: 'track_block', position: [0, 1.8, -20], params: { width: 6.0, length: 20, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'd3', type: 'shape_gate', position: [0, 2.2, -13], params: { cutoutShape: 'flat_wide', wallWidth: 5.7, wallHeight: 4.4, color: '#ff9f1c' } },
      { id: 'd4', type: 'shape_gate', position: [0, 2.2, -21], params: { cutoutShape: 'tall_narrow', wallWidth: 5.7, wallHeight: 4.4, color: '#3a86ff' } },
      { id: 'd5', type: 'shape_gate', position: [0, 2.2, -29], params: { cutoutShape: 'flat_wide', wallWidth: 5.7, wallHeight: 4.4, color: '#ff4d6d' } },
      { id: 'd6', type: 'track_block', position: [0, 1.8, -41], params: { width: 6.0, length: 18, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'd7', type: 'checkpoint_finish', position: [0, 2.2, -34], params: { variant: 'checkpoint', width: 5.4, color: '#2ec4b6' } },
      { id: 'd8', type: 'spinning_sweeper', position: [0, 2.2, -39], params: { armLength: 5.0, speed: 1.6, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'd9', type: 'track_block', position: [0, 1.8, -58], params: { width: 6.5, length: 14, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'd10', type: 'checkpoint_finish', position: [0, 2.2, -62], params: { variant: 'finish', width: 6.0, color: '#ff9f1c' } }
    ]
  },

  {
    id: 'step_it_up',
    name: 'Step It Up',
    difficulty: 3,
    objective: 'Climb the staircase, then catch the rising lift and ride it to the top deck.',
    description: 'Vertical progression ending in a moving elevator.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'e1', type: 'track_block', position: [0, 0, -4], params: { width: 7.5, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'e2', type: 'track_block', position: [0, 1.5, -16], params: { width: 7, length: 10, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'e3', type: 'spinning_sweeper', position: [0, 1.9, -14.5], params: { armLength: 5.0, speed: 1.8, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'e4', type: 'track_block', position: [0, 3.1, -28], params: { width: 6.5, length: 10, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'e5', type: 'shape_gate', position: [0, 3.5, -26], params: { cutoutShape: 'tall_narrow', wallWidth: 6.1, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'e7', type: 'track_block', position: [0, 4.8, -40], params: { width: 6.5, length: 10, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'e8', type: 'checkpoint_finish', position: [0, 5.2, -44], params: { variant: 'checkpoint', width: 5.6, color: '#2ec4b6' } },
      { id: 'e9', type: 'moving_platform', position: [0, 5.0, -52], params: { width: 4.5, length: 7.0, axis: 'y', distance: 2.0, speed: 1.2, color: '#3a86ff' } },
      { id: 'e10', type: 'track_block', position: [0, 7.2, -63], params: { width: 6.5, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'e11', type: 'spinning_sweeper', position: [0, 7.6, -61], params: { armLength: 5.2, speed: 1.8, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'e12', type: 'shape_gate', position: [0, 7.6, -66], params: { cutoutShape: 'flat_wide', wallWidth: 6.1, wallHeight: 4.0, color: '#ff9f1c' } },
      { id: 'e13', type: 'track_block', position: [0, 7.2, -76], params: { width: 7, length: 12, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'e14', type: 'checkpoint_finish', position: [0, 7.6, -79], params: { variant: 'finish', width: 6.5, color: '#ff9f1c' } }
    ]
  },

  {
    id: 'morph_madness',
    name: 'Morph Madness',
    difficulty: 3,
    objective: 'Gate, gate, pad, then two bars and a drifting bridge. Keep morphing mid-air.',
    description: 'Shape-shifting gates interleaved with hazard timing.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'f1', type: 'track_block', position: [0, 0, -8], params: { width: 6.8, length: 22, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'f2', type: 'shape_gate', position: [0, 0.4, -7], params: { cutoutShape: 'flat_wide', wallWidth: 6.4, wallHeight: 4.0, color: '#ff9f1c' } },
      { id: 'f3', type: 'shape_gate', position: [0, 0.4, -14], params: { cutoutShape: 'tall_narrow', wallWidth: 6.4, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'f4', type: 'bouncy_pad', position: [0, 0.4, -17], params: { width: 3.4, length: 3.0, bounceForce: 20.5, color: '#2ec4b6' } },
      { id: 'f5', type: 'track_block', position: [0, 3.2, -31], params: { width: 7.2, length: 20, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'f6', type: 'checkpoint_finish', position: [0, 3.6, -23.5], params: { variant: 'checkpoint', width: 6.2, color: '#2ec4b6' } },
      { id: 'f7', type: 'spinning_sweeper', position: [0, 3.6, -29.5], params: { armLength: 4.6, speed: 1.5, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'f8', type: 'spinning_sweeper', position: [0, 3.6, -36.5], params: { armLength: 4.6, speed: -1.5, barHeight: 0.85, color: '#ff9f1c' } },
      { id: 'f9', type: 'moving_platform', position: [0, 3.2, -46], params: { width: 4.4, length: 6.0, axis: 'x', distance: 3.6, speed: 1.5, color: '#3a86ff' } },
      { id: 'f10', type: 'track_block', position: [0, 3.2, -62], params: { width: 7.0, length: 22, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'f11', type: 'checkpoint_finish', position: [0, 3.6, -53.5], params: { variant: 'checkpoint', width: 6.2, color: '#2ec4b6' } },
      { id: 'f12', type: 'shape_gate', position: [0, 3.6, -58.5], params: { cutoutShape: 'tall_narrow', wallWidth: 6.6, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'f13', type: 'checkpoint_finish', position: [0, 3.6, -70.5], params: { variant: 'finish', width: 6.6, color: '#ff9f1c' } }
    ]
  },

  {
    id: 'slime_cathedral',
    name: 'Slime Cathedral',
    difficulty: 4,
    objective: 'Chain two launches up to the high hall, then flatten and slip under the low bars.',
    description: 'A vertical climb on slime pads with duck-under sweepers.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'h1', type: 'track_block', position: [0, 0, -5], params: { width: 7, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'h2', type: 'bouncy_pad', position: [0, 0.4, -9], params: { width: 3.6, length: 3.4, bounceForce: 18.5, color: '#2ec4b6' } },
      { id: 'h3', type: 'track_block', position: [0, 5.0, -21], params: { width: 6.5, length: 14, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'h4', type: 'checkpoint_finish', position: [0, 5.4, -17], params: { variant: 'checkpoint', width: 5.8, color: '#2ec4b6' } },
      { id: 'h5', type: 'spinning_sweeper', position: [0, 5.4, -26], params: { armLength: 5.2, speed: -1.9, barHeight: 1.05, color: '#ff4d6d' } },
      { id: 'h6', type: 'track_block', position: [0, 5.0, -36], params: { width: 6.0, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'h7', type: 'spinning_sweeper', position: [0, 5.4, -35], params: { armLength: 5.4, speed: 1.9, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'h8', type: 'shape_gate', position: [0, 5.4, -41], params: { cutoutShape: 'flat_wide', wallWidth: 5.7, wallHeight: 4.0, color: '#ff9f1c' } },
      { id: 'h9', type: 'track_block', position: [0, 5.0, -50], params: { width: 6.0, length: 12, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'h10', type: 'bouncy_pad', position: [0, 5.4, -54], params: { width: 3.2, length: 3.0, bounceForce: 22, color: '#2ec4b6' } },
      { id: 'h11', type: 'track_block', position: [0, 10.2, -70], params: { width: 6.0, length: 22, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'h12', type: 'checkpoint_finish', position: [0, 10.6, -74], params: { variant: 'checkpoint', width: 5.6, color: '#2ec4b6' } },
      { id: 'h13', type: 'spinning_sweeper', position: [0, 10.6, -78], params: { armLength: 5.4, speed: 1.9, barHeight: 1.05, color: '#ff9f1c' } },
      { id: 'h14', type: 'track_block', position: [0, 10.2, -90], params: { width: 6.5, length: 12, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'h15', type: 'checkpoint_finish', position: [0, 10.6, -93], params: { variant: 'finish', width: 6.5, color: '#ff9f1c' } }
    ]
  },

  {
    id: 'sky_bridges',
    name: 'Sky Bridges',
    difficulty: 4,
    objective: 'Cross three drifting bridges over open air. Board early, jump late.',
    description: 'Platform-only traversal at three different axes.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'g1', type: 'track_block', position: [0, 0, -4], params: { width: 7.5, length: 10, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'g2', type: 'bouncy_pad', position: [0, 0.4, -7], params: { width: 3.2, length: 3.0, bounceForce: 14, color: '#2ec4b6' } },
      { id: 'g3', type: 'track_block', position: [0, 2.2, -17], params: { width: 7, length: 10, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'g4', type: 'spinning_sweeper', position: [0, 2.6, -19.5], params: { armLength: 5.6, speed: 1.9, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'g5', type: 'moving_platform', position: [0, 2.2, -30], params: { width: 5.0, length: 7.0, axis: 'z', distance: 3.2, speed: 1.4, color: '#3a86ff' } },
      { id: 'g6', type: 'track_block', position: [0, 2.2, -47], params: { width: 6.5, length: 14, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'g7', type: 'checkpoint_finish', position: [0, 2.6, -43], params: { variant: 'checkpoint', width: 5.6, color: '#2ec4b6' } },
      { id: 'g8', type: 'spinning_sweeper', position: [0, 2.6, -50], params: { armLength: 5.6, speed: -1.9, barHeight: 0.85, color: '#ff9f1c' } },
      { id: 'g9', type: 'moving_platform', position: [0, 2.2, -62], params: { width: 4.6, length: 8.0, axis: 'x', distance: 3.8, speed: 1.5, color: '#3a86ff' } },
      { id: 'g10', type: 'track_block', position: [0, 2.2, -76], params: { width: 6.0, length: 14, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'g11', type: 'shape_gate', position: [0, 2.6, -73], params: { cutoutShape: 'tall_narrow', wallWidth: 5.7, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'g12', type: 'spinning_sweeper', position: [0, 2.6, -79], params: { armLength: 6.6, speed: 2.0, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'g13', type: 'moving_platform', position: [0, 3.0, -88], params: { width: 4.5, length: 7.0, axis: 'y', distance: 2.2, speed: 1.3, color: '#3a86ff' } },
      { id: 'g14', type: 'track_block', position: [0, 3.4, -102], params: { width: 6.5, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'g15', type: 'checkpoint_finish', position: [0, 3.8, -105], params: { variant: 'finish', width: 6.5, color: '#ff9f1c' } }
    ]
  },

  {
    id: 'vertigo_spiral',
    name: 'Vertigo Spiral',
    difficulty: 5,
    objective: 'Twenty metres of ramp, a timed lift, then bars that swing clear off the narrow ledge.',
    description: 'Height, narrow ledges and overhanging sweeper arms.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'i1', type: 'track_block', position: [0, 0, -5], params: { width: 7, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'i2', type: 'track_block', position: [0, 1.05, -21], params: { width: 6.5, length: 20, height: DECK, slopeAngle: 6, color: '#dbe4f0' } },
      { id: 'i3', type: 'track_block', position: [0, 2.095, -40], params: { width: 6.5, length: 18, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'i4', type: 'spinning_sweeper', position: [0, 2.495, -37], params: { armLength: 7.0, speed: 1.9, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'i5', type: 'track_block', position: [0, 2.095, -56], params: { width: 6.0, length: 12, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'i6', type: 'spinning_sweeper', position: [0, 2.495, -53], params: { armLength: 7.0, speed: -2.0, barHeight: 0.85, color: '#ff9f1c' } },
      { id: 'i7', type: 'checkpoint_finish', position: [0, 2.495, -59], params: { variant: 'checkpoint', width: 5.6, color: '#2ec4b6' } },
      { id: 'i8', type: 'moving_platform', position: [0, 2.295, -69], params: { width: 4.6, length: 9.0, axis: 'y', distance: 2.4, speed: 1.1, color: '#3a86ff' } },
      { id: 'i9', type: 'track_block', position: [0, 4.6, -84], params: { width: 6.0, length: 14, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'i10', type: 'shape_gate', position: [0, 5.0, -80], params: { cutoutShape: 'tall_narrow', wallWidth: 5.7, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'i11', type: 'spinning_sweeper', position: [0, 5.0, -87], params: { armLength: 7.0, speed: 2.1, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'i12', type: 'checkpoint_finish', position: [0, 5.0, -83], params: { variant: 'checkpoint', width: 5.4, color: '#2ec4b6' } },
      { id: 'i13', type: 'track_block', position: [0, 4.6, -102], params: { width: 5.5, length: 14, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'i14', type: 'spinning_sweeper', position: [0, 5.0, -99], params: { armLength: 6.4, speed: -2.1, barHeight: 0.85, color: '#ff9f1c' } },
      { id: 'i15', type: 'track_block', position: [0, 4.6, -118], params: { width: 6.0, length: 14, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'i16', type: 'spinning_sweeper', position: [0, 5.0, -115], params: { armLength: 6.6, speed: 2.3, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'i17', type: 'checkpoint_finish', position: [0, 5.0, -121], params: { variant: 'finish', width: 6.0, color: '#ff9f1c' } }
    ]
  },

  {
    id: 'final_gauntlet',
    name: 'Final Gel Gauntlet',
    difficulty: 5,
    objective: 'Every hazard at once. Four bars, two bridges, three gates and a duck-under. Good luck.',
    description: 'The full obstacle vocabulary in one long run.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      { id: 'j1', type: 'track_block', position: [0, 0, -5], params: { width: 7.5, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'j2', type: 'bouncy_pad', position: [0, 0.4, -9], params: { width: 3.4, length: 3.0, bounceForce: 18, color: '#2ec4b6' } },
      { id: 'j3', type: 'track_block', position: [0, 2.6, -20], params: { width: 6.0, length: 14, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'j4', type: 'spinning_sweeper', position: [0, 3.0, -16], params: { armLength: 6.2, speed: 2.2, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'j5', type: 'track_block', position: [0, 2.6, -34], params: { width: 6.0, length: 12, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'j6', type: 'spinning_sweeper', position: [0, 3.0, -31], params: { armLength: 6.2, speed: -2.2, barHeight: 0.85, color: '#ff9f1c' } },
      { id: 'j7', type: 'shape_gate', position: [0, 3.0, -36], params: { cutoutShape: 'tall_narrow', wallWidth: 5.7, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'j8', type: 'checkpoint_finish', position: [0, 3.0, -39], params: { variant: 'checkpoint', width: 5.4, color: '#2ec4b6' } },
      { id: 'j9', type: 'moving_platform', position: [0, 2.6, -48], params: { width: 4.4, length: 7.0, axis: 'x', distance: 3.4, speed: 1.7, color: '#3a86ff' } },
      { id: 'j10', type: 'track_block', position: [0, 2.6, -62], params: { width: 5.5, length: 16, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'j11', type: 'shape_gate', position: [0, 3.0, -57], params: { cutoutShape: 'flat_wide', wallWidth: 5.2, wallHeight: 4.0, color: '#ff9f1c' } },
      { id: 'j12', type: 'spinning_sweeper', position: [0, 3.0, -62], params: { armLength: 6.4, speed: 2.3, barHeight: 0.85, color: '#ff4d6d' } },
      { id: 'j13', type: 'bouncy_pad', position: [0, 3.0, -68], params: { width: 3.2, length: 3.0, bounceForce: 22.5, color: '#2ec4b6' } },
      { id: 'j14', type: 'track_block', position: [0, 7.4, -80], params: { width: 6.0, length: 18, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'j15', type: 'checkpoint_finish', position: [0, 7.8, -74], params: { variant: 'checkpoint', width: 5.4, color: '#2ec4b6' } },
      { id: 'j16', type: 'spinning_sweeper', position: [0, 7.8, -83], params: { armLength: 5.6, speed: -1.9, barHeight: 1.05, color: '#ff4d6d' } },
      { id: 'j17', type: 'track_block', position: [0, 7.4, -97], params: { width: 6.5, length: 14, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'j18', type: 'moving_platform', position: [0, 7.4, -112], params: { width: 4.5, length: 7.0, axis: 'y', distance: 2.4, speed: 1.3, color: '#3a86ff' } },
      { id: 'j19', type: 'track_block', position: [0, 9.6, -124], params: { width: 6.0, length: 14, height: DECK, slopeAngle: 0, color: '#e2e8f0' } },
      { id: 'j20', type: 'checkpoint_finish', position: [0, 10.0, -120], params: { variant: 'checkpoint', width: 5.4, color: '#2ec4b6' } },
      { id: 'j21', type: 'shape_gate', position: [0, 10.0, -128], params: { cutoutShape: 'tall_narrow', wallWidth: 5.7, wallHeight: 4.0, color: '#3a86ff' } },
      { id: 'j22', type: 'track_block', position: [0, 9.6, -139], params: { width: 6.5, length: 12, height: DECK, slopeAngle: 0, color: '#dbe4f0' } },
      { id: 'j23', type: 'checkpoint_finish', position: [0, 10.0, -142], params: { variant: 'finish', width: 6.5, color: '#ff9f1c' } }
    ]
  }
];
