/* ============================================================================
   KOPI HIGHLANDS — Fase 1: Petik & Dunia
   Single-file HTML5 (vanilla JS + three.js inline). Portrait-first.
   Scope Fase 1: engine, terasering, selective picking, keranjang, hut jual,
   HUD, save, i18n, synth SFX. (Wash channel & roast = Fase 2, lihat banner
   di bawah.)
   ============================================================================ */

/* ============================================================================
   0. BOOT & CONFIG
   ============================================================================ */
const CFG = {
  PICK_RANGE: 2.6,        // jarak maksimal ke cluster agar bisa petik
  PICK_CYCLE: 1.2,        // detik per siklus ring menyusut
  GOLD_R: 31,             // radius zona emas (svg 120x120, r awal 52)
  GOLD_TOL: 5,            // toleransi radius zona emas (±12% fase)
  BASKET_CAP: 40,         // kapasitas keranjang
  CHERRY_PRICE: 0.50,     // $ per cherry (Fase 1: jual langsung di hut)
  Q_GREEN: -2,            // penalti quality per cherry hijau
  Q_OVER: -1,             // penalti quality per cherry overripe
  PLAYER_SPEED: 5.2,
  HUT_POS: null,          // diisi setelah build (Vector3)
  HUT_RADIUS: 2.6,
  SAVE_KEY: 'kh_save_v1',
  BUSH_ROWS: 4, BUSH_COLS: 4, BUSH_GAP: 4.2,
  CLUSTERS_PER_BUSH: 3, CHERRIES_PER_CLUSTER: 6,
};

const COL = {
  sky: 0xF6C87E, fog: 0xF2C078,
  hemiSky: 0xF7C873, hemiGround: 0x5A7A3A, sun: 0xFFD9A0,
  terrace: 0x4C9A5F, terraceEdge: 0x2F6B3E, soil: 0x8A5A3B,
  leaf: 0x2E7D46, trunk: 0x6B4A2B,
  cherryRipe: 0xE8452C, cherryGreen: 0x7AB648, cherryOver: 0x6B2D1E,
  cherryFlower: 0xF5EFD8, cherryGold: 0xFFB800,
  shirt: 0xFF4B4B, skin: 0xE8B88A, pants: 0x3A3A4A, straw: 0xD9B36A,
  jute: 0xC9A86A, water: 0x3FA7C4, hutWood: 0x8A5A3B, hutRoof: 0xA0522D,
};

// helpers (tanpa alokasi)
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function damp(cur, target, rate, dt) { return lerp(cur, target, 1 - Math.exp(-rate * dt)); }

/* ============================================================================
   1. I18N (EN/ID)
   ============================================================================ */
const STRINGS = {
  en: {
    pick: 'PICK', hint_start: 'Walk to a coffee bush. Hold PICK, release in the gold ring!',
    hint_pick: 'Hold PICK... release when the ring turns gold!',
    hint_hut: 'Basket full! Go to the hut to sell.',
    hint_full: 'Basket full!',
    perfect: 'PERFECT!', strip: 'Strip pick', no_ripe: 'No ripe cherries!',
    sold: 'Sold!', quality: 'Quality',
  },
  id: {
    pick: 'PETIK', hint_start: 'Jalan ke semak kopi. Tahan PETIK, lepas di ring emas!',
    hint_pick: 'Tahan PETIK... lepas saat ring jadi emas!',
    hint_hut: 'Keranjang penuh! Ke gubuk untuk jual.',
    hint_full: 'Keranjang penuh!',
    perfect: 'SEMPURNA!', strip: 'Petik campur', no_ripe: 'Tidak ada cherry matang!',
    sold: 'Terjual!', quality: 'Kualitas',
  },
};
let lang = 'en';
function t(key) { const s = STRINGS[lang] || STRINGS.en; return s[key] || STRINGS.en[key] || key; }
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.getElementById('btn-lang').textContent = (lang === 'en') ? 'ID' : 'EN';
  refreshHint(true);
}

/* ============================================================================
   2. SAVE MANAGER (kh_save_v1)
   ============================================================================ */
const SaveSys = {
  data: { v: 1, cash: 0, lang: 'en', stats: { picked: 0, perfect: 0, strips: 0, sold: 0, bestQ: 0 }, lastSave: 0 },
  load() {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === 1) {
          this.data.cash = +d.cash || 0;
          this.data.lang = (d.lang === 'id') ? 'id' : 'en';
          Object.assign(this.data.stats, d.stats || {});
          this.data.lastSave = +d.lastSave || 0;
        }
      }
    } catch (e) { /* corrupted save -> mulai baru */ }
    lang = this.data.lang;
  },
  save() {
    try {
      this.data.lastSave = Date.now();
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(this.data));
    } catch (e) { /* storage penuh/blocked -> abaikan */ }
  },
};

/* ============================================================================
   3. AUDIO SYNTH (Web Audio API, tanpa file eksternal)
   ============================================================================ */
const AudioSys = {
  ctx: null, master: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    if (m) this.ctx.suspend(); else this.ctx.resume();
  },
  _tone(freq, dur, type, vol, when, slideTo) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t0 = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  _noise(dur, vol, filterFreq, when) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t0 = c.currentTime + (when || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = filterFreq || 1500;
    const g = c.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  },
  pluck()  { this._tone(rand(520, 700), 0.12, 'triangle', 0.35); this._noise(0.05, 0.12, 2500); },
  pop()    { this._noise(0.07, 0.2, 1800); },
  ding()   { this._tone(880, 0.35, 'sine', 0.32); this._tone(1318, 0.45, 'sine', 0.28, 0.07); },
  click()  { this._tone(760, 0.06, 'square', 0.12); },
  error()  { this._tone(170, 0.18, 'sawtooth', 0.16, 0, 120); },
  cash()   { this._tone(660, 0.12, 'triangle', 0.3); this._tone(880, 0.12, 'triangle', 0.3, 0.08); this._tone(1174, 0.2, 'triangle', 0.3, 0.16); },
};

/* ============================================================================
   4. ENGINE — renderer, scene, kamera, cahaya
   ============================================================================ */
