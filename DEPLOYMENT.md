# Pembaruan production

## Pengembalian Asset

Setelah menerima fitur Pengembalian Asset, jalankan sekali dari root project PWA:

```bash
php backend/create_asset_returns_tables.php
```

Karyawan membuka **Tanda Terima Asset → Pengembalian Asset**, memilih 1–6 asset,
mengisi tanggal, alasan, kondisi, kelengkapan, dan catatan, lalu menyimpan pengajuan.
Dokumen Word dapat diunduh dari riwayat untuk pemeriksaan dan tanda tangan.
Template asli disertakan di `backend/templates/pengembalian-asset.docx`;
kop, format, tabel, pernyataan, dan kolom tanda tangan dipertahankan.
Server memerlukan ekstensi PHP `zip`, `dom`, dan `mbstring`; Microsoft Word
atau LibreOffice tidak diperlukan untuk menghasilkan unduhan di server.

Status awal adalah **Menunggu Pelepasan Admin**. Pengajuan tidak mengubah
`assets.karyawan_id`, status asset, atau data tanda terima. Admin melepas asset
melalui Master Asset AYPSIS seperti biasa. Saat riwayat dimuat ulang, PWA
memeriksa apakah `assets.karyawan_id` sudah kosong atau berpindah dari karyawan
pengaju; item tersebut ditandai sudah dilepas. Pengajuan menjadi
**Sudah Dikembalikan** setelah seluruh item dilepas. Pelepasan sebagian ditampilkan
per item. Waktu selesai adalah waktu pelepasan terdeteksi oleh PWA.
Dokumen menggunakan snapshot saat pengajuan, sehingga tetap dapat diunduh
setelah data tanda terima diperbarui/dihapus oleh admin. Tidak ada persetujuan
admin tambahan di PWA; kedua project harus memakai database Master Asset yang sama.

## Foto Tanda Terima Asset

Untuk fitur foto Tanda Terima Asset, jalankan sekali setelah menerima perubahan:

```bash
php backend/create_asset_receipt_photos_table.php
```

Foto baru disimpan ke `AYPSIS_PUBLIC_DIR/uploads/tanda-terima-assets/photos` dan nama file
dicatat di `tanda_terima_asset.foto`, sesuai disk `tanda_terima_asset` AYPSIS.
Riwayat upload tetap dicatat di `tanda_terima_asset_fotos`. Skrip persiapan di atas
juga menambahkan kolom `foto` jika belum tersedia. Pastikan
proses PHP PWA dapat menulis ke folder tersebut. Foto di folder ini mengikuti akses
file foto Tanda Terima Asset AYPSIS. Kamera memerlukan HTTPS atau localhost.

PWA membaca `tanda_terima_asset.foto` terlebih dahulu, sehingga foto yang diunggah
melalui AYPSIS juga dapat dibuka tanpa riwayat upload PWA. Kedua project harus
menggunakan database dan folder fisik foto yang sama; atur `AYPSIS_PUBLIC_DIR`
ke direktori `public` project AYPSIS. Jika kolom foto kosong, PWA memakai riwayat
foto lama yang cocok dengan pemegang. Nama file Laravel dan PWA didukung.

Untuk menghubungkan foto PWA lama ke `tanda_terima_asset.foto`, jalankan sekali:

```bash
php backend/sync_asset_receipt_photos.php
```

Proses ini menyalin foto lama yang pemegangnya masih cocok dan kolom `tanda_terima_asset.foto`
masih kosong. Foto lama di `uploads/assets/photos` dan `backend/private/asset-receipts` tetap dipertahankan
dan dapat dibuka oleh pemegangnya melalui API PWA.

Repository menyertakan hasil build `frontend/dist`. Build dan commit dilakukan
di lingkungan pengembangan; server production cukup menerima hasilnya:

```bash
cd /var/www/pwa
git pull origin main
```

Tidak perlu menjalankan `npm install` atau `npm run build` di server untuk
pembaruan frontend yang hasil build-nya sudah disertakan. Muat ulang aplikasi
setelah pull untuk mengaktifkan service worker terbaru.

---

## Konfigurasi Environment (backend/.env)

Buat file `/var/www/pwa/backend/.env` dengan isi berikut dan sesuaikan nilainya:

```env
# Direktori publik server AYPSIS (Laravel) — tempat file uploads/ berada
AYPSIS_PUBLIC_DIR=/var/www/aypsis/public

# URL publik server AYPSIS — digunakan sebagai fallback gambar pamflet/berita
# yang disimpan di server AYPSIS dan tidak ada salinannya di server PWA.
# Contoh: https://sistem.perusahaan.com
AYPSIS_BASE_URL=https://DOMAIN-AYPSIS-ANDA
```

> **Penting**: File `.env` tidak boleh di-commit ke Git karena berisi konfigurasi
> yang berbeda antara production dan lokal.

---

## Gambar Pamflet/Berita

Gambar berita dan pamflet yang diupload melalui sistem AYPSIS disimpan di
`AYPSIS_PUBLIC_DIR/uploads/pamflet/`. Backend PWA akan otomatis menggunakan
`AYPSIS_BASE_URL` sebagai fallback URL jika file tidak ditemukan secara lokal.

Pastikan domain AYPSIS mengizinkan CORS untuk gambar (`Access-Control-Allow-Origin`)
agar browser dapat menampilkan gambar dari domain tersebut di halaman PWA.

---

## Service Worker

Urutan entri cache service worker dibuat konsisten di `frontend/vite.config.ts`
agar perbedaan urutan file Windows/Linux tidak mengubah `frontend/dist/sw.js`.

Jika server masih memiliki perubahan `sw.js` dari build lama, lakukan sekali
sebelum menerima perbaikan ini:

```bash
git stash push -m "Backup sw sebelum perbaikan build" -- frontend/dist/sw.js
git pull origin main
```

Cadangan tetap tersimpan; tidak perlu menerapkan kembali service worker lama.
Perubahan kode lain yang benar-benar berbeda tetap perlu diperiksa jika Git
melaporkan konflik. Jangan mengabaikan seluruh folder `dist` karena server
mengandalkan hasil build tersebut untuk menampilkan aplikasi.
