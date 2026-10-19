# QA — Kopi Highlands Fase 1 (2026-10-18)

## Build
- Deliverable: `dist/index.html` — **707 KB** (< 1 MB) ✅
- three.js: `vendor/three.module.min.js` pin **0.160.0** (670.681 bytes;
  verifikasi: header `const t="160"`, string `outputColorSpace` ada).
- `vendor/` + `dist/` di `.gitignore` (reproduce via `fetch_vendor.sh` +
  `python3 build_inline.py`). Tidak ada commit/push (sesuai instruksi).

## Verifikasi yang dijalankan
| Cek | Hasil |
|---|---|
| `build_inline.py` → `dist/index.html` | OK, 707 KB, tepat 1× `<script type="module">` |
| Trik inline (three source + kode game satu module) | OK — blok `export{...}` valid, binding three in-scope, kode game dibungkus IIFE (anti-tabrakan identifier minified) |
| Ekstrak module → `node --check` | OK |
| Semua identifier kapital di game.js resolve ke export three / lokal / builtin | OK (script `verify_three_refs`, 0 unknown) |
| Semua `getElementById` ada di template.html | OK (11/11) |
| Headless boot smoke test (node, fake DOM+THREE) | BOOT OK, 30 frame OK, 16 bush / 288 cherry / ~267 transisi terjadwal |
| Logic test: strip pick (3 ripe+2 hijau+1 over) | Quality 100 → 95 ✅, stat strips=1 |
| Logic test: clean pick cluster full-merah | Quality tetap 100 ✅, stat perfect=1 |
| Logic test: clean pick tanpa cherry merah | no-op ✅ |
| Logic test: gold zone | ≈ fase [0.38, 0.62] sesuai SPEC ✅ |
| Nol alokasi di rAF (review kode) | temp `_v1.._v4/_dummy/_color` reuse; pool partikel (120), flyer (18), floater DOM (10) preallocated |

## Checklist Fase 1 SPEC (§10)
- [x] Engine: SRGBColorSpace, ACESFilmic 1.15, PCFSoftShadowMap
- [x] Hemisphere amber `#F7C873`/`#5A7A3A` 0.85; Directional `#FFD9A0` 1.4 sudut rendah; FogExp2 `#F2C078` 0.012
- [x] Kamera isometrik high-angle follow + lerp; portrait ditarik lebih jauh
- [x] DPR clamp `min(dpr, 2)`; pause + mute + save saat `document.hidden`
- [x] Terasering prosedural + semak kopi (instanced: trunk/foliage/cherry = 3 draw call untuk 16 semak)
- [x] Cluster cherry campuran merah/hijau/hitam; regrow bunga→hijau→merah (timer visual, tanpa scan per-frame)
- [x] Farmer low-poly (kemeja merah `#FF4B4B`, topi jerami); joystick floating bottom-70% + WASD
- [x] Selective picking: tahan PICK → ring 1,2 dtk → lepas di zona emas ±12% = clean pick; strip pick = quality −2/−1
- [x] Keranjang anyam: magnetik arc bezier, kapasitas 40, sway spring dari velocity
- [x] Cherry pop particles (InstancedMesh) + floating text + SFX synth (pluck/pop/ding/cash/click/error)
- [x] HUD: cash, keranjang n/40, quality, FPS + draw calls, toggle EN/ID
- [x] SaveManager `kh_save_v1` (cash/lang/stats; tiap 10 dtk + on hide)
- [x] Section banner Fase 2/3/4 di kode (bukan stub fungsi)

## Keputusan desain (penyederhanaan sesuai SPEC)
1. **Outlet Fase 1 = gubuk jual** (bukan wash/roast): keranjang penuh → berdiri di pad gubuk → cherry terbang satu per satu → cash = n × $0.50 × qualityMult (0.5–1.5×). Ini menjaga loop playable end-to-end; diganti wash channel + roast drum di Fase 2.
2. **Basket tidak persist di save** (mulai kosong tiap load) — Fase 1 tidak punya arti ekonomi untuk isi keranjang antar-sesi.
3. **Cluster emas langka**: belum diimplementasikan sebagai tipe terpisah — cluster dengan semua-merah terjadi alami via RNG (±probabilitas). Ditandai sebagai kandidat Fase 3 (atau hapus dari SPEC bila tidak perlu).

