# SPEC: Canyon Sawmill — 3D Idle-Craft Kayu, Single-File HTML5

> **SUPERSEDED (2026-10-18):** konsep dialihkan ke kopi atas ide user.
> Spec aktif: **"Kopi Highlands"** di
> `~/workspace/html5-games/kopi-highlands/SPEC.md`.
> File ini dipertahankan sebagai arsip.

> Rewrite dari spec pihak ketiga "3D Idle Lumber Chop Empire" menjadi versi
> **single-file + diferensiasi**, sesuai standar portofolio.
> Status: SPEC — belum ada build. Ditulis 2026-10-17.

## 0. Keputusan Kunci (delta dari spec asli)

| Spec asli | Versi ini | Alasan |
|---|---|---|
| Vite + TypeScript + Zustand + Tailwind | Single `index.html`; dev di `src/`, ship via `build_inline.py` → `dist/index.html` | Standar portofolio: single-file, QA live-browser, ship cepat |
| Target CrazyGames + Poki | **CrazyGames primer, GameDistribution sekunder; Poki dicoret** | Poki menuntut eksklusivitas web ±5 tahun — konflik strategi multi-portal |
| Estetika "Voodoo/SayGames" generik, loop klon idle-lumber | **Biome golden-hour redwood canyon + loop taktil "craftsman"** (lihat §1) | Anti clone-reject — cf. penolakan Tower Rush; Timber Tycoon (loop identik: tebang→punggung→sawmill→truk→hire) sudah live di CrazyGames sejak Okt 2026 |
| Tanpa standar portofolio | **EN/ID, 8 achievements, share card 1080×1350, CrazyGames SDK v3, portrait 9:16** | Standar portofolio |
| 4 fase raksasa ("no placeholder") | 4 fase di-scope ulang; **tiap fase berakhir playable + QA checklist** | Kadensi ship-cepat; tiap fase bisa di-playtest di HP |

**Nama: Canyon Sawmill.** Dicek 2026-10-17, tidak ada game berjudul sama
(hasil pencarian hanya ngarai asli dan game Steam "Canyon" yang tidak related).
Judul ID: "Sawmill Ngarai" (subtitle saja, judul utama tetap EN untuk portal).

---

## 1. Diferensiasi — Kenapa Ini Bukan Klon

Fantasi inti digeser: bukan **"manager idle yang menonton conveyor"**
(Timber Tycoon / klon Voodoo), melainkan **"tukang kayu yang tangannya
bekerja"** — setiap mesin dioperasikan pemain lewat mini-loop taktil
skill-based. Lapisan idle (apprentice, upgrade, offline) tetap ada untuk
audiens idle, tapi *moment-to-moment play* menuntut skill dan screenshot
langsung terlihat beda.

| Aspek | Klon (Timber Tycoon / Voodoo) | Canyon Sawmill |
|---|---|---|
| Menebang | Auto-chop / tahan pasif | **Timing-based**: tahan tombol CHOP, lepas saat ring menyusut masuk zona emas → *Perfect!* (crit, 2× log) |
| Sawmill | Tonton conveyor jalan | **Hand-fed**: drag log melewati gergaji; ada heat meter — terlalu cepat = overheat/jam, stabil di zona hijau = *clean cut* bonus papan |
| Logistik | Forklift / conveyor datar | **Flume sungai + pintu air**: tap pintu untuk routing papan ke dermaga yang benar; salah rute = papan hanyut |
| Biome | Halaman hijau datar generik | **Redwood canyon golden-hour**: kabut amber, sungai, tebing sandstone, bayangan panjang |
| Kamera | Isometrik generik | Isometrik high-angle yang sama (familiar), tapi dunia vertikal canyon |

**Aturan diferensiasi (jangan dilanggar saat build):**
1. Setiap aksi inti pemain harus punya **skill check** (timing / kecepatan / routing) — tidak ada "tonton saja".
2. Setiap screenshot harus terbaca beda dari klon hijau: dominan **amber/oranye**, ada **sungai**, ada **tebing**.
3. Istilah "tycoon/empire/idle" dihindari di judul & copy portal.

---

## 2. Arsitektur Single-File

### 2.1 Layout dev → ship

