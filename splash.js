/* =========================================================
   AREWA MARKET - SPLASH / LOADING SCREEN (kamar Facebook)
   ---------------------------------------------------------
   Yana nuna allo mai logo da animation nan take lokacin da
   app ko shafi ya fara buɗewa, maimakon farar takarda.
   - Ana nuna shi sau ɗaya a kowane zama (session), kada ya
     dame mutum idan yana tafiya tsakanin shafuka.
   - Yana ɓacewa bayan shafi ya gama loading (mafi ƙaranci
     0.7 daƙiƙa), kuma a ƙarshe bayan daƙiƙa 6 ko da menene.
   Ana saka shi a <head>, kafin sauran scripts:
   <script src="splash.js"></script>
========================================================= */
(function(){

  try{
    if(sessionStorage.getItem("arewaSplashShown")) return;
    sessionStorage.setItem("arewaSplashShown", "1");
  }catch(e){}

  var css =
    "#arewaSplash{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;text-align:center;color:#fff;" +
    "background:radial-gradient(circle at 50% 30%,#1f7a4d 0%,#175e3f 40%,#0d3b2c 100%);" +
    "font-family:Inter,Arial,sans-serif;transition:opacity .35s ease;" +
    "padding:env(safe-area-inset-top,0px) 24px env(safe-area-inset-bottom,0px)}" +
    "#arewaSplash.out{opacity:0;pointer-events:none}" +
    "#arewaSplash .sp-logo{width:104px;height:104px;border-radius:26px;background:#fff;" +
    "box-shadow:0 10px 36px rgba(0,0,0,.35),0 0 0 3px #c9a227;display:flex;align-items:center;" +
    "justify-content:center;overflow:hidden;animation:spPulse 1.6s ease-in-out infinite}" +
    "#arewaSplash .sp-logo img{width:100%;height:100%;object-fit:cover;display:block}" +
    "#arewaSplash .sp-logo svg{width:70%;height:70%;animation:spSpin 6s linear infinite}" +
    "#arewaSplash h1{font-size:26px;letter-spacing:.3px;margin:22px 0 6px;font-weight:800}" +
    "#arewaSplash p{font-size:13.5px;opacity:.85;margin:0}" +
    "#arewaSplash .sp-bar{width:190px;max-width:60vw;height:5px;border-radius:5px;margin-top:30px;" +
    "background:rgba(255,255,255,.2);overflow:hidden}" +
    "#arewaSplash .sp-bar i{display:block;height:100%;width:40%;border-radius:5px;" +
    "background:linear-gradient(90deg,#c9a227,#f3d36b);animation:spSlide 1.1s ease-in-out infinite}" +
    "@keyframes spPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}" +
    "@keyframes spSpin{to{transform:rotate(360deg)}}" +
    "@keyframes spSlide{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}" +
    "@media(prefers-reduced-motion:reduce){#arewaSplash .sp-logo,#arewaSplash .sp-logo svg," +
    "#arewaSplash .sp-bar i{animation:none}}";

  var petals =
    '<svg viewBox="0 0 40 40" aria-hidden="true">' +
    '<ellipse cx="20" cy="9" rx="4.6" ry="7.6" fill="#175e3f"/>' +
    '<ellipse cx="20" cy="9" rx="4.6" ry="7.6" fill="#c9a227" transform="rotate(60 20 20)"/>' +
    '<ellipse cx="20" cy="9" rx="4.6" ry="7.6" fill="#1f7a4d" transform="rotate(120 20 20)"/>' +
    '<ellipse cx="20" cy="9" rx="4.6" ry="7.6" fill="#d9b84a" transform="rotate(180 20 20)"/>' +
    '<ellipse cx="20" cy="9" rx="4.6" ry="7.6" fill="#0d3b2c" transform="rotate(240 20 20)"/>' +
    '<ellipse cx="20" cy="9" rx="4.6" ry="7.6" fill="#2f8f5b" transform="rotate(300 20 20)"/></svg>';

  var style = document.createElement("style");
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  var el = document.createElement("div");
  el.id = "arewaSplash";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    '<div class="sp-logo" id="spLogo">' + petals + '</div>' +
    '<h1>Arewa Market</h1>' +
    '<p>Kasuwar Arewa a Hannunka</p>' +
    '<div class="sp-bar"><i></i></div>';
  document.documentElement.appendChild(el);

  // Idan akwai logo na gaske (apple-touch-icon.png), a nuna shi maimakon furannin
  var img = new Image();
  img.alt = "";
  img.onload = function(){
    var box = document.getElementById("spLogo");
    if(box){ box.innerHTML = ""; box.appendChild(img); }
  };
  img.src = "apple-touch-icon.png";

  var started = Date.now(), done = false;

  function hide(){
    if(done) return;
    done = true;
    var wait = Math.max(0, 700 - (Date.now() - started));
    setTimeout(function(){
      el.classList.add("out");
      setTimeout(function(){
        if(el.parentNode) el.parentNode.removeChild(el);
        if(style.parentNode) style.parentNode.removeChild(style);
      }, 400);
    }, wait);
  }

  if(document.readyState === "complete") hide();
  else window.addEventListener("load", hide);

  setTimeout(hide, 6000);   // na tsaro: kada ya makale
})();
