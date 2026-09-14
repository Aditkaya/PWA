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