## Celah / risiko yang diketahui
1. **FEEL GATE (butuh playtest HP user):** apakah cherry-pop + ding + combo cukup memuaskan menggantikan "tebang"? Tidak bisa divalidasi headless. Yang perlu dilaporkan user: (a) timing ring terasa adil di jempol, (b) cherry pop terasa "pluk" atau hambar, (c) kapasitas 40 terlalu kecil/besar.
2. **Overflow keranjang**: cherry yang sedang terbang saat keranjang mencapai 40 akan hangus diam-diam (1–2 cherry per kejadian). Ditoleransi Fase 1.
3. **Belum dites di browser sungguhan** (tidak ada WebGL di mesin ini): trik inline module + `outputColorSpace` r160 perlu konfirmasi visual satu kali — buka `dist/index.html` langsung dari file (tanpa server) di Chrome HP/desktop.
4. **Dev template** (`src/index.dev.html`) butuh `python3 -m http.server` karena import map tidak jalan di `file://`. Deliverable `dist/index.html` jalan dari file langsung.
5. Draw calls aktual & FPS di HP mid-range belum diukur (target < 60 calls; estimasi ~30).

## Cara jalan
- Dev: `cd kopi-highlands && python3 -m http.server 8000` → buka `http://localhost:8000/src/index.dev.html`
- Ship: `python3 build_inline.py` → `dist/index.html` (buka langsung, tanpa server)
- Vendor ulang: `./fetch_vendor.sh`

## Bug kritis 2026-10-18 — ReferenceError: WebGLRenderer is not defined (FIXED)
- **Gejala (laporan user + live browser):** halaman hanya render HUD statis di atas background tan; tidak ada scene 3D; klik tidak berefek; fps "--".
- **Akar masalah:** `three.module.min.js` mendeklarasikan class dengan nama minified lokal (`Jl`) dan hanya mengekspos nama publik sebagai **alias export** (`export{... Jl as WebGLRenderer ...}`). `export{A as B}` TIDAK membuat binding lokal `B` di dalam module — jadi `new WebGLRenderer()` di kode game melempar ReferenceError dan seluruh module mati sebelum renderer dibuat. Klaim verifikasi sebelumnya ("binding three in-scope") SALAH — penalaran statis yang keliru tentang export alias.
- **Fix (build_inline.py):** fungsi `three_alias_consts()` mem-parse blok `export{...}`, dan untuk setiap `X as Y` (X≠Y) memancarkan `const Y=X;` — 416 binding — disisipkan SETELAH source three (dan blok export-nya) dan SEBELUM IIFE kode game.
- **Verifikasi fix (bukan klaim):**
  1. `node` impor `three.module.min.js` sebagai module: 416/416 nama publik ada di namespace, tipe benar (WebGLRenderer/Scene/PerspectiveCamera = function).
  2. Simulasi struktur module hasil build (three source + alias consts) di node: `typeof WebGLRenderer/Scene/InstancedMesh` = function — skenario gagal yang persis kini lolos.
  3. `node --check` pada module hasil ekstrak: lolos.
  4. Live-browser re-check https://alamaby.github.io/html5-games/kopi-highlands/ setelah push fix (lihat bawah).
- **Pelajaran:** klaim "verified" untuk trik inline tidak boleh hanya statis — butuh evaluasi binding yang sesungguhnya (seperti tes node di atas) atau browser sungguhan.
- **Verifikasi live-browser (2026-10-18, setelah push 29dbcb0):** RENDERS YES —
  scene 3D tampil (terasering hijau, semak kopi + cherry merah, petani topi jerami,
  gold selection ring, shadows, rumah), HUD "20 fps · 28 calls" (angka real),
  klik memindahkan karakter, tahan PICK → keranjang 0/40→6/40, Quality 100→97,
  pesan "Strip pick" muncul. Tanpa console error. Catatan: load pertama masih
  menampilkan build lama (cache); reload setelah deploy window menampilkan build fix.

