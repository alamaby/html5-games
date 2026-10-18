# SPEC: Kopi Highlands — 3D Tactile Coffee Harvest, Single-File HTML5

> Rewrite dari "Canyon Sawmill" (versi kayu) menjadi **versi kopi**, atas ide
> dan keputusan user. Nama **"Kopi Highlands"** dipilih user 2026-10-18
> (collision-checked: bersih).
> Status: SPEC — belum ada build. Ditulis 2026-10-18.
> File ini menggantikan `~/workspace/html5-games/canyon-sawmill/SPEC.md`
> (versi kayu, disupersede).

## 0. Keputusan Kunci

| Sebelumnya (kayu) | Versi ini (kopi) | Alasan |
|---|---|---|
| Tebang pohon → papan → truk | **Petik cherry → wash channel → roast → karung → truk** | Ide user; analisis 2026-10-18: clone risk lebih rendah, 2 mekanik inti jadi lebih autentik |
| Timing chop (ring emas) | **Selective picking**: ring emas hanya valid di cluster matang; petik campur = Quality turun | Praktik asli *selective harvesting vs strip picking* |
| Hand-fed sawmill + heat | **Roasting drum + heat control** dengan momen ***First Crack*** | Mapping 1:1, lebih masuk akal: roasting memang soal kontrol panas |
| Flume + pintu air (buatan) | **Washing channel + pintu air** (pemisahan density: sinker vs floater) | Proses asli kopi washed — mekanik jadi autentik |
| Biome redwood canyon | **Kebun terasering highland golden-hour** | Siluet terasering beda dari halaman datar klon maupun canyon; cherry merah pop di atas hijau |
| Ekonomi datar ($/papan) | **Quality axis**: % cherry matang → grade → multiplier harga | Ekonomi lebih dalam dengan satu angka (Quality 0–100) |
| — | **Semesta "cherry to cup"** dengan Pour & Pressure | Game ini = hulu, Pour & Pressure = hilir. Cerita portofolio unik |
| Tetap | Single-file (`three@0.160.0` module-min inline via `build_inline.py`), CrazyGames primer + GameDistribution sekunder, portrait 9:16, EN/ID, 8 achievements, share card 1080×1350, SDK v3 | Standar portofolio tidak berubah |

**Copy portal**: hindari kata "tycoon/idle/empire/farm". Pimpin dengan
*"selective cherry picking"* dan *"roast to first crack"*.

---

## 1. Diferensiasi — Kenapa Ini Bukan Klon

| Aspek | Klon sejenis | Kopi Highlands |
|---|---|---|
| Game kopi yang ada | Coffee Farm (manajemen 2D), Coffee Mania (puzzle sort), Coffee Stack (stacker) — dicek 2026-10-18, **tidak ada** 3D tactile harvest di CrazyGames | Satu-satunya 3D cherry-harvest taktil |
| Panen | Tap/auto generik | **Selective picking**: bedakan merah matang vs hijau vs hitam overripe; skill check warna + timing |
| Pengolahan | Otomatis / tonton | **Wash channel density sorting** + **roast drum heat control** — dua-duanya proses kopi asli |
| Ekonomi | $/unit datar | **Quality 0–100** → multiplier harga; roast-match bonus dari order |
| Biome | Halaman hijau datar | **Terasering highland golden-hour** |
| Semesta | Berdiri sendiri | **"Cherry to cup"** — hulu dari Pour & Pressure |

**Aturan diferensiasi:**
1. Setiap aksi inti = skill check (warna/timing/panas/routing). Tidak ada "tonton saja".
2. Rantai produksi **tepat 3 stasiun taktil**: petik → wash → roast. Pulp & drying = otomatis/dilipat (anti scope creep).
3. Setiap screenshot: dominan **hijau terasering + merah cherry + amber golden-hour**.

---

## 2. Arsitektur Single-File

Sama dengan spec kayu (terbukti masuk akal, tinggal pakai):

```
kopi-highlands/
├── src/
│   ├── game.js            # seluruh game (vanilla JS, section banners)
│   ├── style.css          # UI overlay hand-CSS (tanpa Tailwind)
│   └── index.dev.html    # template dev
├── vendor/
│   └── three.module.min.js   # PIN: three@0.160.0
├── build_inline.py      # stdlib-only → dist/index.html
└── dist/
    └── index.html       # SATU file deliverable
```

- Trik inline: `three.module.min.js` + kode game dalam satu
  `<script type="module">` (`export` three tetap valid, binding in-scope).
  **Verifikasi di awal Fase 1**; fallback UMD `0.149.0` siap.
- Budget: ~640 KB (three) + ~200–250 KB (game+css) ≈ **< 1 MB**.
- Save key: `kh_save_v1`. Tanpa Vite/TS/Zustand/Tailwind/npm.

---

## 3. Visual Direction — Terraced Highland Golden-Hour

