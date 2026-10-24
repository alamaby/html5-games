# Generator Acak — Level 1 Alibi Breaker

> **Status:** Terimplementasi di `index.html` pada 24 Oktober 2026 (lokal,
> belum di-push). Mode Asli / Acak / Harian / Seed sudah ada di layar
> briefing, dengan generator + validator murni di antara marker
> `GENERATOR-START`–`GENERATOR-END` dan test di
> `tests/test_generator.mjs` (25/25 lolos, headless).
> Catatan implementasi: (1) ID clue kasus acak memakai `cctv`, sedangkan
> kasus asli memakai `cctv-bima` — keduanya valid karena UI membaca ID
> dari kasus aktif, bukan ID hardcode; (2) cek validator V10
> diimplementasikan sebagai "hint tidak menyebut nama pelaku/korban",
> sesuai definisi hint di §6.4 yang memang menyebut objek log, bukan
> sebagai cek label clue pematah secara harfiah.
> **Acuan:** `DESIGN.md` §5.1 (Kasus 1 asli), §6.2 (kasus harian prosedural),
> §7.1 (struktur data + validasi), dan bentuk `CASE` di `index.html`
> (pelaku, pematah, tersangka, clue, hint, rantai logika).
> **Judul kerja game:** *Alibi Breaker* (bukan final).

---

## 1. Tujuan dan batasan

### 1.1. Tujuan

Pemain yang sudah menyelesaikan Level 1 bisa memainkan Level 1 lagi dan
mendapat kasus yang terasa baru — nama, setting, jam, urutan, dan (yang
paling penting) siapa pelakunya bisa berbeda — tanpa membuat kasus yang
tidak terpecahkan, ambigu, atau tidak adil.

### 1.2. Yang diacak di v1 ini

- Skin setting (4 pilihan, lihat §4).
- Nama tersangka dan nama korban (dari pool, tanpa duplikat dalam satu kasus).
- Peran pelaku, dari 2 peran yang memenuhi syarat per skin (lihat §4).
- Jam, dengan constraint waktu (lihat §5) — bukan acak bebas per clue.
- Urutan tampil tersangka dan clue (shuffle dengan seed).
- Seed kasus, sehingga satu varian bisa diulang persis atau dibagikan
  lewat kode seed (lihat §7).

### 1.3. Yang TIDAK diacak di v1 ini (non-goal)

- Skeleton logika. Generator ini hanya untuk skeleton A Level 1:
  **"mengaku tidak keluar vs log pintu"** (lihat §3). Skeleton Kasus 2
  (red herring + gabung 2 clue) dan Kasus 3 (alibi berdua) adalah
  generator terpisah, bukan varian dari dokumen ini.
- Jumlah tersangka (tetap 4) dan jumlah clue (tetap 5).
- Jenis bukti: tetap 1 pematah + 1 pendukung + 3 bukti pembela dengan
  tipe yang sama (CCTV, patroli/log, sudah-pergi-sebelum-jendela).
- Cerita bebas / narasi baru yang ditulis AI. Semua kalimat berasal dari
  template di §6, bukan dari teks bebas.

Alasan batasan ini: kalau skeleton-nya ikut diacak di v1, validator tidak
bisa lagi menjamin satu jawaban yang adil. Variasi skeleton adalah
pekerjaan Level 2–3, bukan Level 1.

---

## 2. Prinsip desain (tidak boleh dilanggar implementasi)

1. **Output generator = bentuk `CASE` yang sama persis dengan Level 1
   yang sudah ada.** Field `id`, `culprit`, `breakingClue`, `suspects[]`,
   `clues[]`, `hints[]`, `logic_id`, `logic_en` harus sama strukturnya,
   sehingga UI di `index.html` tidak perlu diubah untuk menampilkan kasus
   acak. Generator hanya mengganti *isi* `CASE`, bukan *bentuknya*.
2. **ID clue tetap stabil:** `akses`, `sidik`, `cctv`, `patroli`,
   `parkir`. Yang berubah adalah label dan detailnya per skin, bukan
   ID-nya. Ini menjaga test lama (`tests/test_level1.mjs`) tetap
   relevan dan mencegah bug karena ID baru yang tidak dikenali UI.
3. **Satu jawaban, satu pematah.** Selalu tepat satu clue dengan
   `breaks == culprit`, dan tepat satu clue pendukung (`sidik`).
4. **Setiap non-pelaku punya tepat satu bukti pembela independen,**
   dengan tipe bukti yang berbeda satu sama lain (CCTV, patroli, pergi
   duluan). Tidak ada non-pelaku yang gugur hanya karena motif atau
   firasat.