const Engine = {
  renderer: null, scene: null, camera: null,
  camTarget: null, // Vector3 reusable untuk lookAt
  init() {
    const container = document.getElementById('game');
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;               // r152+ API ✓ (r160)
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new Scene();
    this.scene.background = new Color(COL.sky);
    this.scene.fog = new FogExp2(COL.fog, 0.012);

    this.camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camTarget = new Vector3();

    // Hemisphere: langit amber -> pantulan kebun (tidak ada bayangan hitam pekat)
    const hemi = new HemisphereLight(COL.hemiSky, COL.hemiGround, 0.85);
    this.scene.add(hemi);
    // Sun: hangat, sudut rendah -> bayangan panjang golden-hour
    const sun = new DirectionalLight(COL.sun, 1.4);
    sun.position.set(-18, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.scene.add(sun.target);

    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  },
  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  },
  // kamera isometrik high-angle mengikuti pemain dengan lerp
  follow(dt, px, pz) {
    const aspect = window.innerWidth / window.innerHeight;
    const dist = aspect < 0.8 ? 24 : 19;             // portrait: tarik lebih jauh
    _v1.set(0.62, 0.85, 0.62).normalize().multiplyScalar(dist);
    _v1.x += px; _v1.y += 0; _v1.z += pz;
    const k = 1 - Math.exp(-5 * dt);
    this.camera.position.lerp(_v1, k);
    this.camTarget.set(px, 1.0, pz);
    this.camera.lookAt(this.camTarget);
  },
};
// temp objects — dipakai ulang, tidak pernah new di loop
const _v1 = new Vector3(), _v2 = new Vector3(), _v3 = new Vector3(), _v4 = new Vector3();
const _dummy = new Object3D();
const _color = new Color();

/* ============================================================================
   5. PROCEDURAL ASSETS — terasering, semak kopi + cherry, farmer, hut
   ============================================================================ */
function stdMat(color, opts) {
  return new MeshStandardMaterial(Object.assign(
    { color: color, roughness: 0.68, metalness: 0.05, flatShading: true }, opts || {}));
}

