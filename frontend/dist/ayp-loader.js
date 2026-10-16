(function () {
  "use strict";

  var loader = document.getElementById("ayp-loader");
  var root = document.getElementById("root");
  if (!loader || !root) return;

  var pageLoaded = document.readyState === "complete";
  var startedAt = Date.now();
  var minimumDuration = 2500;
  var scheduled = false;
  var observer = new MutationObserver(tryHide);

  function tryHide() {
    if (!pageLoaded || !root.firstElementChild || scheduled) return;

    scheduled = true;
    observer.disconnect();
    window.setTimeout(function () {
      loader.classList.add("is-hidden");
      window.setTimeout(function () {
        loader.remove();
      }, 300);
    }, Math.max(0, minimumDuration - (Date.now() - startedAt)));
  }

  observer.observe(root, { childList: true });
  if (!pageLoaded) {
    window.addEventListener("load", function () {
      pageLoaded = true;
      tryHide();
    }, { once: true });
  }
  tryHide();
})();