5. **Tidak ada placeholder yang bocor.** Setelah generate, tidak boleh
   ada `{nama}`, `{ruang}`, atau sejenisnya yang tersisa di teks ID
   maupun EN. Ini dicek validator (V8) dan test.
6. **Hint tidak pernah menyebut nama pelaku, nama korban, atau label
   clue pematah secara harfiah.** Hint 1 mengarah ke jenis clue, hint 2
   menunjuk objek log (bukan orang).
7. **Deterministik per seed.** Seed yang sama → kasus yang sama persis
   (termasuk urutan shuffle). Seed berbeda → biasanya kasus berbeda,
   tetapi tidak dijamin selalu berbeda di semua field (lihat §8 tentang
   distribusi).

---

## 3. Skeleton A — "Mengaku tidak keluar vs log pintu"

Skeleton ini adalah abstraksi dari Kasus 1 asli. Semua varian generator
adalah instansiasi dari skeleton ini, bukan cerita baru.

### 3.1. Peran (bundle) dalam satu kasus

Setiap kasus selalu terdiri dari 4 bundle berikut, masing-masing diisi
satu orang:

| Bundle | Klaim tersangka | Bukti yang mematahkan / membela | Tipe clue |
|---|---|---|---|
| **NEVER** (pelaku) | Berada di `archiveRoom` dari `claimStart` sampai `windowEnd`, tidak keluar sama sekali. | Log `accessObject` membuka pintu `crimeRoom` pada `breakingTime` (di dalam jendela). | `akses` = pematah |
| — (pendukung pelaku) | — | Sidik jari pelaku di gagang pintu `crimeRoom`. Mendukung log, bukan pematah. | `sidik` = pendukung |
| **CCTV** (bukan pelaku) | Berada di ruangan lain yang terpantau CCTV selama jendela. | Rekaman CCTV ruangan lain pada `cctvTime` (di dalam jendela). | `cctv` = pembela |
| **PATROL** (bukan pelaku) | Patroli / berkeliling selama jendela. | Cap/log di tempat lain pada menit yang *sama persis* dengan `breakingTime`. | `patroli` = pembela |
| **LEFT** (bukan pelaku) | Sudah pulang / pergi sebelum jendela. | Struk/tiket/log keluar pada `leftReceipt`, plus rekaman gerbang pada `leftReceipt + 1 menit` — keduanya sebelum jendela. | `parkir` = pembela |

Catatan: bundle PATROL dan LEFT sengaja dibedakan. PATROL membuktikan
"di tempat lain pada menit yang sama", LEFT membuktikan "sudah pergi
sebelum kejadian". Kalau keduanya digabung, pemain tidak belajar
membedakan dua jenis pembela waktu yang berbeda.

### 3.2. Kenapa pelaku tidak bisa dari sembarang peran

Hanya peran staf yang plausibel memegang `accessObject` ke `crimeRoom`
dan bekerja di `archiveRoom` yang boleh menjadi pelaku. Mahasiswa,
pengunjung, klien, atau orang tua murid tidak boleh menjadi pelaku di
skeleton ini — kalau mereka tiba-tiba punya log kartu staf ke ruang
terlarang, kasusnya terasa dibuat-buat dan pemain yang teliti akan
merasa dicurangi, meskipun logikanya formal benar.

Karena itu §4 membatasi pelaku ke 2 peran staf per skin, dan peran
lainnya hanya boleh mengisi bundle CCTV / PATROL / LEFT yang sesuai
dengan perannya.

---

## 4. Skin setting dan pool peran

Setiap skin mendefinisikan: nama setting, `crimeRoom`, `archiveRoom`,
`accessObject`, peran korban, 2 peran pelaku yang memenuhi syarat,
dan pool peran pembela per bundle. Semua nama peran dan ruangan harus
memiliki versi ID dan EN (lihat §6).

### 4.1. Skin 1 — Perpustakaan (asli, seed 0)

- Setting ID: Perpustakaan kota. EN: City library.
- `crimeRoom`: Ruang Baca Utama / Main Reading Room.
- `archiveRoom`: Ruang Arsip / Archive Room.
- `accessObject`: Kartu Akses / Access Card.
- Korban: Penjaga Perpustakaan / Library Keeper.
- Pelaku yang memenuhi syarat (pilih 1): Pustakawan Senior / Senior
  Librarian; Asisten Pustakawan / Library Assistant.
- CCTV (pilih 1): Mahasiswa / Student (ruang belajar lantai 2);
  Peneliti Tamu / Visiting Researcher (ruang baca lantai 2).
