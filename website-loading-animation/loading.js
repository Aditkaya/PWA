/*
 * Reusable Website Loading
 * Loading hilang setelah seluruh halaman selesai dimuat.
 */
(function () {
  "use strict";

  function hidePageLoader() {
    var loader = document.getElementById("page-loader");

    if (!loader || loader.classList.contains("is-hidden")) {
      return;
    }

    loader.classList.add("is-hidden");

    // Hapus overlay setelah fade-out selesai.
    window.setTimeout(function () {
      if (loader && loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
    }, 300);
  }

  if (document.readyState === "complete") {
    hidePageLoader();
  } else {
    window.addEventListener("load", hidePageLoader, { once: true });
  }
})();