```
canyon-sawmill/
├── src/
│   ├── game.js        # seluruh game (vanilla JS, section banners)
│   ├── style.css      # UI overlay (tanpa Tailwind — hand CSS)
│   └── index.dev.html# template dev (script terpisah, untuk iterasi cepat)
├── vendor/
│   └── three.module.min.js   # PIN: three@0.160.0 (lihat §2.2)
├── build_inline.py  # stdlib-only: inline vendor + src → dist/index.html
└── dist/
    └── index.html   # SATU file deliverable → portal & GitHub Pages
```

- **Tidak ada** Vite / TypeScript / Zustand / Tailwind / npm.
- State: satu objek `G` (vanilla) + update DOM langsung ala game portofolio lain.
- UI: DOM overlay + `<style>` inline (pola yang sama dengan 4 game sebelumnya:
  tombol arcade glossy, thumb-zone).
- `build_inline.py` kerjaannya sepele: baca template, ganti
  `<!--INLINE:three-->` / `<!--INLINE:game-->` / `<!--INLINE:css-->` dengan isi
  file. Tanpa dependensi.

### 2.2 Three.js: pin & trik inline

- **Pin `three@0.160.0`, file `three.module.min.js`** (~600–640 KB).
  Alasan: build UMD `three.min.js` dihapus setelah r159; r160 masih punya
  `outputColorSpace` API yang dipakai spec visual.
- Trik single-file: seluruh isi `three.module.min.js` + kode game digabung
  dalam **satu** `<script type="module">`. `export {...}` bawaan three tetap
  valid di top-level module, dan binding hasil export langsung in-scope untuk
  kode game di bawahnya. **Verifikasi trik ini di awal Fase 1** (risiko
  utama arsitektur).
- Fallback bila trik bermasalah: pin `three@0.149.0` UMD (`three.min.js`,
  global `THREE`, pakai `renderer.outputEncoding = THREE.sRGBEncoding`).
- Budget ukuran: ~640 KB (three) + ~200–250 KB (game+css) ≈ **< 1 MB**
  single HTML. Dapat diterima portal & GitHub Pages.

### 2.3 Struktur kode (section banners dalam game.js)

```
0. Boot & config          4. ProceduralAssets (mesh factory)
1. I18N (EN/ID)           5. Particles (InstancedMesh)
2. SaveManager            6. Systems: Chop, Saw, Flume, Truck, Apprentice, Economy
3. Engine (renderer/scene)7. UI: HUD, UpgradeModal, Achievements, ShareCard
                          8. SDK wrapper + main loop
```

---

## 3. Visual Direction — Golden-Hour Canyon

Renderer (dipertahankan dari spec asli, karena benar):
- `renderer.outputColorSpace = THREE.SRGBColorSpace`
- `renderer.toneMapping = THREE.ACESFilmicToneMapping`, exposure `1.15`
- `renderer.shadowMap.enabled = true`, `PCFSoftShadowMap`

Lighting (diubah ke golden-hour):
- **Hemisphere:** langit amber `#F7C873` / pantulan lantai canyon `#7A4A2B`, intensitas `0.85`
- **Sun directional:** hangat rendah `#FFD9A0`, intensitas `1.4`, sudut rendah
  → bayangan panjang khas golden hour; shadow camera ortho `[-25,25,25,-25]`,
  map `1024×1024`
- **Fog:** `THREE.FogExp2(0xF2C078, 0.012)` — kabut amber menyatu dengan langit

Palet (dilarang warna RGB mentah; material `MeshStandardMaterial`
`{ roughness: 0.68, metalness: 0.05, flatShading: true }`):

| Elemen | Warna |
|---|---|
| Tebing sandstone | `#C98A5B` |
| Lantai canyon / pasir | `#E8C47A` |
| Batang redwood | `#8B4A2B` |
| Dedaunan redwood (amber) | `#D98E32` / `#B5651D` |
| Zona pinus (aksen hijau) | `#2E8B57` |
| Sungai flume | `#3FA7C4` |
| Baja sawmill | `#B2B8C2` |
| Hazard paint | `#FF8E00` |
| Kemeja pemain | `#FF4B4B`, overall `#2F58CD` |
| Gelembung cash | `#2ECC71` |
| Pohon bonus emas | `#FFB800` |