- PATROL (tetap peran, nama acak): Satpam / Security Guard (koridor
  utara).
- LEFT (pilih 1): Pengunjung / Visitor; Anggota Perpustakaan / Library
  Member (keduanya dengan bukti parkir/gerbang).

Kasus asli (Lina, Bima, Pak Hadi, Rani) adalah instansiasi skin ini
dengan pelaku = Pustakawan Senior, CCTV = Mahasiswa, PATROL = Satpam,
LEFT = Pengunjung.

### 4.2. Skin 2 — Museum

- Setting ID: Museum. EN: Museum.
- `crimeRoom`: Ruang Pamer A / Gallery A.
- `archiveRoom`: Gudang Koleksi / Collection Storage.
- `accessObject`: Kartu Staf / Staff Card.
- Korban: Kurator / Curator.
- Pelaku (pilih 1): Asisten Kurator / Assistant Curator; Staf Konservasi
  / Conservation Staff.
- CCTV (pilih 1): Fotografer / Photographer (galeri B); Pengunjung
  Pameran / Exhibition Visitor (galeri B).
- PATROL: Satpam / Security Guard (koridor).
- LEFT (pilih 1): Pengunjung / Visitor; Sponsor Pameran / Exhibition
  Sponsor (keduanya dengan bukti tiket/parkir keluar).

### 4.3. Skin 3 — Kantor

- Setting ID: Kantor. EN: Office.
- `crimeRoom`: Ruang Rapat Utama / Main Meeting Room.
- `archiveRoom`: Ruang Arsip Dokumen / Document Archive.
- `accessObject`: Kartu Karyawan / Employee Card.
- Korban: Manajer Kantor / Office Manager.
- Pelaku (pilih 1): Staf Administrasi / Administration Staff; Asisten
  Manajer / Assistant Manager.
- CCTV (pilih 1): Karyawan Magang / Intern (ruang kerja lantai 2);
  Desainer / Designer (studio).
- PATROL: Satpam / Security Guard (koridor).
- LEFT (pilih 1): Klien / Client; Tamu Bisnis / Business Guest
  (keduanya dengan bukti resepsionis/parkir keluar).

### 4.4. Skin 4 — Sekolah (Laboratorium)

- Setting ID: Sekolah, laboratorium. EN: School laboratory.
- `crimeRoom`: Laboratorium Utama / Main Laboratory.
- `archiveRoom`: Gudang Alat / Equipment Storage.
- `accessObject`: Kartu Lab / Lab Card.
- Korban: Kepala Laboratorium / Laboratory Head.
- Pelaku (pilih 1): Laboran / Laboratory Technician; Asisten Lab /
  Laboratory Assistant.
- CCTV (pilih 1): Siswa / Student (perpustakaan sekolah); Guru Tamu /
  Guest Teacher (ruang belajar).
- PATROL: Satpam Sekolah / School Security Guard (koridor).
- LEFT (pilih 1): Orang Tua Murid / Parent; Pengunjung Sekolah / School
  Visitor (keduanya dengan bukti parkir/gerbang keluar).

### 4.5. Pool nama

Nama adalah proper noun, jadi sama di ID dan EN. Pool awal (16 nama,
boleh ditambah belakangan, tetapi tidak boleh dikurangi tanpa mengulang
test distribusi):

> Lina, Bima, Hadi, Rani, Dewi, Rizal, Sinta, Joko, Maya, Tono, Ardi,
> Putri, Fajar, Intan, Dimas, Tari

Aturan pakai pool:

- Dalam satu kasus, 4 nama tersangka harus berbeda satu sama lain.
- Nama korban harus berbeda dari keempat nama tersangka. Pool korban
  terpisah dan lebih kecil (nama dengan gelar yang sesuai skin, misalnya
  Pak Raka, Bu Ayu, Pak Dani, Bu Sari) — atau, kalau pool korban
  digabung, korban diambil dulu sebelum tersangka, lalu dikeluarkan
  dari pool tersangka untuk kasus itu.
- Nama tidak boleh memberi petunjuk pelaku (misalnya jangan pakai nama
  yang sama dengan peran, dan jangan pakai inisial yang membentuk
  pola). Pool di atas sengaja netral.
- Catatan kehati-hatian: beberapa nama di pool juga dipakai di Kasus 2
  dan 3 (Dewi, Rizal, Sinta, dan lain-lain). Itu tidak masalah selama
  dalam satu kasus tidak ada duplikat, tetapi saat Level 2–3 ikut
  digenerate, pool harus dicek ulang agar pemain tidak mengira
  "Dewi selalu terlibat".

