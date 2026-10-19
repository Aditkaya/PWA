WEBSITE LOADING ANIMATION
=========================

File:
- loading.html  : potongan HTML loader
- loading.css   : desain dan animasi spinner
- loading.js    : menghilangkan loader setelah window load
- demo.html     : contoh lengkap yang bisa langsung dibuka

CARA PASANG
===========

1. Copy loading.css ke folder CSS project Anda.
2. Copy loading.js ke folder JS project Anda.
3. Masukkan isi loader dari loading.html tepat setelah tag <body>.
4. Hubungkan loading.css di <head>.
5. Hubungkan loading.js sebelum </body> atau gunakan atribut defer.

Untuk project PHP yang memiliki header/template global, loader sebaiknya
dipasang pada template global agar reusable di semua halaman.

CATATAN
=======
Background default adalah putih (#ffffff). Silakan sesuaikan properti
background pada .page-loader jika website Anda menggunakan background gelap.