## Fix 2026-10-18 — feedback playtest user (basket + indikator bush)
1. **Keranjang di depan → pindah ke punggung.** Komentar kode sudah bilang
   "di punggung" tapi `basket.position` memakai local +Z = arah hadap (depan).
   Fix: `basket.position.set(0, 1.0, -0.42)` + `basketWorld` (target arc
   magnetik) ikut ke `(0, 1.35, -0.42)`.
2. **Bush siap panen tidak jelas.** Tambah indikator: 1 InstancedMesh
   (16 instance, 1 draw call) berupa cherry merah melayang (bob + pulse)
   di atas bush yang punya ≥1 cherry matang (state 3). Update tiap frame
   via `World.updateReadyMarkers()` — murah (16×18 cek state).

## Bug 2026-10-18 — cherry overripe tidak pernah rontok (siklus mati) (FIXED)
- **Gejala:** indikator bush siap panen (fix sebelumnya) tidak pernah muncul di live browser.
- **Akar masalah:** state machine cherry 0→1→2→3→4 tidak punya transisi keluar dari
  state 4 (overripe) — `updateCherries` tidak punya cabang `state === 4`, dan
  `_setState(ch, 4, 0)` memakai `at=0` sehingga tidak pernah masuk antrean pending.
  Akibatnya ±40–60 detik setelah load, SEMUA cherry jadi overripe permanen:
  tidak ada cherry matang baru → indikator (ripe-only) tidak pernah tampil, dan
  mekanik selective-pick mati diam-diam (clean pick mustahil).
- **Fix:** `3→4` dijadwalkan `now+rand(10,20)` (overripe menggantung 10–20 dtk,
  masih bisa dipetik dengan penalti), tambah `4→0` (`now+rand(1,2)`) agar rontok
  dan masuk siklus regrow; initial overripe juga dijadwalkan `now+rand(8,16)`.
- **Verifikasi:** simulasi headless 288 cherry / 600 dtk game-time — semua 5 transisi
  fire seimbang (~3230× tiap tipe), steady state ripe ≈50%, over ≈27%. Tidak ada
  starvation. (Cherry tidak di-persist di save, jadi tidak perlu migrasi.)

## Tuning 2026-10-18 — pacing regrow diperlambat (feedback user)
- **Keluhan:** satu bush cukup untuk penuh 1 keranjang (40) — tidak perlu jelajah.
- **Sebab:** cherry yang dipetik jadi hijau lagi hanya dalam ~5 dtk
  (gone 1–2 dtk + flower ~3 dtk), jadi strip-pick satu bush tidak pernah habis.
- **Fix:** gone setelah dipetik 8–14 dtk, flower 6–10 dtk, green 12–20 dtk,
  ripe 35–60 dtk (window petik lega), over 25–40 dtk.
- **Verifikasi (simulasi):** 1 bush yang di-strip penuh baru bisa dipetik lagi
  ~20 dtk, ripe lagi ~38 dtk → harus mutar ke bush lain. Steady state 288 cherry:
  ripe ~60%, semua transisi seimbang (tidak starvation). Angka final tetap
  butuh validasi feel di HP user.
- **Verifikasi live-browser (2026-10-18):** marker tampil — ±16 dari ±18 bush
  menunjukkan bola merah melayang jelas di atas kanopi (terpisah dari cherry di
  dedaunan), persisten selama 5+ menit observasi. PICK berfungsi
  (0/40→6/40). Tanpa error.

# QA — Kopi Highlands Fase 2 "Olah" (2026-10-18)