Renderer: `SRGBColorSpace`, `ACESFilmicToneMapping` exposure `1.15`,
`PCFSoftShadowMap` (dipertahankan — benar).

Lighting (golden-hour):
- **Hemisphere:** langit amber `#F7C873` / pantulan kebun `#5A7A3A`, `0.85`
- **Sun:** `#FFD9A0`, `1.4`, sudut rendah → bayangan panjang; shadow ortho
  `[-25,25,25,-25]`, `1024×1024`
- **Fog:** `FogExp2(0xF2C078, 0.012)` — kabut amber

Palet (`MeshStandardMaterial { roughness: 0.68, metalness: 0.05, flatShading: true }`):

| Elemen | Warna |
|---|---|
| Terasering (rumput) | `#4C9A5F` / tepi gelap `#2F6B3E` |
| Tanah teras | `#8A5A3B` |
| Daun kopi | `#2E7D46` |
| Cherry matang | `#E8452C` |
| Cherry mentah | `#7AB648` |
| Cherry overripe | `#6B2D1E` |
| Wash channel (air) | `#3FA7C4` |
| Drum roaster (baja) | `#B2B8C2`, hazard `#FF8E00`, bara `#FF7A1A` |
| Karung goni | `#C9A86A` |
| Biji roast | `#4A2C17` |
| Kemeja petani | `#FF4B4B` (standar pemain portofolio) |
| Bundle cash | `#2ECC71` |
| Pohon bonus emas | `#FFB800` (cluster cherry emas langka) |

Game juice: cherry **pop** particles saat dipetik (kompensasi feel "lembut" —
lihat §11 Risiko #1), squash-and-stretch cluster, keranjang sway (spring dari
velocity), drop-zone berpijar, uap roast.

---

## 4. Gameplay Loops (angka = tunable)

### 4.1 Petik selektif — pilar #1
- Dekati semak kopi → cluster cherry terlihat campuran: **merah** (matang),
  **hijau** (mentah), **hitam** (overripe).
- **Tahan tombol PICK** → ring menyusut (siklus 1,2 dtk). **Lepas di zona
  emas** → *clean pick*: hanya cherry merah yang terpetik, hijau tertinggal.
  Lepas di luar zona → *strip pick*: semua terpetik.
- **Quality** (per batch keranjang, mulai 100): −2 per cherry hijau,
  −1 per overripe. Clean pick sempurna = Quality utuh.
- Cluster emas langka: semua merah → selalu Perfect-able, 3× cherry.
- Cluster regrow: bunga → cherry hijau → merah (timer visual).

### 4.2 Keranjang anyam
- Cherry terpetik melengkung (bezier) ke keranjang di punggung.
  Kapasitas dasar **40 cherry** (upgradeable). Sway spring seperti backpack.

### 4.3 Wash channel — pilar #2 (density sorting)
- Tuang keranjang ke channel → cherry mengalir ~6 dtk.
- Cherry bagus (**sinker**) tenggelam; defect (**floater**) mengapung —
  terlihat jelas secara visual.
- **Tap pintu air** untuk routing: sinker → dermaga GOOD, floater → dermaga
  DEFECT (dijual murah sebagai low-grade, bukan dibuang — tanpa hukuman
  frustrasi).
- Upgrade: kecepatan aliran.

### 4.4 Roasting drum — pilar #3 (heat + First Crack)
- Muat biji GOOD ke drum → **jaga jarum panas di zona hijau** (drag/tilt
  kontrol).
- Pada ~196°C: ***FIRST CRACK!*** — bunyi pop khas + visual + SFX signature.
  Setelah first crack, order menentukan target: **light / medium / dark**
  (papan order di samping drum).
- Stop tepat di target → *roast-match* **+25% harga**. Terlalu jauh
  (gosong) atau terlalu dini (under) → penalti Quality batch.
- Heat > zona merah terlalu lama = batch gosong (batch hangus, mulai lagi —
  satu-satunya fail state kecil, dengan feedback jelas).

### 4.5 Drying beds — otomatis
- Biji GOOD dari wash channel otomatis ke penjemuran (rak bambu, timer
  visual). Upgrade mempercepat. Bukan stasiun taktil — disengaja.

### 4.6 Karung & truk
- Biji roast masuk karung goni (visual menumpuk) → truk datang saat ≥8 karung
  → muat → pergi → bundle cash → **tap untuk collect**.
- Harga dasar/karung: Arabika $12, Robusta $20, Liberika $35 (per zona §4.8).
  Final = dasar × **Quality multiplier (0,5×–1,5×)** × roast-match (1,25×).

### 4.7 Pekerja (lapisan idle)
- Hire picker: auto selective-pick versi sederhana (**tanpa** timing minigame —
  timing = privilege pemain), angkut ke wash channel. Maks 3.