---

## 5. Generasi waktu (constraint, bukan acak bebas)

Semua waktu dalam menit sejak tengah malam. Jendela kejadian selalu
10 menit, di malam hari, supaya nuansa "malam di gedung yang sudah
sepi" tetap terjaga dan tidak ada kasus yang jatuh lewat tengah malam.

### 5.1. Rumus

1. Pilih `windowStart` dari daftar: 19:30, 19:50, 20:00, 20:20, 20:50
   (dalam menit: 1170, 1190, 1200, 1220, 1250).
2. `windowEnd = windowStart + 10`.
3. `breakingTime = windowStart + 2` (log pintu pelaku).
4. `patrolTime = breakingTime` (cap/log di tempat lain, menit yang sama).
5. `cctvTime = windowStart + 7` (rekaman CCTV ruangan lain).
6. `leftReceipt = windowStart - 28`, `leftGate = leftReceipt + 1`,
   `leftClaim = leftReceipt - 2` (klaim "sudah pulang" sedikit sebelum
   struk, selisih perjalanan ke parkir/gerbang — sama seperti kasus
   asli: klaim 20:20, struk 20:22, gerbang 20:23).
7. `claimStart (pelaku) = windowStart - 20`, klaim pelaku berlaku
   sampai `windowEnd`.
8. `foundTime = windowEnd` (korban ditemukan di akhir jendela).
9. Rentang timeline yang ditampilkan: dari `leftClaim` sampai
   `windowEnd`. Jendela yang disorot di timeline: `windowStart`
   sampai `windowEnd`.

### 5.2. Contoh hitung (bukan hasil run, hanya ilustrasi rumus)

Jika `windowStart = 20:00`, maka:

- Jendela: 20:00–20:10, ditemukan 20:10.
- Log pintu pelaku: 20:02. Cap patroli: 20:02 (tempat lain).
- CCTV ruangan lain: 20:07.
- Struk pergi: 19:32, gerbang: 19:33, klaim pulang: 19:30.
- Klaim pelaku: di `archiveRoom` 19:40–20:10, tidak keluar.
- Timeline tampil: 19:30–20:10, sorotan 20:00–20:10.

Jika `windowStart = 20:50` (kasus asli), rumus yang sama menghasilkan
persis angka kasus asli: log 20:52, patroli 20:52, CCTV 20:57, struk
20:22, gerbang 20:23, klaim pulang 20:20, klaim pelaku 20:30–21:00,
timeline 20:20–21:00. Ini adalah uji kewarasan pertama implementasi:
seed 0 harus mereproduksi kasus asli, bukan kasus yang mirip-mirip.

### 5.3. Yang dilarang rumus ini

- `breakingTime`, `patrolTime`, atau `cctvTime` di luar jendela.
- `leftReceipt` atau `leftGate` di dalam atau setelah jendela.
- `leftClaim` setelah `leftReceipt` (klaim pulang tidak boleh sesudah
  bukti sudah pergi — itu justru membuat tersangka terlihat berbohong
  padahal ia pembela).
- Jendela yang melewati 23:00 atau melewati tengah malam.

---

## 6. Template teks (ID + EN)

Semua kalimat di bawah ini adalah template. `{...}` adalah placeholder
yang wajib diganti saat generate. Tidak ada kalimat kasus yang ditulis
bebas per varian.

### 6.1. Briefing

- ID: "{victimName}, {victimRole} ditemukan di {crimeRoom} jam
  {foundTime}. Empat orang ada di gedung malam ini — satu alibi tidak
  cocok dengan jejaknya."
- EN: "{victimName}, {victimRole} was found in {crimeRoom} at
  {foundTime}. Four people were in the building tonight — one alibi
  does not match the trace."

### 6.2. Alibi dan pembela per bundle

**NEVER (pelaku) — alibi:**

- ID: "Di {archiveRoom} {claimStart}–{windowEnd}, tidak keluar sama
  sekali."
- EN: "In {archiveRoom} {claimStart}–{windowEnd}, never left at all."

**NEVER — pembela jika pemain salah menuduh pelaku dengan clue yang
salah, atau penjelasan di layar hasil (bukan defense, karena pelaku
tidak punya defense):** tidak ada teks defense untuk pelaku. Jika
pemain menuduh pelaku dengan clue pendukung (`sidik`), feedback-nya
adalah template umum di §6.4, bukan defense.

**CCTV — alibi dan defense:**

- Alibi ID: "Di {cctvRoom} {cctvClaimRange}." / EN: "In {cctvRoom}
  {cctvClaimRange}."