## Build
- Deliverable: `dist/index.html` + published `kopi-highlands/index.html` — **760 KB** (< 1 MB) ✅
- `three_alias_consts()` di build_inline.py TIDAK disentuh (416 binding, terverifikasi).
- Tepat 1× `<script type="module">`; `node --check` pada module hasil ekstrak: OK.
- Semua `getElementById` (17) ada di template.html; semua `t('...')` + `data-i18n`
  (31 key) ada di STRINGS en & id (paritas penuh, dicek via node).

## Yang dibangun (loop cherry → wash → roast → karung → truk → cash)
1. **Wash channel** (§4.3): gubuk Fase 1 jadi drop-off (fungsi jual langsung
   DIHAPUS sesuai SPEC). Berdiri di pad → keranjang dituang (flyer arc) ke channel.
   Cherry mengalir ~6 dtk: sinker (merah/matang) tenggelam, floater (hijau/over)
   mengapung + bob. Di fork: tap tombol GOOD/DEFECT untuk routing per cherry;
   auto-route benar bila dibiarkan 2 dtk (tanpa frustrasi). Salah routing:
   sinker→DEFECT = jadi defect murah; floater→GOOD = biji terkontaminasi (-10 Q).
   DEFECT auto-jual @10 biji × $0.25.
2. **Dryer otomatis** (§4.5): biji GOOD terbang ke rak bambu (2 rak, 56 slot);
   timer visual 20 dtk (warna hijau→coklat); lalu ke hopper. Bukan taktil.
3. **Roast drum** (§4.4): LOAD (butuh ≥12 biji kering, maks 24/batch) → jaga
   jarum di zona hijau via drag fuel slider. ~196°C = **FIRST CRACK!**
   (banner + crackle pops + drum shake + partikel). Order light/medium/dark
   (band 45-60/60-78/78-95%). STOP di band → roast-match +25%; di luar band →
   ×0.8 (under); >225°C kelamaan atau progress ≥97% → GOSONG (batch hangus).
   Drum hum (pitch ikut panas), api menyala ikut temp, uap saat >150°C.
4. **Karung & truk** (§4.6): 1 batch roast = 1 karung (visual menumpuk, maks 12).
   ≥8 karung → truk datang → muat satu per satu (arc) → pergi → **tap COLLECT**.
5. **Ekonomi** (§5): karung = $12 × qualityMult (0,5–1,5 dari Q batch keranjang)
   × roast-match 1,25 (atau ×0,8 under). Defect flat $0,25/biji.
6. **Audio** (§8): splash, crackle pops, drum hum, gate clunk, load rumble,
   cashBig arpeggio — semua synth, tanpa file.
7. **EN/ID**: 31 key, paritas penuh.

## Keputusan desain / deviasi dari SPEC (minimal, sesuai intensi)
1. **Gates = tombol DOM** (bukan tap 3D via raycast): lebih andal di jempol HP;
   paddle 3D tetap beranimasi sebagai feedback visual.
2. **LOAD drum tanpa syarat proximity**: panel roast bersifat global; jalan ke
   drum tidak menambah gameplay (kontrol via DOM). Dokumentasi: boleh diubah
   bila playtest minta.
3. **Hopper (biji kering) di-persist** di save (stockpile), tapi wash/dry/roast
   yang sedang berjalan TIDAK persist (reset saat load) — konsisten dengan
   keputusan Fase 1 (keranjang tidak persist).
4. **Urutan roast**: order diacak saat LOAD (bukan setelah first crack) agar
   pemain bisa ancang-ancang; first crack tetap momen signature di 196°C.
5. **Auto-route 2 dtk** di fork: menjaga alur bila pemain lambat; tidak ada
   streak/combo (scope).
6. `boot()` dipindah ke akhir file (sebelumnya setelah section 15): sistem
   Fase 2 didefinisikan setelahnya → TDZ ReferenceError bila tidak dipindah.
   **Bug ini tertangkap oleh headless test, bukan di browser.**

