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
  // --- Fase 2: Olah (wash -> dry -> roast -> sack -> truck) ---
  WASH_FLOW_TIME: 6,      // detik cherry mengalir di channel
  WASH_FORK_WAIT: 2.0,    // detik tunggu tap sebelum auto-route benar
  DEFECT_PRICE: 0.25,     // $ per biji defect (auto-jual per 10)
  DEFECT_AUTOSELL: 10,
  DRY_TIME: 20,           // detik penjemuran (visual, otomatis)
  ROAST_MIN_BEANS: 12, ROAST_MAX_BEANS: 24,
  SACK_PRICE: 12,         // $ per karung (Arabika)
  ROAST_MATCH_MULT: 1.25, // bonus roast-match
  UNDER_PENALTY: 0.8,     // penalti under-roasted
  SACKS_FOR_TRUCK: 8,     // karung -> truk datang
  FIRST_CRACK_TEMP: 196,  // °C momen first crack
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
  waterDark: 0x2A7A94, steel: 0xB2B8C2, hazard: 0xFF8E00, ember: 0xFF7A1A,
  beanRoast: 0x4A2C17, beanDry: 0xD9C08A, defectBin: 0x7A4A2B, truckRed: 0xC0392B, cashGreen: 0x2ECC71,
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
    hint_pour: 'Basket full! Pour it at the wash channel.',
    hint_wash: 'Tap a gate to route each cherry!',
    hint_roast: 'Dry beans ready! Load the drum.',
    hint_roasting: 'Keep the needle green! STOP in the target zone.',
    hint_collect: 'Truck left cash! Tap COLLECT.',
    wash_good: 'GOOD', wash_defect: 'DEFECT',
    load_drum: 'LOAD DRUM', roast_stop: 'STOP', collect: 'COLLECT',
    need_beans: 'Need 12+ dry beans',
    first_crack: 'FIRST CRACK!',
    roast_match: 'ROAST MATCH! +25%',
    under_roast: 'Under-roasted',
    burnt: 'BURNT!',
    defect_sold: 'Defect sold',
    contaminated: 'Contaminated!',
    sacks: 'Sacks',
    order_light: 'Light', order_medium: 'Medium', order_dark: 'Dark',
  },
  id: {
    pick: 'PETIK', hint_start: 'Jalan ke semak kopi. Tahan PETIK, lepas di ring emas!',
    hint_pick: 'Tahan PETIK... lepas saat ring jadi emas!',
    hint_hut: 'Keranjang penuh! Ke gubuk untuk jual.',
    hint_full: 'Keranjang penuh!',
    perfect: 'SEMPURNA!', strip: 'Petik campur', no_ripe: 'Tidak ada cherry matang!',
    sold: 'Terjual!', quality: 'Kualitas',
    hint_pour: 'Keranjang penuh! Tuang ke wash channel.',
    hint_wash: 'Ketuk pintu air untuk mengarahkan cherry!',
    hint_roast: 'Biji kering siap! Muat ke drum.',
    hint_roasting: 'Jaga jarum di hijau! STOP di zona target.',
    hint_collect: 'Truk meninggalkan uang! Ketuk AMBIL.',
    wash_good: 'BAGUS', wash_defect: 'CACAT',
    load_drum: 'MUAT DRUM', roast_stop: 'STOP', collect: 'AMBIL',
    need_beans: 'Butuh 12+ biji kering',
    first_crack: 'FIRST CRACK!',
    roast_match: 'ROAST MATCH! +25%',
    under_roast: 'Kurang matang',
    burnt: 'GOSONG!',
    defect_sold: 'Cacat terjual',
    contaminated: 'Terkontaminasi!',
    sacks: 'Karung',
    order_light: 'Light', order_medium: 'Medium', order_dark: 'Dark',
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
  data: { v: 1, cash: 0, lang: 'en', stats: { picked: 0, perfect: 0, strips: 0, sold: 0, bestQ: 0 },
    sacks: 0, sackValue: 0, defect: 0, dryCount: 0, dryQSum: 0, lastSave: 0 },
  load() {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === 1) {
          this.data.cash = +d.cash || 0;
          this.data.lang = (d.lang === 'id') ? 'id' : 'en';
          Object.assign(this.data.stats, d.stats || {});
          // Fase 2: default aman untuk save lama
          this.data.sacks = Math.max(0, Math.floor(+d.sacks || 0));
          this.data.sackValue = Math.max(0, +d.sackValue || 0);
          this.data.defect = Math.max(0, Math.floor(+d.defect || 0));
          this.data.dryCount = Math.max(0, Math.floor(+d.dryCount || 0));
          this.data.dryQSum = Math.max(0, +d.dryQSum || 0);
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
  // --- Fase 2 ---
  splash() {
    // tuang ke channel: debur air
    this._noise(0.35, 0.3, 700); this._noise(0.2, 0.18, 1400, 0.1);
    this._tone(rand(300, 420), 0.15, 'sine', 0.12, 0.05, 180);
  },
  crackle() {
    // FIRST CRACK signature: rentetan pop tajam ~2.5 dtk
    for (let i = 0; i < 14; i++) {
      const when = Math.pow(Math.random(), 1.4) * 2.4;
      this._noise(0.05, rand(0.15, 0.3), rand(2200, 4200), when);
      this._tone(rand(900, 1600), 0.04, 'square', 0.08, when);
    }
    this._tone(220, 0.5, 'sine', 0.2, 0, 110);
  },
  cashBig() {
    // arpeggio koin lebih panjang (collect truk)
    const seq = [523, 659, 784, 1046, 1318];
    for (let i = 0; i < seq.length; i++) this._tone(seq[i], 0.16, 'triangle', 0.3, i * 0.09);
  },
  gate() { this._noise(0.08, 0.22, 900); this._tone(240, 0.1, 'square', 0.14, 0, 140); },
  loadDrum() { this._tone(140, 0.3, 'sawtooth', 0.18, 0, 90); this._noise(0.25, 0.15, 500, 0.05); },
  // drum hum: osilator kontinu, pitch mengikuti panas
  hum: null,
  humStart() {
    if (!this.ctx || this.muted || this.hum) return;
    try {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      const g = c.createGain(); g.gain.value = 0.05;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.hum = { o: o, g: g };
    } catch (e) { this.hum = null; }
  },
  humUpdate(tempC) {
    if (!this.hum || !this.ctx || this.muted) return;
    this.hum.o.frequency.setTargetAtTime(55 + tempC * 0.55, this.ctx.currentTime, 0.1);
  },
  humStop() {
    if (!this.hum) return;
    try {
      const h = this.hum; this.hum = null;
      h.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
      h.o.stop(this.ctx.currentTime + 0.6);
    } catch (e) { this.hum = null; }
  },
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
    this.buildWashStation(S);   // Fase 2
    this.buildDryer(S);         // Fase 2
    this.buildDrum(S);          // Fase 2
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

  /* ---- Fase 2: wash channel + dryer + roast drum (visual) ---- */
  buildWashStation(S) {
    // Channel: pour (9.5, 9.1) -> fork (3.0, 9.1) -> GOOD dock (1.0, 9.1).
    // Cabang DEFECT ke (3.0, 11.3). Air y=0.62.
    const px = 9.5, gx = 0.5, fx = 3.0, z = 9.1, len = px - gx, cx = (px + gx) / 2;
    const troughMat = stdMat(0x8A5A3B);
    const base = new Mesh(new BoxGeometry(len, 0.3, 1.2), troughMat);
    base.position.set(cx, 0.35, z); base.receiveShadow = true;
    const water = new Mesh(new PlaneGeometry(len, 0.9),
      new MeshStandardMaterial({ color: COL.water, transparent: true, opacity: 0.78, roughness: 0.25 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, 0.62, z);
    S.add(base); S.add(water);
    this.washWater = water;
    // foam: garis-garis putih yang mengalir (1 draw call)
    const foamIM = new InstancedMesh(new PlaneGeometry(0.5, 0.12),
      new MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 }), 10);
    foamIM.frustumCulled = false;
    this.washFoam = foamIM; this.washFoamT = 0;
    S.add(foamIM);
    // cabang DEFECT (pendek, ke +z)
    const dLen = 2.2, dBase = new Mesh(new BoxGeometry(1.2, 0.3, dLen), troughMat);
    dBase.position.set(fx, 0.35, z + dLen / 2); dBase.receiveShadow = true;
    const dWater = new Mesh(new PlaneGeometry(0.9, dLen), water.material);
    dWater.rotation.x = -Math.PI / 2; dWater.position.set(fx, 0.62, z + dLen / 2);
    S.add(dBase); S.add(dWater);
    // pintu air: 2 paddle di fork (diputar saat routing)
    const gateMat = stdMat(COL.hazard);
    const mkGate = (gx, gz, ry) => {
      const p = new Mesh(new BoxGeometry(0.9, 0.5, 0.12), gateMat);
      p.position.set(gx, 0.85, gz); p.rotation.y = ry; p.castShadow = true;
      S.add(p); return p;
    };
    this.gateGood = mkGate(fx - 0.2, z - 0.75, 0.5);
    this.gateDefect = mkGate(fx + 0.35, z + 0.75, -0.5);
    // dermaga GOOD: platform kayu di ujung channel
    const dock = new Mesh(new BoxGeometry(1.6, 0.25, 1.6), stdMat(0x8A5A3B));
    dock.position.set(1.0, 0.35, z); dock.receiveShadow = true; dock.castShadow = true;
    S.add(dock);
    // bin DEFECT
    const bin = new Mesh(new CylinderGeometry(0.55, 0.45, 0.9, 10), stdMat(COL.defectBin));
    bin.position.set(fx, 0.45, z + dLen + 0.4); bin.castShadow = true;
    S.add(bin);
    // ring highlight di fork (cherry yang menunggu routing)
    const ring = new Mesh(new RingGeometry(0.35, 0.5, 20),
      new MeshBasicMaterial({ color: 0xFFD34D, transparent: true, opacity: 0.9, side: DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(fx, 0.7, z); ring.visible = false;
    S.add(ring);
    this.forkRing = ring;
  },

  buildDryer(S) {
    // 2 rak bambu; biji dijemur di atasnya (otomatis, bukan taktil)
    const rackMat = stdMat(0xC9A86A);
    const mkRack = (x, z) => {
      const r = new Mesh(new BoxGeometry(2.2, 0.22, 1.4), rackMat);
      r.position.set(x, 0.5, z); r.castShadow = true; r.receiveShadow = true;
      S.add(r);
    };
    mkRack(-1.2, 8.0); mkRack(-1.2, 10.2);
    this.dryerRacks = [new Vector3(-1.2, 0.62, 8.0), new Vector3(-1.2, 0.62, 10.2)];
  },

  buildDrum(S) {
    // drum roaster: tabung baja horizontal + api + hopper
    const dx = -4.2, dz = 9.1;
    const drum = new Mesh(new CylinderGeometry(0.85, 0.85, 1.7, 14), stdMat(COL.steel));
    drum.rotation.z = Math.PI / 2; drum.position.set(dx, 1.35, dz); drum.castShadow = true;
    S.add(drum);
    this.roastDrum = drum;
    // hazard stripe di badan drum (cincin)
    const stripe = new Mesh(new TorusGeometry(0.86, 0.07, 6, 16), stdMat(COL.hazard));
    stripe.rotation.y = Math.PI / 2; stripe.position.set(dx, 1.35, dz);
    S.add(stripe);
    // dudukan
    const stand = new Mesh(new BoxGeometry(0.5, 1.0, 1.9), stdMat(0x5A5A5A));
    stand.position.set(dx, 0.5, dz); stand.castShadow = true;
    S.add(stand);
    // api di bawah (cone emissive; intensitas ikut panas)
    const fire = new Mesh(new ConeGeometry(0.5, 0.7, 8),
      new MeshBasicMaterial({ color: COL.ember, transparent: true, opacity: 0.0 }));
    fire.position.set(dx, 0.45, dz);
    S.add(fire);
    this.roastFire = fire;
    // hopper di atas (biji kering masuk sini)
    const hop = new Mesh(new BoxGeometry(0.9, 0.5, 0.9), stdMat(COL.steel));
    hop.position.set(dx, 2.45, dz); hop.castShadow = true;
    S.add(hop);
    this.roastDrumPos = new Vector3(dx, 1.35, dz);
    this.drumHopperPos = new Vector3(dx, 2.7, dz);
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
      // dest: 'basket' | 'wash' | 'dryer'; data: boolean/number tergantung dest
      this.items.push({ t: 1, dur: 0.5, p0: new Vector3(), p1: new Vector3(), p2: new Vector3(), dest: 'basket', data: true });
      _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
      this.im.setColorAt(i, _color.set(COL.cherryRipe));
    }
    this.im.instanceColor.needsUpdate = true;
    S.add(this.im);
  },
  spawn(from, to, dest, data) {
    for (let i = 0; i < this.MAX; i++) {
      const f = this.items[i];
      if (f.t < 1) continue;
      f.t = 0; f.dur = rand(0.4, 0.55); f.dest = dest || 'basket'; f.data = data;
      f.p0.copy(from); f.p2.copy(to);
      f.p1.copy(from).lerp(to, 0.5); f.p1.y += 1.6;      // titik kontrol arc
      const cc = (f.dest === 'dryer') ? COL.beanDry
        : (f.data === false ? COL.cherryGreen : COL.cherryRipe);
      this.im.setColorAt(i, _color.set(cc));
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
        if (f.dest === 'wash') WashSys.onPourArrived(f.data);
        else if (f.dest === 'dryer') DrySys.onBeanArrived(f.data);
        else BasketSys.onCherryArrived();
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
  count: 0, quality: 100, good: 0, defect: 0,   // good=ripe, defect=hijau+over (untuk wash)
  onCherryArrived() {
    if (this.count >= CFG.BASKET_CAP) return;
    this.count++;
    Player.basketCherries.count = this.count;
    AudioSys.pop();
    Hud.dirty = true;
  },
  get full() { return this.count >= CFG.BASKET_CAP; },
  reset() { this.count = 0; this.quality = 100; this.good = 0; this.defect = 0; Player.basketCherries.count = 0; Hud.dirty = true; },
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

    // --- Fase 2: tombol wash / roast / collect ---
    const onTap = (id, fn) => {
      document.getElementById(id).addEventListener('click', e => {
        e.preventDefault(); AudioSys.init(); fn();
      });
    };
    onTap('btn-wash-good', () => WashSys.route(true));
    onTap('btn-wash-defect', () => WashSys.route(false));
    onTap('btn-load', () => { AudioSys.click(); RoastSys.tryLoad(); });
    onTap('btn-roast-stop', () => RoastSys.stop());
    onTap('btn-collect', () => SackSys.collect());
    // fuel slider: drag vertikal
    const fslider = document.getElementById('fuel-slider');
    fslider.addEventListener('pointerdown', e => {
      e.preventDefault(); AudioSys.init();
      try { fslider.setPointerCapture(e.pointerId); } catch (err) {}
      RoastSys.setFuel(e);
      const pid = e.pointerId;
      const mv = ev => { if (ev.pointerId === pid) RoastSys.setFuel(ev); };
      const up2 = ev => {
        if (ev.pointerId !== pid) return;
        fslider.removeEventListener('pointermove', mv);
        fslider.removeEventListener('pointerup', up2);
        fslider.removeEventListener('pointercancel', up2);
      };
      fslider.addEventListener('pointermove', mv);
      fslider.addEventListener('pointerup', up2);
      fslider.addEventListener('pointercancel', up2);
    });

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
      Flyers.spawn(_v1, bw, 'basket', wasRipe);
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
    BasketSys.good += ripe; BasketSys.defect += green + over;   // komposisi batch untuk wash
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
   13. HUT — stasiun tuang (Fase 2: drop-off ke wash channel; bukan jual lagi)
   ============================================================================ */
const HutSys = {
  pourAcc: 0, pourInflight: 0, pouring: false,
  markerEl: null,
  init() { this.markerEl = document.getElementById('hut-marker'); },
  update(dt, now) {
    // pad berpijar
    const s = 1 + Math.sin(now * 4) * 0.07;
    World.hutPad.scale.set(s, s, 1);
    World.hutPad.material.opacity = 0.6 + Math.sin(now * 4) * 0.2;
    // marker "ke sini" saat keranjang penuh & wash bebas
    const show = BasketSys.full && !WashSys.busy();
    this.markerEl.style.display = show ? 'block' : 'none';
    if (show) {
      _v1.copy(World.hutPos); _v1.y = 3.4; _v1.project(Engine.camera);
      this.markerEl.style.left = ((_v1.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      this.markerEl.style.top = ((-_v1.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    }
    // tuang: berdiri di pad -> cherry terbang ke channel satu per satu
    _v1.copy(Player.pos); _v1.y = 0;
    const near = _v1.distanceTo(World.hutPos) < CFG.HUT_RADIUS;
    // Lanjutkan pour yang sedang berjalan (this.pouring); cegah batch baru saat wash sibuk.
    // Tanpa `|| this.pouring`, beginPour() membuat busy()=true di frame pertama
    // sehingga loop tuang tidak pernah jalan lagi -> deadlock (keranjang 40/40 selamanya).
    if (near && BasketSys.count > 0 && (!WashSys.busy() || this.pouring)) {
      if (!this.pouring) { this.pouring = true; WashSys.beginPour(); AudioSys.splash(); }
      this.pourAcc += dt;
      while (this.pourAcc >= 0.06 && BasketSys.count > 0 && WashSys.pourLen > 0) {
        this.pourAcc -= 0.06;
        const sinker = WashSys.pourQueue[WashSys.pourLen - 1];  // peek dulu
        Player.basketWorld(_v3);
        _v4.copy(WashSys.POUR); _v4.y = 1.0;
        if (Flyers.spawn(_v3, _v4, 'wash', sinker)) {
          WashSys.pourLen--;
          this.pourInflight++;
          BasketSys.count--;
          Player.basketCherries.count = BasketSys.count;
          Hud.dirty = true;
        } else break;
      }
    } else {
      this.pourAcc = 0;
      if (this.pouring && BasketSys.count === 0 && this.pourInflight === 0) {
        this.pouring = false;
        WashSys.endPour();
      }
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
    ['hud-cash', 'hud-basket', 'hud-quality', 'hud-sacks', 'hud-fps', 'hud-calls'].forEach(id => {
      this.el[id] = document.getElementById(id);
    });
  },
  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.el['hud-cash'].textContent = '$' + SaveSys.data.cash.toFixed(2);
    this.el['hud-basket'].textContent = BasketSys.count + '/' + CFG.BASKET_CAP;
    this.el['hud-quality'].textContent = BasketSys.quality;
    this.el['hud-sacks'].textContent = SaveSys.data.sacks;
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
  let key;
  if (SackSys.collectValue > 0) key = 'hint_collect';
  else if (RoastSys.active) key = 'hint_roasting';
  else if (WashSys.busy()) key = 'hint_wash';
  else if (DrySys.count >= CFG.ROAST_MIN_BEANS) key = 'hint_roast';
  else if (BasketSys.full) key = 'hint_pour';
  else if (PickSys.target) key = 'hint_pick';
  else key = 'hint_start';
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
    WashSys.update(dt, tSec);
    DrySys.update(dt);
    RoastSys.update(dt, tSec);
    SackSys.update(dt, tSec);

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
  WashSys.init(Engine.scene);
  DrySys.init(Engine.scene);
  RoastSys.init();
  SackSys.init(Engine.scene);
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
// boot() dipanggil di AKHIR file agar semua sistem (termasuk Fase 2)
// sudah terdefinisi (hindari TDZ).

/* ============================================================================
   16. WASH CHANNEL — density sorting (§4.3): sinker vs floater + pintu air
   Alur: tuang keranjang -> cherry mengalir ~6 dtk -> antre di fork ->
   tap GOOD/DEFECT (auto-route benar bila dibiarkan 2 dtk) ->
   GOOD -> dryer, DEFECT -> auto-jual murah.
   ============================================================================ */
const WashSys = {
  POUR: null, FORK: null, GOOD_DOCK: null, DEFECT_DOCK: null, WATER_Y: 0.62,
  pouring: false, flowing: false,
  pourQueue: null, pourLen: 0,
  batchQuality: 100,
  items: [], im: null,
  waitList: null, waitCount: 0,   // antrean index item di fork (FIFO)
  uiEl: null, foamT: 0,
  goodRouted: 0, defectRouted: 0,

  init(S) {
    this.POUR = new Vector3(9.5, 0, 9.1);
    this.FORK = new Vector3(3.0, 0, 9.1);
    this.GOOD_DOCK = new Vector3(1.0, 0, 9.1);
    this.DEFECT_DOCK = new Vector3(3.0, 0, 11.7);
    this.pourQueue = new Array(40);
    this.waitList = new Array(40);
    this.im = new InstancedMesh(new SphereGeometry(0.09, 6, 5),
      new MeshStandardMaterial({ roughness: 0.5, flatShading: true }), 40);
    this.im.instanceMatrix.setUsage(DynamicDrawUsage);
    this.im.frustumCulled = false;
    for (let i = 0; i < 40; i++) {
      this.items.push({ active: false, t: 0, sinker: true, mode: 0, forkT: 0,
        routeT: 0, good: true, qpos: 0,
        fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 });
      _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
      this.im.setColorAt(i, _color.set(COL.cherryRipe));
    }
    this.im.instanceColor.needsUpdate = true;
    S.add(this.im);
    this.uiEl = document.getElementById('wash-ui');
    World.gateGood.userData.baseRy = World.gateGood.rotation.y;
    World.gateDefect.userData.baseRy = World.gateDefect.rotation.y;
    World.gateGood.userData.swing = 0; World.gateDefect.userData.swing = 0;
  },

  busy() { return this.pouring || this.flowing; },

  beginPour() {
    // pindahkan komposisi batch dari keranjang ke antrean tuang, diacak.
    // (good+defect = yang dipetik; bisa > count karena overflow -> potong)
    const g = Math.min(BasketSys.good, 40), d = Math.min(BasketSys.defect, 40);
    let n = 0;
    for (let i = 0; i < g && n < 40; i++) this.pourQueue[n++] = true;
    for (let i = 0; i < d && n < 40; i++) this.pourQueue[n++] = false;
    for (let i = n - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = this.pourQueue[i]; this.pourQueue[i] = this.pourQueue[j]; this.pourQueue[j] = tmp;
    }
    this.pourLen = Math.min(BasketSys.count, n);
    this.batchQuality = BasketSys.quality;
    this.pouring = true;
    this.goodRouted = 0; this.defectRouted = 0;
  },

  onPourArrived(sinker) {
    HutSys.pourInflight--;
    for (let i = 0; i < 40; i++) {
      const it = this.items[i];
      if (it.active) continue;
      it.active = true; it.t = 0; it.sinker = !!sinker; it.mode = 0; it.qpos = 0;
      this.im.setColorAt(i, _color.set(it.sinker ? COL.cherryRipe : COL.cherryGreen));
      break;
    }
    this.im.instanceColor.needsUpdate = true;
  },

  endPour() {
    BasketSys.reset();
    this.pouring = false;
    this.flowing = true;
    this.uiEl.style.display = 'flex';
    refreshHint(true);
    SaveSys.save();
  },

  route(toGood) {
    if (this.waitCount <= 0) return;
    const i = this.waitList[0];
    for (let k = 0; k < this.waitCount - 1; k++) {
      this.waitList[k] = this.waitList[k + 1];
      this.items[this.waitList[k]].qpos = k;
    }
    this.waitCount--;
    const it = this.items[i];
    it.mode = 2; it.routeT = 0; it.good = toGood;
    const d = toGood ? this.GOOD_DOCK : this.DEFECT_DOCK;
    it.fx = this.FORK.x; it.fy = this.WATER_Y + 0.15; it.fz = this.FORK.z;
    it.tx = d.x; it.ty = 0.9; it.tz = d.z;
    const gate = toGood ? World.gateGood : World.gateDefect;
    gate.userData.swing = 1;
    AudioSys.gate();
  },

  finishRoute(i) {
    const it = this.items[i];
    it.active = false;
    _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
    _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
    this.im.setMatrixAt(i, _dummy.matrix);
    this.im.instanceMatrix.needsUpdate = true;
    if (it.good) {
      this.goodRouted++;
      _v1.set(it.tx, it.ty, it.tz);
      _v2.copy(World.dryerRacks[0]); _v2.y = 1.2;
      const q = it.sinker ? this.batchQuality : Math.max(0, this.batchQuality - 10);
      if (!it.sinker) {
        Floaters.spawn(it.tx, 1.6, it.tz, t('contaminated'), 'bad');
        AudioSys.error();
      } else {
        Particles.burst(_v1, COL.water, 4, 1.5);
      }
      if (!Flyers.spawn(_v1, _v2, 'dryer', q)) DrySys.onBeanArrived(q);
    } else {
      this.defectRouted++;
      SaveSys.data.defect++;
      if (!it.sinker) {
        // floater -> DEFECT: benar
      } else {
        Floaters.spawn(it.tx, 1.6, it.tz, '-$', 'bad');
      }
      if (SaveSys.data.defect >= CFG.DEFECT_AUTOSELL) this.sellDefect();
      Hud.dirty = true;
    }
  },

  sellDefect() {
    const n = SaveSys.data.defect;
    if (n <= 0) return;
    const v = n * CFG.DEFECT_PRICE;
    SaveSys.data.defect = 0;
    SaveSys.data.cash += v;
    Floaters.spawn(this.DEFECT_DOCK.x, 1.8, this.DEFECT_DOCK.z,
      '+$' + v.toFixed(2) + ' ' + t('defect_sold'), 'cash');
    AudioSys.cash();
    Hud.dirty = true; SaveSys.save();
  },

  update(dt, now) {
    // foam selalu mengalir (ambient)
    this.foamT += dt;
    const len = 6.5, cx = 6.25;
    for (let i = 0; i < 10; i++) {
      const x = cx + len / 2 - ((this.foamT * 1.1 + i * 0.73) % (len + 1));
      _dummy.position.set(x, 0.64, 9.1 + ((i * 0.37) % 0.5) - 0.25);
      _dummy.rotation.set(-Math.PI / 2, 0, 0);
      _dummy.scale.set(1, 1, 1); _dummy.updateMatrix();
      World.washFoam.setMatrixAt(i, _dummy.matrix);
    }
    World.washFoam.instanceMatrix.needsUpdate = true;
    // ayunan pintu air
    for (const gate of [World.gateGood, World.gateDefect]) {
      const u = gate.userData;
      if (u.swing > 0) {
        u.swing = Math.max(0, u.swing - dt * 2.2);
        gate.rotation.y = u.baseRy + Math.sin(u.swing * Math.PI) * 0.7;
      }
    }
    if (!this.flowing) { World.forkRing.visible = false; return; }

    let dirty = false, activeCount = 0;
    for (let i = 0; i < 40; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      activeCount++;
      if (it.mode === 0) {
        it.t += dt / CFG.WASH_FLOW_TIME;
        if (it.t >= 1) {
          it.mode = 1; it.t = 1; it.forkT = 0;
          it.qpos = this.waitCount;
          this.waitList[this.waitCount++] = i;
        }
      } else if (it.mode === 1) {
        if (it.qpos === 0) {
          it.forkT += dt;
          if (it.forkT >= CFG.WASH_FORK_WAIT) this.route(it.sinker); // auto benar
        }
      } else {
        it.routeT += dt / 0.5;
        if (it.routeT >= 1) this.finishRoute(i);
      }
      this.writeMatrix(i, it, now);
      dirty = true;
    }
    if (dirty) this.im.instanceMatrix.needsUpdate = true;
    World.forkRing.visible = this.waitCount > 0;
    if (this.waitCount > 0) {
      const s = 1 + Math.sin(now * 8) * 0.12;
      World.forkRing.scale.set(s, s, 1);
    }
    if (activeCount === 0) {
      this.flowing = false;
      this.uiEl.style.display = 'none';
      World.forkRing.visible = false;
      refreshHint(true);
    }
  },

  writeMatrix(i, it, now) {
    if (!it.active) {
      _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
    } else if (it.mode === 2) {
      const t = Math.min(it.routeT, 1), u = t * t * (3 - 2 * t);
      _dummy.position.set(
        it.fx + (it.tx - it.fx) * u,
        it.fy + (it.ty - it.fy) * u + Math.sin(u * Math.PI) * 0.8,
        it.fz + (it.tz - it.fz) * u);
      _dummy.scale.set(1, 1, 1);
    } else {
      let x, y, s = 1;
      if (it.mode === 1 && it.qpos === 0) {
        x = this.FORK.x; y = this.WATER_Y + 0.12;
        s = 1 + Math.sin(now * 8) * 0.15;
      } else {
        const t = it.mode === 1 ? Math.max(0.55, 0.94 - 0.055 * it.qpos) : Math.min(it.t, 1);
        x = this.POUR.x + (this.FORK.x - this.POUR.x) * t;
        y = it.sinker ? this.WATER_Y - 0.16
          : this.WATER_Y + 0.03 + Math.sin(now * 5 + i * 1.3) * 0.04;
      }
      _dummy.position.set(x, y, 9.1);
      _dummy.scale.set(s, s, s);
    }
    _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
    this.im.setMatrixAt(i, _dummy.matrix);
  },
};

/* ============================================================================
   17. DRYER — penjemuran otomatis (§4.5, bukan taktil)
   Biji GOOD dari wash -> rak bambu (timer visual, warna hijau->coklat) ->
   hopper (siap roast). Otomatis penuh.
   ============================================================================ */
const DrySys = {
  im: null, slots: [],
  count: 0, qSum: 0,          // hopper: biji kering siap roast
  dryCol: null,
  init(S) {
    this.dryCol = new Color(COL.beanDry);
    // hopper persist (stockpile, bukan in-progress)
    this.count = Math.max(0, Math.floor(SaveSys.data.dryCount || 0));
    this.qSum = Math.max(0, SaveSys.data.dryQSum || 0);
    this.im = new InstancedMesh(new SphereGeometry(0.07, 6, 5),
      new MeshStandardMaterial({ roughness: 0.6, flatShading: true }), 56);
    this.im.instanceMatrix.setUsage(DynamicDrawUsage);
    this.im.frustumCulled = false;
    let s = 0;
    for (const rack of World.dryerRacks) {
      for (let gx = 0; gx < 7; gx++) for (let gz = 0; gz < 4; gz++) {
        this.slots.push({
          active: false, t: 0, quality: 100,
          x: rack.x - 0.9 + gx * 0.3, y: rack.y + 0.12, z: rack.z - 0.5 + gz * 0.33,
        });
        _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
        this.im.setMatrixAt(s, _dummy.matrix);
        this.im.setColorAt(s, _color.set(COL.beanDry));
        s++;
      }
    }
    this.im.instanceColor.needsUpdate = true;
    S.add(this.im);
  },
  onBeanArrived(quality) {
    for (let i = 0; i < 56; i++) {
      const sl = this.slots[i];
      if (sl.active) continue;
      sl.active = true; sl.t = 0; sl.quality = quality;
      _dummy.position.set(sl.x, sl.y, sl.z); _dummy.scale.set(1, 1, 1);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
      this.im.setColorAt(i, _color.set(COL.cherryGreen));
      this.im.instanceMatrix.needsUpdate = true;
      this.im.instanceColor.needsUpdate = true;
      return;
    }
    this.count++; this.qSum += quality;   // rak penuh -> langsung hopper
    this.saveHopper();
    refreshHint(true);
  },
  saveHopper() {
    SaveSys.data.dryCount = this.count;
    SaveSys.data.dryQSum = this.qSum;
  },
  update(dt) {
    let mDirty = false, cDirty = false;
    for (let i = 0; i < 56; i++) {
      const sl = this.slots[i];
      if (!sl.active) continue;
      sl.t += dt;
      if (sl.t >= CFG.DRY_TIME) {
        sl.active = false;
        this.count++; this.qSum += sl.quality;
        this.saveHopper();
        _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
        this.im.setMatrixAt(i, _dummy.matrix);
        mDirty = true;
        if (this.count === CFG.ROAST_MIN_BEANS) refreshHint(true);
      } else {
        _color.set(COL.cherryGreen).lerp(this.dryCol, sl.t / CFG.DRY_TIME);
        this.im.setColorAt(i, _color);
        cDirty = true;
      }
    }
    if (mDirty) this.im.instanceMatrix.needsUpdate = true;
    if (cDirty) this.im.instanceColor.needsUpdate = true;
  },
};

/* (RoastSys §18 didefinisikan tepat di bawah, sebelum SackSys.
   Urutan definisi tidak penting; yang penting semua terdefinisi sebelum boot().) */

/* ============================================================================
   18. ROAST DRUM — heat control + FIRST CRACK + order (§4.4)
   Drag fuel untuk jaga jarum di zona hijau. ~196°C = FIRST CRACK (signature).
   STOP di zona target order -> roast-match +25%. Merah kelamaan = gosong.
   ============================================================================ */
const RoastSys = {
  active: false,
  beans: 0, quality: 100, order: 1,
  temp: 25, fuel: 55, progress: 0, scorch: 0, cracked: false,
  bands: [[45, 60], [60, 78], [78, 95]],
  orderKeys: ['order_light', 'order_medium', 'order_dark'],
  uiEl: null, tempEl: null, needleEl: null, fillEl: null,
  orderEl: null, beansEl: null, sliderEl: null, knobEl: null, loadBtn: null,
  crackT: 0, shakeT: 0,

  init() {
    const g = id => document.getElementById(id);
    this.uiEl = g('roast-ui'); this.tempEl = g('roast-temp');
    this.needleEl = g('roast-needle'); this.fillEl = g('roast-fill');
    this.orderEl = g('roast-order'); this.beansEl = g('roast-beans');
    this.sliderEl = g('fuel-slider'); this.knobEl = g('fuel-knob');
    this.loadBtn = g('btn-load');
  },

  setFuel(e) {
    const r = this.sliderEl.getBoundingClientRect();
    const k = 1 - (e.clientY - r.top) / r.height;
    this.fuel = clamp(k, 0, 1) * 100;
  },

  tryLoad() {
    if (this.active || DrySys.count < CFG.ROAST_MIN_BEANS) return;
    const n = Math.min(DrySys.count, CFG.ROAST_MAX_BEANS);
    const q = DrySys.qSum / DrySys.count;
    DrySys.count -= n; DrySys.qSum -= q * n;
    if (DrySys.count <= 0) { DrySys.count = 0; DrySys.qSum = 0; }
    DrySys.saveHopper();
    this.start(n, q);
  },

  start(n, q) {
    this.active = true;
    this.beans = n; this.quality = q;
    this.order = (Math.random() * 3) | 0;
    this.temp = 25; this.fuel = 55; this.progress = 0; this.scorch = 0;
    this.cracked = false; this.crackT = 0; this.shakeT = 0;
    this.uiEl.style.display = 'block';
    this.loadBtn.style.display = 'none';
    this.orderEl.textContent = t(this.orderKeys[this.order]).toUpperCase();
    const b = this.bands[this.order];
    const band = document.getElementById('roast-band');
    band.style.left = b[0] + '%'; band.style.width = (b[1] - b[0]) + '%';
    this.updateUI();
    AudioSys.loadDrum(); AudioSys.humStart();
    refreshHint(true);
  },

  stop() {
    if (!this.active) return;
    const b = this.bands[this.order], p = this.progress;
    const qm = 0.5 + this.quality / 100;
    if (p >= b[0] && p <= b[1]) {
      const v = CFG.SACK_PRICE * qm * CFG.ROAST_MATCH_MULT;
      SackSys.addSack(v, true);
      Floaters.spawn(World.roastDrumPos.x, 3.0, World.roastDrumPos.z, t('roast_match'), 'gold');
      AudioSys.ding();
    } else {
      const v = CFG.SACK_PRICE * qm * CFG.UNDER_PENALTY;
      SackSys.addSack(v, false);
      Floaters.spawn(World.roastDrumPos.x, 3.0, World.roastDrumPos.z, t('under_roast'), '');
      AudioSys.pluck();
    }
    SaveSys.data.stats.roasted = (SaveSys.data.stats.roasted || 0) + 1;
    this.endRoast();
  },

  failBurnt() {
    Floaters.spawn(World.roastDrumPos.x, 3.0, World.roastDrumPos.z, t('burnt'), 'bad');
    AudioSys.error();
    _v1.copy(World.roastDrumPos); _v1.y += 1.2;
    Particles.burst(_v1, 0x2A2A2A, 16, 3);
    this.endRoast();
  },

  endRoast() {
    this.active = false;
    this.uiEl.style.display = 'none';
    document.getElementById('firstcrack-banner').style.display = 'none';
    AudioSys.humStop();
    SaveSys.save();
    refreshHint(true);
  },

  update(dt, now) {
    this.loadBtn.style.display =
      (!this.active && DrySys.count >= CFG.ROAST_MIN_BEANS && SackSys.collectValue <= 0) ? 'block' : 'none';
    if (!this.active) return;
    // --- fisika panas: temp mengejar equilibrium fuel ---
    const eq = 20 + this.fuel * 2.2;
    this.temp += (eq - this.temp) * Math.min(1, dt * 0.35);
    // --- FIRST CRACK ---
    if (!this.cracked && this.temp >= CFG.FIRST_CRACK_TEMP) {
      this.cracked = true; this.crackT = 2.5; this.shakeT = 0.7;
      document.getElementById('firstcrack-banner').style.display = 'flex';
      AudioSys.crackle();
      _v1.copy(World.roastDrumPos); _v1.y += 1.0;
      Particles.burst(_v1, COL.beanRoast, 14, 3.5);
      SaveSys.data.stats.cracks = (SaveSys.data.stats.cracks || 0) + 1;
    }
    if (this.crackT > 0) {
      this.crackT -= dt;
      if (this.crackT <= 0) document.getElementById('firstcrack-banner').style.display = 'none';
    }
    // --- progress roast (jalan saat 150-225°C) ---
    if (this.temp >= 150 && this.temp <= 225) {
      this.progress += dt * 2.0 * (0.6 + 0.4 * (this.temp - 150) / 75);
    }
    // --- scorch (zona merah) ---
    if (this.temp > 225) {
      this.scorch += dt * (this.temp - 225) / 30;
      if (this.scorch >= 1) { this.failBurnt(); return; }
    } else {
      this.scorch = Math.max(0, this.scorch - dt * 0.3);
    }
    if (this.progress >= 97) { this.failBurnt(); return; }
    // --- visual drum ---
    World.roastDrum.rotation.x += dt * (0.6 + this.temp / 120);
    const heatK = clamp((this.temp - 60) / 160, 0, 1);
    World.roastFire.material.opacity = 0.22 + heatK * 0.68;
    const fs = 0.8 + heatK * 0.7 + Math.sin(now * 13) * 0.08;
    World.roastFire.scale.set(fs, fs * (1 + heatK * 0.5), fs);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      World.roastDrum.position.x = World.roastDrumPos.x + Math.sin(now * 40) * 0.06 * this.shakeT;
    } else {
      World.roastDrum.position.x = World.roastDrumPos.x;
    }
    if (this.temp > 150 && Math.random() < dt * 6) {
      _v1.copy(World.roastDrumPos); _v1.y += 1.1;
      Particles.burst(_v1, 0xDDDDDD, 2, 1.1);
    }
    AudioSys.humUpdate(this.temp);
    this.updateUI();
  },

  updateUI() {
    this.tempEl.textContent = Math.round(this.temp) + '°C';
    const pct = clamp((this.temp - 20) / 230, 0, 1) * 100;
    this.needleEl.style.left = pct + '%';
    this.fillEl.style.width = clamp(this.progress, 0, 100) + '%';
    const rk = clamp(this.progress / 100, 0, 1);
    const r = Math.round(205 - rk * 150), gg = Math.round(155 - rk * 118), b = Math.round(105 - rk * 80);
    this.fillEl.style.background = 'rgb(' + r + ',' + gg + ',' + b + ')';
    this.beansEl.textContent = this.beans + ' · Q' + Math.round(this.quality);
    this.knobEl.style.bottom = 'calc(' + this.fuel.toFixed(1) + '% - 14px)';
  },
};

/* ============================================================================
   19. SACKSYS — karung goni + truk + collect cash (§4.6)
   Roast batch -> 1 karung (visual menumpuk). >=8 karung -> truk datang,
   muat, pergi -> bundle cash -> TAP untuk collect.
   ============================================================================ */
const SackSys = {
  im: null, pilePos: [],
  truck: null, truckState: 'idle', truckT: 0,
  loading: null,          // {idx, t} karung yang sedang dimuat
  collectValue: 0,
  collectBtn: null, collectVal: null,

  init(S) {
    const bx = -6.5, bz = 9.1;
    const layers = [5, 4, 3];
    for (let l = 0; l < 3; l++) {
      for (let i = 0; i < layers[l] && this.pilePos.length < 12; i++) {
        this.pilePos.push({
          x: bx - (layers[l] - 1) * 0.45 + i * 0.9,
          y: 0.32 + l * 0.58, z: bz,
        });
      }
    }
    this.im = new InstancedMesh(new SphereGeometry(0.42, 8, 6),
      new MeshStandardMaterial({ color: COL.jute, roughness: 0.85, flatShading: true }), 12);
    this.im.frustumCulled = false;
    this.im.castShadow = true;
    for (let i = 0; i < 12; i++) {
      _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
    }
    S.add(this.im);
    this.refresh();
    this.buildTruck(S);
    this.collectBtn = document.getElementById('btn-collect');
    this.collectVal = document.getElementById('collect-val');
  },

  refresh() {
    const n = Math.min(SaveSys.data.sacks, 12);
    for (let i = 0; i < 12; i++) {
      if (i < n) {
        const p = this.pilePos[i];
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.scale.set(1, 0.72, 1);
        _dummy.rotation.set(0, i * 0.7, 0);
      } else {
        _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.rotation.set(0, 0, 0);
      }
      _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
    }
    this.im.instanceMatrix.needsUpdate = true;
  },

  addSack(value, matched) {
    SaveSys.data.sacks++;
    SaveSys.data.sackValue += value;
    SaveSys.data.stats.sacksMade = (SaveSys.data.stats.sacksMade || 0) + 1;
    this.refresh();
    Hud.dirty = true; SaveSys.save();
    if (SaveSys.data.sacks >= CFG.SACKS_FOR_TRUCK && this.truckState === 'idle') {
      this.sendTruck();
    }
    refreshHint(true);
  },

  buildTruck(S) {
    const g = new Group();
    const cab = new Mesh(new BoxGeometry(1.6, 1.4, 1.8), stdMat(COL.truckRed));
    cab.position.set(0, 1.15, 0); cab.castShadow = true;
    const bed = new Mesh(new BoxGeometry(3.4, 1.0, 1.9), stdMat(0x8A5A3B));
    bed.position.set(-2.5, 0.95, 0); bed.castShadow = true;
    g.add(cab); g.add(bed);
    const wg = new CylinderGeometry(0.35, 0.35, 0.3, 10);
    const wm = stdMat(0x2B2B2B);
    for (const [wx, wz] of [[0.5, 0.95], [0.5, -0.95], [-1.7, 0.95], [-1.7, -0.95], [-3.4, 0.95], [-3.4, -0.95]]) {
      const w = new Mesh(wg, wm);
      w.rotation.x = Math.PI / 2; w.position.set(wx, 0.35, wz);
      g.add(w);
    }
    g.visible = false;
    g.position.set(18, 0, 12.5);
    S.add(g);
    this.truck = g;
  },

  sendTruck() {
    this.truckState = 'arriving'; this.truckT = 0;
    this.truck.visible = true;
    this.truck.position.set(18, 0, 12.5);
    AudioSys.loadDrum();
  },

  truckBed(out) {
    return out.set(this.truck.position.x - 2.5, 1.7, this.truck.position.z);
  },

  collect() {
    if (this.collectValue <= 0) return;
    const v = this.collectValue;
    this.collectValue = 0;
    SaveSys.data.cash += v;
    SaveSys.data.stats.earned = (SaveSys.data.stats.earned || 0) + v;
    _v1.set(-6.5, 2.5, 12.5);
    Floaters.spawn(_v1.x, _v1.y, _v1.z, '+$' + v.toFixed(2), 'cash');
    AudioSys.cashBig();
    Hud.dirty = true; SaveSys.save(); refreshHint(true);
  },

  update(dt, now) {
    const show = this.collectValue > 0;
    this.collectBtn.style.display = show ? 'block' : 'none';
    if (show) this.collectVal.textContent = '$' + this.collectValue.toFixed(2);
    if (this.truckState === 'idle') return;
    const tr = this.truck;
    if (this.truckState === 'arriving') {
      this.truckT += dt;
      const k = Math.min(1, this.truckT / 4);
      tr.position.x = lerp(18, -6.5, k * k * (3 - 2 * k));
      tr.position.y = Math.abs(Math.sin(this.truckT * 9)) * 0.05;
      if (k >= 1) { this.truckState = 'loading'; tr.position.y = 0; }
    } else if (this.truckState === 'loading') {
      if (this.loading) {
        const L = this.loading;
        L.t += dt / 0.45;
        const t = Math.min(L.t, 1), u = t * t * (3 - 2 * t);
        const p = this.pilePos[L.idx];
        this.truckBed(_v1);
        _dummy.position.set(
          p.x + (_v1.x - p.x) * u,
          p.y + (_v1.y - p.y) * u + Math.sin(u * Math.PI) * 1.6,
          p.z + (_v1.z - p.z) * u);
        _dummy.scale.set(1, 0.72, 1); _dummy.rotation.set(0, L.idx * 0.7, 0);
        _dummy.updateMatrix();
        this.im.setMatrixAt(L.idx, _dummy.matrix);
        this.im.instanceMatrix.needsUpdate = true;
        if (L.t >= 1) {
          SaveSys.data.sacks--;
          this.loading = null;
          this.refresh();
          Hud.dirty = true;
        }
      } else if (SaveSys.data.sacks > 0) {
        this.loading = { idx: Math.min(SaveSys.data.sacks, 12) - 1, t: 0 };
        AudioSys.pop();
      } else {
        this.truckState = 'departing'; this.truckT = 0;
      }
    } else if (this.truckState === 'departing') {
      this.truckT += dt;
      const k = Math.min(1, this.truckT / 4);
      tr.position.x = lerp(-6.5, -18, k * k * (3 - 2 * k));
      tr.position.y = Math.abs(Math.sin(this.truckT * 9)) * 0.05;
      if (k >= 1) {
        this.truckState = 'idle';
        tr.visible = false;
        this.collectValue = SaveSys.data.sackValue;
        SaveSys.data.sackValue = 0;
        SaveSys.save();
        refreshHint(true);
      }
    }
    void now;
  },
};

/* ============================================================================
   FASE 3 — WORKERS (picker), UPGRADES, ZONES 2-3, OFFLINE EARNINGS
   -> Perluas SaveSys (upgrades, zones, lastSave -> offline calc).
   ============================================================================ */

/* ============================================================================
   FASE 4 — SDK CRAZYGAMES v3, ACHIEVEMENTS, SHARE CARD, QA PORTAL
   -> SdkSys wrapper + mock; achievements; share 1080x1350.
   ============================================================================ */

// Entry point (di akhir agar semua sistem terdefinisi).
boot();