### 4.8 Zona (varietas)
1. **Lower Terraces** — Arabika (awal)
2. **Upper Slopes** — Robusta (unlock $600)
3. **Cloud Forest** — Liberika premium (unlock $3.000)
Tiap zona: warna daun/biji sedikit beda + dermaga wash baru.

---

## 5. Ekonomi & Upgrade

- `Cost = Math.floor(BaseCost * Math.pow(1.18, level))`
- Upgrade pemain: Pick Speed (charge ring lebih cepat), Basket Capacity.
- Upgrade empire: Dryer Speed, Drum Stability (zona hijau lebih lebar),
  Channel Flow, Hire Picker, Zone Unlock.
- **Offline earnings**: `(now − lastSave)` × estimasi rate, cap 8 jam;
  **2× via rewarded ad** saat load.
- Save `localStorage` tiap 10 dtk + on hide.

---

## 6. Integrasi CrazyGames SDK v3 (+ GameDistribution)

- Deteksi `window.CrazyGames?.SDK`; absen → **mock ad overlay** (countdown
  3 dtk) untuk test lokal.
- Event: `sdkGameLoadingStart/Stop` (wajib QA), `gameplayStart()` input
  pertama, `gameplayStop()` menu/ad, `happytime()` saat unlock zona /
  **first roast-match**.
- Rewarded: **2× Revenue Overdrive** 120 dtk, **Master Roaster** 60 dtk
  (timing roast auto-sempurna), **VIP Truck** (cash = 60 dtk output maks),
  **Offline Doubler**.
- Midroll hanya via tombol/jeda alami.
- Varian GameDistribution: `dist-gd/` + GDSDK snippet (pola Tower Rush).

---

## 7. Performance (mobile)

- `setPixelRatio(Math.min(devicePixelRatio, 2))`
- `InstancedMesh` + pool: semak/cherry, partikel (pop, splash, uap, chaff),
  karung, cash. **Nol alokasi di rAF.**
- Pause loop + mute audio saat `document.hidden` / ad aktif.
- Satu directional light berbayang; target 60 fps mid-range, draw calls < 60.

---

## 8. Audio — Web Audio Synth

Cherry *pluk/pop*, **perfect ding**, first-crack **crackle pops**
(signature sound — micin timing roast), splash channel, drum hum
(pitch ikut panas), coin arpeggio, upgrade pop, UI click. Tanpa file eksternal.

---

## 9. Standar Portofolio

- **Bilingual EN/ID**: objek `STRINGS`, toggle di menu; default EN.
  Judul ID: "Kopi Highlands" (sama — kata "kopi" sudah Indonesia).
- **8 achievements**: First Perfect Pick, 50× Perfect Pick, 10× First Crack
  hit, Quality 95+ batch, unlock Upper Slopes, unlock Cloud Forest,
  3 picker, $10.000 terkumpul.
- **Share card 1080×1350**: snapshot canvas → composite (judul, cherry
  dipetik, perfect picks, quality terbaik) → unduh.
- **Portrait 9:16** primer.
- Semesta "cherry to cup": sebut Pour & Pressure di credit/about
  ("hilir" dari game ini) — tanpa janji cross-save.

---

## 10. Fase Build (tiap fase = playable + QA)

**Fase 1 — Petik & dunia.** Engine + verifikasi trik inline three r160 +
terasering + pemain + selective picking + keranjang + HUD.
*Exit: loop petik playable. **Gate khusus**: playtest HP — apakah cherry-pop
juice cukup memuaskan menggantikan "tebang"? Kalau tidak, tuning feel dulu
sebelum lanjut.*
**Fase 2 — Olah.** Wash channel + pintu air + dryer otomatis + roast drum +
First Crack + karung + truk + cash.
*Exit: loop cherry→roast→uang end-to-end playable.*
**Fase 3 — Empire.** Picker, upgrade modal, zona, ekonomi Quality, offline,
save. *Exit: progresi 15 menit terasa; offline doubler jalan.*
**Fase 4 — Portal.** SDK v3 + rewarded/mock + achievements + share card +
EN/ID + QA checklist CG + varian GDSDK.

## 11. Risiko & Non-Goals

- **Risiko #1 (feel):** petik lebih lembut dari tebang → mitigasi: juice
  cherry-pop agresif + combo streak + SFX pluk memuaskan; **gate playtest
  HP di akhir Fase 1** sebelum bangun sisanya.
- **Risiko #2 (scope):** rantai kopi asli panjang → disiplin **3 stasiun
  taktil** (§1 aturan #2); pulp & drying otomatis, tidak bisa ditawar.
- **Risiko #3 (teknis):** trik inline three module — verifikasi Fase 1,
  fallback UMD 0.149.0 siap.
- Non-goals: kata "tycoon/idle/empire/farm" di judul & copy; Poki;
  multiplayer; aset eksternal; bundler/TS.
