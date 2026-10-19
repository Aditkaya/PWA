AYP ANIMATED WEBSITE LOADER
===========================

PREVIEW
-------
Buka index.html di browser.
Klik "Lihat Animasi Lagi" jika loader sudah menghilang.

FILE
----
index.html
ayp-loader.css
ayp-loader.js
ayp-logo-transparent.png

CARA PASANG
-----------
1. Copy ayp-logo-transparent.png ke project.
2. Copy ayp-loader.css ke folder CSS.
3. Copy ayp-loader.js ke folder JS.
4. Copy blok <div id="ayp-loader"...> dari index.html tepat setelah <body>.
5. Load ayp-loader.css di <head>.
6. Load ayp-loader.js sebelum </body> atau gunakan defer.

ANIMASI
-------
- Logo perusahaan AYP berada di tengah.
- Logo memiliki pulse sangat lembut.
- Ring biru berputar 360 derajat setiap 0.9 detik.
- Loading... memiliki titik bergerak.
- Overlay transparan + blur tipis.
- Loader fade-out 260ms setelah halaman selesai dimuat.
- Responsive desktop/mobile.

TRANSPARANSI OVERLAY
--------------------
Default:
background: rgba(255,255,255,.38);

Lebih transparan:
background: rgba(255,255,255,.15);

Benar-benar tanpa lapisan putih:
background: transparent;
backdrop-filter: none;
