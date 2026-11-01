/* =========================================================
   AREWA MARKET - SPLASH (kalar shafi kawai)
   ---------------------------------------------------------
   Yana nuna kalar kore na shafin (kamar header) nan take,
   ba tare da hoto, rubutu ko animation ba, don kada ya dauki
   hankalin mutum. Yana bacewa da zarar shafi ya fara fitowa.
   - Sau daya a kowane zama (session).
   - Mafi tsawo daƙiƙa 1.5, ko da menene.
   Ana saka shi a <head>: <script src="splash.js"></script>
========================================================= */
(function(){

  try{
    if(sessionStorage.getItem("arewaSplashShown")) return;
    sessionStorage.setItem("arewaSplashShown", "1");
  }catch(e){}

  var style = document.createElement("style");
  style.textContent =
    "#arewaSplash{position:fixed;inset:0;z-index:2147483000;" +
    "background:linear-gradient(135deg,#0d3b2c 0%,#175e3f 55%,#1f7a4d 100%);" +
    "transition:opacity .3s ease}" +
    "#arewaSplash.out{opacity:0;pointer-events:none}";
  (document.head || document.documentElement).appendChild(style);

  var el = document.createElement("div");
  el.id = "arewaSplash";
  el.setAttribute("aria-hidden", "true");
  document.documentElement.appendChild(el);

  var done = false;

  function hide(){
    if(done) return;
    done = true;
    requestAnimationFrame(function(){
      el.classList.add("out");
      setTimeout(function(){
        if(el.parentNode) el.parentNode.removeChild(el);
        if(style.parentNode) style.parentNode.removeChild(style);
      }, 350);
    });
  }

  if(document.readyState !== "loading") hide();
  else document.addEventListener("DOMContentLoaded", hide);

  setTimeout(hide, 1500);   // na tsaro: kada ya makale

})();