const World = {
  bushes: [],       // { pos:Vector3, clusters:[{anchor:Vector3, cherryIdx:[6]}] }
  cherries: [],     // { inst, state, at, cluster }
  pending: [],      // indeks cherry yang punya transisi terjadwal
  cherryIM: null,
  build() {
    const S = Engine.scene;
    // --- tanah lapang ---
    const ground = new Mesh(new PlaneGeometry(70, 70), stdMat(COL.terrace));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    S.add(ground);

    // --- terasering latar (5 undak naik ke -z) ---
    const terrGeo = new BoxGeometry(46, 1.15, 5);
    const terrIM = new InstancedMesh(terrGeo, stdMat(COL.terrace), 6);
    const edgeGeo = new BoxGeometry(46, 0.35, 0.5);
    const edgeIM = new InstancedMesh(edgeGeo, stdMat(COL.terraceEdge), 6);
    for (let i = 0; i < 6; i++) {
      const z = -15 - i * 5, y = 0.55 + i * 1.15;
      _dummy.position.set(0, y, z); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix(); terrIM.setMatrixAt(i, _dummy.matrix);
      _dummy.position.set(0, y + 0.55, z + 2.5); _dummy.updateMatrix();
      edgeIM.setMatrixAt(i, _dummy.matrix);
    }
    terrIM.receiveShadow = true;
    S.add(terrIM); S.add(edgeIM);

    // --- bukit jauh ---
    const hillGeo = new IcosahedronGeometry(1, 1);
    const hillIM = new InstancedMesh(hillGeo, stdMat(0x6FA05C), 4);
    const hillPos = [[-30, -2, -42, 14], [5, -3, -48, 18], [32, -2, -40, 12], [-8, -4, -55, 22]];
    for (let i = 0; i < 4; i++) {
      _dummy.position.set(hillPos[i][0], hillPos[i][1], hillPos[i][2]);
      _dummy.scale.set(hillPos[i][3], hillPos[i][3] * 0.45, hillPos[i][3] * 0.7);
      _dummy.rotation.set(0, i, 0); _dummy.updateMatrix();
      hillIM.setMatrixAt(i, _dummy.matrix);
    }
    hillIM.frustumCulled = false;
    S.add(hillIM);

    this.buildBushes(S);
    this.buildReadyMarkers(S);
    this.buildGrass(S);
    this.buildHut(S);
  },

  buildBushes(S) {
    const n = CFG.BUSH_ROWS * CFG.BUSH_COLS;                 // 16
    const per = CFG.CLUSTERS_PER_BUSH, cp = CFG.CHERRIES_PER_CLUSTER;
    // trunk + foliage + tanah: instanced (hemat draw call)
    const trunkIM = new InstancedMesh(new CylinderGeometry(0.09, 0.13, 0.9, 6), stdMat(COL.trunk), n);
    const folIM = new InstancedMesh(new IcosahedronGeometry(0.95, 0), stdMat(COL.leaf), n * 3);
    const dirtIM = new InstancedMesh(new CircleGeometry(1.25, 10), stdMat(COL.soil), n);
    trunkIM.castShadow = true; folIM.castShadow = true;
    dirtIM.frustumCulled = false;

    const totalCherries = n * per * cp;                       // 288
    const cherryIM = new InstancedMesh(
      new SphereGeometry(0.09, 6, 5),
      new MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, flatShading: true }),
      totalCherries);
    cherryIM.instanceMatrix.setUsage(DynamicDrawUsage);
    cherryIM.castShadow = true; cherryIM.frustumCulled = false;
    this.cherryIM = cherryIM;

    const gap = CFG.BUSH_GAP, off = (CFG.BUSH_ROWS - 1) * gap / 2;
    let bi = 0, ci = 0;
    const now = performance.now() / 1000;
    for (let r = 0; r < CFG.BUSH_ROWS; r++) for (let c = 0; c < CFG.BUSH_COLS; c++) {
      const x = c * gap - off, z = r * gap - off;
      // tanah
      _dummy.position.set(x, 0.02, z); _dummy.rotation.set(-Math.PI / 2, 0, 0);
      _dummy.scale.set(1, 1, 1); _dummy.updateMatrix(); dirtIM.setMatrixAt(bi, _dummy.matrix);
      // trunk
      _dummy.position.set(x, 0.45, z); _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      trunkIM.setMatrixAt(bi, _dummy.matrix);
      // foliage 3 blob
      const blobs = [[0, 1.15, 0, 1.0], [0.45, 0.95, 0.25, 0.72], [-0.42, 0.98, -0.22, 0.78]];
      for (let b = 0; b < 3; b++) {
        _dummy.position.set(x + blobs[b][0], blobs[b][1], z + blobs[b][2]);
        _dummy.scale.set(blobs[b][3], blobs[b][3] * 0.75, blobs[b][3]);
        _dummy.rotation.set(0, bi + b, 0); _dummy.updateMatrix();
        folIM.setMatrixAt(bi * 3 + b, _dummy.matrix);
      }
      // clusters
      const bush = { pos: new Vector3(x, 0, z), clusters: [] };
      const angles = [Math.PI / 2, Math.PI / 2 + 2.1, Math.PI / 2 + 4.2];
      for (let k = 0; k < per; k++) {
        const ax = x + Math.cos(angles[k]) * 0.62, az = z + Math.sin(angles[k]) * 0.62;
        const ay = 1.05 + (k % 2) * 0.3;
        const anchor = new Vector3(ax, ay, az);
        const idxs = [];
        for (let j = 0; j < cp; j++) {
          const th = (j / cp) * Math.PI * 2 + k;
          _v1.set(anchor.x + Math.cos(th) * 0.26, anchor.y + Math.sin(j * 2.3) * 0.2, anchor.z + Math.sin(th) * 0.26);
          const cherry = { inst: ci, idx: this.cherries.length, state: 0, at: 0, pos: _v1.clone(), cluster: null };
          this.cherries.push(cherry);
          // state awal campuran agar langsung bisa dipetik
          const roll = Math.random();
          if (roll < 0.55) this._setState(cherry, 3, now + rand(30, 50));       // ripe -> over
          else if (roll < 0.85) this._setState(cherry, 2, now + rand(10, 18));   // green -> ripe
          else if (roll < 0.93) this._setState(cherry, 4, now + rand(15, 25));  // over -> drop
          else this._setState(cherry, 1, now + rand(2, 6));                     // flower -> green
          idxs.push(cherry.idx);
          ci++;
        }
        const cluster = { anchor: anchor, cherryIdx: idxs, squash: 0 };
        idxs.forEach(ii => { this.cherries[ii].cluster = cluster; });
        bush.clusters.push(cluster);
      }
      this.bushes.push(bush);
      bi++;
    }
    cherryIM.instanceColor.needsUpdate = true;
    S.add(trunkIM); S.add(folIM); S.add(dirtIM); S.add(cherryIM);
  },

  // state cherry: 0 gone, 1 flower, 2 green, 3 ripe, 4 over
  _setState(ch, st, at) {
    ch.state = st; ch.at = at || 0;
    const s = st === 1 ? 0.5 : st === 2 ? 0.75 : st === 0 ? 0.0001 : 1.0;
    _dummy.position.copy(ch.pos); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(s, s, s);
    _dummy.updateMatrix(); this.cherryIM.setMatrixAt(ch.inst, _dummy.matrix);
    _color.set(st === 1 ? COL.cherryFlower : st === 2 ? COL.cherryGreen : st === 3 ? COL.cherryRipe : st === 4 ? COL.cherryOver : 0x000000);
    this.cherryIM.setColorAt(ch.inst, _color);
    this.cherryIM.instanceMatrix.needsUpdate = true;
    this.cherryIM.instanceColor.needsUpdate = true;
    if (at) this.pending.push({ idx: ch.idx, at: at });
  },

  updateCherries(now) {
    // hanya cherry yang punya transisi terjadwal (tidak scan 288 tiap frame).
    // entri menyimpan `at` agar entri basi (cherry dipetik sebelum transisi)
    // tidak pernah fire ganda.
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const e = this.pending[i];
      const ch = this.cherries[e.idx];
      if (!ch || ch.at !== e.at || now < e.at) {
        if (!ch || ch.at !== e.at) this.pending.splice(i, 1); // entri basi -> buang
        continue;
      }
      this.pending.splice(i, 1);
      if (ch.state === 0) this._setState(ch, 1, now + rand(6, 10));          // gone -> flower
      else if (ch.state === 1) this._setState(ch, 2, now + rand(12, 20)); // flower -> green
      else if (ch.state === 2) this._setState(ch, 3, now + rand(35, 60)); // green -> ripe -> over
      else if (ch.state === 3) this._setState(ch, 4, now + rand(25, 40)); // ripe -> over -> drop
      else if (ch.state === 4) this._setState(ch, 0, now + rand(8, 15));  // over -> gone -> regrow
    }
  },

  buildReadyMarkers(S) {
    // indikator bush yang SIAP dipetik: cherry merah melayang di atas bush.
    // 1 draw call (InstancedMesh); terlihat hanya bila ada cherry matang (state 3).
    const n = this.bushes.length;
    this.readyIM = new InstancedMesh(new SphereGeometry(0.16, 8, 6),
      new MeshBasicMaterial({ color: COL.cherryRipe }), n);
    this.readyIM.instanceMatrix.setUsage(DynamicDrawUsage);
    this.readyIM.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      _dummy.position.set(0, -10, 0); _dummy.scale.set(0.0001, 0.0001, 0.0001);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.readyIM.setMatrixAt(i, _dummy.matrix);
    }
    S.add(this.readyIM);
  },

  updateReadyMarkers(now) {
    // dipanggil tiap frame dari Game.frame; murah (16 bush x 18 cherry cek state).
    const n = this.bushes.length;
    for (let bi = 0; bi < n; bi++) {
      const b = this.bushes[bi];
      let ripe = false;
      for (const cl of b.clusters) {
        for (const ii of cl.cherryIdx) {
          if (this.cherries[ii].state === 3) { ripe = true; break; }
        }
        if (ripe) break;
      }
      if (ripe) {
        const bob = Math.sin(now * 2.6 + bi * 1.7);
        const s = 1 + 0.18 * bob;
        _dummy.position.set(b.pos.x, 2.45 + bob * 0.14, b.pos.z);
        _dummy.scale.set(s, s, s);
      } else {
        _dummy.position.set(b.pos.x, -10, b.pos.z);
        _dummy.scale.set(0.0001, 0.0001, 0.0001);
      }
      _dummy.rotation.set(0, 0, 0);
      _dummy.updateMatrix();
      this.readyIM.setMatrixAt(bi, _dummy.matrix);
    }
    this.readyIM.instanceMatrix.needsUpdate = true;
  },

  buildGrass(S) {
    const gIM = new InstancedMesh(new ConeGeometry(0.09, 0.42, 5), stdMat(0x5FA968), 70);
    let placed = 0, guard = 0;
    while (placed < 70 && guard++ < 600) {
      const x = rand(-13, 13), z = rand(-13, 13);
      let ok = true;
      for (const b of this.bushes) {
        if (Math.abs(b.pos.x - x) < 1.6 && Math.abs(b.pos.z - z) < 1.6) { ok = false; break; }
      }
      if (!ok) continue;
      _dummy.position.set(x, 0.2, z); _dummy.rotation.set(rand(-0.15, 0.15), rand(0, 6), rand(-0.15, 0.15));
      const s = rand(0.7, 1.4); _dummy.scale.set(s, s, s); _dummy.updateMatrix();
      gIM.setMatrixAt(placed, _dummy.matrix); placed++;
    }
    gIM.count = placed; gIM.frustumCulled = false;
    S.add(gIM);
  },

  buildHut(S) {
    // gubuk jual di tepi ladang + pad berpijar
    const g = new Group();
    const hutX = 11.5, hutZ = 5.5;
    const base = new Mesh(new BoxGeometry(3.2, 2.2, 2.6), stdMat(COL.hutWood));
    base.position.set(hutX, 1.1, hutZ); base.castShadow = true; base.receiveShadow = true;
    const roof = new Mesh(new ConeGeometry(2.9, 1.6, 4), stdMat(COL.hutRoof));
    roof.position.set(hutX, 3.0, hutZ); roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    const counter = new Mesh(new BoxGeometry(2.2, 0.9, 0.7), stdMat(COL.jute));
    counter.position.set(hutX - 0.4, 0.45, hutZ + 1.7); counter.castShadow = true;
    g.add(base); g.add(roof); g.add(counter);
    // pad jual: ring berpijar
    const pad = new Mesh(new RingGeometry(1.7, 2.3, 28),
      new MeshBasicMaterial({ color: 0xFFD34D, transparent: true, opacity: 0.75, side: DoubleSide }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(hutX - 0.4, 0.03, hutZ + 3.6);
    g.add(pad);
    S.add(g);
    CFG.HUT_POS = new Vector3(hutX - 0.4, 0, hutZ + 3.6);
    this.hutPad = pad; this.hutPos = CFG.HUT_POS.clone();
  },
};

/* ============================================================================
   6. PARTICLES — cherry pop burst (InstancedMesh pool, tanpa alokasi)
   ============================================================================ */
const Particles = {
  MAX: 120, im: null, pool: [], active: 0,
  init(S) {
    this.im = new InstancedMesh(new SphereGeometry(0.07, 5, 4),
      new MeshBasicMaterial({ transparent: true, opacity: 0.95 }), this.MAX);
    this.im.instanceMatrix.setUsage(DynamicDrawUsage);
    this.im.frustumCulled = false;
    for (let i = 0; i < this.MAX; i++) {
      this.pool.push({ life: 0, max: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, s: 1 });
      _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
      this.im.setColorAt(i, _color.set(0xE8452C));
    }
    this.im.instanceColor.needsUpdate = true;
    S.add(this.im);
  },
  burst(p, colorHex, n, speed) {
    let spawned = 0;
    for (let i = 0; i < this.MAX && spawned < n; i++) {
      const pt = this.pool[i];
      if (pt.life > 0) continue;
      pt.life = pt.max = rand(0.35, 0.6);
      pt.x = p.x; pt.y = p.y; pt.z = p.z;
      const a = rand(0, Math.PI * 2), sp = rand(0.4, 1) * speed;
      pt.vx = Math.cos(a) * sp; pt.vz = Math.sin(a) * sp; pt.vy = rand(1.5, 3.5);
      pt.s = rand(0.7, 1.4);
      this.im.setColorAt(i, _color.set(colorHex));
      spawned++;
    }
    if (spawned) this.im.instanceColor.needsUpdate = true;
  },
  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.MAX; i++) {
      const pt = this.pool[i];
      if (pt.life <= 0) continue;
      pt.life -= dt; dirty = true;
      pt.vy -= 9 * dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
      if (pt.y < 0.03) { pt.y = 0.03; pt.vy *= -0.35; }
      const k = Math.max(pt.life / pt.max, 0.001) * pt.s;
      _dummy.position.set(pt.x, pt.y, pt.z);
      _dummy.scale.set(k, k, k); _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
      if (pt.life <= 0) {
        _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.updateMatrix(); this.im.setMatrixAt(i, _dummy.matrix);
      }
    }
    if (dirty) this.im.instanceMatrix.needsUpdate = true;
  },
};

