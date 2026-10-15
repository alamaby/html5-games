/* Pull the Pin — pure game logic (no DOM, no audio). Testable in Node. */
'use strict';

const PP = {
  W: 420, H: 740,
  CX1: 40, CX2: 380, CTOP: 130, FLOOR: 670,   // container bounds
  BALL_R: 16, PIN_R: 7,
  GRAV: 1500, MAXV: 1000,

  LEVELS: [
    {
      name: { en: 'First Pull', id: 'Tarikan Pertama' },
      pins: [{ x1: 40, x2: 380, y: 360, handle: 'r' }],
      balls: [
        { x: 160, y: 290, kind: 'good' }, { x: 210, y: 290, kind: 'good' },
        { x: 260, y: 290, kind: 'good' },
      ],
      cup: { x: 210, w: 130, y: 600 },
      lava: null,
      target: 3,
      hint: { en: 'Tap the pin to pull it!', id: 'Ketuk pin untuk menariknya!' },
      solve: [0],
    },
    {
      name: { en: 'Order Matters', id: 'Urutan Penting' },
      pins: [
        { x1: 40, x2: 380, y: 330, handle: 'r' },
        { x1: 40, x2: 380, y: 510, handle: 'l' },
      ],
      balls: [
        { x: 110, y: 260, kind: 'good' }, { x: 150, y: 260, kind: 'good' },
        { x: 190, y: 260, kind: 'good' },
        { x: 215, y: 460, kind: 'bomb' }, { x: 260, y: 460, kind: 'bomb' },
      ],
      cup: { x: 150, w: 100, y: 600 },
      lava: { x1: 190, x2: 370, y: 640 },
      target: 3,
      hint: { en: 'Wrong order goes BOOM!', id: 'Urutan salah bisa DUAR!' },
      solve: [1, 0],
    },
    {
      name: { en: 'Split Path', id: 'Jalan Terpisah' },
      pins: [
        { x1: 40, x2: 380, y: 330, handle: 'r' },
        { x1: 40, x2: 200, y: 510, handle: 'l' },
      ],
      balls: [
        { x: 90, y: 260, kind: 'good' }, { x: 130, y: 260, kind: 'good' },
        { x: 170, y: 260, kind: 'good' },
        { x: 270, y: 260, kind: 'bomb' }, { x: 310, y: 260, kind: 'bomb' },
      ],
      cup: { x: 130, w: 100, y: 600 },
      lava: { x1: 240, x2: 370, y: 640 },
      target: 3,
      hint: { en: 'Bombs love lava.', id: 'Bom suka lava.' },
      solve: [0, 1],
    },
    {
      name: { en: 'Zigzag', id: 'Zigzag' },
      pins: [
        { x1: 40, x2: 210, y: 300, handle: 'l' },
        { x1: 210, x2: 380, y: 460, handle: 'r' },
      ],
      balls: [
        { x: 100, y: 230, kind: 'good' }, { x: 140, y: 230, kind: 'good' },
        { x: 180, y: 230, kind: 'good' },
        { x: 300, y: 400, kind: 'bomb' },
      ],
      cup: { x: 140, w: 100, y: 600 },
      lava: { x1: 260, x2: 370, y: 640 },
      target: 3,
      hint: { en: 'Staggered pins, steady hands.', id: 'Pin zigzag, tangan stabil.' },
      solve: [0, 1],
    },
    {
      name: { en: 'Grand Finale', id: 'Final Akbar' },
      pins: [
        { x1: 40, x2: 380, y: 320, handle: 'r' },
        { x1: 260, x2: 380, y: 500, handle: 'l' },
      ],
      balls: [
        { x: 110, y: 250, kind: 'good' }, { x: 150, y: 250, kind: 'good' },
        { x: 300, y: 250, kind: 'bomb' },
        { x: 300, y: 450, kind: 'bomb' }, { x: 340, y: 450, kind: 'bomb' },
      ],
      cup: { x: 130, w: 80, y: 600 },
      lava: { x1: 270, x2: 370, y: 640 },
      target: 2,
      hint: { en: 'Everything you learned, at once.', id: 'Semua yang kupelajari, sekaligus.' },
      solve: [1, 0],
    },
  ],

  createGame(levelIdx) {
    const L = PP.LEVELS[levelIdx];
    return {
      level: levelIdx,
      pins: L.pins.map((p) => ({ x1: p.x1, x2: p.x2, y: p.y, handle: p.handle, state: 'in' })),
      balls: L.balls.map((b) => ({
        x: b.x, y: b.y, px: b.x, py: b.y, vx: 0, vy: 0,
        kind: b.kind, state: 'active',
      })),
      cup: { x: L.cup.x, w: L.cup.w, y: L.cup.y },
      lava: L.lava ? { x1: L.lava.x1, x2: L.lava.x2, y: L.lava.y } : null,
      target: L.target,
      totalGood: L.balls.filter((b) => b.kind === 'good').length,
      cupCount: 0, exploded: 0, lavaBombs: 0,
      status: 'aim',           // aim | sim | won | lost
      time: 0, settleT: 0, endT: 0,
      capTimes: [],
      events: [],
    };
  },

  pullPin(st, i) {
    const p = st.pins[i];
    if (!p || p.state !== 'in' || st.status === 'won' || st.status === 'lost') return false;
    p.state = 'out';
    if (st.status === 'aim') st.status = 'sim';
    st.events.push({ t: 'pinpull', i });
    return true;
  },

  activeBalls(st) { return st.balls.filter((b) => b.state === 'active'); },
  activeGood(st) { return st.balls.filter((b) => b.state === 'active' && b.kind === 'good'); },

  step(st, dt) {
    if (st.status === 'won' || st.status === 'lost') return;
    st.time += dt;
    st.events.length = 0;
    const h = dt / 3;
    for (let s = 0; s < 3; s++) PP.substep(st, h);
    // win / lose evaluation
    if (st.cupCount >= st.target) {
      st.endT += dt;
      if (st.endT > 0.6) { st.status = 'won'; st.events.push({ t: 'win' }); }
      return;
    }
    st.endT = 0;
    let maxSp = 0;
    const act = PP.activeBalls(st);
    for (const b of act) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > maxSp) maxSp = sp;
    }
    const pinsIn = st.pins.some((p) => p.state === 'in');
    if (!pinsIn && maxSp < 15) st.settleT += dt; else st.settleT = 0;
    if (PP.activeGood(st).length + st.cupCount < st.target) {
      st.status = 'lost'; st.events.push({ t: 'lose', why: 'impossible' }); return;
    }
    if (st.settleT > 0.7) {
      st.status = st.cupCount >= st.target ? 'won' : 'lost';
      st.events.push({ t: st.status, why: 'settled' });
    }
  },

  substep(st, h) {
    const R = PP.BALL_R;
    for (const b of st.balls) {
      if (b.state !== 'active') continue;
      b.px = b.x; b.py = b.y;
      b.vy = Math.min(b.vy + PP.GRAV * h, PP.MAXV);
      b.vx *= (1 - 0.12 * h); b.vy *= (1 - 0.02 * h);
      b.x += b.vx * h; b.y += b.vy * h;
      // walls
      if (b.x - R < PP.CX1) { b.x = PP.CX1 + R; b.vx = Math.abs(b.vx) * 0.3; }
      if (b.x + R > PP.CX2) { b.x = PP.CX2 - R; b.vx = -Math.abs(b.vx) * 0.3; }
      if (b.y - R < PP.CTOP) { b.y = PP.CTOP + R; b.vy = Math.abs(b.vy) * 0.3; }
      if (b.y + R > PP.FLOOR) {
        b.y = PP.FLOOR - R;
        if (Math.abs(b.vy) > 60) { b.vy = -b.vy * 0.25; st.events.push({ t: 'bounce', x: b.x, y: b.y }); }
        else b.vy = 0;
        b.vx *= (1 - 2.5 * h);
      }
      // pins (capsule collision)
      for (const p of st.pins) {
        if (p.state !== 'in') continue;
        const cx = Math.max(p.x1, Math.min(b.x, p.x2));
        const dx = b.x - cx, dy = b.y - p.y;
        const d = Math.hypot(dx, dy), minD = R + PP.PIN_R;
        if (d < minD && d > 1e-6) {
          const nx = dx / d, ny = dy / d;
          b.x = cx + nx * minD; b.y = p.y + ny * minD;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx -= 1.1 * vn * nx; b.vy -= 1.1 * vn * ny;
            b.vx *= 0.985; b.vy *= 0.985;
            if (vn < -120) st.events.push({ t: 'pinbounce', x: b.x, y: b.y });
          }
        }
      }
      // (no per-substep sleep: substep gravity is below any sane threshold;
      // resting jitter stays under the settle-detection limit instead)
    }
    // ball-ball collisions
    const act = PP.activeBalls(st);
    for (let i = 0; i < act.length; i++) {
      for (let j = i + 1; j < act.length; j++) {
        const a = act[i], c = act[j];
        const dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy), minD = R * 2;
        if (d < minD && d > 1e-6) {
          const nx = dx / d, ny = dy / d, ov = (minD - d) / 2;
          a.x -= nx * ov; a.y -= ny * ov;
          c.x += nx * ov; c.y += ny * ov;
          const rvx = c.vx - a.vx, rvy = c.vy - a.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const imp = -(1 + 0.25) * vn / 2;
            a.vx -= imp * nx; a.vy -= imp * ny;
            c.vx += imp * nx; c.vy += imp * ny;
          }
          // bomb touches good ball -> both destroyed
          if ((a.kind === 'bomb' && c.kind === 'good') || (a.kind === 'good' && c.kind === 'bomb')) {
            const bx = (a.x + c.x) / 2, by = (a.y + c.y) / 2;
            a.state = 'dead'; c.state = 'dead';
            st.exploded++;
            st.events.push({ t: 'explode', x: bx, y: by });
          }
        }
      }
    }
    // cup capture + lava
    for (const b of st.balls) {
      if (b.state !== 'active') continue;
      const cup = st.cup;
      if (b.vy > 0 && b.py <= cup.y && b.y > cup.y &&
          Math.abs(b.x - cup.x) < cup.w / 2 - 6) {
        b.state = 'cup';
        if (b.kind === 'bomb') {
          st.status = 'lost'; st.events.push({ t: 'lose', why: 'bombcup', x: b.x, y: b.y });
          return;
        }
        st.cupCount++;
        st.capTimes.push(st.time);
        st.events.push({ t: 'capture', x: b.x, y: cup.y, n: st.cupCount });
        continue;
      }
      const lv = st.lava;
      if (lv && b.y + R > lv.y && b.x > lv.x1 && b.x < lv.x2) {
        b.state = 'dead';
        if (b.kind === 'bomb') { st.lavaBombs++; st.events.push({ t: 'lavaboom', x: b.x, y: lv.y }); }
        else st.events.push({ t: 'lavalost', x: b.x, y: lv.y });
      }
    }
  },
};

if (typeof module !== 'undefined') module.exports = PP;