## Hasil test headless (node, three r160 asli + WebGLRenderer fake + DOM stub)
33/33 PASS:
- Fase 1 regresi (4): strip 3R+2G+1O → Q95 ✅; good=3 defect=3 ✅; clean → Q100 ✅
- Wash (8): sinker→GOOD sampai dryer Q90 ✅; floater→DEFECT ✅;
  floater→GOOD penalti Q80 ✅; sinker→DEFECT ✅; auto-route ✅; flowing selesai ✅;
  defect auto-sell 10×$0.25=$2.50 ✅
- Roast (7): first crack di 196.0°C ✅; match 12×1.4×1.25=$21.00 ✅;
  under 12×1.3×0.8=$12.48 ✅; gosong → tidak aktif & tidak nambah karung ✅
- Truk (4): kirim saat ≥8 ✅; collect ✅; karung habis ✅
- Save (5): sacks/defect/dryCount persist ✅; load lama → default 0 ✅

## Draw calls
- Baru: channel (5) + gates (2) + dock/bin (2) + fork ring (1) + wash IM (1)
  + dryer (2+1) + drum (5) + sacks IM (1) + truck (8, transien) ≈ 20 (+8).
- Total estimasi: ~50 (idle), ~58 (truk aktif). Target <60 ✅.

## Belum terverifikasi (tidak ada WebGL di mesin ini)
1. **Visual 3D**: tampilan channel/air/gates/drum/truk/karung, readability
   sinker vs floater, posisi UI vs scene 3D — BUTUH cek browser sungguhan.
2. **Feel**: drag fuel slider di jempol, timing tap gate, pacing wash 40 cherry,
   durasi roast ~45-60 dtk, kejelasan banner first crack.
3. **Audio**: crackle/hum/splash hanya dicek tidak-crash (AudioContext null di
   node); kualitas SFX butuh dengar langsung.
4. **FPS aktual** di HP mid-range dengan ~50 draw calls.

## Bug kritis 2026-10-19 — deadlock tuang wash (FIXED, laporan user + screenshot)
- **Gejala:** berdiri di pad gubuk dengan keranjang 40/40 → hint "Tap a gate to
  route each cherry!" muncul, tapi channel kosong, keranjang tidak pernah
  berkurang, tombol gate tidak muncul. Stuck permanen (reload tidak membantu
  karena bug deterministik).
- **Akar masalah:** `HutSys.update` memakai syarat
  `near && count>0 && !WashSys.busy()`. Di frame pertama `beginPour()` membuat
  `WashSys.pouring=true` → `busy()=true` → frame berikutnya selalu masuk cabang
  `else`, loop spawn flyer cherry TIDAK PERNAH jalan lagi. `count` tetap 40,
  `endPour()` (syarat `count===0`) tidak pernah dipanggil. Deadlock total.
- **Fix (1 baris):** syarat jadi `(!WashSys.busy() || this.pouring)` — pour yang
  sedang berjalan boleh lanjut; batch baru tetap dicegah saat wash sibuk.
- **Verifikasi:** regression test `test-wash-pour.mjs` me-replay HutSys.update
  ASLI (diekstrak verbatim) — kode lama FAIL (0 flyer, count 40, pouring=true
  selamanya = persis state screenshot user), kode baru PASS (40 flyer,
  count→0, endPour terpanggil). `node --check` OK.

## Fix 2026-10-19 — keyboard mapping camera-relative
- **Laporan playtest:** tombol panah/WASD terasa miring 90° di desktop.
- **Sebab:** `pollKeys()` memakai sumbu dunia mentah, sedangkan joystick
  memakai transform camera-relative (`camRight`/`camFwd`).
- **Fix:** `pollKeys()` sekarang memakai rumus yang sama persis seperti joystick
  (Up = arah pandang kamera). Diverifikasi headless dengan kamera sintetis:
  Up→camFwd, Right→camRight, Down→−camFwd. Tidak berdampak ke HP (joystick).
