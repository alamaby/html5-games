export const PRESET_LEVELS = {
  beginner_bounce: {
    id: 'beginner_bounce',
    name: 'Beginner Bounce',
    description: 'Learn bouncing pads, sweeper timing, and your first morph gate.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      {
        id: 'obs_1',
        type: 'track_block',
        position: [0, 0, -4],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 7, length: 14, height: 0.8, slopeAngle: 0, color: '#e2e8f0' }
      },
      {
        id: 'obs_2',
        type: 'bouncy_pad',
        position: [0, 0.4, -9.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 3.6, length: 3.2, bounceForce: 18.5, color: '#2ec4b6' }
      },
      {
        id: 'obs_3',
        type: 'track_block',
        position: [0, 2.2, -21],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 7, length: 16, height: 0.8, slopeAngle: 0, color: '#dbe4f0' }
      },
      {
        id: 'obs_4',
        type: 'spinning_sweeper',
        position: [0, 2.6, -20.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { armLength: 5.8, speed: 1.85, barHeight: 0.85, color: '#ff4d6d' }
      },
      {
        id: 'obs_5',
        type: 'checkpoint_finish',
        position: [0, 2.6, -27],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { variant: 'checkpoint', width: 6.0, color: '#2ec4b6' }
      },
      {
        id: 'obs_6',
        type: 'track_block',
        position: [0, 2.2, -39],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 7, length: 18, height: 0.8, slopeAngle: 0, color: '#e2e8f0' }
      },
      {
        id: 'obs_7',
        type: 'shape_gate',
        position: [0, 2.6, -36],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { cutoutShape: 'flat_wide', wallWidth: 6.6, wallHeight: 3.4, color: '#ff9f1c' }
      },
      {
        id: 'obs_8',
        type: 'shape_gate',
        position: [0, 2.6, -43],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { cutoutShape: 'tall_narrow', wallWidth: 6.6, wallHeight: 3.4, color: '#3a86ff' }
      },
      {
        id: 'obs_9',
        type: 'moving_platform',
        position: [0, 2.2, -53],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 4.8, length: 6.5, axis: 'x', distance: 3.2, speed: 1.4, color: '#3a86ff' }
      },
      {
        id: 'obs_10',
        type: 'track_block',
        position: [0, 2.2, -65],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 8, length: 14, height: 0.8, slopeAngle: 0, color: '#e2e8f0' }
      },
      {
        id: 'obs_11',
        type: 'checkpoint_finish',
        position: [0, 2.6, -69],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { variant: 'finish', width: 6.5, color: '#ff9f1c' }
      }
    ]
  },

  morph_madness: {
    id: 'morph_madness',
    name: 'Morph Madness',
    description: 'Rapid shape-shifting gates, dual sweepers, and moving sky bridges.',
    spawnPoint: [0, 2.2, 0],
    obstacles: [
      {
        id: 'obs_101',
        type: 'track_block',
        position: [0, 0, -8],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 6.8, length: 22, height: 0.8, slopeAngle: 0, color: '#e2e8f0' }
      },
      {
        id: 'obs_102',
        type: 'shape_gate',
        position: [0, 0.4, -7],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { cutoutShape: 'flat_wide', wallWidth: 6.4, wallHeight: 3.4, color: '#ff9f1c' }
      },
      {
        id: 'obs_103',
        type: 'shape_gate',
        position: [0, 0.4, -14],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { cutoutShape: 'tall_narrow', wallWidth: 6.4, wallHeight: 3.4, color: '#ff4d6d' }
      },
      {
        id: 'obs_104',
        type: 'bouncy_pad',
        position: [0, 0.4, -17.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 3.4, length: 3.0, bounceForce: 20.5, color: '#2ec4b6' }
      },
      {
        id: 'obs_105',
        type: 'track_block',
        position: [0, 3.2, -31],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 7.2, length: 20, height: 0.8, slopeAngle: 0, color: '#dbe4f0' }
      },
      {
        id: 'obs_106',
        type: 'checkpoint_finish',
        position: [0, 3.6, -23.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { variant: 'checkpoint', width: 6.2, color: '#2ec4b6' }
      },
      {
        id: 'obs_107',
        type: 'spinning_sweeper',
        position: [0, 3.6, -29.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { armLength: 6.2, speed: 2.6, barHeight: 0.85, color: '#ff4d6d' }
      },
      {
        id: 'obs_108',
        type: 'spinning_sweeper',
        position: [0, 3.6, -36.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { armLength: 6.2, speed: -2.8, barHeight: 0.85, color: '#ff9f1c' }
      },
      {
        id: 'obs_109',
        type: 'moving_platform',
        position: [0, 3.2, -46],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 4.4, length: 6.0, axis: 'x', distance: 4.5, speed: 1.95, color: '#3a86ff' }
      },
      {
        id: 'obs_110',
        type: 'track_block',
        position: [0, 3.2, -62],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { width: 7.0, length: 22, height: 0.8, slopeAngle: 0, color: '#e2e8f0' }
      },
      {
        id: 'obs_111',
        type: 'checkpoint_finish',
        position: [0, 3.6, -53.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { variant: 'checkpoint', width: 6.2, color: '#2ec4b6' }
      },
      {
        id: 'obs_112',
        type: 'shape_gate',
        position: [0, 3.6, -58.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { cutoutShape: 'tall_narrow', wallWidth: 6.6, wallHeight: 3.4, color: '#3a86ff' }
      },
      {
        id: 'obs_113',
        type: 'shape_gate',
        position: [0, 3.6, -64.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { cutoutShape: 'flat_wide', wallWidth: 6.6, wallHeight: 3.4, color: '#ff9f1c' }
      },
      {
        id: 'obs_114',
        type: 'checkpoint_finish',
        position: [0, 3.6, -70.5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        params: { variant: 'finish', width: 6.6, color: '#ff9f1c' }
      }
    ]
  }
};
