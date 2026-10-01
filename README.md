# AntroAnak

**Status Gizi Anak WHO–CDC**

Aplikasi web (PWA) untuk menilai status gizi anak 0–20 tahun. Referensi dipilih otomatis sesuai **rekomendasi IDAI**: **WHO 2006** untuk anak < 5 tahun dan **CDC 2000** untuk anak ≥ 5 tahun. Aplikasi ini bisa dipasang di HP, berjalan tanpa internet setelah dibuka pertama kali, dan menyimpan hasil ke **PDF** atau **JPG**.

**Aplikasi ini dibuat oleh Manjilala – Poltekkes Kemenkes Makassar.**

## Fitur

| Umur | Referensi utama | Indikator | Klasifikasi |
|---|---|---|---|
| < 5 tahun | WHO 2006 | BB/U, PB/U atau TB/U, BB/PB atau BB/TB, IMT/U, LK/U | Permenkes No. 2 Tahun 2020 (z-score) |
| ≥ 5 tahun | CDC 2000 | TB/U, BB/U, IMT/U (+ BB/TB untuk 2–5 th di grafik CDC) | Persentil CDC; obesitas berat ≥ 120% P95 |
| Semua umur | – | %BB ideal (%BBI) | Waterlow / IDAI |

- **Pembanding (opsional):** balita ditampilkan juga dengan CDC 2000; anak 5–19 tahun ditampilkan juga dengan WHO 2007. Berguna untuk kasus rujukan Puskesmas ↔ RS, riset, dan bahan ajar.
- Z-score, persentil, interpretasi berwarna, dan grafik pertumbuhan (garis SD untuk WHO, persentil untuk CDC) dengan titik anak
- Koreksi otomatis ±0,7 cm bila cara ukur tidak sesuai umur
- Unduh PDF (A4), unduh JPG, bagikan langsung (misalnya ke WhatsApp), dan cetak
- Data anak tidak dikirim ke server; semua dihitung di HP
- Tombol **Panduan** berisi deskripsi aplikasi dan petunjuk penggunaan (dropdown per topik); pengguna baru mendapat pengingat untuk membukanya

## Cara menerbitkan di GitHub Pages

1. Masuk ke GitHub, lalu buat repository baru, dengan nama **`antro-anak`** (pilih **Public**).
2. Klik **Add file → Upload files**, lalu klik **choose your files**, pilih **semua file** di folder ini (Ctrl+A), dan klik **Open**. Pastikan ada 17 file (termasuk `.nojekyll`), lalu klik **Commit changes**.
3. Buka **Settings → Pages**. Pada *Source*, pilih **Deploy from a branch**, branch **main**, folder **/ (root)**, lalu **Save**.
4. Tunggu 1–2 menit. Alamat aplikasi akan muncul, misalnya `https://NAMA-AKUN.github.io/antro-anak/`.

## Cara memasang di HP petugas

- **Android (Chrome):** buka alamat aplikasi → ketuk tombol **Pasang di HP** di pojok kanan atas, atau menu ⋮ → **Instal aplikasi / Tambahkan ke layar utama**.
- **iPhone (Safari):** buka alamat aplikasi → ketuk ikon **Bagikan** → **Tambahkan ke Layar Utama**.

Setelah dipasang, ikon Poltekkes muncul di layar utama dan aplikasi bisa dipakai tanpa internet.

## Memperbarui aplikasi

Setiap kali ada file yang diubah, naikkan nomor `VERSION` di `sw.js` (misalnya `v2.1.0` → `v2.1.1`). HP petugas akan mengambil versi baru saat aplikasi dibuka dengan internet.

## Metode perhitungan

**Umum.** Z-score dihitung dengan metode LMS: `z = ((X/M)^L − 1) / (L·S)`; persentil = Φ(z) × 100. Umur dihitung dari selisih hari; umur bulan = hari ÷ 30,4375.

**WHO 2006 (< 60 bulan)** mengikuti aturan paket resmi WHO Anthro:
- Tabel dicari per hari umur; BB/PB (45–110 cm) dan BB/TB (65–120 cm) diinterpolasi per 0,1 cm.
- Umur < 731 hari memakai PB (diukur berdiri → +0,7 cm); umur ≥ 731 hari memakai TB (diukur berbaring → −0,7 cm).
- BB/U, BB/PB, BB/TB, dan IMT/U memakai *restricted z-score* WHO untuk nilai di luar ±3 SD. Z-score dibulatkan 2 desimal sebelum diklasifikasi.

**WHO 2007 (pembanding, 60–< 229 bulan; BB/U hanya sampai < 121 bulan)** mengikuti paket resmi WHO AnthroPlus (interpolasi per bulan). Hasilnya telah diuji dengan data uji resmi AnthroPlus: 2.096 z-score identik (selisih 0,00).

