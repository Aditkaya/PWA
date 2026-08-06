# Panduan Menjalankan Proyek PWA Absensi Karyawan

Proyek ini terbagi menjadi dua bagian: **Frontend** (React, TypeScript, Vite) dan **Backend** (PHP Native/PDO). Untuk menjalankan aplikasi secara penuh, Anda harus memastikan bahwa *Database*, *Backend*, dan *Frontend* berjalan secara bersamaan.

Berikut adalah langkah-langkahnya:

---

## 1. Menjalankan Database MySQL
Aplikasi ini membutuhkan database `aypsis` untuk memvalidasi login.
1. Buka aplikasi **XAMPP** atau **Laragon**.
2. Klik **Start** pada layanan **MySQL**.
3. Pastikan tidak ada *error* dan MySQL berjalan dengan baik.

---

## 2. Menjalankan Server Backend (API)
Backend bertugas untuk mengelola logika, terhubung ke database, dan merespons permintaan dari Frontend.

1. Buka aplikasi **Terminal** (Command Prompt / PowerShell / VS Code Terminal).
2. Arahkan direktori ke folder backend dengan perintah:
   ```bash
   cd c:\kerjaan\PWA\backend
   ```
3. Nyalakan server PHP bawaan dan arahkan *router* ke `api.php`:
   ```bash
   php -S localhost:8000 routes/api.php
   ```
4. **Penting:** Terminal ini akan tampak "diam/hang". Ini berarti server sedang menyala dan mendengarkan permintaan. **Jangan tutup terminal ini.**

---

## 3. Menjalankan Server Frontend (Web App)
Frontend adalah antarmuka visual yang dilihat oleh pengguna (UI).

1. Buka **Terminal Baru** (Biarkan terminal backend di Langkah 2 tetap menyala).
2. Arahkan direktori ke folder frontend dengan perintah:
   ```bash
   cd c:\kerjaan\PWA\frontend
   ```
3. (Opsional) Jika Anda baru pertama kali menjalankan di komputer baru, instal modulnya dulu: `npm install`
4. Jalankan server *development* Vite:
   ```bash
   npm run dev
   ```
5. Tunggu hingga muncul tulisan `➜  Local: http://localhost:5173/`.

---

## 4. Mengakses Aplikasi
1. Buka peramban (browser) favorit Anda seperti Google Chrome.
2. Akses alamat URL: **`http://localhost:5173/`**
3. Anda akan melihat halaman Login.
4. Coba masuk menggunakan *Username* dan *Password* yang ada di database `aypsis` Anda.

> **Menghentikan Server**
> Jika Anda sudah selesai bekerja dan ingin mematikan server (baik Frontend maupun Backend), cukup klik pada jendela terminal yang bersangkutan dan tekan tombol **`Ctrl + C`** pada keyboard Anda.
