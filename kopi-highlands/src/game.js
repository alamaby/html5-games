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
  WASH_POOL: 84,          // Fase 3: pool wash >= kapasitas keranjang maks (80) + margin
};

// --- Fase 3: zona / varietas (§4.8) ---
// Ladang diperluas ke +x: tiga field 4x4, masing-masing dengan wash station sendiri.
// price = $ dasar per karung; ripe/leaf = tint visual per zona.
const ZONES = [
  { name: 'Lower Terraces', variety: 'Arabika',  price: 12, xOff: 0,  leaf: 0x2E7D46, ripe: 0xE8452C, unlock: 0 },
  { name: 'Upper Slopes',   variety: 'Robusta',  price: 20, xOff: 38, leaf: 0x4C9440, ripe: 0xF26B1D, unlock: 600 },
  { name: 'Cloud Forest',   variety: 'Liberika', price: 35, xOff: 76, leaf: 0x1F6E5E, ripe: 0xA61E4D, unlock: 3000 },
];

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
    // --- Fase 3 ---
    upgrades: 'UPGRADES', upg_title: 'Empire Upgrades', close: 'CLOSE',
    buy: 'BUY', max: 'MAX', lvl: 'Lv',
    up_pickSpeed: 'Pick Speed', up_pickSpeed_d: 'Charge ring fills faster',
    up_basketCap: 'Basket Capacity', up_basketCap_d: '+8 cherries per level',
    up_dryerSpeed: 'Dryer Speed', up_dryerSpeed_d: 'Beans dry faster',
    up_drumStability: 'Drum Stability', up_drumStability_d: 'Wider green heat zone',
    up_channelFlow: 'Channel Flow', up_channelFlow_d: 'Cherries flow faster',
    up_picker: 'Hire Picker', up_picker_d: 'Auto-picks ripe cherries for you',
    zones_title: 'Zones', per_sack: '/sack', unlock: 'UNLOCK', owned: 'OWNED',
    offline_title: 'While you were away',
    offline_earned: 'Your pickers earned',
    offline_collect: 'COLLECT', offline_double: '2× COLLECT (AD)',
    ad_text: 'Ad playing…', ad_mock: 'MOCK AD',
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
    // --- Fase 3 ---
    upgrades: 'UPGRADE', upg_title: 'Upgrade Empire', close: 'TUTUP',
    buy: 'BELI', max: 'MAKS', lvl: 'Lv',
    up_pickSpeed: 'Kecepatan Petik', up_pickSpeed_d: 'Ring charge lebih cepat penuh',
    up_basketCap: 'Kapasitas Keranjang', up_basketCap_d: '+8 cherry per level',
    up_dryerSpeed: 'Kecepatan Jemur', up_dryerSpeed_d: 'Biji lebih cepat kering',
    up_drumStability: 'Stabilitas Drum', up_drumStability_d: 'Zona panas hijau lebih lebar',
    up_channelFlow: 'Arus Channel', up_channelFlow_d: 'Cherry mengalir lebih cepat',
    up_picker: 'Rekrut Picker', up_picker_d: 'Otomatis memetik cherry matang',
    zones_title: 'Zona', per_sack: '/karung', unlock: 'BUKA', owned: 'DIMILIKI',
    offline_title: 'Selama kamu pergi',
    offline_earned: 'Picker kamu menghasilkan',
    offline_collect: 'AMBIL', offline_double: '2× AMBIL (IKLAN)',
    ad_text: 'Iklan diputar…', ad_mock: 'IKLAN MOCK',
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
    sacks: 0, sackValue: 0, defect: 0, dryCount: 0, dryQSum: 0, lastSave: 0,
    // Fase 3: level upgrade, zona terbuka, hopper per zona (default aman utk save lama)
    upg: { pickSpeed: 0, basketCap: 0, dryerSpeed: 0, drumStability: 0, channelFlow: 0, picker: 0 },
    zones: [true, false, false],
    dryZones: [{ c: 0, q: 0 }, { c: 0, q: 0 }, { c: 0, q: 0 }] },
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
          // Fase 3: upgrade (clamp ke rentang sah), zona, hopper per zona
          const du = (d && d.upg) || {};
          const clampLvl = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
          this.data.upg = {
            pickSpeed: clampLvl(du.pickSpeed, 5), basketCap: clampLvl(du.basketCap, 5),
            dryerSpeed: clampLvl(du.dryerSpeed, 5), drumStability: clampLvl(du.drumStability, 5),
            channelFlow: clampLvl(du.channelFlow, 5), picker: clampLvl(du.picker, 3),
          };
          const dz = Array.isArray(d.zones) ? d.zones : [];
          this.data.zones = [true, !!dz[1], !!dz[2]];
          const dzz = Array.isArray(d.dryZones) ? d.dryZones : [];
          for (let i = 0; i < 3; i++) {
            const e = dzz[i] || {};
            this.data.dryZones[i] = {
              c: Math.max(0, Math.floor(+e.c || 0)),
              q: Math.max(0, +e.q || 0),
            };
          }
          // save Fase 2 (tanpa dryZones) tapi punya stok hopper -> wariskan ke zona 0
          if (!Array.isArray(d.dryZones) && this.data.dryCount > 0) {
            this.data.dryZones[0] = { c: this.data.dryCount, q: this.data.dryQSum };
          }
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
  // --- Fase 3 ---
  upgrade() {
    // arpeggio naik cerah (beli upgrade / unlock zona)
    const seq = [440, 587, 880, 1174];
    for (let i = 0; i < seq.length; i++) this._tone(seq[i], 0.14, 'triangle', 0.3, i * 0.07);
  },
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
    this.sun = sun;   // Fase 3: sun mengikuti pemain agar bayangan hidup di semua zona

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
    // sun + target mengikuti pemain (kotak shadow +-25 selalu di sekitar pemain,
    // jadi zona 2/3 yang jauh di +x tetap dapat bayangan golden-hour)
    if (this.sun) {
      this.sun.position.set(px - 18, 14, pz + 8);
      this.sun.target.position.set(px, 0, pz);
      this.sun.target.updateMatrixWorld();
    }
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
    // --- tanah lapang (Fase 3: diperlebar menutupi 3 zona, pusat x=38) ---
    const ground = new Mesh(new PlaneGeometry(150, 76), stdMat(COL.terrace));
    ground.rotation.x = -Math.PI / 2; ground.position.x = 38; ground.receiveShadow = true;
    S.add(ground);

    // --- terasering latar (5 undak naik ke -z, membentang di semua zona) ---
    const terrGeo = new BoxGeometry(140, 1.15, 5);
    const terrIM = new InstancedMesh(terrGeo, stdMat(COL.terrace), 6);
    const edgeGeo = new BoxGeometry(140, 0.35, 0.5);
    const edgeIM = new InstancedMesh(edgeGeo, stdMat(COL.terraceEdge), 6);
    for (let i = 0; i < 6; i++) {
      const z = -15 - i * 5, y = 0.55 + i * 1.15;
      _dummy.position.set(38, y, z); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix(); terrIM.setMatrixAt(i, _dummy.matrix);
      _dummy.position.set(38, y + 0.55, z + 2.5); _dummy.updateMatrix();
      edgeIM.setMatrixAt(i, _dummy.matrix);
    }
    terrIM.receiveShadow = true;
    S.add(terrIM); S.add(edgeIM);

    // --- bukit jauh (tersebar di ketiga zona) ---
    const hillGeo = new IcosahedronGeometry(1, 1);
    const hillIM = new InstancedMesh(hillGeo, stdMat(0x6FA05C), 8);
    const hillPos = [[-30, -2, -42, 14], [5, -3, -48, 18], [32, -2, -40, 12], [-8, -4, -55, 22],
      [43, -3, -48, 18], [70, -2, -40, 12], [46, -4, -55, 22], [84, -2, -44, 16]];
    for (let i = 0; i < hillPos.length; i++) {
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
    this.buildStations(S);      // Fase 3: wash station + dryer racks per zona
    this.buildDrum(S);          // Fase 2
  },

  buildBushes(S) {
    // Fase 3: 3 zona x 16 bush = 48 bush / 864 cherry, tetap 4 draw call (IM bersama).
    const per = CFG.CLUSTERS_PER_BUSH, cp = CFG.CHERRIES_PER_CLUSTER;
    const nBush = ZONES.length * CFG.BUSH_ROWS * CFG.BUSH_COLS;      // 48
    const trunkIM = new InstancedMesh(new CylinderGeometry(0.09, 0.13, 0.9, 6), stdMat(COL.trunk), nBush);
    // foliage: material putih + instanceColor per zona (tint daun beda tiap varietas)
    const folIM = new InstancedMesh(new IcosahedronGeometry(0.95, 0),
      new MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.68, metalness: 0.05, flatShading: true }), nBush * 3);
    const dirtIM = new InstancedMesh(new CircleGeometry(1.25, 10), stdMat(COL.soil), nBush);
    trunkIM.castShadow = true; folIM.castShadow = true;
    dirtIM.frustumCulled = false;
    this.folIM = folIM;

    const totalCherries = nBush * per * cp;                          // 864
    const cherryIM = new InstancedMesh(
      new SphereGeometry(0.09, 6, 5),
      new MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, flatShading: true }),
      totalCherries);
    cherryIM.instanceMatrix.setUsage(DynamicDrawUsage);
    cherryIM.castShadow = true; cherryIM.frustumCulled = false;
    this.cherryIM = cherryIM;

    const gap = CFG.BUSH_GAP, off = (CFG.BUSH_ROWS - 1) * gap / 2;
    const grey = new Color(0x8A8A7A);
    let bi = 0, ci = 0;
    const now = performance.now() / 1000;
    for (let zi = 0; zi < ZONES.length; zi++) {
      const unlocked = !!SaveSys.data.zones[zi];
      const xOff = ZONES[zi].xOff;
      for (let r = 0; r < CFG.BUSH_ROWS; r++) for (let c = 0; c < CFG.BUSH_COLS; c++) {
        const x = c * gap - off + xOff, z = r * gap - off;
        // tanah
        _dummy.position.set(x, 0.02, z); _dummy.rotation.set(-Math.PI / 2, 0, 0);
        _dummy.scale.set(1, 1, 1); _dummy.updateMatrix(); dirtIM.setMatrixAt(bi, _dummy.matrix);
        // trunk
        _dummy.position.set(x, 0.45, z); _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
        trunkIM.setMatrixAt(bi, _dummy.matrix);
        // foliage 3 blob (warna zona; zona terkunci = kusam keabu-abuan)
        _color.set(ZONES[zi].leaf);
        if (!unlocked) _color.lerp(grey, 0.62);
        const blobs = [[0, 1.15, 0, 1.0], [0.45, 0.95, 0.25, 0.72], [-0.42, 0.98, -0.22, 0.78]];
        for (let b = 0; b < 3; b++) {
          _dummy.position.set(x + blobs[b][0], blobs[b][1], z + blobs[b][2]);
          _dummy.scale.set(blobs[b][3], blobs[b][3] * 0.75, blobs[b][3]);
          _dummy.rotation.set(0, bi + b, 0); _dummy.updateMatrix();
          folIM.setMatrixAt(bi * 3 + b, _dummy.matrix);
          folIM.setColorAt(bi * 3 + b, _color);
        }
        // clusters
        const bush = { pos: new Vector3(x, 0, z), clusters: [], zone: zi };
        const angles = [Math.PI / 2, Math.PI / 2 + 2.1, Math.PI / 2 + 4.2];
        for (let k = 0; k < per; k++) {
          const ax = x + Math.cos(angles[k]) * 0.62, az = z + Math.sin(angles[k]) * 0.62;
          const ay = 1.05 + (k % 2) * 0.3;
          const anchor = new Vector3(ax, ay, az);
          const idxs = [];
          for (let j = 0; j < cp; j++) {
            const th = (j / cp) * Math.PI * 2 + k;
            _v1.set(anchor.x + Math.cos(th) * 0.26, anchor.y + Math.sin(j * 2.3) * 0.2, anchor.z + Math.sin(th) * 0.26);
            const cherry = { inst: ci, idx: this.cherries.length, state: 0, at: 0, pos: _v1.clone(), cluster: null, zone: zi };
            this.cherries.push(cherry);
            idxs.push(cherry.idx);
            ci++;
          }
          const cluster = { anchor: anchor, cherryIdx: idxs, squash: 0, zone: zi };
          idxs.forEach(ii => { this.cherries[ii].cluster = cluster; });
          bush.clusters.push(cluster);
          if (unlocked) this._seedCluster(cluster, now);
          else for (const ii of idxs) this._setState(this.cherries[ii], 0, 0); // terkunci: kosong
        }
        this.bushes.push(bush);
        bi++;
      }
    }
    cherryIM.instanceColor.needsUpdate = true;
    if (folIM.instanceColor) folIM.instanceColor.needsUpdate = true;
    S.add(trunkIM); S.add(folIM); S.add(dirtIM); S.add(cherryIM);
  },

  // distribusi state awal cluster (juga dipakai saat zona dibuka)
  _seedCluster(cluster, now) {
    for (const ii of cluster.cherryIdx) {
      const cherry = this.cherries[ii];
      const roll = Math.random();
      if (roll < 0.55) this._setState(cherry, 3, now + rand(30, 50));       // ripe -> over
      else if (roll < 0.85) this._setState(cherry, 2, now + rand(10, 18));   // green -> ripe
      else if (roll < 0.93) this._setState(cherry, 4, now + rand(15, 25));  // over -> drop
      else this._setState(cherry, 1, now + rand(2, 6));                     // flower -> green
    }
  },

  // zona dibuka dari modal upgrade: warnai daun + tanam cherry
  activateZone(zi) {
    const now = performance.now() / 1000;
    _color.set(ZONES[zi].leaf);
    for (let bi = 0; bi < this.bushes.length; bi++) {
      const b = this.bushes[bi];
      if (b.zone !== zi) continue;
      for (let k = 0; k < 3; k++) this.folIM.setColorAt(bi * 3 + k, _color);
      for (const cl of b.clusters) this._seedCluster(cl, now);
    }
    if (this.folIM.instanceColor) this.folIM.instanceColor.needsUpdate = true;
    this.cherryIM.instanceColor.needsUpdate = true;
  },

  // state cherry: 0 gone, 1 flower, 2 green, 3 ripe, 4 over
  _setState(ch, st, at) {
    ch.state = st; ch.at = at || 0;
    const s = st === 1 ? 0.5 : st === 2 ? 0.75 : st === 0 ? 0.0001 : 1.0;
    _dummy.position.copy(ch.pos); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(s, s, s);
    _dummy.updateMatrix(); this.cherryIM.setMatrixAt(ch.inst, _dummy.matrix);
    _color.set(st === 1 ? COL.cherryFlower : st === 2 ? COL.cherryGreen : st === 3 ? ZONES[ch.zone].ripe : st === 4 ? COL.cherryOver : 0x000000);
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
      this.readyIM.setColorAt(i, _color.set(ZONES[this.bushes[i].zone].ripe));   // Fase 3: tint zona
    }
    if (this.readyIM.instanceColor) this.readyIM.instanceColor.needsUpdate = true;
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
    const gIM = new InstancedMesh(new ConeGeometry(0.09, 0.42, 5), stdMat(0x5FA968), 150);
    let placed = 0, guard = 0;
    while (placed < 150 && guard++ < 1500) {
      const x = rand(-13, 89), z = rand(-13, 13);
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

  /* ---- Fase 3: wash station + dryer racks PER ZONA, visual digabung IM ----
     Semua bagian statis 3 stasiun dirender dengan 8 InstancedMesh bersama
     (base, air, bin, pad, gate, ring, foam, rak) -> hemat draw call.
     Data per stasiun di this.stations[zi]; WashSys menunjuk stasiun aktif. */
  buildStations(S) {
    this.stations = [];
    const woodMat = stdMat(0x8A5A3B);
    const baseIM = new InstancedMesh(new BoxGeometry(1, 1, 1), woodMat, 9);
    baseIM.castShadow = true; baseIM.receiveShadow = true; baseIM.frustumCulled = false;
    const waterIM = new InstancedMesh(new PlaneGeometry(1, 1),
      new MeshStandardMaterial({ color: COL.water, transparent: true, opacity: 0.78, roughness: 0.25 }), 6);
    waterIM.frustumCulled = false;
    const binIM = new InstancedMesh(new CylinderGeometry(0.55, 0.45, 0.9, 10), stdMat(COL.defectBin), 3);
    binIM.castShadow = true; binIM.frustumCulled = false;
    const padIM = new InstancedMesh(new RingGeometry(1.7, 2.3, 28),
      new MeshBasicMaterial({ color: 0xFFD34D, transparent: true, opacity: 0.75, side: DoubleSide }), 3);
    padIM.frustumCulled = false;
    const gateIM = new InstancedMesh(new BoxGeometry(0.9, 0.5, 0.12), stdMat(COL.hazard), 6);
    gateIM.castShadow = true; gateIM.frustumCulled = false;
    gateIM.instanceMatrix.setUsage(DynamicDrawUsage);
    const ringIM = new InstancedMesh(new RingGeometry(0.35, 0.5, 20),
      new MeshBasicMaterial({ color: 0xFFD34D, transparent: true, opacity: 0.9, side: DoubleSide }), 3);
    ringIM.frustumCulled = false;
    ringIM.instanceMatrix.setUsage(DynamicDrawUsage);
    const foamIM = new InstancedMesh(new PlaneGeometry(0.5, 0.12),
      new MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 }), 30);
    foamIM.frustumCulled = false;
    foamIM.instanceMatrix.setUsage(DynamicDrawUsage);
    const rackIM = new InstancedMesh(new BoxGeometry(1, 1, 1), stdMat(0xC9A86A), 6);
    rackIM.castShadow = true; rackIM.receiveShadow = true; rackIM.frustumCulled = false;
    this.stBaseIM = baseIM; this.stGateIM = gateIM; this.stRingIM = ringIM; this.stFoamIM = foamIM;
    this.dryerRacks = [];

    const setBox = (im, i, x, y, z, sx, sy, sz) => {
      _dummy.position.set(x, y, z); _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(sx, sy, sz); _dummy.updateMatrix(); im.setMatrixAt(i, _dummy.matrix);
    };
    const setPlane = (im, i, x, y, z, sx, sy) => {
      _dummy.position.set(x, y, z); _dummy.rotation.set(-Math.PI / 2, 0, 0);
      _dummy.scale.set(sx, sy, 1); _dummy.updateMatrix(); im.setMatrixAt(i, _dummy.matrix);
    };

    for (let zi = 0; zi < ZONES.length; zi++) {
      const off = ZONES[zi].xOff, z = 9.1;
      // trough utama + cabang DEFECT + dermaga GOOD
      setBox(baseIM, zi * 3 + 0, 5.0 + off, 0.35, z, 9, 0.3, 1.2);
      setBox(baseIM, zi * 3 + 1, 3.0 + off, 0.35, z + 1.1, 1.2, 0.3, 2.2);
      setBox(baseIM, zi * 3 + 2, 1.0 + off, 0.35, z, 1.6, 0.25, 1.6);
      // air
      setPlane(waterIM, zi * 2 + 0, 5.0 + off, 0.62, z, 9, 0.9);
      setPlane(waterIM, zi * 2 + 1, 3.0 + off, 0.62, z + 1.1, 0.9, 2.2);
      // bin DEFECT
      setBox(binIM, zi, 3.0 + off, 0.45, z + 2.6, 1, 1, 1);
      // rak jemur (2 per zona)
      setBox(rackIM, zi * 2 + 0, -1.2 + off, 0.5, 8.0, 2.2, 0.22, 1.4);
      setBox(rackIM, zi * 2 + 1, -1.2 + off, 0.5, 10.2, 2.2, 0.22, 1.4);
      const r0 = new Vector3(-1.2 + off, 0.62, 8.0); r0.zone = zi;
      const r1 = new Vector3(-1.2 + off, 0.62, 10.2); r1.zone = zi;
      this.dryerRacks.push(r0); this.dryerRacks.push(r1);
      // foam disembunyikan dulu (ditulis WashSys tiap frame)
      for (let i = 0; i < 10; i++) {
        _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
        foamIM.setMatrixAt(zi * 10 + i, _dummy.matrix);
      }
      const st = {
        zi: zi, xOff: off, z: z,
        POUR: new Vector3(9.5 + off, 0, z), FORK: new Vector3(3.0 + off, 0, z),
        GOOD_DOCK: new Vector3(1.0 + off, 0, z), DEFECT_DOCK: new Vector3(3.0 + off, 0, z + 2.6),
        padPos: new Vector3(11.1 + off, 0, z),
        foamCx: 6.25 + off, foamLen: 6.5, foamBase: zi * 10,
        gateGoodI: zi * 2, gateDefectI: zi * 2 + 1, ringI: zi, padI: zi,
        gateGoodPos: new Vector3(2.8 + off, 0.85, z - 0.75),
        gateDefectPos: new Vector3(3.35 + off, 0.85, z + 0.75),
        baseRyGood: 0.5, baseRyDefect: -0.5, swingGood: 0, swingDefect: 0,
      };
      this.stations.push(st);
      this.gateMatrix(st, true); this.gateMatrix(st, false);
      this.ringMatrix(st, 0);
    }
    S.add(baseIM); S.add(waterIM); S.add(binIM); S.add(padIM);
    S.add(gateIM); S.add(ringIM); S.add(foamIM); S.add(rackIM);
    this.stPadIM = padIM;
    this.pulsePads(0);
  },

  // posisi/rotasi satu pintu air ke IM bersama (dipakai WashSys saat swing)
  gateMatrix(st, isGood) {
    const sw = isGood ? st.swingGood : st.swingDefect;
    const base = isGood ? st.baseRyGood : st.baseRyDefect;
    const p = isGood ? st.gateGoodPos : st.gateDefectPos;
    _dummy.position.copy(p);
    _dummy.rotation.set(0, base + Math.sin(sw * Math.PI) * 0.7, 0);
    _dummy.scale.set(1, 1, 1); _dummy.updateMatrix();
    this.stGateIM.setMatrixAt(isGood ? st.gateGoodI : st.gateDefectI, _dummy.matrix);
    this.stGateIM.instanceMatrix.needsUpdate = true;
  },

  // ring highlight fork: scale<=0 = sembunyi
  ringMatrix(st, scale) {
    if (scale > 0) {
      _dummy.position.set(st.FORK.x, 0.7, st.z);
      _dummy.rotation.set(-Math.PI / 2, 0, 0);
      _dummy.scale.set(scale, scale, 1);
    } else {
      _dummy.position.set(0, -99, 0); _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(0.001, 0.001, 0.001);
    }
    _dummy.updateMatrix();
    this.stRingIM.setMatrixAt(st.ringI, _dummy.matrix);
    this.stRingIM.instanceMatrix.needsUpdate = true;
  },

  // pad tuang berdenyut (semua zona)
  pulsePads(now) {
    for (let zi = 0; zi < this.stations.length; zi++) {
      const st = this.stations[zi];
      const s = 1 + Math.sin(now * 4 + zi * 1.3) * 0.07;
      _dummy.position.set(st.padPos.x, 0.03, st.padPos.z);
      _dummy.rotation.set(-Math.PI / 2, 0, 0);
      _dummy.scale.set(s, s, 1); _dummy.updateMatrix();
      this.stPadIM.setMatrixAt(st.padI, _dummy.matrix);
    }
    this.stPadIM.instanceMatrix.needsUpdate = true;
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
      this.items.push({ t: 1, dur: 0.5, p0: new Vector3(), p1: new Vector3(), p2: new Vector3(), dest: 'basket', data: true, zone: 0 });
      _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(i, _dummy.matrix);
      this.im.setColorAt(i, _color.set(COL.cherryRipe));
    }
    this.im.instanceColor.needsUpdate = true;
    S.add(this.im);
  },
  spawn(from, to, dest, data, zone) {
    for (let i = 0; i < this.MAX; i++) {
      const f = this.items[i];
      if (f.t < 1) continue;
      f.t = 0; f.dur = rand(0.4, 0.55); f.dest = dest || 'basket'; f.data = data; f.zone = zone || 0;
      f.p0.copy(from); f.p2.copy(to);
      f.p1.copy(from).lerp(to, 0.5); f.p1.y += 1.6;      // titik kontrol arc
      const cc = (f.dest === 'dryer') ? COL.beanDry
        : (f.data === false ? COL.cherryGreen : (f.dest === 'basket' ? ZONES[f.zone].ripe : COL.cherryRipe));
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
        else if (f.dest === 'dryer') DrySys.onBeanArrived(f.data, f.zone);
        else BasketSys.onCherryArrived(f.zone);
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
    // isi keranjang: cherry mini (8 lapis x 10 = 80 = kapasitas maks Fase 3),
    // visibility via .count = jumlah saat ini (dibatasi BasketSys.cap())
    const bc = new InstancedMesh(new SphereGeometry(0.07, 6, 5),
      new MeshStandardMaterial({ color: COL.cherryRipe, roughness: 0.55, flatShading: true }), 80);
    let bi2 = 0;
    for (let layer = 0; layer < 8; layer++) for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + layer * 0.3;
      const rr = 0.19 - (layer % 4) * 0.02;
      _dummy.position.set(Math.cos(a) * rr, -0.02 + (layer % 4) * 0.1, Math.sin(a) * rr);
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
    this.pos.x = clamp(this.pos.x + this.vel.x * dt, -13, 89);
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
  byZone: [0, 0, 0],                            // Fase 3: count per zona asal (harga karung)
  cap() { return UpgradeSys.basketCap(); },     // kapasitas efektif (base 40 + upgrade)
  batchZone() {                                  // zona mayoritas isi keranjang
    let bi = 0;
    for (let i = 1; i < 3; i++) if (this.byZone[i] > this.byZone[bi]) bi = i;
    return bi;
  },
  onCherryArrived(zone) {
    if (this.count >= this.cap()) return;
    this.count++;
    this.byZone[zone || 0]++;
    Player.basketCherries.count = this.count;
    AudioSys.pop();
    Hud.dirty = true;
  },
  get full() { return this.count >= this.cap(); },
  reset() {
    this.count = 0; this.quality = 100; this.good = 0; this.defect = 0;
    this.byZone[0] = 0; this.byZone[1] = 0; this.byZone[2] = 0;
    Player.basketCherries.count = 0; Hud.dirty = true;
  },
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
    let jx = 0, jy = 0;
    if (k.KeyA || k.ArrowLeft) jx -= 1;
    if (k.KeyD || k.ArrowRight) jx += 1;
    if (k.KeyW || k.ArrowUp) jy -= 1;
    if (k.KeyS || k.ArrowDown) jy += 1;
    if (jx === 0 && jy === 0) { this.mx = 0; this.mz = 0; return; }
    // mapping relatif kamera, SAMA seperti joystick: atas = arah pandang kamera.
    // (Dulu pakai sumbu dunia mentah -> di desktop terasa miring 90°.)
    Engine.camera.getWorldDirection(_v2); _v2.y = 0; _v2.normalize();
    this.mx = clamp(-_v2.z * jx + _v2.x * -jy, -1, 1);   // camRight.x*jx + camFwd.x*-jy
    this.mz = clamp(_v2.x * jx + _v2.z * -jy, -1, 1);    // camRight.z*jx + camFwd.z*-jy
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
      if (!SaveSys.data.zones[b.zone]) continue;   // Fase 3: zona terkunci tak bisa dipetik
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
    const cyc = UpgradeSys.pickCycle();
    const phase = (this.chargeT % cyc) / cyc;
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
      Flyers.spawn(_v1, bw, 'basket', wasRipe, cl.zone);
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
      const cyc = UpgradeSys.pickCycle();
      const phase = (this.chargeT % cyc) / cyc;
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
  markerEl: null, station: null,   // Fase 3: stasiun aktif untuk batch pemain
  init() { this.markerEl = document.getElementById('hut-marker'); },
  update(dt, now) {
    // pad semua zona berpijar
    World.pulsePads(now);
    // stasiun terdekat dari pemain (pemain bisa tuang di dermaga zona mana pun);
    // batch yang sedang berjalan mengunci stasiunnya sendiri
    let st = null, bestD = 1e9;
    _v1.copy(Player.pos); _v1.y = 0;
    for (const s of World.stations) {
      const d = _v1.distanceTo(s.padPos);
      if (d < bestD) { bestD = d; st = s; }
    }
    if (this.pouring && this.station) st = this.station;
    // marker "ke sini" saat keranjang penuh & wash bebas
    const show = BasketSys.full && !WashSys.busy() && !!st;
    this.markerEl.style.display = show ? 'block' : 'none';
    if (show) {
      _v1.copy(st.padPos); _v1.y = 3.4; _v1.project(Engine.camera);
      this.markerEl.style.left = ((_v1.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      this.markerEl.style.top = ((-_v1.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    }
    // tuang: berdiri di pad -> cherry terbang ke channel satu per satu
    const near = bestD < CFG.HUT_RADIUS;
    // Lanjutkan pour yang sedang berjalan (this.pouring); cegah batch baru saat wash sibuk.
    // Tanpa `|| this.pouring`, beginPour() membuat busy()=true di frame pertama
    // sehingga loop tuang tidak pernah jalan lagi -> deadlock (keranjang 40/40 selamanya).
    if (near && BasketSys.count > 0 && (!WashSys.busy() || this.pouring)) {
      if (!this.pouring) { this.pouring = true; this.station = st; WashSys.beginPour(st); AudioSys.splash(); }
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
    ['hud-cash', 'hud-basket', 'hud-quality', 'hud-sacks', 'hud-fps', 'hud-calls', 'hud-zone'].forEach(id => {
      this.el[id] = document.getElementById(id);
    });
  },
  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.el['hud-cash'].textContent = '$' + SaveSys.data.cash.toFixed(2);
    this.el['hud-basket'].textContent = BasketSys.count + '/' + BasketSys.cap();
    this.el['hud-quality'].textContent = BasketSys.quality;
    this.el['hud-sacks'].textContent = SaveSys.data.sacks;
    // Fase 3: zona tempat pemain berdiri
    const zi = clamp(Math.floor((Player.pos.x + 19) / 38), 0, 2);
    this.el['hud-zone'].textContent = ZONES[zi].variety;
  },
  fpsTick(dt) {
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.el['hud-fps'].textContent = Math.round(this.frames / this.fpsT);
      this.el['hud-calls'].textContent = Engine.renderer.info.render.calls;
      const zi = clamp(Math.floor((Player.pos.x + 19) / 38), 0, 2);
      this.el['hud-zone'].textContent = ZONES[zi].variety;
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
  else if (DrySys.maxZoneCount() >= CFG.ROAST_MIN_BEANS) key = 'hint_roast';
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
    PickerSys.update(dt);          // Fase 3: NPC picker (jalan juga saat pemain idle)
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
  PickerSys.init(Engine.scene);   // Fase 3
  HutSys.init();
  WashSys.init(Engine.scene);
  DrySys.init(Engine.scene);
  RoastSys.init();
  SackSys.init(Engine.scene);
  Hud.init();
  UpgradeSys.init();              // Fase 3 (tombol + modal upgrade)
  InputSys.init();
  applyI18n();
  refreshHint(true);
  Hud.update();
  OfflineSys.check();             // Fase 3: SEBELUM save pertama menimpa lastSave

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
  batchZone: 0, st: null, auto: false, pourTimer: 0,   // Fase 3: batch & stasiun aktif
  items: [], im: null,
  waitList: null, waitCount: 0,   // antrean index item di fork (FIFO)
  uiEl: null, foamT: 0, _ringOn: false,
  goodRouted: 0, defectRouted: 0,

  init(S) {
    this.setStation(World.stations[0]);
    const N = CFG.WASH_POOL;
    this.pourQueue = new Array(N);
    this.waitList = new Array(N);
    this.im = new InstancedMesh(new SphereGeometry(0.09, 6, 5),
      new MeshStandardMaterial({ roughness: 0.5, flatShading: true }), N);
    this.im.instanceMatrix.setUsage(DynamicDrawUsage);
    this.im.frustumCulled = false;
    for (let i = 0; i < N; i++) {
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
  },

  // Fase 3: arahkan POUR/FORK/dock ke stasiun zona aktif
  setStation(st) {
    this.st = st;
    this.POUR = st.POUR; this.FORK = st.FORK;
    this.GOOD_DOCK = st.GOOD_DOCK; this.DEFECT_DOCK = st.DEFECT_DOCK;
  },

  busy() { return this.pouring || this.flowing; },

  beginPour(st) {
    // pindahkan komposisi batch dari keranjang ke antrean tuang, diacak.
    // (good+defect = yang dipetik; bisa > count karena overflow -> potong)
    this.setStation(st || World.stations[0]);
    const capN = CFG.WASH_POOL;
    const g = Math.min(BasketSys.good, capN), d = Math.min(BasketSys.defect, capN);
    let n = 0;
    for (let i = 0; i < g && n < capN; i++) this.pourQueue[n++] = true;
    for (let i = 0; i < d && n < capN; i++) this.pourQueue[n++] = false;
    for (let i = n - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = this.pourQueue[i]; this.pourQueue[i] = this.pourQueue[j]; this.pourQueue[j] = tmp;
    }
    this.pourLen = Math.min(BasketSys.count, n);
    this.batchQuality = BasketSys.quality;
    this.batchZone = BasketSys.batchZone();   // Fase 3: harga karung ikut zona asal
    this.auto = false;
    this.pouring = true;
    this.goodRouted = 0; this.defectRouted = 0;
  },

  /* Fase 3: pour otomatis dari picker NPC. Keranjang pemain TIDAK disentuh;
     item diaktifkan langsung oleh timer di update() (tanpa flyer). */
  beginPourBatch(good, defect, quality, batchZone, station) {
    if (this.busy()) return false;
    this.setStation(station || World.stations[batchZone]);
    let n = 0;
    for (let i = 0; i < good && n < CFG.WASH_POOL; i++) this.pourQueue[n++] = true;
    for (let i = 0; i < defect && n < CFG.WASH_POOL; i++) this.pourQueue[n++] = false;
    for (let i = n - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = this.pourQueue[i]; this.pourQueue[i] = this.pourQueue[j]; this.pourQueue[j] = tmp;
    }
    this.pourLen = n;
    this.batchQuality = quality;
    this.batchZone = batchZone;
    this.auto = true;
    this.pourTimer = 0;
    this.pouring = true;
    this.goodRouted = 0; this.defectRouted = 0;
    AudioSys.splash();
    return true;
  },

  activateItem(sinker) {
    for (let i = 0; i < CFG.WASH_POOL; i++) {
      const it = this.items[i];
      if (it.active) continue;
      it.active = true; it.t = 0; it.sinker = !!sinker; it.mode = 0; it.qpos = 0;
      this.im.setColorAt(i, _color.set(it.sinker ? COL.cherryRipe : COL.cherryGreen));
      this.im.instanceColor.needsUpdate = true;
      return true;
    }
    return false;
  },

  onPourArrived(sinker) {
    if (!this.auto) HutSys.pourInflight--;
    this.activateItem(sinker);
  },

  endPour(resetBasket) {
    if (resetBasket !== false) BasketSys.reset();   // batch picker: jangan sentuh keranjang
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
    if (toGood) this.st.swingGood = 1; else this.st.swingDefect = 1;
    World.gateMatrix(this.st, toGood);
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
      _v2.copy(World.dryerRacks[this.st.zi * 2]); _v2.y = 1.2;   // rak zona stasiun ini
      const q = it.sinker ? this.batchQuality : Math.max(0, this.batchQuality - 10);
      if (!it.sinker) {
        Floaters.spawn(it.tx, 1.6, it.tz, t('contaminated'), 'bad');
        AudioSys.error();
      } else {
        Particles.burst(_v1, COL.water, 4, 1.5);
      }
      if (!Flyers.spawn(_v1, _v2, 'dryer', q, this.batchZone)) DrySys.onBeanArrived(q, this.batchZone);
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
    // foam selalu mengalir di SEMUA stasiun (ambient, 1 IM bersama)
    this.foamT += dt;
    for (let zi = 0; zi < World.stations.length; zi++) {
      const st = World.stations[zi];
      for (let i = 0; i < 10; i++) {
        const x = st.foamCx + st.foamLen / 2 - ((this.foamT * 1.1 + i * 0.73) % (st.foamLen + 1));
        _dummy.position.set(x, 0.64, st.z + ((i * 0.37) % 0.5) - 0.25);
        _dummy.rotation.set(-Math.PI / 2, 0, 0);
        _dummy.scale.set(1, 1, 1); _dummy.updateMatrix();
        World.stFoamIM.setMatrixAt(st.foamBase + i, _dummy.matrix);
      }
      // ayunan pintu air stasiun ini
      if (st.swingGood > 0) { st.swingGood = Math.max(0, st.swingGood - dt * 2.2); World.gateMatrix(st, true); }
      if (st.swingDefect > 0) { st.swingDefect = Math.max(0, st.swingDefect - dt * 2.2); World.gateMatrix(st, false); }
    }
    World.stFoamIM.instanceMatrix.needsUpdate = true;
    // Fase 3: pour otomatis picker — aktifkan item bertahap dari antrean
    if (this.auto && this.pouring) {
      this.pourTimer += dt;
      while (this.pourTimer >= 0.07 && this.pourLen > 0) {
        this.pourTimer -= 0.07;
        this.activateItem(this.pourQueue[--this.pourLen]);
      }
      if (this.pourLen === 0) this.endPour(false);
    }
    if (!this.flowing) {
      if (this._ringOn) { World.ringMatrix(this.st, 0); this._ringOn = false; }
      return;
    }

    let dirty = false, activeCount = 0;
    for (let i = 0; i < CFG.WASH_POOL; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      activeCount++;
      if (it.mode === 0) {
        it.t += dt / UpgradeSys.flowTime();   // Fase 3: Channel Flow upgrade
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
    if (this.waitCount > 0) {
      World.ringMatrix(this.st, 1 + Math.sin(now * 8) * 0.12);
      this._ringOn = true;
    } else if (this._ringOn) {
      World.ringMatrix(this.st, 0); this._ringOn = false;
    }
    if (activeCount === 0) {
      this.flowing = false;
      this.uiEl.style.display = 'none';
      if (this._ringOn) { World.ringMatrix(this.st, 0); this._ringOn = false; }
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
      _dummy.position.set(x, y, this.st.z);
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
  count: 0, qSum: 0,          // total hopper (semua zona) — kompat pembaca lama
  hop: [{ c: 0, q: 0 }, { c: 0, q: 0 }, { c: 0, q: 0 }],   // Fase 3: hopper per zona asal
  dryCol: null,
  init(S) {
    this.dryCol = new Color(COL.beanDry);
    // hopper persist per zona (SaveSys.load sudah migrasi save Fase 2 -> zona 0)
    for (let i = 0; i < 3; i++) {
      const e = SaveSys.data.dryZones[i] || { c: 0, q: 0 };
      this.hop[i] = { c: Math.max(0, Math.floor(e.c || 0)), q: Math.max(0, e.q || 0) };
    }
    this.syncTotals();
    const nSlots = World.dryerRacks.length * 28;   // 6 rak x 28 = 168
    this.im = new InstancedMesh(new SphereGeometry(0.07, 6, 5),
      new MeshStandardMaterial({ roughness: 0.6, flatShading: true }), nSlots);
    this.im.instanceMatrix.setUsage(DynamicDrawUsage);
    this.im.frustumCulled = false;
    let s = 0;
    for (const rack of World.dryerRacks) {
      for (let gx = 0; gx < 7; gx++) for (let gz = 0; gz < 4; gz++) {
        this.slots.push({
          active: false, t: 0, quality: 100, rackZone: rack.zone, beanZone: 0,
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
  syncTotals() {
    this.count = this.hop[0].c + this.hop[1].c + this.hop[2].c;
    this.qSum = this.hop[0].q + this.hop[1].q + this.hop[2].q;
  },
  addToHop(zone, quality) {
    this.hop[zone].c++; this.hop[zone].q += quality;
    this.syncTotals();
    this.saveHopper();
  },
  maxZoneCount() {
    return Math.max(this.hop[0].c, this.hop[1].c, this.hop[2].c);
  },
  // ambil batch roast dari zona dengan stok terbanyak (>= ROAST_MIN_BEANS)
  takeBatch() {
    let bi = -1;
    for (let i = 0; i < 3; i++) {
      if (this.hop[i].c >= CFG.ROAST_MIN_BEANS && (bi < 0 || this.hop[i].c > this.hop[bi].c)) bi = i;
    }
    if (bi < 0) return null;
    const h = this.hop[bi];
    const n = Math.min(h.c, CFG.ROAST_MAX_BEANS);
    const q = h.q / h.c;
    h.c -= n; h.q -= q * n;
    if (h.c <= 0) { h.c = 0; h.q = 0; }
    this.syncTotals();
    this.saveHopper();
    return { n: n, q: q, zone: bi };
  },
  onBeanArrived(quality, zone) {
    zone = zone || 0;
    // utamakan rak di zona asal biji; fallback rak bebas mana pun
    let pick = -1;
    for (let i = 0; i < this.slots.length; i++) {
      const sl = this.slots[i];
      if (sl.active) continue;
      if (sl.rackZone === zone) { pick = i; break; }
      if (pick < 0) pick = i;
    }
    if (pick >= 0) {
      const sl = this.slots[pick];
      sl.active = true; sl.t = 0; sl.quality = quality; sl.beanZone = zone;
      _dummy.position.set(sl.x, sl.y, sl.z); _dummy.scale.set(1, 1, 1);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      this.im.setMatrixAt(pick, _dummy.matrix);
      this.im.setColorAt(pick, _color.set(COL.cherryGreen));
      this.im.instanceMatrix.needsUpdate = true;
      this.im.instanceColor.needsUpdate = true;
      return;
    }
    this.addToHop(zone, quality);   // rak penuh -> langsung hopper
    refreshHint(true);
  },
  saveHopper() {
    for (let i = 0; i < 3; i++) SaveSys.data.dryZones[i] = { c: this.hop[i].c, q: this.hop[i].q };
    SaveSys.data.dryCount = this.count;
    SaveSys.data.dryQSum = this.qSum;
  },
  update(dt) {
    const dryT = UpgradeSys.dryTime();   // Fase 3: Dryer Speed upgrade
    let mDirty = false, cDirty = false;
    for (let i = 0; i < this.slots.length; i++) {
      const sl = this.slots[i];
      if (!sl.active) continue;
      sl.t += dt;
      if (sl.t >= dryT) {
        sl.active = false;
        this.addToHop(sl.beanZone, sl.quality);
        _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
        this.im.setMatrixAt(i, _dummy.matrix);
        mDirty = true;
        refreshHint(true);
      } else {
        _color.set(COL.cherryGreen).lerp(this.dryCol, sl.t / dryT);
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
  beans: 0, quality: 100, order: 1, batchZone: 0,   // Fase 3: zona asal batch (harga karung)
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
    if (this.active) return;
    const b = DrySys.takeBatch();   // Fase 3: batch dari satu zona (stok terbanyak)
    if (!b) return;
    this.start(b.n, b.q, b.zone);
  },

  start(n, q, zone) {
    this.active = true;
    this.beans = n; this.quality = q; this.batchZone = zone || 0;
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
    const price = ZONES[this.batchZone].price;   // Fase 3: harga ikut zona asal biji
    if (p >= b[0] && p <= b[1]) {
      const v = price * qm * CFG.ROAST_MATCH_MULT;
      SackSys.addSack(v, true);
      Floaters.spawn(World.roastDrumPos.x, 3.0, World.roastDrumPos.z, t('roast_match'), 'gold');
      AudioSys.ding();
    } else {
      const v = price * qm * CFG.UNDER_PENALTY;
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
      (!this.active && DrySys.maxZoneCount() >= CFG.ROAST_MIN_BEANS && SackSys.collectValue <= 0) ? 'block' : 'none';
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
    // --- progress roast (jalan di zona hijau; Fase 3: Drum Stability melebarkannya) ---
    const gLo = UpgradeSys.greenLo(), gHi = UpgradeSys.greenHi();
    if (this.temp >= gLo && this.temp <= gHi) {
      this.progress += dt * 2.0 * (0.6 + 0.4 * (this.temp - gLo) / (gHi - gLo));
    }
    // --- scorch (di atas zona hijau) ---
    if (this.temp > gHi) {
      this.scorch += dt * (this.temp - gHi) / 30;
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
   20. PICKER NPC — pekerja sewaan (§4.7 Fase 3)
   Auto selective-pick versi sederhana: hanya cherry matang (state 3), tanpa
   timing minigame. Angkut maks 12 -> tuang ke wash station zona panennya
   (WashSys.beginPourBatch — antrean wash yang sama seperti pour pemain,
   pemain tetap yang me-routing di fork). Jalan terus walau pemain idle.
   Visual: 1 InstancedMesh kotak bersama (3 picker x 6 bagian) = 1 draw call.
   ============================================================================ */
const PickerSys = {
  MAXP: 3, CARRY: 12, SPEED: 3.4, PICK_DT: 0.55,
  im: null, pickers: [],
  cols: [0x3E7CB1, 0xC96F2E, 0x7A4FA3],   // warna baju per picker
  // [x, y, z, sx, sy, sz] per bagian tubuh (lokal, hadap +z)
  partDef: [
    [0, 0.25, 0, 0.5, 0.5, 0.24],        // kaki/celana
    [0, 0.85, 0, 0.55, 0.65, 0.35],      // torso (baju berwarna)
    [0, 1.45, 0, 0.42, 0.42, 0.42],      // kepala
    [0, 1.62, 0, 0.95, 0.06, 0.95],      // brim topi jerami
    [0, 1.78, 0, 0.5, 0.25, 0.5],        // top topi
    [0, 1.0, -0.42, 0.55, 0.5, 0.3],     // keranjang punggung
  ],
  init(S) {
    this.im = new InstancedMesh(new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ roughness: 0.8, flatShading: true }), this.MAXP * this.partDef.length);
    this.im.instanceMatrix.setUsage(DynamicDrawUsage);
    this.im.castShadow = true; this.im.frustumCulled = false;
    for (let i = 0; i < this.MAXP; i++) {
      this.paintPicker(i);
      for (let k = 0; k < this.partDef.length; k++) {
        _dummy.position.set(0, -99, 0); _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
        this.im.setMatrixAt(i * this.partDef.length + k, _dummy.matrix);
      }
    }
    if (this.im.instanceColor) this.im.instanceColor.needsUpdate = true;
    S.add(this.im);
    for (let i = 0; i < this.count(); i++) this.spawn();
  },
  count() { return SaveSys.data.upg.picker || 0; },
  paintPicker(i) {
    const base = i * this.partDef.length;
    this.im.setColorAt(base + 0, _color.set(COL.pants));
    this.im.setColorAt(base + 1, _color.set(this.cols[i]));
    this.im.setColorAt(base + 2, _color.set(COL.skin));
    this.im.setColorAt(base + 3, _color.set(COL.straw));
    this.im.setColorAt(base + 4, _color.set(COL.straw));
    this.im.setColorAt(base + 5, _color.set(COL.jute));
  },
  spawn() {
    if (this.pickers.length >= this.MAXP) return;
    const zone = this.bestZone();
    const st = World.stations[zone];
    this.pickers.push({
      x: st.padPos.x + 1.5, z: st.padPos.z - 2.5, face: 0, bob: Math.random() * 6,
      state: 'seek', carry: 0, pickT: 0, target: null, zone: zone, idleT: 0,
    });
  },
  // zona terbuka dengan cherry matang terbanyak
  bestZone() {
    let bi = 0, bc = -1;
    for (let zi = 0; zi < 3; zi++) {
      if (!SaveSys.data.zones[zi]) continue;
      let c = 0;
      for (const ch of World.cherries) if (ch.zone === zi && ch.state === 3) c++;
      if (c > bc) { bc = c; bi = zi; }
    }
    return bi;
  },
  findRipe(p) {
    let best = -1, bestD = 1e18;
    for (let i = 0; i < World.cherries.length; i++) {
      const ch = World.cherries[i];
      if (ch.zone !== p.zone || ch.state !== 3) continue;
      let taken = false;
      for (const o of this.pickers) if (o !== p && o.target === i) { taken = true; break; }
      if (taken) continue;
      const dx = ch.pos.x - p.x, dz = ch.pos.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best < 0 ? null : best;
  },
  moveTo(p, tx, tz, dt, arrive) {
    const ad = arrive || 0.45;
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d <= ad) return true;
    const vx = dx / d, vz = dz / d;
    const step = Math.min(d - ad * 0.5, this.SPEED * dt);
    p.x += vx * step; p.z += vz * step;
    const want = Math.atan2(vx, vz);
    let dd = want - p.face;
    while (dd > Math.PI) dd -= Math.PI * 2;
    while (dd < -Math.PI) dd += Math.PI * 2;
    p.face += dd * Math.min(1, 12 * dt);
    return (d - step) <= ad;
  },
  stepPicker(p, dt, now) {
    p.bob += dt * 9;
    if (p.state === 'deliver') {
      const st = World.stations[p.zone];
      if (this.moveTo(p, st.padPos.x, st.padPos.z, dt)) {
        // sampai di pad: tuang ke wash (gagal bila wash sibuk -> tunggu di pad)
        if (WashSys.beginPourBatch(p.carry, 0, 100, p.zone, st)) {
          p.carry = 0; p.state = 'seek';
        }
      }
      return;
    }
    // state 'seek'
    if (p.carry >= this.CARRY) { p.state = 'deliver'; return; }
    if (p.target === null || World.cherries[p.target].state !== 3) {
      p.target = this.findRipe(p);
      if (p.target === null) {
        if (p.carry > 0) { p.state = 'deliver'; return; }
        // ladang zona ini kosong: tunggu dekat pad; lama-lama pindah zona
        p.idleT += dt;
        if (p.idleT > 6) { p.zone = this.bestZone(); p.idleT = 0; }
        const st = World.stations[p.zone];
        this.moveTo(p, st.padPos.x - 2, st.padPos.z - 3, dt);
        return;
      }
      p.idleT = 0;
    }
    const ch = World.cherries[p.target];
    if (this.moveTo(p, ch.pos.x, ch.pos.z, dt, 0.8)) {
      p.pickT += dt;
      if (p.pickT >= this.PICK_DT) {
        p.pickT = 0;
        if (ch.state === 3) {
          World._setState(ch, 0, now + rand(8, 14));   // sama seperti petik pemain
          p.carry++;
          SaveSys.data.stats.picked++;
          Particles.burst(ch.pos, ZONES[p.zone].ripe, 2, 1.6);
        }
        p.target = null;
        if (p.carry >= this.CARRY) p.state = 'deliver';
      }
    } else p.pickT = 0;
  },
  writePicker(i) {
    const p = this.pickers[i];
    const bobY = Math.abs(Math.sin(p.bob)) * 0.05;
    const cf = Math.cos(p.face), sf = Math.sin(p.face);
    for (let k = 0; k < this.partDef.length; k++) {
      const d = this.partDef[k];
      _dummy.position.set(
        p.x + d[0] * cf + d[2] * sf,
        d[1] + bobY,
        p.z - d[0] * sf + d[2] * cf);
      _dummy.rotation.set(0, p.face, 0);
      _dummy.scale.set(d[3], d[4], d[5]);
      _dummy.updateMatrix();
      this.im.setMatrixAt(i * this.partDef.length + k, _dummy.matrix);
    }
  },
  update(dt) {
    if (!this.pickers.length) return;
    const now = performance.now() / 1000;
    for (let i = 0; i < this.pickers.length; i++) {
      this.stepPicker(this.pickers[i], dt, now);
      this.writePicker(i);
    }
    this.im.instanceMatrix.needsUpdate = true;
  },
};

/* ============================================================================
   21. UPGRADES — modal & efek (§5 Fase 3)
   Formula biaya WAJIB: Math.floor(BaseCost * Math.pow(1.18, level)).
   Level 0 untuk semua efek = perilaku Fase 2 persis (tanpa regresi).
   ============================================================================ */
const UpgradeSys = {
  DEFS: [
    { key: 'pickSpeed', base: 50, max: 5 },
    { key: 'basketCap', base: 75, max: 5 },
    { key: 'dryerSpeed', base: 60, max: 5 },
    { key: 'drumStability', base: 80, max: 5 },
    { key: 'channelFlow', base: 60, max: 5 },
    { key: 'picker', base: 150, max: 3 },
  ],
  modalEl: null, listEl: null, cashEl: null, open: false,

  lvl(key) { return SaveSys.data.upg[key] || 0; },
  defOf(key) { for (const d of this.DEFS) if (d.key === key) return d; return null; },
  costOf(key) {
    const d = this.defOf(key);
    return Math.floor(d.base * Math.pow(1.18, this.lvl(key)));   // formula §5
  },
  isMax(key) { return this.lvl(key) >= this.defOf(key).max; },

  // --- efek upgrade (dipakai sistem lain) ---
  pickCycle() { return CFG.PICK_CYCLE * Math.pow(0.92, this.lvl('pickSpeed')); },
  basketCap() { return CFG.BASKET_CAP + 8 * this.lvl('basketCap'); },
  dryTime() { return CFG.DRY_TIME * Math.pow(0.85, this.lvl('dryerSpeed')); },
  flowTime() { return CFG.WASH_FLOW_TIME * Math.pow(0.88, this.lvl('channelFlow')); },
  greenLo() { return 150 - 3 * this.lvl('drumStability'); },
  greenHi() { return 225 + 5 * this.lvl('drumStability'); },

  init() {
    this.modalEl = document.getElementById('upgrade-modal');
    this.listEl = document.getElementById('upg-list');
    this.cashEl = document.getElementById('upg-cash');
    document.getElementById('btn-upgrades').addEventListener('click', () => { AudioSys.click(); this.show(); });
    document.getElementById('btn-upg-close').addEventListener('click', () => { AudioSys.click(); this.hide(); });
  },
  show() { this.open = true; this.modalEl.style.display = 'flex'; this.render(); },
  hide() { this.open = false; this.modalEl.style.display = 'none'; },
  render() {
    this.cashEl.textContent = '$' + SaveSys.data.cash.toFixed(2);
    let html = '';
    for (const d of this.DEFS) {
      const lv = this.lvl(d.key), mx = lv >= d.max;
      const cost = this.costOf(d.key);
      const afford = SaveSys.data.cash >= cost;
      html += '<div class="upg-row">'
        + '<div class="upg-info"><div class="upg-name">' + t('up_' + d.key)
        + ' <span class="upg-lvl">' + t('lvl') + ' ' + lv + '/' + d.max + '</span></div>'
        + '<div class="upg-desc">' + t('up_' + d.key + '_d') + '</div></div>'
        + (mx ? '<button class="upg-buy max" disabled>' + t('max') + '</button>'
          : '<button class="upg-buy" data-upg="' + d.key + '"' + (afford ? '' : ' disabled') + '>$' + cost + '</button>')
        + '</div>';
    }
    html += '<div class="upg-zones-title">' + t('zones_title') + '</div>';
    for (let zi = 1; zi < 3; zi++) {
      const z = ZONES[zi], owned = !!SaveSys.data.zones[zi];
      const afford = SaveSys.data.cash >= z.unlock;
      html += '<div class="upg-row">'
        + '<div class="upg-info"><div class="upg-name">' + z.name + ' · ' + z.variety + '</div>'
        + '<div class="upg-desc">$' + z.price + t('per_sack') + '</div></div>'
        + (owned ? '<button class="upg-buy max" disabled>' + t('owned') + '</button>'
          : '<button class="upg-buy" data-zone="' + zi + '"' + (afford ? '' : ' disabled') + '>' + t('unlock') + ' $' + z.unlock + '</button>')
        + '</div>';
    }
    this.listEl.innerHTML = html;
    const ub = this.listEl.querySelectorAll('button[data-upg]');
    for (const b of ub) b.addEventListener('click', () => this.buy(b.dataset.upg));
    const zb = this.listEl.querySelectorAll('button[data-zone]');
    for (const b of zb) b.addEventListener('click', () => this.unlockZone(+b.dataset.zone));
  },
  buy(key) {
    const d = this.defOf(key);
    if (!d || this.lvl(key) >= d.max) return;
    const cost = this.costOf(key);
    if (SaveSys.data.cash < cost) { AudioSys.error(); return; }
    SaveSys.data.cash -= cost;
    SaveSys.data.upg[key]++;
    if (key === 'picker') PickerSys.spawn();
    AudioSys.upgrade();
    Hud.dirty = true;
    SaveSys.save();
    this.render();
  },
  unlockZone(zi) {
    if (SaveSys.data.zones[zi]) return;
    const cost = ZONES[zi].unlock;
    if (SaveSys.data.cash < cost) { AudioSys.error(); return; }
    SaveSys.data.cash -= cost;
    SaveSys.data.zones[zi] = true;
    World.activateZone(zi);
    AudioSys.upgrade();
    Floaters.spawn(Player.pos.x, 2.4, Player.pos.z, ZONES[zi].name + '!', 'gold');
    Hud.dirty = true;
    SaveSys.save();
    this.render();
  },
};

/* ============================================================================
   22. OFFLINE EARNINGS (§5 Fase 3)
   gain = min(elapsed, 8 jam) x rate; rate = picker x 0.20 karung/menit
   x harga karung zona terbaik yang terbuka / 60 (per detik).
   Tanpa picker -> tidak ada penghasilan offline (picker = mesin idle-nya).
   Doubler 2x memakai mock overlay 3 detik (pola §6); SDK asli = Fase 4.
   ============================================================================ */
const OfflineSys = {
  CAP_SEC: 8 * 3600,
  modalEl: null, amtEl: null, gain: 0,
  rate() {
    const pk = SaveSys.data.upg.picker || 0;
    if (pk <= 0) return 0;
    let price = ZONES[0].price;
    for (let i = 0; i < 3; i++) if (SaveSys.data.zones[i]) price = Math.max(price, ZONES[i].price);
    return pk * 0.20 * price / 60;
  },
  compute(nowMs) {
    const last = SaveSys.data.lastSave || 0;
    if (!last) return { sec: 0, gain: 0 };
    const sec = Math.min(Math.max(0, (nowMs - last) / 1000), this.CAP_SEC);
    return { sec: sec, gain: sec * this.rate() };
  },
  check() {
    const r = this.compute(Date.now());
    this.gain = r.gain;
    if (r.sec < 300 || this.gain < 1) return;   // < 5 menit / < $1: tidak usah modal
    this.modalEl = document.getElementById('offline-modal');
    this.amtEl = document.getElementById('offline-amt');
    this.amtEl.textContent = '$' + this.gain.toFixed(2);
    this.modalEl.style.display = 'flex';
    document.getElementById('btn-off-collect').addEventListener('click', () => this.collect(1));
    document.getElementById('btn-off-double').addEventListener('click', () => this.showAd());
  },
  collect(mult) {
    if (this.gain <= 0) return;
    SaveSys.data.cash += this.gain * mult;
    this.gain = 0;
    if (this.modalEl) this.modalEl.style.display = 'none';
    const ad = document.getElementById('ad-overlay');
    if (ad) ad.style.display = 'none';
    AudioSys.cash();
    Hud.dirty = true;
    SaveSys.save();
  },
  showAd() {
    // mock ad: hitung mundur 3 detik lalu collect 2x (SDK asli Fase 4)
    const ad = document.getElementById('ad-overlay');
    const cnt = document.getElementById('ad-count');
    ad.style.display = 'flex';
    let n = 3;
    cnt.textContent = n;
    const iv = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(iv); this.collect(2); }
      else cnt.textContent = n;
    }, 1000);
  },
};

/* ============================================================================
   FASE 4 — SDK CRAZYGAMES v3, ACHIEVEMENTS, SHARE CARD, QA PORTAL
   -> SdkSys wrapper + mock; achievements; share 1080x1350.
   ============================================================================ */

// Entry point (di akhir agar semua sistem terdefinisi).
boot();
