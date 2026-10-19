(function(){
  "use strict";

  var loader = document.getElementById("ayp-loader");

  function hideLoader(){
    if(!loader || loader.classList.contains("is-hidden")) return;
    loader.classList.add("is-hidden");
  }

  if(document.readyState === "complete"){
    window.setTimeout(hideLoader, 250);
  }else{
    window.addEventListener("load", function(){
      window.setTimeout(hideLoader, 250);
    }, {once:true});
  }

  // Fungsi opsional untuk menampilkan loader saat AJAX / proses lain.
  window.showAYPLoader = function(duration){
    if(!loader) return;
    loader.classList.remove("is-hidden");
    if(duration){
      window.setTimeout(hideLoader, duration);
    }
  };

  window.hideAYPLoader = hideLoader;
})();