Game juice (dipertahankan): squash-and-stretch elastic saat pohon kena tebang /
log mendarat / bangunan naik level; backpack sway berbasis spring dari
velocity & belokan; drop-zone berpijar dengan border dashed berdenyut.

---

## 4. Gameplay Loops (angka = tunable, bukan final)

### 4.1 Menebang — timing-based (pilar diferensiasi #1)
- Dekati pohon → mode tebang siap. **Tahan tombol CHOP** (thumb-zone kanan
  bawah) untuk charge; sebuah **ring menyusut** muncul di atas pohon (siklus
  1,2 dtk).
- **Lepas di zona emas** (±12% ring) → *PERFECT!*: damage 2× + woodchip burst
  besar + SFX ding. Lepas di luar zona → tebasan normal.
- Pohon punya HP + floating health bar + shake/squash tiap kena.
  HP: pinus 3, oak 5, redwood 8 (berkurang via upgrade Axe).
- Pohon tumbang → log mental dengan animasi pop → stump → sapling → pohon
  penuh (regrow timer visual).
- Pohon bonus emas (jarang): selalu Perfect-able, drop 3× log.

### 4.2 Backpack magnetik
- Jalan dekat log → log melengkung (bezier/parabola) ke punggung, stack
  vertikal. Kapasitas dasar **6** (upgradeable).
- Stack bergoyang (spring lag dari velocity & sudut belok).

### 4.3 Sawmill — hand-fed (pilar #2)
- Berdiri di pad infeed → log pindah dari punggung ke rel (arc parabola).
- **Drag log melewati gergaji** dengan jari. Meter kecepatan: zona hijau
  40–70%; >85% menaikkan **heat**; heat 100% = **jam** (cooldown 4 dtk).
- Selesaikan ≥80% feed di zona hijau → ***clean cut***: 1 log = **3 papan**
  (normal 2).
- Papan keluar ke pallet outfeed.

### 4.4 Flume + pintu air (pilar #3)
- Papan otomatis masuk flume sungai, mengalir ~6 dtk ke area dermaga.
- **2–3 pintu air** (sesuai zona terbuka); tap untuk toggle arah.
- Papan harus masuk **dermaga jenis kayunya** (Pine/Oak/Redwood).
  Salah rute → papan hanyut (hilang; feedback jelas, tanpa hukuman lain).
- Upgrade: kecepatan aliran flume.

### 4.5 Truk & cash
- Truk datang saat ada dermaga ≥10 papan → muat ≤20 → pergi → muncul
  **grid bundle cash 3D** di pad koleksi → **tap untuk collect** (magnet).
- Nilai: papan pinus $5, oak $12, redwood $30.

### 4.6 Apprentice (lapisan idle)
- Hire apprentice: auto-chop pohon pinus terdekat (versi sederhana, **tanpa**
  timing minigame — timing adalah privilege pemain), angkut 4 log ke infeed.
- Maks 3. Mereka menggerakkan ekonomi saat pemain fokus ke sawmill/flume.

### 4.7 Zona
1. **Pine Flats** (awal) → 2. **Oak Grove** (unlock $500) → 3. **Redwood Depths**
   (unlock $2.500). Tiap zona: pohon baru + dermaga flume baru + warna daun beda.

---

## 5. Ekonomi & Upgrade

- Formula biaya: `Cost = Math.floor(BaseCost * Math.pow(1.18, level))`
- Upgrade pemain: Axe Damage, Move Speed, Backpack Capacity.
- Upgrade empire: Saw Cooling (heat decay +), Flume Speed, Hire Apprentice,
  Zone Unlock.
- **Offline earnings**: `(now - lastSave)` × estimasi rate (apprentice + saw),
  cap 8 jam; opsi **2× via rewarded ad** saat load.
- Save: `localStorage` (`cs_save_v1`); simpan tiap 10 dtk + on hide.

---

## 6. Integrasi CrazyGames SDK v3 (+ GameDistribution)

- `src/sdk` menjadi section dalam game.js: deteksi `window.CrazyGames?.SDK`;
  bila absen → **mock ad overlay** (countdown 3 dtk) agar alur monetisasi
  bisa dites lokal — pola yang sama dipakai game lain.
