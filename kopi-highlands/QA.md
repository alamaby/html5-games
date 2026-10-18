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
