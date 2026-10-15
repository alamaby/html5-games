/* Neon Dodge — pure game logic (no DOM, no audio). Testable in Node. */
'use strict';

const ND = {
  W: 420, H: 740,
  PR: 14,

  createGame() {
    return {
      status: 'play',          // play | dying | over
      time: 0, score: 0,
      player: { x: 210, y: 620, tx: 210, ty: 620 },
      obstacles: [],
      spawnT: 0.9,
      nearMiss: 0,
      dieT: 0,
      events: [],
    };
  },

  setTarget(st, x, y) {
    st.player.tx = Math.max(24, Math.min(ND.W - 24, x));
    st.player.ty = Math.max(170, Math.min(ND.H - 40, y));
  },

  difficulty(t) {
    return {
      interval: Math.max(0.32, 1.05 - t * 0.011),
      speed: Math.min(720, 230 + t * 6.5),
    };
  },

  spawn(st, kind, x) {
    const d = ND.difficulty(st.time);
    const k = kind !== undefined ? kind : Math.random();
    const sx = x !== undefined ? x : 30 + Math.random() * (ND.W - 60);
    let o;
    if (k < 0.45) {
      o = { kind: 'bar', x: sx, y: -30, vx: (Math.random() - 0.5) * 40, vy: d.speed,
            w: 60 + Math.random() * 90, h: 16, hue: 315 + Math.random() * 30, scored: false };
    } else if (k < 0.75) {
      o = { kind: 'orb', x: sx, y: -30, vx: (Math.random() - 0.5) * 60, vy: d.speed * 1.1,
            r: 12 + Math.random() * 9, hue: 0 + Math.random() * 20, scored: false, ph: Math.random() * 6.28 };
    } else {
      o = { kind: 'shard', x: sx, y: -30, vx: (Math.random() - 0.5) * 50, vy: d.speed * 0.95,
            r: 14 + Math.random() * 10, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 4,
            hue: 265 + Math.random() * 30, scored: false };
    }
    st.obstacles.push(o);
    return o;
  },

  hitR(o) { return o.kind === 'bar' ? 0 : (o.kind === 'shard' ? o.r * 0.8 : o.r); },

  collides(st, o) {
    const p = st.player, PR = ND.PR * 0.85; // forgiving hitbox
    if (o.kind === 'bar') {
      const cx = Math.max(o.x - o.w / 2, Math.min(p.x, o.x + o.w / 2));
      const cy = Math.max(o.y - o.h / 2, Math.min(p.y, o.y + o.h / 2));
      return Math.hypot(p.x - cx, p.y - cy) < PR;
    }
    return Math.hypot(p.x - o.x, p.y - o.y) < ND.hitR(o) + PR;
  },

  step(st, dt) {
    if (st.status === 'dying') {
      st.dieT -= dt;
      if (st.dieT <= 0) { st.status = 'over'; st.events.push({ t: 'over' }); }
      return;
    }
    if (st.status !== 'play') return;
    st.time += dt;
    st.score += dt * 10;
    const p = st.player;
    const k = Math.min(1, dt * 14);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    st.spawnT -= dt;
    if (st.spawnT <= 0) {
      ND.spawn(st);
      st.spawnT = ND.difficulty(st.time).interval * (0.75 + Math.random() * 0.5);
    }
    for (let i = st.obstacles.length - 1; i >= 0; i--) {
      const o = st.obstacles[i];
      const prevY = o.y;
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.kind === 'orb') o.x += Math.sin(st.time * 3 + o.ph) * 30 * dt;
      if (o.kind === 'shard') o.rot += o.vr * dt;
      if (o.x < 20) { o.x = 20; o.vx = Math.abs(o.vx); }
      if (o.x > ND.W - 20) { o.x = ND.W - 20; o.vx = -Math.abs(o.vx); }
      if (ND.collides(st, o)) {
        st.status = 'dying'; st.dieT = 0.9;
        st.events.push({ t: 'die', x: p.x, y: p.y });
        return;
      }
      if (!o.scored && prevY <= p.y && o.y > p.y) {
        o.scored = true;
        const gap = o.kind === 'bar'
          ? Math.abs(o.x - p.x) - o.w / 2
          : Math.hypot(p.x - o.x, p.y - o.y) - ND.hitR(o);
        if (gap > 0 && gap < 55) {
          st.nearMiss++;
          st.score += 25;
          st.events.push({ t: 'nearmiss', x: p.x, y: p.y });
        }
      }
      if (o.y > ND.H + 60) st.obstacles.splice(i, 1);
    }
  },
};

if (typeof module !== 'undefined') module.exports = ND;