- Event (nama API sudah benar di spec asli; **ditambah** yang kurang):
  `sdkGameLoadingStart/Stop` (wajib — CG QA cek loading),
  `gameplayStart()` pada input pertama, `gameplayStop()` saat menu/ad,
  `happytime()` saat unlock zona / upgrade sawmill.
- Rewarded placements: **2× Revenue Overdrive** 120 dtk, **Golden Saw** 60 dtk
  (1-hit chop, mesh gergaji emas), **VIP Truck** (cash = 60 dtk output maks),
  **Offline Doubler**.
- Midroll: hanya via tombol / jeda alami (bukan interupsi paksa) — aman QA.
- GameDistribution: bangun varian `dist-gd/` dari HTML yang sama + GDSDK
  snippet (mengikuti pola Tower Rush yang sudah dikerjakan).

---

## 7. Performance (mobile)

- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
- `InstancedMesh` + object pool untuk: pohon, log, papan, partikel
  (woodchip, splash, smoke), bundle cash. **Nol alokasi di dalam rAF loop.**
- Pause loop + clock + mute AudioContext saat `document.hidden` atau ad aktif.
- Satu directional light berbayang; lainnya no-shadow. Target: 60 fps di
  mid-range, draw calls < 60.

---

## 8. Audio — Web Audio Synth

Pola synth yang sama dengan game portofolio: chop (noise burst + thump),
**perfect ding** (pembeda!), saw (sawtooth + noise, pitch ikut kecepatan feed),
overheat warning, splash flume, coin arpeggio, upgrade pop, UI click.
Tanpa file audio eksternal.

---

## 9. Standar Portofolio

- **Bilingual EN/ID**: objek `STRINGS`, toggle di menu. Default EN (portal),
  ID satu tap.
- **8 achievements**: First Perfect, 50× Perfect, 100 pohon tumbang,
  clean-cut streak ×10, unlock Oak, unlock Redwood, 3 apprentice,
  $10.000 cash terkumpul.
- **Share card 1080×1350**: snapshot `renderer.domElement` (snapshot tepat
  setelah render / `preserveDrawingBuffer: true`) → composite dengan judul,
  statistik (pohon, perfect, cash) → unduh/gambar.
- **Portrait 9:16** primer; landscape didukung responsif (kamera menyesuaikan),
  bukan fokus desain.
- Copy portal: hindari kata "tycoon/idle/empire"; tonjolkan
  "timing-based chopping" & "hand-fed sawmill".

---

## 10. Fase Build (tiap fase = playable + QA)

**Fase 1 — Tebang & dunia.** Engine + trik inline three r160 (verifikasi dulu)
+ biome canyon + pemain + joystick + chop timing + pohon/regrow + backpack +
HUD (cash, kapasitas, FPS/drawcall). *Exit: playable loop tebang→tumpuk;
playtest HP: timing ring terasa adil.*
**Fase 2 — Olah & kirim.** Sawmill hand-fed + heat/jam + flume + pintu air +
dermaga + truk + cash collect. *Exit: full loop pinus (tebang→papan→uang)
playable end-to-end.*
**Fase 3 — Empire.** Apprentice + upgrade modal + zona Oak/Redwood + ekonomi +
offline + save. *Exit: progresi 15 menit terasa; offline doubler jalan.*
**Fase 4 — Portal.** SDK v3 wiring + rewarded/mock + achievements + share card
+ EN/ID + QA checklist CG (loading events, gameplay start/stop, nol console
error, perf HP mid-range) + varian GDSDK.

## 11. Risiko & Non-Goals

- Risiko #1: trik inline `three.module.min.js` — mitigasi: verifikasi di
  Fase 1, fallback UMD 0.149.0 sudah disiapkan.
- Risiko #2: tuning timing ring & heat meter butuh playtest jempol asli
  (seperti kasus threshold "Too rough!" di Pour & Pressure) — jangan finalkan
  angka tanpa playtest HP.
- Non-goals: Poki, multiplayer, aset eksternal, TypeScript/bundler,
  mode landscape sebagai fokus.
