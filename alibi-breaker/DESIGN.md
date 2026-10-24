# Alibi Breaker — Dokumen Desain Lengkap

> **Status:** Level 1 dibangun dan di-push ke GitHub (24 Oktober 2026,
> commit `5579e5d9c9f2c92df73c65fdcecd12d7ba2c0590` di `main`, hanya 3 file
> `alibi-breaker/` — perubahan lokal lain di repo tidak ikut di-push).
> Belum ada submission ke portal mana pun. Kasus 2–15 belum dibangun.
> **Judul kerja (bukan final):** *Alibi Breaker* / *Jejak Terakhir* / *Kasus 3 Menit*.
> Keputusan judul final tetap di tangan Alam.
> **Tanggal desain:** 24 Oktober 2026
> **Bahasa game:** Bilingual EN/ID, mengikuti pola game portfolio sebelumnya.
> **Target portal utama:** CrazyGames. Jalur cadangan: GameDistribution, lalu itch.io untuk tes awal.

---

## 1. Ringkasan satu kalimat

Bukan "cari siapa pembunuhnya", tapi **"patahkan alibinya"**: dalam satu adegan,
dengan 4 tersangka dan 5–6 clue visual, pemain menyusun timeline lalu memilih
satu bukti yang mematahkan alibi satu tersangka.

Kalimat ini adalah pembeda utama dari game detektif yang sudah ramai di portal
(point-and-click, cari objek tersembunyi, dan escape room). Pembeda itu penting
karena penolakan Tower Rush di CrazyGames (15 Oktober 2026) alasannya adalah
konsep yang terlalu dekat dengan judul yang sudah ada, bukan kualitas teknis.

---

## 2. Analisis portal (ringkas)

### 2.1. Yang sudah ada di CrazyGames

- Kategori detektif memang ada, dan format dominannya adalah point-and-click,
  hidden clue, dan escape room.
- Game detektif terpopulernya adalah *Murderer*, game multiplayer ala Among Us,
  bukan puzzle logika murni.
- Kesimpulan: pasar detektif terbukti ada, tetapi **puzzle logika murni yang
  diselesaikan dengan penalaran (bukan sekadar klik objek tersembunyi) masih
  relatif lowong**. Di situlah celah Alibi Breaker.

### 2.2. Tiga risiko terbesar — dan jawaban desainnya

| Risiko | Jawaban desain |
|---|---|
| Pemain kabur sebelum 1 menit (conversion). Target game top: 80%+ pemain main minimal 1 menit, load < 10 detik, build < 20 MB. | Briefing hanya 2 kalimat. Clue pertama bisa di-tap dalam hitungan detik. Tidak ada dinding teks di awal. |
| Sesi terlalu pendek. Game sukses biasanya rata-rata main 10+ menit per sesi. | 1 kasus = 2–4 menit, dan kasus berikutnya langsung ditawarkan. Target sesi = 3–5 kasus. |
| Tidak ada alasan kembali besok (Day 1 retention). Target game kuat: 10–15%. | Progres rank detektif, bintang per kasus, dan kasus harian prosedural (lihat §7). Progress tersimpan di localStorage. |

Angka KPI di atas adalah target dari panduan Basic Launch CrazyGames
(periode tes 7–21 hari, minimal 500 plays). Angka itu dipakai sebagai kompas
desain, bukan jaminan lolos review.

---

## 3. Core loop

```
Pilih kasus → Briefing 2 kalimat → Tap clue (5–6) → Buka panel tersangka
→ Uji alibi (cocokkan clue waktu/tempat dengan klaim tersangka)
→ Tuduh → Hasil + penjelasan logika → Bintang + progres rank
→ Kasus berikutnya / iklan antar-kasus
```

Satu kasus dirancang selesai dalam **2–4 menit**. Tidak ada mekanik refleks,
tidak ada WASD, tidak ada timer yang menghukum pemain santai. Input hanya
tap/click, supaya playable penuh di HP maupun desktop.

### 3.1. Aturan emas setiap kasus (wajib lolos sebelum kasus dinyatakan jadi)

