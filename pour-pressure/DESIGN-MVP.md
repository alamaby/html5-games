# Pour & Pressure — Dokumen Desain MVP

**Status:** konsep, disetujui untuk MVP (2026-10-15)
**Scope MVP:** 1 mode seduh (Pour-Over spiral), 1 chapter (Slow Bar), radar rasa 4 sumbu.
**Target build:** single-file `index.html`, portrait 9:16, Canvas 2D, WebAudio synth, bilingual EN/ID.
**Standar portofolio yang dipakai:** CrazyGames SDK v3 + GDSDK hooks, achievements, share-score card 1080×1350, localStorage save.

French Press (plunging) dan Signature/Whipping (zig-zag) adalah **chapter berikutnya**, bukan MVP. Fase gilingan sebagai slider **dihilangkan di MVP** — grind size jadi parameter tetap per order di kartu pesanan.

---

## 1. Struktur Sesi

- **1 Shift = 4 order** pelanggan. Estimasi durasi shift: 5–7 menit.
- **Chapter 1 (Slow Bar) = 5 shift = 20 order.** Shift N terbuka setelah shift N−1 selesai (bintang berapapun).
- **Iklan:** midroll / `showAd` **di antara shift**, tidak pernah di tengah order. (CrazyGames v3: `gameplayStart` saat order dimulai, `gameplayStop` saat hasil keluar, `happytime` saat ★★★.)
- **1 order = 60–90 detik** (target tuning; lihat §4).

## 2. Loop per Order (5 langkah)

```
[1 Kartu Order] → [2 Bloom ±15 dtk] → [3 Ekstraksi ±45 dtk] → [4 Stop] → [5 Radar + Skor]
```

**Langkah 1 — Kartu Order.** Menampilkan: nama + emoji pelanggan, nama minuman, mini radar target (4 sumbu), grind size (Fine/Medium/Coarse), suhu awal air, rasio target (1:14–1:16). Tombol "Mulai Seduh".

**Langkah 2 — Bloom.** Pemain **tahan jari** di touchpad untuk menuang sampai bloom meter penuh (±60 g air, ~7,5 dtk). Lalu **timer 8 detik otomatis** — gelembung CO₂ muncul (partikel canvas), pemain menunggu. Selama bloom, ekstraksi sudah berjalan pelan (simulasi §4).

**Langkah 3 — Ekstraksi (inti game).** Pemain menahan jari + **memutar pola spiral** di touchpad bawah. Kucuran air dirender di dripper tengah layar (offset cursor — jari tidak menutupi visual). Air mengalir selama jari menyentuh. Pemain memutuskan **kapan Stop**.

**Langkah 4 — Stop.** Tombol Stop besar di zona jempol. Ekstraksi berhenti, rasa "dikunci".

**Langkah 5 — Evaluasi Radar.** Radar 4 sumbu (Acidity, Sweetness, Bitterness, Body): poligon target pelanggan (transparan) vs poligon hasil (solid). Skor per sumbu → bintang 1–3 → koin + tip.

## 3. Layout Layar (Portrait 9:16)

```
Zona Info (20% atas)    : target radar mini, suhu live, timbangan digital (g), extraction %
Zona Kanvas (55% tengah): penampang atas dripper — bubuk kopi, pusaran air, gelembung, warna seduhan
Zona Jempol (25% bawah) : touchpad virtual + indikator flow/teknik + tombol Stop
```

**Touchpad = mode relatif** (seperti trackpad laptop): yang dipakai adalah *delta* gerakan jari, bukan posisi absolut. Ini mencegah lompatan kursor saat jari pertama menyentuh. Skala: 1 px gerakan jari ≈ 1 px gerakan kursor tuang di dripper.

**Panduan spiral:** garis spiral samar digambar di dripper sebagai panduan visual (bisa dimatikan di setting).

## 4. Simulation Engine (per frame, `requestAnimationFrame`)

Semua konstanta tuning terpusat di satu objek `CONFIG` — **satu-satunya file/tempat yang boleh diubah saat playtest.**

### 4.1 State per order

| Variabel | Satuan | Keterangan |
|---|---|---|
| `E` | % | Ekstraksi (0–30). Variabel rasa utama |
| `W` | g | Air dituang (0–360) |
| `T` | °C | Suhu slurry saat ini |
| `wet` | 0–1 | Saturasi bubuk (1.0 saat W ≥ 60 g) |
| `C` | 0–1 | Penalti channeling (akumulatif, permanen per order) |
| `G` | 0–1 | Penalti agitasi berlebih (akumulatif) |
| `pourOn` | bool | Jari menyentuh touchpad |
| `v` | px/s | Kecepatan jari (smoothed, EMA α=0.25) |
| `r` | px | Jarak kursor tuang dari pusat dripper |

### 4.2 Konstanta awal (CONFIG)