/* ============================================================================
   7. FLYING CHERRIES — arc bezier magnetik ke keranjang / hut
   ============================================================================ */
const Flyers = {
  MAX: 18, im: null, items: [],
  init(S) {
    this.im = new InstancedMesh(new SphereGeometry(0.085, 6, 5),
      new MeshStandardMaterial({ roughness: 0.55, flatShading: true }), this.MAX);
    this.im.instanceMatrix.setUsage(DynamicDrawUsage);
    this.im.frustumCulled = false;
    for (let i = 0; i < this.MAX; i++) {
      this.items.push({ t: 1, dur: 0.5, p0: new Vector3(), p1: new Vector3(), p2: new Vector3(), toHut: false, ripe: true });
      _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
      this.im.setColorAt(i, _color.set(COL.cherryRipe));
    }
    this.im.instanceColor.needsUpdate = true;
    S.add(this.im);
  },
  spawn(from, to, toHut, ripe) {
    for (let i = 0; i < this.MAX; i++) {
      const f = this.items[i];
      if (f.t < 1) continue;
      f.t = 0; f.dur = rand(0.4, 0.55); f.toHut = toHut;
      f.p0.copy(from); f.p2.copy(to);
      f.p1.copy(from).lerp(to, 0.5); f.p1.y += 1.6;      // titik kontrol arc
      this.im.setColorAt(i, _color.set(ripe ? COL.cherryRipe : COL.cherryGreen));
      this.im.instanceColor.needsUpdate = true;
      return true;
    }
    return false; // pool penuh -> cherry hangus (tidak boleh sering terjadi)
  },
  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.MAX; i++) {
      const f = this.items[i];
      if (f.t >= 1) continue;
      f.t += dt / f.dur; dirty = true;
      const t = Math.min(f.t, 1), u = 1 - t;
      _v1.set(0, 0, 0);
      _v1.x = u * u * f.p0.x + 2 * u * t * f.p1.x + t * t * f.p2.x;
      _v1.y = u * u * f.p0.y + 2 * u * t * f.p1.y + t * t * f.p2.y;
      _v1.z = u * u * f.p0.z + 2 * u * t * f.p1.z + t * t * f.p2.z;
      const s = 1 + Math.sin(t * Math.PI) * 0.3;
      _dummy.position.copy(_v1); _dummy.scale.set(s, s, s);
      _dummy.rotation.set(t * 5, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
      if (f.t >= 1) {
        _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.updateMatrix(); this.im.setMatrixAt(i, _dummy.matrix);
        if (f.toHut) HutSys.onCherryArrived(); else BasketSys.onCherryArrived();
      }
    }
    if (dirty) this.im.instanceMatrix.needsUpdate = true;
  },
};