1. **Satu pelaku, satu pematah utama.** Selalu ada tepat satu clue yang
   mematahkan alibi pelaku. Clue lain boleh mendukung, bukan menggantikan.
2. **Setiap tersangka lain punya bukti independen.** Minimal satu bukti
   waktu/tempat (CCTV, log, struk, metadata, saksi) yang menempatkannya di
   tempat lain pada rentang kejadian. Tidak boleh ada tersangka yang gugur
   hanya karena "tidak ada motif" atau "kelihatannya baik".
3. **Red herring harus bisa dijelaskan.** Setiap clue menyesatkan wajib punya
   penjelasan di layar hasil (misalnya: sidik itu dari siang, bukan malam
   kejadian). Pemain yang tertipu harus belajar, bukan merasa dicurangi.
4. **Tidak ada info di luar clue.** Kasus harus bisa diselesaikan 100% dari
   clue yang ditampilkan. Motif bukan bukti. Firasaat bukan bukti.
5. **Tidak ada gore.** Gaya cozy-mystery ala board game *Clue*: flat, tanpa
   darah, tanpa detail kekerasan. Korban "ditemukan", penyebab tidak
   divisualkan. Ini menjaga game aman untuk audiens portal yang luas.

### 3.2. Sistem bintang dan hint

- **3 bintang:** tuduhan pertama benar, tanpa hint.
- **2 bintang:** tuduhan pertama benar dengan 1 hint, atau benar pada
  tuduhan kedua.
- **1 bintang:** selesai dengan hint lebih dari 1, atau tuduhan lebih dari 2.

Hint tidak pernah menyebut nama pelaku:

