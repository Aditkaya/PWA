# Validasi wajah di server

HP hanya membuka kamera/GPS dan mengirim foto ketika pengguna menekan tombol foto.
`POST /api/attendance/break` memanggil layanan AI sebelum menulis foto atau absensi.
Registrasi (`POST /api/face-registration`) juga memeriksa bahwa foto berisi tepat satu wajah.
Foto yang ditolak tidak disimpan. Kegagalan layanan menghasilkan HTTP 503, bukan melewati validasi.

## Instalasi pada komputer/server PHP yang sama

Diperlukan Node.js 20 atau lebih baru, PHP dengan ekstensi cURL dan GD, serta file model
yang sudah disertakan di `backend/face-ai/models`. Model tidak diunduh dari internet saat startup.

```sh
cd backend/face-ai
npm ci
npm run setup
npm start
```

Perintah setup membuat token acak di `backend/config/face-ai.local.json` dan tidak menimpa
konfigurasi yang ada. PHP dan layanan Node membaca file yang sama. File ini diabaikan Git.
Pastikan akun proses PHP dan Node bisa membacanya. Di Linux, jalankan setup sebagai akun
layanan yang sama (misalnya `www-data`), atau atur pemilik/grup file dan izin baca yang sesuai.
Jangan meletakkan direktori backend/config di document root publik.

Di terminal lain:

```sh
cd backend/face-ai
npm run health
```

Hasil siap dengan akselerasi: `{"ready":true,"backend":"tensorflow"}`. Saat startup model dimuat sekali ke memori worker Node.
Biarkan proses berjalan selama aplikasi dipakai. Di Windows gunakan terminal terpisah;
di Linux gunakan pengelola layanan seperti contoh systemd berikut.

Jika lokasi uploads berbeda dari konfigurasi lama aplikasi, isi environment proses PHP
`UPLOAD_BASE_DIR` dengan direktori induk folder `uploads`, dan `AYPSIS_PUBLIC_DIR`
dengan direktori public AYPSIS (atau nilai yang sama). Contoh PowerShell sebelum menyalakan PHP:

```powershell
$env:UPLOAD_BASE_DIR = 'C:\folder_joki\PWA-main\backend'
$env:AYPSIS_PUBLIC_DIR = $env:UPLOAD_BASE_DIR
php -S localhost:8000 backend/routes/api.php
```

Foto registrasi lama harus tetap tersedia di folder uploads tersebut.

## Contoh systemd di Linux

Sesuaikan lokasi Node, direktori proyek, dan akun layanan sebelum memasang unit:

```ini
[Unit]
Description=AYPSIS face verification
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/pwa/backend/face-ai
ExecStart=/usr/bin/node server.cjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Layanan hanya mendengarkan `127.0.0.1:8001` dan meminta token. HP tidak mengakses port ini.
Hanya web PHP/HTTPS aplikasi yang perlu bisa dijangkau karyawan. Web server harus melayani
frontend dari `frontend/dist` dan meneruskan `/api/*` ke router PHP; jangan melayani seluruh
direktori proyek sebagai file publik. Router PHP membatasi file publik ke folder uploads.

Konfigurasi opsional (environment proses):

| Variabel | Pengguna | Nilai default |
| --- | --- | --- |
| `FACE_AI_URL` | PHP dan health | `http://127.0.0.1:8001` |
| `FACE_AI_TOKEN` | PHP, Node, health | token file konfigurasi |
| `FACE_AI_PORT` | Node | `8001` |
| `FACE_AI_MODEL_DIR` | Node | folder `models` di layanan ini |
| `FACE_AI_BACKEND` | Node | otomatis mencoba native; `tensorflow` mewajibkan native, `cpu` untuk fallback |

Jika PHP dan Node berjalan di container berbeda, alamat loopback tidak saling menjangkau;
contoh ini untuk dua proses pada host yang sama. Jangan membuka layanan ke jaringan umum.

## Perilaku dan batas

- Model pencocokan dan ambang jarak 0,58 mengikuti implementasi sebelumnya. Backend
  mengambil foto referensi dari data pengguna, bukan menerima referensi dari browser.
- Model berada di backend; paket frontend tidak mengimpor face-api atau meminta `/models`.
- Saat PWA diperbarui, cache model perangkat dari implementasi sebelumnya dibersihkan.
- Referensi yang sudah dihitung disimpan di memori dengan batas 500 entri, berdasarkan hash
  foto. Registrasi ulang otomatis menghasilkan referensi baru.
- Worker memproses satu pekerjaan sekaligus, antrean maksimal 8. Permintaan PHP dibatasi
  25 detik. Jika server sibuk, pengguna menerima pesan untuk mencoba lagi.
  Pekerjaan yang melewati 20 detik menghentikan worker; systemd dapat memulai ulang layanan.
- Input JPEG/PNG maksimal 2 MB/2 megapiksel dinormalisasi PHP menjadi JPEG maksimal sisi
  640 piksel. TensorFlow native memakai CPU server melalui C++ tanpa GPU atau layanan berbayar.
  Dependensi opsional `@tensorflow/tfjs-node` dikunci ke 1.7.0 agar cocok dengan core face-api.js.
  Jangan menaikkan versi paket TensorFlow secara terpisah. Instalasi pertama mengunduh library
  native; model wajah tetap berasal dari folder lokal. Jika instalasi native tidak didukung,
  mode otomatis kembali ke CPU JavaScript yang lebih lambat. Periksa nilai `backend` pada health.
  Untuk produksi gunakan `Environment=FACE_AI_BACKEND=tensorflow` dalam unit systemd agar
  kegagalan akselerasi terlihat sebagai kegagalan startup. Kapasitas absen serentak tetap perlu diukur.
- Ini pencocokan identitas dari foto, belum deteksi keaslian wajah hidup (anti foto/replay).
- Sistem login/user_id aplikasi mengikuti backend yang sudah ada; perubahan ini bukan
  penggantian mekanisme autentikasi aplikasi.

## Urutan rilis

1. Pasang dependensi dan konfigurasi layanan di server tujuan; jalankan hingga health siap.
2. Rilis PHP yang mewajibkan validasi server.
3. Rilis frontend/dist baru. Jika layanan belum siap, backend menolak absensi dengan 503.

Build ulang frontend setelah perubahan. Untuk tes otomatis:

```sh
cd backend/face-ai
npm test
```

Tes PHP menggunakan SQLite sementara, tanpa koneksi ke database MySQL produksi.
Tes model asli memastikan gambar tanpa wajah ditolak; tes kecocokan wajah karyawan
dan beban serentak tetap perlu dilakukan pada server tujuan sebelum pemakaian penuh.

Referensi implementasi: [face-api.js](https://github.com/justadudewhohacks/face-api.js)
dan [jpeg-js](https://github.com/jpeg-js/jpeg-js).