/* ============================================================================
   8. FLOATING TEXT (DOM pool)
   ============================================================================ */
const Floaters = {
  pool: [],
  init() {
    const wrap = document.getElementById('floaters');
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('div');
      el.className = 'floater'; el.style.display = 'none';
      wrap.appendChild(el);
      this.pool.push({ el: el, life: 0, max: 1, wx: 0, wy: 0, wz: 0 });
    }
  },
  spawn(wx, wy, wz, text, cls) {
    for (const f of this.pool) {
      if (f.life > 0) continue;
      f.life = f.max = 1.1; f.wx = wx; f.wy = wy; f.wz = wz;
      f.el.textContent = text; f.el.className = 'floater' + (cls ? ' ' + cls : '');
      f.el.style.display = 'block';
      return;
    }
  },
  update(dt) {
    const w = window.innerWidth, h = window.innerHeight;
    for (const f of this.pool) {
      if (f.life <= 0) continue;
      f.life -= dt; f.wy += dt * 1.2;
      if (f.life <= 0) { f.el.style.display = 'none'; continue; }
      _v1.set(f.wx, f.wy, f.wz).project(Engine.camera);
      f.el.style.left = ((_v1.x * 0.5 + 0.5) * w) + 'px';
      f.el.style.top = ((-_v1.y * 0.5 + 0.5) * h) + 'px';
      f.el.style.opacity = Math.min(1, f.life / 0.4);
    }
  },
};

/* ============================================================================
   9. PLAYER — farmer low-poly + keranjang anyam
   ============================================================================ */
const Player = {
  group: null, basket: null, basketCherries: null,
  pos: null, vel: null, face: 0, bob: 0, moving: false,
  sway: 0, swayV: 0,
  init(S) {
    const g = new Group();
    const legL = new Mesh(new BoxGeometry(0.22, 0.5, 0.22), stdMat(COL.pants));
    legL.position.set(-0.15, 0.25, 0);
    const legR = legL.clone(); legR.position.x = 0.15;
    const torso = new Mesh(new BoxGeometry(0.55, 0.65, 0.35), stdMat(COL.shirt));
    torso.position.y = 0.85;
    const armL = new Mesh(new BoxGeometry(0.16, 0.55, 0.16), stdMat(COL.skin));
    armL.position.set(-0.37, 0.85, 0);
    const armR = armL.clone(); armR.position.x = 0.37;
    const head = new Mesh(new SphereGeometry(0.24, 8, 6), stdMat(COL.skin));
    head.position.y = 1.45;
    const brim = new Mesh(new CylinderGeometry(0.5, 0.5, 0.05, 10), stdMat(COL.straw));
    brim.position.y = 1.6;
    const top = new Mesh(new ConeGeometry(0.3, 0.28, 8), stdMat(COL.straw));
    top.position.y = 1.75;
    [legL, legR, torso, armL, armR, head, brim, top].forEach(m => { m.castShadow = true; g.add(m); });
    this.armL = armL; this.armR = armR;

    // keranjang anyam di punggung
    const basket = new Group();
    const cup = new Mesh(new CylinderGeometry(0.34, 0.25, 0.42, 10, 1, true), stdMat(COL.jute, { side: DoubleSide }));
    cup.position.y = 0.1;
    const bottom = new Mesh(new CircleGeometry(0.25, 10), stdMat(COL.jute));
    bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.11;
    const rim = new Mesh(new TorusGeometry(0.34, 0.045, 6, 12), stdMat(0xA8824F));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.31;
    basket.add(cup); basket.add(bottom); basket.add(rim);
    basket.position.set(0, 1.0, -0.42);   // di punggung (belakang arah hadap)
    // isi keranjang: 40 cherry mini (4 lapis x 10), visibility = jumlah
    const bc = new InstancedMesh(new SphereGeometry(0.07, 6, 5),
      new MeshStandardMaterial({ color: COL.cherryRipe, roughness: 0.55, flatShading: true }), CFG.BASKET_CAP);
    let bi2 = 0;
    for (let layer = 0; layer < 4; layer++) for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + layer * 0.3;
      const rr = 0.19 - layer * 0.02;
      _dummy.position.set(Math.cos(a) * rr, -0.02 + layer * 0.1, Math.sin(a) * rr);
      _dummy.scale.set(1, 1, 1); _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      bc.setMatrixAt(bi2++, _dummy.matrix);
    }
    bc.count = 0; bc.frustumCulled = false;
    basket.add(bc);
    g.add(basket);
    this.basket = basket; this.basketCherries = bc;

    g.position.set(0, 0, 6);
    S.add(g);
    this.group = g;
    this.pos = g.position;
    this.vel = new Vector3();
  },
  basketWorld(out) {
    // posisi mulut keranjang (target arc magnetik)
    _v4.set(0, 1.35, -0.42);
    return this.group.localToWorld(out.copy(_v4));
  },
  update(dt) {
    // gerak dari input (diisi InputSys)
    const ix = InputSys.mx, iz = InputSys.mz;
    this.moving = (ix !== 0 || iz !== 0);
    _v1.set(ix, 0, iz);
    if (_v1.lengthSq() > 1) _v1.normalize();
    _v1.multiplyScalar(CFG.PLAYER_SPEED);
    this.vel.lerp(_v1, 1 - Math.exp(-10 * dt));
    this.pos.x = clamp(this.pos.x + this.vel.x * dt, -13, 13);
    this.pos.z = clamp(this.pos.z + this.vel.z * dt, -13, 13);
    // hadap arah gerak
    if (this.moving) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.face;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.face += d * (1 - Math.exp(-12 * dt));
    }
    this.group.rotation.y = this.face;
    // bob jalan
    this.bob += dt * (this.moving ? 11 : 2);
    const amp = this.moving ? 0.06 : 0.015;
    this.group.position.y = Math.abs(Math.sin(this.bob)) * amp;
    this.armL.rotation.x = this.moving ? Math.sin(this.bob) * 0.7 : 0;
    this.armR.rotation.x = this.moving ? -Math.sin(this.bob) * 0.7 : 0;
    // sway keranjang: spring dari velocity lateral
    const latV = this.vel.x * Math.cos(this.face) - this.vel.z * Math.sin(this.face);
    const target = clamp(-latV * 0.06, -0.4, 0.4);
    this.swayV += (target - this.sway) * 60 * dt;
    this.swayV *= Math.exp(-8 * dt);
    this.sway += this.swayV * dt;
    this.basket.rotation.z = this.sway;
    this.basket.rotation.x = clamp(-this.vel.length() * 0.012, -0.15, 0);
  },
};