- Defense ID: "Rekaman CCTV {cctvRoom} merekam {name} jam {cctvTime} —
  ia di tempat lain pada rentang kejadian." / EN: "{cctvRoom} CCTV
  recorded {name} at {cctvTime} — he/she was elsewhere during the
  window."

**PATROL — alibi dan defense:**

- Alibi ID: "Patroli {patrolArea} {patrolClaimRange}." / EN:
  "Patrolling {patrolArea} {patrolClaimRange}."
- Defense ID: "Cap/log {name} di {patrolPlace} jam {patrolTime} — ia di
  tempat lain pada menit yang sama." / EN: "{name}'s log in
  {patrolPlace} at {patrolTime} — he/she was elsewhere that same
  minute."

**LEFT — alibi dan defense:**

- Alibi ID: "Sudah pulang jam {leftClaim}." / EN: "Already went home
  at {leftClaim}."
- Defense ID: "Struk {leftProof} {name} {leftReceipt} dan rekaman
  gerbang {leftGate} — ia sudah pergi sebelum rentang kejadian." /
  EN: "{name}'s {leftProof} receipt at {leftReceipt} and gate
  recording at {leftGate} — he/she had left before the window."

Nilai `{cctvRoom}`, `{patrolArea}`, `{patrolPlace}`, `{leftProof}`
berasal dari skin (§4) dan bundle yang dipilih, bukan dari teks bebas.

### 6.3. Clue (label + detail)

**`akses` (pematah):**

- Label ID: "Log {accessObject}" / EN: "{accessObject} Log".
- Detail ID: "{accessObject} {culpritName} membuka pintu {crimeRoom}
  jam {breakingTime} — padahal ia mengaku tidak keluar dari
  {archiveRoom} sama sekali."
- Detail EN: "{culpritName}'s {accessObject} opened the {crimeRoom}
  door at {breakingTime} — even though he/she claimed never to leave
  {archiveRoom}."

**`sidik` (pendukung):**

- Label ID: "Sidik jari di pintu" / EN: "Fingerprint on the door".
- Detail ID: "Sidik jari {culpritName} ada di gagang pintu {crimeRoom}.
  Ini mendukung log, tapi bukan pematah utama."
- Detail EN: "{culpritName}'s fingerprint is on the {crimeRoom} door
  handle. This supports the log, but it is not the main breaker."

**`cctv`, `patroli`, `parkir`:** detailnya sama dengan teks defense
bundle yang bersangkutan di §6.2 (satu sumber kebenaran, jangan tulis
dua versi yang bisa berbeda).

### 6.4. Hint (tidak boleh menyebut nama)

- Hint 1 ID: "Satu orang mengaku tidak pernah keluar dari {archiveRoom},
  tapi ada jejak keluar." / EN: "One person claims they never left
  {archiveRoom}, but there is a trace of them leaving."
- Hint 2 ID: "Cek log {accessObject}." / EN: "Check the
  {accessObject} log."

Perhatikan: hint 2 menyebut objek, bukan orang dan bukan ruangan
kejahatan. Itu sengaja — hint boleh mengarahkan ke jenis bukti, tidak
boleh mengarahkan ke tersangka.

### 6.5. Rantai logika di layar hasil (urutan tetap)

Urutan selalu: CCTV gugur, PATROL gugur, LEFT gugur, lalu kesimpulan
pelaku. Urutan ini tetap meskipun urutan tampil tersangka diacak,
supaya pemain membaca penalaran yang konsisten.

- ID: "{cctvName} gugur: {cctvDefenseSingkat}.",
  "{patrolName} gugur: {patrolDefenseSingkat}.",
  "{leftName} gugur: {leftDefenseSingkat}.",
  "Tersisa {culpritName}, dan log {accessObject} jam {breakingTime}
  mematahkan klaimnya bahwa ia tidak keluar dari {archiveRoom}."
- EN: versi yang sama dengan kata kerja yang setara (lihat implementasi
  untuk kalimat lengkapnya; jangan menerjemahkan kata per kata dari ID
  jika hasilnya tidak natural).

---

## 7. RNG, seed, dan mode main

### 7.1. RNG deterministik

Gunakan PRNG kecil yang deterministik, misalnya mulberry32, bukan
`Math.random()` langsung (yang tidak bisa diulang). Pseudocode:

```js
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

Semua pilihan acak (skin, pelaku, peran pembela, nama, jam, shuffle)
harus memakai `rng` yang sama, dalam urutan yang tetap (lihat §7.3).
Kalau urutan pemakaian `rng` berubah, seed yang sama akan menghasilkan
kasus yang berbeda — itu bug determinisme, bukan fitur.

### 7.2. Seed

- **Kasus asli:** seed `0`, dan implementasi wajib mereproduksi kasus
  asli persis (Lina / perpustakaan / jam asli). Seed 0 adalah test
  regresi, bukan sekadar nilai default.
- **Kasus harian:** seed = tanggal WIB dalam format `YYYYMMDD`
  (misalnya 20261025). Alasan memakai WIB, bukan UTC: pemain di
  Indonesia (zona waktu utama game ini) mendapat kasus baru tepat
  tengah malam WIB, bukan jam 07:00 WIB seperti kalau memakai UTC.
- **Kasus acak:** seed = bilangan acak 6 digit yang dipilih saat
  pemain menekan "Acak", lalu seed itu ditampilkan sebagai kode
  (misalnya `AB-482913`) dan disimpan, supaya pemain bisa mengulang
  varian yang sama atau membagikannya.
- **Ulangi dengan seed:** pemain memasukkan kode seed, generator
  menjalankan seed yang sama dan menghasilkan kasus yang sama.

Kode seed yang ditampilkan tidak boleh mengandung nama pelaku atau
petunjuk apa pun. Kode hanyalah angka.

### 7.3. Langkah generate (G1–G12)

1. **G1.** Terima `seed`, buat `rng = mulberry32(seed)`.
2. **G2.** `skin = pick(rng, SKINS)` — kecuali seed 0 yang memaksa
   skin Perpustakaan.
3. **G3.** `culpritRole = pick(rng, skin.culpritRoles)`.
4. **G4.** `cctvRole = pick(rng, skin.cctvRoles)`,
   `patrolRole = skin.patrolRole` (tunggal per skin),
   `leftRole = pick(rng, skin.leftRoles)`.
5. **G5.** Ambil 4 nama berbeda dari pool nama dengan `rng`, lalu
   tetapkan berurutan ke pelaku, CCTV, PATROL, LEFT. Ambil nama korban
   yang berbeda dari keempatnya.
6. **G6.** Hitung waktu dengan rumus §5 (pilih `windowStart` dengan
   `rng` dari daftar, kecuali seed 0 yang memaksa 20:50).
7. **G7.** Bangun `suspects[]` dari template §6.2 (ID + EN).
8. **G8.** Bangun `clues[]` dari template §6.3 dengan ID stabil
   (`akses`, `sidik`, `cctv`, `patroli`, `parkir`).
9. **G9.** Bangun `hints[]` dan `logic[]` dari template §6.4–§6.5.
10. **G10.** Shuffle urutan tampil `suspects[]` dan `clues[]`
    dengan `rng`. Jangan shuffle `logic[]` (urutannya tetap §6.5).
11. **G11.** Jalankan validator §8. Jika lolos, kembalikan kasus.
12. **G12.** Jika gagal, ulangi dari G1 dengan `seed + 1`, maksimal
    10 kali. Jika masih gagal, kembalikan kasus asli (seed 0) dan
    catat kegagalan itu sebagai bug generator, bukan sebagai kasus
    baru yang "kira-kira benar".

---

## 8. Validator (wajib lolos sebelum kasus ditampilkan)

Validator adalah fungsi murni (tanpa DOM) yang menerima `GeneratedCase`
dan mengembalikan lolos/gagal beserta daftar pelanggaran. Tidak ada
kasus yang boleh ditampilkan tanpa melewati validator ini, termasuk
kasus harian.

| Kode | Cek | Alasan |
|---|---|---|
| V1 | Tepat satu clue dengan `breaks` terisi, dan `breaks == culprit`. | Pematah tunggal. |
| V2 | Tepat satu clue pendukung (`sidik`), dan pendukung itu merujuk ke pelaku, bukan ke orang lain. | Pendukung tidak boleh menyesatkan. |
| V3 | Setiap non-pelaku punya tepat satu clue `clears == namanya`, dan tipe `clears` ketiganya berbeda (CCTV, patroli, pergi). | Pembela independen dan lengkap. |
| V4 | `breakingTime`, `patrolTime`, `cctvTime` semuanya di dalam jendela; `leftReceipt` dan `leftGate` keduanya sebelum jendela; `leftClaim < leftReceipt < leftGate < windowStart`. | Constraint waktu §5. |
| V5 | Interval klaim pelaku mencakup `breakingTime`, dan ruangan klaim (`archiveRoom`) berbeda dari ruangan log (`crimeRoom`). | Kontradiksi benar-benar terjadi. |
| V6 | 4 nama tersangka berbeda; nama korban berbeda dari semuanya; tidak ada nama kosong. | Tidak ada duplikat / nama hilang. |
| V7 | Peran pelaku ada di daftar `culpritRoles` skin yang dipilih; peran pembela ada di pool bundle-nya. | Plausibilitas peran (lihat §3.2). |
| V8 | Tidak ada placeholder `{...}` yang tersisa di semua teks ID dan EN (tersangka, clue, hint, logika, briefing). | Template yang gagal render. |
| V9 | Semua field ID dan EN terisi dan tidak kosong (kecuali nama orang yang memang sama di kedua bahasa). | Bilingual lengkap sejak awal. |
| V10 | Hint tidak mengandung nama pelaku, nama korban, atau label clue pematah. | Hint tidak membocorkan jawaban. |

Jika validator gagal, ikuti G12: regenerate dengan seed berikutnya,
bukan "perbaiki" kasus yang gagal dengan menambal satu field secara
manual di UI. Menambal di UI menyembunyikan bug generator.

---

## 9. Contoh varian (ilustratif, mengikuti aturan di atas)

Contoh ini **bukan** hasil run generator (generator belum
diimplementasikan), melainkan varian yang dirancang manual mengikuti
rumus §5 dan template §6, untuk menunjukkan bahwa aturan itu
menghasilkan kasus yang koheren. Jangan mengklaim contoh ini berasal
dari seed tertentu sampai implementasi benar-benar menghasilkannya.

**Varian contoh — Skin Museum, jendela 20:00–20:10:**

- Korban: Bu Ayu, Kurator, ditemukan di Ruang Pamer A jam 20:10.
- Pelaku: Putri, Asisten Kurator — mengaku di Gudang Koleksi
  19:40–20:10, tidak keluar. Pematah: Kartu Staf Putri membuka pintu
  Ruang Pamer A jam 20:02. Pendukung: sidik jari Putri di gagang
  pintu Ruang Pamer A.
- CCTV: Ardi, Fotografer — rekaman galeri B jam 20:07.
- PATROL: Hadi, Satpam — log koridor jam 20:02 (menit yang sama
  dengan log pintu, tempat berbeda).
- LEFT: Rani, Pengunjung — tiket keluar 19:32, gerbang 19:33, klaim
  pulang 19:30.
- Hint 1: "Satu orang mengaku tidak pernah keluar dari Gudang Koleksi,
  tapi ada jejak keluar." Hint 2: "Cek log Kartu Staf."
- Solusi: Putri + log Kartu Staf 20:02. Rantai logika mengikuti urutan
  §6.5 (Ardi gugur, Hadi gugur, Rani gugur, tersisa Putri).

Perhatikan: meskipun nama, setting, dan jam berubah total dari kasus
asli, struktur pembuktiannya identik. Itulah yang membuat generator
ini aman: yang diacak adalah instansiasi, bukan logikanya.

---

## 10. Integrasi ke game yang sudah ada (rencana implementasi)

Dokumen ini hanya desain. Saat diimplementasikan, urutannya adalah:

1. **Refactor `CASE` jadi fungsi.** Pindahkan `CASE` di `index.html`
   dari objek hardcode menjadi `buildCase(seed)` yang mengembalikan
   objek dengan bentuk yang sama. Kasus asli menjadi `buildCase(0)`.
   Jangan mengubah UI di langkah ini — hanya sumber datanya.
2. **Tambah modul generator + validator sebagai fungsi murni**
   (tanpa DOM): `generateCase(seed)`, `validateCase(case)`, `rng`
   (§7.1), `SKINS`, `NAME_POOL`, dan template §6. Modul ini harus
   bisa di-test tanpa browser.
3. **Tambah mode di UI (kecil saja):** tombol "Kasus Asli",
   "Acak", "Harian", dan input "Kode Seed" di layar briefing.
   Tampilkan kode seed kasus yang sedang dimainkan di pojok layar
   hasil, supaya pemain bisa membagikannya.
4. **Save (aditif, tidak merusak save lama):** kunci tetap
   `ab_save_v1`, tetapi tambah field `lastSeed`, `randomBestStars`,
   dan `dailyDate` di samping `case1.stars` yang sudah ada. Jangan
   mengubah bentuk field lama.
5. **Test (lihat §11), lalu playtest HP.** Jangan klaim generator
   "berhasil" hanya karena satu seed menghasilkan kasus yang terlihat
   benar.

---

## 11. Rencana test (file test baru, belum dibuat)

Buat `tests/test_generator.mjs` (terpisah dari `test_level1.mjs` yang
sudah ada, supaya test Level 1 asli tidak tercampur dengan test
generator). Test yang wajib ada:

1. **Seed 0 = kasus asli.** `generateCase(0)` harus sama persis
   (pelaku Lina, skin Perpustakaan, jam asli) dengan `CASE` di
   `index.html` saat ini.
2. **Determinisme.** `generateCase(12345)` yang dipanggil dua kali
   menghasilkan JSON yang identik.
3. **100 seed lolos validator.** Jalankan seed 1–100, semuanya harus
   lolos V1–V10. Satu kegagalan saja = bug generator, bukan "kasus
   sial".
4. **Distribusi kasar.** Dari 100 seed, masing-masing dari 4 skin
   muncul minimal 10 kali, dan masing-masing dari 2 peran pelaku per
   skin muncul minimal 5 kali di dalam skin itu. Ini mencegah bug
   "skin/ pelaku tertentu tidak pernah terpilih" yang tidak ketahuan
   dari satu contoh.
5. **Tidak ada placeholder bocor.** Scan semua teks hasil generate
   untuk pola `{` dan `}` — harus nol.
6. **Bilingual lengkap.** Setiap field ID punya pasangan EN yang
   tidak kosong, dan sebaliknya.
7. **Constraint waktu.** Untuk 100 seed, semua waktu memenuhi §5.3.
8. **Hint bersih.** Untuk 100 seed, hint tidak mengandung nama pelaku
   atau korban.
9. **Shuffle tidak mengubah solusi.** Urutan tampil boleh berubah,
   tetapi `culprit` dan `breakingClue` tidak boleh berubah karena
   shuffle.
10. **Fallback.** Jika validator dipaksa gagal (misalnya dengan
    mock yang merusak satu field), generator harus kembali ke kasus
    asli setelah 10 percobaan, bukan menampilkan kasus rusak.

Test-test di atas adalah test logika/headless, sama seperti test Level
1 yang sudah ada. Test tampilan di browser dan feel di HP tetap
menjadi verdict terpisah yang hanya bisa diberikan oleh playtest HP,
sesuai aturan QA yang sudah berlaku untuk game ini.

---

## 12. Risiko dan mitigasi

| Risiko | Mitigasi di desain ini |
|---|---|
| Pemain hafal skeleton setelah beberapa kali main, meskipun nama/setting berubah. | Diakui sebagai batas v1 (§1.3). Mitigasi jangka panjang: generator skeleton Kasus 2 dan 3, dan varian pelaku handcrafted — bukan dengan mengacak skeleton A secara liar. |
| Skin terasa "tempelan" (misalnya peran tidak cocok dengan bukti). | Pool peran per bundle (§4) dan cek V7. Jangan pernah mengisi bundle dengan peran sembarangan demi variasi. |
| Terjemahan EN untuk peran/ruangan baru tidak natural. | Semua istilah EN ditulis di skin sejak awal dan direview manusia, bukan diterjemahkan mesin saat generate. |
| Seed harian berbeda karena zona waktu. | Seed harian memakai tanggal WIB (§7.2), didokumentasikan eksplisit. |
| Generator menghasilkan kasus yang "benar secara formal" tapi terasa aneh (misalnya korban dan pelaku namanya mirip). | Aturan nama berbeda (§4.5) + V6. Jika masih terasa aneh, itu umpan balik untuk mempersempit pool, bukan untuk menambah pengecualian di validator. |
| Implementasi mengubah perilaku Level 1 asli. | Seed 0 = kasus asli persis (§7.2, §11 test 1). Perubahan perilaku apa pun pada seed 0 adalah regresi. |

---

## 13. Keputusan yang masih terbuka (di tangan Alam)

1. Apakah mode "Acak" dan "Harian" langsung masuk ke Level 1, atau
   generator dirilis dulu sebagai mode terpisah setelah Level 1 asli
   di-playtest?
2. Format kode seed final (contoh di dokumen ini `AB-482913` — boleh
   diganti, tetapi formatnya harus tetap angka saja, tanpa petunjuk).
3. Apakah pool nama perlu ditambah (misalnya 24 nama) sebelum
   implementasi, untuk mengurangi pengulangan nama di sesi yang panjang?
4. Apakah skin ke-5 dan ke-6 (misalnya rumah sakit, stasiun) perlu
   ditambahkan sekarang, atau 4 skin di §4 sudah cukup untuk v1?
5. Apakah kasus harian memakai seed tanggal WIB saja, atau juga
   memakai seed tanggal yang sama untuk semua pemain di seluruh dunia
   (UTC) — dokumen ini merekomendasikan WIB, keputusan final tetap di
   Alam.