```js
DOSE = 20            // g kopi, tetap di MVP
TARGET_WATER = 300   // g, rasio 1:15
MAX_WATER = 360       // g, tuang lebih = over-dilusi
POUR_RATE = 8         // g/detik saat jari menyentuh
BLOOM_WATER = 60      // g untuk penuhnya bloom meter
BLOOM_WAIT = 8        // detik timer bloom
EXT_BASE = 0.55       // %/detik pada kondisi referensi
GRIND_EXT = { fine: 1.4, medium: 1.0, coarse: 0.75 }  // faktor ekstraksi
GRIND_BODY = { fine: 1.15, medium: 1.0, coarse: 0.85 } // faktor body
DRAWDOWN = { fine: 4.5, medium: 6.0, coarse: 8.0 }     // g/detik air lolos bed
BED_MAX = 120         // g; bed water di atas ini = flooding (bypass)
POUR_TEMP = 94        // °C suhu air tuang
AMBIENT = 78          // °C suhu target saat idle
```

### 4.3 Update per frame

```
// 1. Air & bed
if (pourOn && W < MAX_WATER) W += POUR_RATE * dt
wet = min(1, W / BLOOM_WATER)
bedWater += (pourOn ? POUR_RATE : 0) * dt - DRAWDOWN[grind] * dt   // clamp ≥ 0
flooding = bedWater > BED_MAX   // efisiensi ekstraksi turun, body turun

// 2. Suhu: tuang → mendekati POUR_TEMP; idle → meluruh ke AMBIENT
T += (pourOn ? (POUR_TEMP - T) * 1.5 : (AMBIENT - T) * 0.25) * dt
if (agitasiAktif) T -= 0.15 * dt

// 3. Ekstraksi
tempF  = 0.55 + 0.45 * clamp((T - 85) / 10, 0, 1)
flowF  = pourOn ? 1.0 : 0.35
floodF = flooding ? 0.6 : 1.0
E += EXT_BASE * wet * tempF * GRIND_EXT[grind] * flowF * floodF * dt   // E max 30

// 4. Channeling: diam di satu titik saat menuang
if (pourOn && v < 25) { dwell += dt } else { dwell = 0 }
if (dwell > 1.2) { C = min(1, C + 0.2); dwell = 0; efekVisualLubang(); peringatan("Channeling!") }

// 5. Agitasi berlebih: terlalu cepat ATAU menabrak dinding dripper
if (pourOn && (v > 900 || r > 0.85 * R_DRIPPER)) { G = min(1, G + 0.3 * dt); peringatan("Terlalu kasar!") }

// 6. Teknik (untuk tip): fraksi waktu tuang dengan 60 < v < 700 dan 0.15R < r < 0.85R
```

**Contoh alur angka (medium grind, main benar):** bloom 60 g (7,5 dtk, E≈+4) → tunggu 8 dtk (E≈+1,5) → tuang 240 g (30 dtk, E≈+15) → **E≈20,5% dalam ±46 dtk + waktu mikir = 60–75 dtk/order.** Sesuai target.

### 4.4 Kurva rasa (E dalam %)

```
acidity    = 100 * exp(-((E - 8)  / 9)²)      // puncak di 8%, lalu turun
sweetness  = 100 * exp(-((E - 20) / 7)²)      // puncak di 20% (sweet spot)
bitterness = 100 / (1 + exp(-(E - 24) / 2.5)) // sigmoid, melonjak > 24%
R          = W / DOSE                          // rasio aktual saat Stop
body       = 100 * clamp((22 - R) / 10, 0.15, 1)
                 * GRIND_BODY[grind]
                 * clamp(E / 18, 0.4, 1)       // under-extracted = body tipis
```

**Efek penalti (diterapkan saat Stop):**

```
acidity    = clamp(acidity + 22*C, 0, 100)
sweetness  = sweetness * (1 - 0.25*C)
bitterness = clamp(bitterness + 18*C + 20*G, 0, 100)
body       = body * (1 - 0.2*C) * (flooding ? 0.8 : 1)
```

Ini memodelkan fenomena nyata: channeling = asam DAN pahit naik bersamaan, manis turun.

### 4.5 Skor vs target pelanggan

Setiap sumbu punya `target` (0–100) dan `tol` (toleransi, default ±12):

```
skorSumbu = max(0, 100 - max(0, |aktual - target| - tol) * 2.5)
skorTotal = rata-rata 4 sumbu
★★★ ≥ 85   ★★ ≥ 70   ★ ≥ 50   (di bawah 50 = pelanggan kecewa, 0 bintang)
koin = 10 + bintang * 5 + round(teknik% * 0.1)
```

## 5. Pelanggan Chapter 1 — Slow Bar (5 arketipe)