/* ============================================================================
   10. BASKET SYSTEM — kapasitas, quality batch
   ============================================================================ */
const BasketSys = {
  count: 0, quality: 100,
  onCherryArrived() {
    if (this.count >= CFG.BASKET_CAP) return;
    this.count++;
    Player.basketCherries.count = this.count;
    AudioSys.pop();
    Hud.dirty = true;
  },
  get full() { return this.count >= CFG.BASKET_CAP; },
  reset() { this.count = 0; this.quality = 100; Player.basketCherries.count = 0; Hud.dirty = true; },
  qualityMult() { return 0.5 + (this.quality / 100); },   // 0.5x .. 1.5x
};

/* ============================================================================
   11. INPUT — joystick floating (bottom 70%) + WASD + tombol PICK
   ============================================================================ */
const InputSys = {
  mx: 0, mz: 0,                       // output gerak -1..1
  joyId: null, joyBX: 0, joyBY: 0,
  keys: {},
  pickHeld: false, pickId: null,
  init() {
    const layer = document.getElementById('touch-layer');
    const joyBase = document.getElementById('joy-base');
    const joyKnob = document.getElementById('joy-knob');
    const R = 60;

    const setKnob = (dx, dy) => {
      joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    // arah kamera untuk mapping joystick yang terasa benar di isometric
    const camRight = new Vector3(), camFwd = new Vector3();

    layer.addEventListener('pointerdown', e => {
      AudioSys.init();
      if (e.clientY < window.innerHeight * 0.3) return;   // 30% atas = area HUD
      if (this.joyId !== null) return;
      try { layer.setPointerCapture(e.pointerId); } catch (err) {}
      this.joyId = e.pointerId;
      this.joyBX = e.clientX; this.joyBY = e.clientY;
      joyBase.style.display = 'block';
      joyBase.style.left = e.clientX + 'px'; joyBase.style.top = e.clientY + 'px';
      setKnob(0, 0);
    });
    const move = e => {
      if (e.pointerId !== this.joyId) return;
      let dx = e.clientX - this.joyBX, dy = e.clientY - this.joyBY;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      setKnob(dx, dy);
      const jx = dx / R, jy = dy / R;
      // mapping relatif kamera
      Engine.camera.getWorldDirection(_v2); _v2.y = 0; _v2.normalize();
      camFwd.copy(_v2);
      camRight.set(-_v2.z, 0, _v2.x);
      this.mx = clamp(camRight.x * jx + camFwd.x * -jy, -1, 1);
      this.mz = clamp(camRight.z * jx + camFwd.z * -jy, -1, 1);
    };
    const up = e => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null; this.mx = 0; this.mz = 0;
      joyBase.style.display = 'none';
    };
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', up);

    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // tombol PICK: tahan & lepas (pointer events, multi-touch aman)
    const btn = document.getElementById('btn-pick');
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); AudioSys.init();
      if (this.pickId !== null) return;
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      this.pickId = e.pointerId;
      PickSys.beginCharge();
    });
    const rel = e => {
      if (e.pointerId !== this.pickId) return;
      this.pickId = null;
      PickSys.release();
    };
    btn.addEventListener('pointerup', rel);
    btn.addEventListener('pointercancel', rel);

    document.getElementById('btn-lang').addEventListener('click', () => {
      AudioSys.init(); AudioSys.click();
      lang = (lang === 'en') ? 'id' : 'en';
      SaveSys.data.lang = lang; SaveSys.save();
      applyI18n();
    });
  },
  pollKeys() {
    if (this.joyId !== null) return;   // joystick menang
    const k = this.keys;
    let x = 0, z = 0;
    if (k.KeyA || k.ArrowLeft) x -= 1;
    if (k.KeyD || k.ArrowRight) x += 1;
    if (k.KeyW || k.ArrowUp) z -= 1;
    if (k.KeyS || k.ArrowDown) z += 1;
    this.mx = x; this.mz = z;
  },
};

/* ============================================================================
   12. PICKING SYSTEM — selective picking (§4.1 SPEC)
   ============================================================================ */
