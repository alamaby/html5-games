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
