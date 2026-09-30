# Pembaruan production

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