const PickSys = {
  target: null,            // cluster terdekat yang bisa dipetik
  charging: false, chargeT: 0,
  ringEl: null, shrinkEl: null,
  hlRing: null,            // highlight cluster target (3D)
  init(S) {
    this.ringEl = document.getElementById('pick-ring');
    this.shrinkEl = document.getElementById('ring-shrink');
    const g = new RingGeometry(0.5, 0.68, 24);
    this.hlRing = new Mesh(g, new MeshBasicMaterial({ color: 0xFFD34D, transparent: true, opacity: 0.9, side: DoubleSide }));
    this.hlRing.rotation.x = -Math.PI / 2;
    this.hlRing.visible = false;
    S.add(this.hlRing);
  },
  clusterPickable(cl) {
    for (const ii of cl.cherryIdx) {
      const st = World.cherries[ii].state;
      if (st === 2 || st === 3 || st === 4) return true;
    }
    return false;
  },
  findTarget() {
    let best = null, bestD = CFG.PICK_RANGE;
    for (const b of World.bushes) {
      for (const cl of b.clusters) {
        _v1.copy(cl.anchor); _v1.y = 0;
        _v2.copy(Player.pos); _v2.y = 0;
        const d = _v1.distanceTo(_v2);
        if (d < bestD && this.clusterPickable(cl)) { bestD = d; best = cl; }
      }
    }
    return best;
  },
  beginCharge() {
    if (this.charging || !this.target || BasketSys.full) return;
    this.charging = true; this.chargeT = 0;
    document.getElementById('btn-pick').classList.add('charging');
    AudioSys.click();
  },
  release() {
    document.getElementById('btn-pick').classList.remove('charging');
    if (!this.charging) return;
    this.charging = false;
    this.ringEl.style.display = 'none';
    const cl = this.target;
    if (!cl) return;
    const phase = (this.chargeT % CFG.PICK_CYCLE) / CFG.PICK_CYCLE;
    const r = 52 - 42 * phase;
    const clean = Math.abs(r - CFG.GOLD_R) <= CFG.GOLD_TOL;
    this.resolvePick(cl, clean);
  },
  resolvePick(cl, clean) {
    let ripe = 0, green = 0, over = 0;
    const now = performance.now() / 1000;
    const bw = Player.basketWorld(_v3);
    for (const ii of cl.cherryIdx) {
      const ch = World.cherries[ii];
      if (ch.state !== 2 && ch.state !== 3 && ch.state !== 4) continue;
      if (clean && ch.state !== 3) continue;      // clean pick: hanya merah
      const wasRipe = (ch.state === 3);
      if (wasRipe) ripe++; else if (ch.state === 2) green++; else over++;
      World._setState(ch, 0, now + rand(8, 14)); // gone -> regrow (cukup lama agar harus pindah bush)
      _v1.copy(ch.pos);
      Flyers.spawn(_v1, bw, false, wasRipe);
      Particles.burst(ch.pos, wasRipe ? COL.cherryRipe : COL.cherryGreen, 3, 2.2);
    }
    if (ripe + green + over === 0) {
      // tidak ada yang terpetik (clean pick di cluster tanpa merah)
      Floaters.spawn(cl.anchor.x, cl.anchor.y + 0.6, cl.anchor.z, t('no_ripe'), 'bad');
      AudioSys.error();
      cl.squash = 0.18;
      return;
    }
    SaveSys.data.stats.picked += ripe + green + over;
    if (clean) {
      SaveSys.data.stats.perfect++;
      Floaters.spawn(cl.anchor.x, cl.anchor.y + 0.8, cl.anchor.z, t('perfect'), 'gold');
      AudioSys.ding();
      Particles.burst(cl.anchor, COL.cherryGold, 10, 3.2);
    } else {
      SaveSys.data.stats.strips++;
      BasketSys.quality = clamp(BasketSys.quality + CFG.Q_GREEN * green + CFG.Q_OVER * over, 0, 100);
      Floaters.spawn(cl.anchor.x, cl.anchor.y + 0.8, cl.anchor.z, t('strip'), '');
      AudioSys.pluck();
    }
    SaveSys.data.stats.bestQ = Math.max(SaveSys.data.stats.bestQ, BasketSys.quality);
    cl.squash = 0.28;      // squash-and-stretch cluster
    Hud.dirty = true;
  },
  update(dt, now) {
    this.target = this.findTarget();
    const btn = document.getElementById('btn-pick');
    const canPick = !!this.target && !BasketSys.full;
    btn.classList.toggle('ready', canPick && !this.charging);
    btn.classList.toggle('disabled', !canPick);
    // highlight target
    if (this.target) {
      this.hlRing.visible = true;
      this.hlRing.position.set(this.target.anchor.x, 0.06, this.target.anchor.z);
      const s = 1 + Math.sin(now * 6) * 0.08;
      this.hlRing.scale.set(s, s, 1);
    } else this.hlRing.visible = false;
    // charge ring UI
    if (this.charging) {
      if (!this.target) { this.release(); return; }  // target hilang saat charge
      this.chargeT += dt;
      const phase = (this.chargeT % CFG.PICK_CYCLE) / CFG.PICK_CYCLE;
      const r = 52 - 42 * phase;
      const inGold = Math.abs(r - CFG.GOLD_R) <= CFG.GOLD_TOL;
      this.shrinkEl.setAttribute('r', r.toFixed(1));
      this.shrinkEl.classList.toggle('in-gold', inGold);
      // posisi ring di atas cluster (proyeksi)
      _v1.copy(this.target.anchor); _v1.y += 0.9;
      _v1.project(Engine.camera);
      const sx = (_v1.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-_v1.y * 0.5 + 0.5) * window.innerHeight;
      this.ringEl.style.display = 'block';
      this.ringEl.style.left = sx + 'px'; this.ringEl.style.top = sy + 'px';
    } else {
      this.ringEl.style.display = 'none';
    }
    // squash anim cluster
    for (const b of World.bushes) for (const cl of b.clusters) {
      if (cl.squash > 0) {
        cl.squash -= dt;
        const k = 1 + Math.sin((0.28 - Math.max(cl.squash, 0)) / 0.28 * Math.PI) * 0.22;
        for (const ii of cl.cherryIdx) {
          const ch = World.cherries[ii];
          if (ch.state === 0) continue;
          const base = ch.state === 1 ? 0.5 : ch.state === 2 ? 0.75 : 1.0;
          _dummy.position.copy(ch.pos); _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(base * k, base / k, base * k); _dummy.updateMatrix();
          World.cherryIM.setMatrixAt(ch.inst, _dummy.matrix);
        }
        World.cherryIM.instanceMatrix.needsUpdate = true;
      }
    }
  },
};

/* ============================================================================
   13. HUT — jual cherry (Fase 1: outlet sederhana; diganti wash+roast di Fase 2)
   ============================================================================ */