- **Hint 1:** mengarah ke jenis clue ("Satu orang mengaku tidak pernah
  keluar, tapi ada jejak keluar." / "Siapa yang jejaknya hilang di tengah
  waktu kejadian?").
- **Hint 2:** menunjuk clue spesifik ("Cek log pintu." / "Jejak sepatu di
  gudang cocok dengan sepatu siapa?").

Jika tuduhan salah, layar hasil menunjukkan bukti yang masih membela
tersangka yang dituduh itu — bukan sekadar "salah, coba lagi".

---

## 4. Struktur layar (UI)

1. **Home:** tombol Main, peta kasus (terkunci/terbuka), rank detektif,
   kasus harian.
2. **Briefing:** setting, korban, rentang waktu kejadian, dan 2 kalimat
   konteks. Tombol "Mulai menyelidiki" langsung terlihat.
3. **Investigasi:** tiga area yang bisa berpindah cepat:
   - *Adegan:* ikon-ikon clue yang bisa di-tap (jam, kartu akses, CCTV,
     struk, log, sidik, jejak sepatu).
   - *Tersangka:* kartu 4 tersangka, masing-masing menampilkan alibi yang
     diklaim.
   - *Timeline:* garis waktu rentang kejadian; clue waktu yang sudah
     ditemukan menempel di posisinya, sehingga kontradiksi terlihat visual.
4. **Tuduh:** pilih tersangka, lalu pilih clue pematah. Kedua pilihan harus
   diisi — ini mencegah tuduhan asal tebak tanpa clue.
5. **Hasil:** pelaku, rantai logika langkah demi langkah, penjelasan red
   herring, bintang, dan tombol kasus berikutnya.

Prinsip UI: teks pendek, ikon visual dulu, target tap besar untuk HP,
tidak mengandalkan warna saja untuk membedakan status (selalu ada label teks).

---

## 5. Desain 3 kasus pertama

Kurva belajarnya sengaja bertahap:

- **Kasus 1** melatih: "cari 1 kontradiksi".
- **Kasus 2** melatih: "abaikan bukti lama, gabungkan 2 clue".
- **Kasus 3** melatih: "jangan terima alibi bersama mentah-mentah".

### 5.1. Kasus 1 — Lampu Perpustakaan / The Library Lamp

- **Target:** 2 menit. **Kesulitan:** mudah (tutorial).
- **Setting:** Perpustakaan kota, ruang baca utama.
- **Korban:** Pak Raka, penjaga perpustakaan, ditemukan jam 21.00.
- **Rentang kejadian:** 20.50–21.00.
- **Briefing:** "Pak Raka ditemukan di ruang baca utama jam 21.00. Empat
  orang ada di gedung malam ini — satu alibi tidak cocok dengan jejaknya."

**Tersangka dan alibi yang diklaim:**

| Tersangka | Peran | Alibi yang diklaim |
|---|---|---|
| Lina | Pustakawan senior | Di ruang arsip 20.30–21.00, tidak keluar sama sekali |
| Bima | Mahasiswa | Di ruang belajar lantai 2, 20.00–21.00 |
| Pak Hadi | Satpam | Patroli koridor 20.40–21.00 |
| Rani | Pengunjung | Sudah pulang jam 20.20 |

**Clue (5):**

1. Log kartu akses: kartu Lina membuka pintu ruang baca jam **20.52**
   → **pematah utama**.
2. Sidik jari Lina di gagang pintu ruang baca → pendukung clue 1.
3. CCTV lantai 2 merekam Bima jam **20.57** → Bima gugur.
4. Cap patroli Pak Hadi di koridor utara jam **20.52** → Hadi berada di
   tempat lain pada menit yang sama dengan clue 1 → Hadi gugur.
5. Struk parkir Rani 20.22 + CCTV gerbang 20.23 → Rani gugur (sebelum
   rentang kejadian).

**Solusi:** Lina. **Rantai logika:** Bima (CCTV lantai 2) + Hadi (cap
patroli 20.52) + Rani (parkir 20.22) semuanya punya bukti di tempat lain →
tersisa Lina, dan log akses 20.52 mematahkan klaim "tidak keluar".

**Hint 1:** "Satu orang mengaku tidak pernah keluar, tapi ada jejak keluar."
**Hint 2:** "Cek log pintu."

**Feedback tuduhan salah:** tampilkan bukti pembela tersangka yang dituduh
(misalnya menuduh Bima → tampilkan CCTV lantai 2 jam 20.57).

### 5.2. Kasus 2 — Kasir yang Tak Seimbang / The Unbalanced Cashier

- **Target:** 3 menit. **Kesulitan:** mudah–menengah.
- **Setting:** Kafe Kopi Senja, gudang belakang.
- **Korban:** Pak Dani, pemilik kafe, ditemukan di gudang.
- **Rentang kejadian:** 20.00–20.15 (kafe tutup 20.15).
- **Briefing:** "Pemilik kafe ditemukan di gudang setelah tutup. Kasir
  mengaku tidak pernah meninggalkan kasir — tapi rekaman kasir punya celah."

**Tersangka dan alibi yang diklaim:**

| Tersangka | Peran | Alibi yang diklaim |
|---|---|---|
| Sinta | Barista | Di dapur 19.30–20.15 |
| Joko | Pemasok kopi | Bongkar barang di gudang 19.20–19.50, lalu pulang |
| Maya | Kasir | Di kasir menghitung uang 19.45–20.15 |
| Tono | Pelanggan tetap | Di meja pojok, lalu pulang |

**Clue (6):**

1. CCTV dapur merekam Sinta jam **20.07** → Sinta gugur.
2. Nota Joko ditandatangani Sinta 19.40 + gerbang truk keluar **19.52**
   → Joko sudah pergi sebelum rentang kejadian → Joko gugur.
3. Struk kopi Tono 19.50 + kamera depan merekam Tono keluar **19.56**
   → Tono sudah pergi sebelum rentang kejadian → Tono gugur.
4. CCTV kasir **kosong/mati 19.50–20.05** → Maya "menghilang" tepat di
   tengah rentang kejadian.
5. Jejak sol sepatu kasir di lantai gudang yang berdebu + daftar kunci
   malam itu hanya dipegang korban dan Maya.
6. **Red herring:** sidik Sinta di pintu gudang. Penjelasan di layar
   hasil: log stok menunjukkan Sinta mengambil susu dari gudang jam
   18.30 — sidik itu wajar dan bukan dari malam kejadian.

**Solusi:** Maya. **Rantai logika:** clue 4 saja belum cukup (CCTV bisa
mati sendiri), tetapi clue 4 + clue 5 membuktikan Maya meninggalkan kasir
menuju gudang pada waktu kejadian. Pemain belajar membedakan bukti lemah,
motif, dan bukti gabungan.

**Hint 1:** "Siapa yang jejaknya hilang di tengah waktu kejadian?"
**Hint 2:** "Jejak sepatu di gudang cocok dengan sepatu siapa?"

### 5.3. Kasus 3 — Alibi Berdua / The Shared Alibi

- **Target:** 3–4 menit. **Kesulitan:** menengah.
- **Setting:** Museum, malam pameran.
- **Korban:** Pak Arman, kurator, ditemukan di Ruang A jam 20.30.
- **Rentang kejadian:** 20.15–20.30.
- **Briefing:** "Seorang saksi melihat kilat dari arah Ruang A jam 20.25.
  Dua orang mengaku bersama sepanjang malam — periksa apakah mereka
  benar-benar bersama."

**Tersangka dan alibi yang diklaim:**

| Tersangka | Peran | Alibi yang diklaim |
|---|---|---|
| Dewi | Asisten kurator | Di Ruang B bersama Rizal 20.00–20.30 mengkatalog |
| Rizal | Teknisi lampu | Di Ruang B bersama Dewi 20.00–20.30 menyetel lampu |
| Intan | Fotografer | Di rooftop memotret langit 20.10–20.40 |
| Fajar | Satpam | Di pos jaga 20.00–20.45, sempat keliling sebentar |

**Clue (6):**

1. Log lampu Ruang B: menyala 20.00–**20.12**, lalu mati total. Tidak ada
   aktivitas penyetelan lampu sampai 20.30 → klaim "menyetel sampai
   20.30" runtuh.
2. Buku log Fajar: Rizal lewat koridor menuju Ruang A jam **20.20**
   → **pematah utama** untuk alibi Rizal.
3. Katalog Dewi: coretan tangan Dewi di Ruang B sampai **20.28** → Dewi
   benar-benar tinggal di Ruang B sendirian (dia pakai headphone, tidak
   sadar Rizal keluar). Dewi bukan kaki tangan, hanya tidak sadar.
4. Metadata foto Intan dari rooftop: 20.15, 20.27, 20.36 → kilat yang
   dilihat saksi bukan dari Intan → Intan gugur.
5. Obeng milik Rizal tertinggal di dekat vitrin Ruang A → pendukung clue 2.
6. Kamera pos jaga merekam Fajar jam 20.22, setelah patroli singkatnya
   → Fajar gugur.

**Solusi:** Rizal. **Rantai logika:** alibi berdua runtuh oleh clue 1 + 2,
clue 5 menguatkan Rizal memang sampai di Ruang A, clue 3 membebaskan Dewi
(secara terpisah), clue 4 membebaskan Intan, clue 6 membebaskan Fajar.

**Hint 1:** "Alibi berdua itu dicek satu per satu, bukan diterima
mentah-mentah."
**Hint 2:** "Kapan sebenarnya pekerjaan lampu di Ruang B berhenti?"

---

## 6. Rencana konten setelah 3 kasus pertama

### 6.1. MVP: 15 kasus buatan tangan

- Kasus 1–3: seperti di atas (tutorial → red herring → alibi bersama).
- Kasus 4–6: variasi mekanik yang sama dengan setting baru — contoh arah:
  satu kasus dengan alibi berbasis struk vs jam mesin, satu kasus dengan
  saksi yang salah ingat jam, satu kasus dengan dua red herring.
- Kasus 7–10: kesulitan menengah — pelaku butuh 2 clue gabungan, dan
  minimal satu tersangka lain punya alibi yang awalnya terlihat lemah
  tetapi terbukti kuat.
- Kasus 11–15: kesulitan sulit — alibi silang antar 3 tersangka, red
  herring yang memanfaatkan clue dari kasus sebelumnya (pola yang salah
  kaprah), dan satu kasus "pembalikan": tersangka yang paling mencurigakan
  justru yang paling terbukti tidak ada di tempat.

Setiap kasus baru wajib melewati §3.1 sebelum masuk build. Jika satu
tersangka tidak punya bukti independen, kasus itu belum jadi — perbaiki
clue-nya, jangan tambahkan narasi penjelas.

### 6.2. Kasus harian prosedural (retention hook)

Satu kasus baru per hari, digenerate dari template, bukan ditulis tangan
penuh:

- Pilih setting dari pool (kafe, perpustakaan, museum, taman, stasiun,
  toko buku, galeri, pasar malam).
- Pilih 4 peran dari pool peran per setting.
- Pilih pelaku secara acak, lalu generate: alibi pelaku (klaim) + 1
  pematah (log/jam/metadata/sidik/jejak) + bukti independen untuk 3
  tersangka lain + 1 red herring yang bisa dijelaskan.
- Validasi otomatis sebelum tampil: pelaku unik, pematah mengarah ke
  tepat satu tersangka, setiap non-pelaku punya bukti.

Kasus harian tidak menggantikan kasus buatan tangan; fungsinya memberi
alasan kembali setelah 15 kasus tamat.

### 6.3. Progres dan rank detektif

- Bintang per kasus tersimpan, total bintang membuka rank:
  Magang → Penyelidik → Detektif → Detektif Senior → Master Deduksi
  (nama rank final menyusul keputusan Alam).
- Rank membuka alat bantu kosmetik/fungsional ringan, bukan jawaban:
  misalnya sorot clue waktu di timeline, atau satu hint gratis per hari.
- Tidak ada sistem energi atau timer yang memaksa pemain menunggu —
  itu berlawanan dengan target sesi 10+ menit di portal.

---

## 7. Spesifikasi teknis (mengikuti pola portfolio)

- **Format:** single-file HTML5, vanilla JS (tanpa framework berat),
  mengikuti pola game portfolio sebelumnya.
- **Grafis:** Canvas 2D / DOM hybrid untuk UI teks — UI puzzle berbasis
  teks dan ikon lebih mudah dibaca daripada full-canvas. Gaya flat
  cozy-mystery, aset orisinal (bukan klon aset game lain).
- **Audio:** WebAudio synth SFX (klik clue, tuduhan benar/salah, bintang),
  tanpa aset audio berlisensi yang meragukan.
- **Input:** tap/click saja. Tidak ada keyboard wajib.
- **Simpan:** localStorage — progres kasus, bintang, rank, kasus harian
  terakhir. Kunci save berversi (misalnya `ab_save_v1`) supaya update
  tidak merusak save lama.
- **Portal:** CrazyGames SDK v3 untuk build portal (iklan hanya
  antar-kasus, tidak pernah di tengah berpikir). Build GameDistribution
  dibuat dari varian yang sama dengan adapter SDK yang terpisah, seperti
  pola Tower Rush GD.
- **Budget:** build < 20 MB, load awal < 10 detik, kasus pertama bisa
  dimainkan tanpa menunggu seluruh 15 kasus ter-load.
- **Bilingual:** semua teks kasus ditulis ID + EN sejak awal di struktur
  data yang sama, bukan diterjemahkan belakangan.

### 7.1. Struktur data kasus (sketsa, untuk build)

```js
{
  id: "kasus-01",
  title_id: "Lampu Perpustakaan",
  title_en: "The Library Lamp",
  setting: "perpustakaan",
  window: ["20:50", "21:00"],
  briefing_id: "...", briefing_en: "...",
  suspects: [
    { name: "Lina", role_id: "Pustakawan senior",
      alibi_id: "Di ruang arsip 20.30–21.00, tidak keluar" }
    // ... 3 tersangka lain
  ],
  clues: [
    { id: "akses-2052", icon: "keycard", type: "waktu",
      text_id: "Kartu Lina membuka pintu ruang baca jam 20.52",
      breaks: "Lina", red_herring: false }
    // ... clue lain; red herring wajib punya `red_herring_explanation`
  ],
  solution: {
    culprit: "Lina",
    breaking_clue: "akses-2052",
    supporting_clues: ["sidik-pintu"],
    explanation_id: "...", explanation_en: "..."
  },
  hints: ["...", "..."],
  target_minutes: 2, difficulty: "mudah"
}
```

Aturan validasi data (bisa jadi unit test sebelum build): `breaking_clue`
mengarah ke tepat satu tersangka; setiap tersangka non-pelaku punya
minimal satu clue pembela; setiap red herring punya penjelasan.

---

## 8. Monetisasi dan jalur portal

- **CrazyGames (utama):** Basic Launch dulu (tanpa iklan aktif selama
  tes KPI), lalu Full Launch dengan SDK untuk monetisasi jika KPI kuat.
- **Iklan:** hanya antar-kasus dan setelah layar hasil — tidak pernah
  memotong pemain yang sedang menyusun timeline.
- **GameDistribution (cadangan):** jika CrazyGames menolak dengan alasan
  diferensiasi, jalur GD dipakai tanpa mengubah desain inti, hanya
  adapter SDK.
- **itch.io:** untuk tes awal dan link demo, bukan target monetisasi utama.
- **Yang tidak dilakukan:** tidak ada branding portal lain di dalam
  build CrazyGames, tidak ada iklan eksternal, tidak ada aset
  non-orisinal melebihi batas yang diizinkan portal.

---

## 9. QA sebelum submission

- [ ] Kasus 1 bisa diselesaikan pemain baru dalam 2 menit tanpa hint,
      setelah membaca briefing saja (tes dengan pemain yang belum tahu
      solusinya).
- [ ] Setiap kasus lolos validasi §7.1: pelaku unik, pematah tunggal,
      semua non-pelaku punya bukti, semua red herring terjelaskan.
- [ ] Tuduhan salah menampilkan bukti pembela yang benar, bukan teks
      generik.
- [ ] Load awal < 10 detik dan build < 20 MB (diukur, bukan diperkirakan).
- [ ] Main penuh di HP (tap target, teks terbaca, tidak ada scroll
      horizontal yang tidak disengaja) dan desktop.
- [ ] Save/load localStorage bertahan setelah reload dan setelah update
      versi minor.
- [ ] SDK CrazyGames: pause/mute saat iklan, resume setelah iklan, tidak
      ada jebakan jika iklan gagal.
- [ ] Tidak ada teks, nama, atau aset yang mengklon game detektif lain
      yang sudah ada di portal.

---

## 10. Keputusan yang masih terbuka (di tangan Alam)

1. Judul final: *Alibi Breaker* / *Jejak Terakhir* / *Kasus 3 Menit* /
   opsi lain.
2. Orientasi layar: portrait (konsisten dengan game mobile-first
   sebelumnya) atau landscape (lebih lega untuk timeline + kartu
   tersangka berdampingan). Rekomendasi dokumen ini: uji landscape
   responsif untuk kasus 1, karena timeline adalah elemen pembeda.
3. Apakah kasus harian prosedural masuk MVP atau ditunda ke update
   setelah 15 kasus buatan tangan terbukti fun.
4. Nama rank detektif final.
5. Kapan mulai build: prototipe Kasus 1 dulu, atau desain Kasus 4–6 dulu.

---

## 11. Langkah berikutnya yang disarankan

1. Pilih judul kerja final untuk folder/repo (bisa diganti sebelum
   submission, tetapi jangan diganti di tengah build).
2. Buat prototipe Kasus 1 saja: briefing → 5 clue → 4 kartu tersangka →
   tuduh → hasil + bintang. Ukur: apakah pemain baru paham tanpa
   penjelasan tambahan.
3. Jika prototipe Kasus 1 lolos, lanjut ke Kasus 2–3 dengan sistem hint
   dan bintang yang sama, lalu baru ke Kasus 4–15.