**CDC 2000.** Nilai L, M, S diinterpolasi linear antartitik tabel. Anak < 24 bulan memakai grafik 0–36 bulan; 24–36 bulan mengikuti cara ukur. Hasil hitung telah dicocokkan dengan kolom persentil resmi CDC.

**%BBI** = BB aktual ÷ BB ideal × 100. BB ideal = median BB/PB atau BB/TB (WHO untuk balita; CDC untuk anak ≥ 5 tahun bila TB masih dalam rentang). Di luar rentang itu dipakai metode *height-age* CDC: umur saat P50 TB/U sama dengan TB anak, lalu diambil P50 BB/U pada umur tersebut.

| Indeks | Klasifikasi Permenkes No. 2 Tahun 2020 (WHO) |
|---|---|
| BB/U (0–60 bln) | < −3 SD BB sangat kurang · −3 s.d. < −2 BB kurang · −2 s.d. +1 normal · > +1 risiko BB lebih |
| PB/U, TB/U | < −3 SD sangat pendek · −3 s.d. < −2 pendek · −2 s.d. +3 normal · > +3 tinggi |
| BB/PB, BB/TB, IMT/U (0–60 bln) | < −3 gizi buruk · −3 s.d. < −2 gizi kurang · −2 s.d. +1 gizi baik · > +1 s.d. +2 berisiko gizi lebih · > +2 s.d. +3 gizi lebih · > +3 obesitas |
| IMT/U (5–18 th) | < −3 gizi buruk · −3 s.d. < −2 gizi kurang · −2 s.d. +1 gizi baik · > +1 s.d. +2 gizi lebih · > +2 obesitas |
| LK/U | < −2 SD atau > +2 SD perlu evaluasi |

| Indeks | Klasifikasi CDC 2000 |
|---|---|
| IMT/U | < P5 gizi kurang · P5–< P85 normal · P85–< P95 gizi lebih · ≥ P95 obesitas · ≥ 120% P95 obesitas berat |
| TB/U, PB/U | < P3 pendek (rekomendasi IDAI); > P97 tinggi |
| BB/PB, BB/TB | < P5 kurus · ≥ P95 gemuk |
| %BBI | < 70% gizi buruk · 70–< 90% gizi kurang · 90–110% gizi baik · > 110–120% overweight · > 120% obesitas |

## Sumber data

- **CDC 2000:** tabel LMS resmi NCHS/CDC (`wtageinf`, `lenageinf`, `hcageinf`, `wtleninf`, `wtage`, `statage`, `bmiagerev`, `wtstat`), https://www.cdc.gov/growthcharts/
- **WHO 2006 dan WHO 2007:** tabel LMS dari paket resmi WHO `anthro` dan `anthroplus`, https://github.com/WorldHealthOrganization
- Kuczmarski RJ, dkk. 2000 CDC Growth Charts for the United States: Methods and Development. *Vital Health Stat* 11(246), 2002.
- WHO Multicentre Growth Reference Study Group. WHO Child Growth Standards: Methods and Development. WHO, 2006.
- de Onis M, dkk. Development of a WHO growth reference for school-aged children and adolescents. *Bull WHO* 85:660–667, 2007.
- Peraturan Menteri Kesehatan RI No. 2 Tahun 2020 tentang Standar Antropometri Anak.

## Daftar file

Semua file diletakkan sejajar (tanpa subfolder) agar mudah diunggah lewat tombol **Add file → Upload files** di GitHub: cukup pilih semua file sekaligus.

```
index.html               halaman utama
style.css                tampilan
app.js                   antarmuka, grafik, panduan, ekspor PDF/JPG
growth.js                mesin perhitungan (WHO 2006, WHO 2007, CDC 2000)
cdc2000-data.js          tabel LMS CDC 2000
who-data.js              tabel LMS WHO 2006 & WHO 2007
html2canvas.min.js       pustaka ekspor gambar (MIT)
jspdf.umd.min.js         pustaka ekspor PDF (MIT)
manifest.json, sw.js     pengaturan PWA (pasang di HP & mode offline)
logo-poltekkes-makassar.png, icon-*.png, maskable-512.png, apple-touch-icon.png   logo & ikon
.nojekyll                penanda untuk GitHub Pages (file tersembunyi)
```

## Catatan

Aplikasi ini alat bantu skrining dan pendidikan. Hasilnya tidak menggantikan penilaian klinis oleh dokter atau dietisien. Cut-off %BBI sebaiknya dicocokkan dengan rekomendasi IDAI terbaru yang berlaku di fasilitas Anda.

Pustaka pihak ketiga: html2canvas (MIT), jsPDF (MIT).