const HutSys = {
  sellAcc: 0, soldValue: 0, soldCount: 0, inflight: 0, saleActive: false,
  markerEl: null,
  init() { this.markerEl = document.getElementById('hut-marker'); },
  onCherryArrived() {
    this.inflight--;
    const v = CFG.CHERRY_PRICE * BasketSys.qualityMult();
    this.soldValue += v; this.soldCount++;
    SaveSys.data.cash += v;
    Hud.dirty = true;
  },
  update(dt, now) {
    // pad berpijar
    const s = 1 + Math.sin(now * 4) * 0.07;
    World.hutPad.scale.set(s, s, 1);
    World.hutPad.material.opacity = 0.6 + Math.sin(now * 4) * 0.2;
    // marker "ke sini" saat keranjang penuh
    const show = BasketSys.full;
    this.markerEl.style.display = show ? 'block' : 'none';
    if (show) {
      _v1.copy(World.hutPos); _v1.y = 3.4; _v1.project(Engine.camera);
      this.markerEl.style.left = ((_v1.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      this.markerEl.style.top = ((-_v1.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    }
    // jual: berdiri di pad -> cherry terbang ke hut satu per satu
    _v1.copy(Player.pos); _v1.y = 0;
    const near = _v1.distanceTo(World.hutPos) < CFG.HUT_RADIUS;
    if (near && BasketSys.count > 0) {
      this.saleActive = true;
      this.sellAcc += dt;
      while (this.sellAcc >= 0.09 && BasketSys.count > 0) {
        this.sellAcc -= 0.09;
        BasketSys.count--;
        Player.basketCherries.count = BasketSys.count;
        Player.basketWorld(_v3);
        _v4.copy(World.hutPos); _v4.y = 1.2;
        if (Flyers.spawn(_v3, _v4, true, true)) this.inflight++;
        else { BasketSys.count++; Player.basketCherries.count = BasketSys.count; break; }
        Hud.dirty = true;
      }
    } else {
      this.sellAcc = 0;
    }
    if (this.saleActive && BasketSys.count === 0 && this.inflight === 0) {
      this.saleActive = false;
      const v = this.soldValue, n = this.soldCount;
      this.soldValue = 0; this.soldCount = 0;
      SaveSys.data.stats.sold += n;
      Floaters.spawn(World.hutPos.x, 2.6, World.hutPos.z, '+$' + v.toFixed(2) + ' ' + t('sold'), 'cash');
      AudioSys.cash();
      BasketSys.reset();
      SaveSys.save();
    }
  },
};

/* ============================================================================
   14. HUD
   ============================================================================ */
const Hud = {
  dirty: true, frames: 0, fpsT: 0,
  el: {},
  init() {
    ['hud-cash', 'hud-basket', 'hud-quality', 'hud-fps', 'hud-calls'].forEach(id => {
      this.el[id] = document.getElementById(id);
    });
  },
  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.el['hud-cash'].textContent = '$' + SaveSys.data.cash.toFixed(2);
    this.el['hud-basket'].textContent = BasketSys.count + '/' + CFG.BASKET_CAP;
    this.el['hud-quality'].textContent = BasketSys.quality;
  },
  fpsTick(dt) {
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.el['hud-fps'].textContent = Math.round(this.frames / this.fpsT);
      this.el['hud-calls'].textContent = Engine.renderer.info.render.calls;
      this.frames = 0; this.fpsT = 0;
    }
  },
};
function refreshHint(force) {
  const el = document.getElementById('hint');
  const key = BasketSys.full ? 'hint_hut' : (PickSys.target ? 'hint_pick' : 'hint_start');
  if (force || el.dataset.k !== key) { el.dataset.k = key; el.textContent = t(key); }
}

/* ============================================================================
   15. MAIN LOOP
   ============================================================================ */
const Game = {
  running: false, last: 0, saveT: 0,
  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(n => this.frame(n));
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const tSec = now / 1000;

    InputSys.pollKeys();
    Player.update(dt);
    Engine.follow(dt, Player.pos.x, Player.pos.z);
    World.updateCherries(tSec);
    World.updateReadyMarkers(tSec);
    PickSys.update(dt, tSec);
    Flyers.update(dt);
    Particles.update(dt);
    Floaters.update(dt);
    HutSys.update(dt, tSec);

    Engine.renderer.render(Engine.scene, Engine.camera);
    Hud.fpsTick(dt);
    Hud.update();
    refreshHint(false);

    this.saveT += dt;
    if (this.saveT >= 10) { this.saveT = 0; SaveSys.save(); }
  },
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(n => this.frame(n));
  },
  stop() {
    this.running = false;
    SaveSys.save();
  },
};

function boot() {
  SaveSys.load();
  Engine.init();
  World.build();
  Particles.init(Engine.scene);
  Flyers.init(Engine.scene);
  Floaters.init();
  Player.init(Engine.scene);
  PickSys.init(Engine.scene);
  HutSys.init();
  Hud.init();
  InputSys.init();
  applyI18n();
  refreshHint(true);
  Hud.update();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Game.stop(); AudioSys.setMuted(true); }
    else { AudioSys.setMuted(false); Game.start(); }
  });
  window.addEventListener('pagehide', () => SaveSys.save());
  window.addEventListener('contextmenu', e => e.preventDefault());

  Game.start();
}

// DOM sudah siap (script di akhir body, baik dev maupun inline)
boot();

/* ============================================================================
   FASE 2 — WASH CHANNEL (density sorting: sinker vs floater + pintu air)
   -> Sistem baru: WashSys; cherry dari keranjang dituang ke channel,
      tap sluice gates untuk routing ke dermaga GOOD/DEFECT.
   ============================================================================ */

/* ============================================================================
   FASE 2 — ROAST DRUM (heat control + momen FIRST CRACK + order light/med/dark)
   -> Sistem baru: RoastSys; SFX signature: crackle pops.
   ============================================================================ */

/* ============================================================================
   FASE 3 — WORKERS (picker), UPGRADES, ZONES 2-3, OFFLINE EARNINGS
   -> Perluas SaveSys (upgrades, zones, lastSave -> offline calc).
   ============================================================================ */

/* ============================================================================
   FASE 4 — SDK CRAZYGAMES v3, ACHIEVEMENTS, SHARE CARD, QA PORTAL
   -> SdkSys wrapper + mock; achievements; share 1080x1350.
   ============================================================================ */