| # | Pelanggan | Target (A / S / B / Body) | Cara menang |
|---|---|---|---|
| 1 | Ibu Rina — "body tebal, asam rendah, jangan terlalu pahit" | 30 / 55 / 40 / 75 | Medium grind, stop di E≈20, rasio 1:14 |
| 2 | Kaum fruity — "mau yang bright & ringan" | 75 / 60 / 25 / 55 (±14) | Coarse grind, stop awal E≈14–16 |
| 3 | Bapak tubruk — "pahit pekat!" | 25 / 35 / 75 (±12) / 85 | Fine grind, dorong ke E≈25–26, rasio 1:13.5 |
| 4 | Anak nongkrong — "yang manis seimbang" | 45 / 80 / 35 / 55 | Medium grind, sweet spot E≈19–21 |
| 5 | Food critic — "sempurna." (toleransi ±8) | 55 / 60 / 50 / 65 | Presisi penuh, tanpa penalti |

20 order di 5 shift memakai 5 arketipe ini dengan variasi suhu awal (90–96 °C) dan grind yang diputar — pemain belajar membaca kartu order, bukan menghafal.

## 6. Audio — WebAudio Synth (prosedural, tanpa aset)

| Event | Resep synth |
|---|---|
| Tuang air | White noise → bandpass filter; frekuensi 400–1200 Hz mengikuti tinggi kucuran, gain mengikuti `pourOn` |
| Bloom (gelembung) | Sine 600–900 Hz acak, decay 80 ms, tiap 200–500 ms selama timer bloom |
| Peringatan channeling/kasar | Square 180 Hz, 120 ms |
| Bintang hasil | Arpeggio triangle C5–E5–G5 |
| Tombol UI | Noise burst pendek via highpass |

## 7. Umpan Balik Visual Anti-Frustrasi (pelajaran dari TapBlaze)

- **Extraction meter selalu terlihat** (angka % + label, bukan cuma warna) — pemain tidak pernah bertanya "kok skornya jelek".
- **Warna seduhan** dari kuning pucat → cokelat gelap sebagai cue sekunder; selalu didampingi angka.
- **Peringatan real-time:** teks + ikon saat channeling ("Channeling! Gerakkan jarimu") dan agitasi ("Terlalu kasar!"), plus lubang visual di bed kopi.
- **Aksesibilitas:** jangan andalkan warna saja (buta warna); angka % dan label teks wajib.

## 8. Getaran — Fallback iOS

`navigator.vibrate` **tidak didukung Safari iOS**. Aturan: getaran hanya *pemanis* di Android; **sinyal utama selalu visual** (layar bergetar via canvas shake + indikator tekanan merah saat plunging/agitasi). Tidak ada mekanik yang bergantung pada getaran.

## 9. Meta-Game MVP

- **Achievements (8):** First Bloom · Sweet Spot (stop di 18–22%) · Surgeon Hands (teknik ≥95%, C=0) · Triple Star · Perfect Shift (4× ★★★) · Astringent Disaster (G=1, fail lucu) · Channel Chaos (3× channeling satu order) · Speed Barista (<60 dtk, ≥★★)
- **Save** (`localStorage pp_save_v1`): shift terbuka, bintang per order, koin, achievements, teknik terbaik.
- **Share card** 1080×1350: radar hasil + bintang + "Can you brew better?" (standar portofolio).
- **Bilingual EN/ID** untuk semua string UI (istilah kopi: Acidity/Keasaman, Sweetness/Kemanisan, Bitterness/Kepahitan, Body/Kekentalan).

## 10. Struktur File (single-file)

```
index.html
├── CONFIG            (semua konstanta §4.2 — satu-satunya titik tuning)
├── I18N             (dict EN/ID)
├── Audio            (synth engine §6)
├── Input            (touchpad relatif, pointer events, EMA velocity)
├── Sim              (update per frame §4.3, kurva rasa §4.4)
├── Render           (dripper, partikel, pusaran, radar, HUD)
├── Screens          (menu, kartu order, hasil, shift complete)
├── Save             (localStorage)
└── SDK              (CrazyGames v3 + GDSDK hooks)
```

## 11. Ceklist Playtest Tuning (wajib sebelum submit portal)

1. Bisakah pemain baru mencapai sweet spot (18–22%) dalam 3 order pertama?
2. Apakah channeling terpicu secara adil (tidak saat pemain sengaja pelan tapi bergerak)?
3. Apakah threshold agitasi (v > 900) tidak menghukum gerakan spiral normal?
4. Apakah suhu terasa bermakna (pemain yang mengulur waktu benar-benar terhukum)?
5. Apakah 5 arketipe pelanggan semuanya *achievable* ★★★ dengan main sempurna?
6. iOS: apakah semua feedback tetap jelas tanpa getaran?
7. Apakah satu order ≤ 90 detik untuk pemain yang sudah paham?
8. Apakah pemain selalu paham kenapa skornya turun (tidak ada "kok marah?")?

## 12. Estimasi & Langkah Berikutnya

- Ini build terbesar di portofolio sejauh ini — estimasi kasar **2–3× effort Tower Rush** (sim engine + 3 fase + radar + 20 order).
- Urutan build yang disarankan: **Sim engine (§4) → Bloom → Ekstraksi+touchpad → Radar+skor → Audio → Meta (shift/achievements/save) → SDK → i18n**.
- Setelah MVP live dan tuning stabil: Chapter 2 (French Press plunging) sebagai update konten.
