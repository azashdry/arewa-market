// =====================================================
// AREWA MARKET - DOWNLOAD APP BANNER
// Android: banner mai maɓallin "Download" (APK) a ƙasan shafi.
// iPhone/Safari: umarni (Share -> Add to Home Screen).
// Ba ya fitowa a cikin app ɗin kanta, ko bayan an rufe shi.
// =====================================================

(function(){

  const APK_URL =
    "https://github.com/azashdry/arewa-market/releases/latest/download/Arewa.Market.apk";

  const KEY = "arewaInstallDismissedAt";
  const HIDE_DAYS = 3;

  const inApp =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.indexOf("android-app://") === 0;

  if(inApp) return;   // an riga an buɗe cikin app

  try{
    const t = Number(localStorage.getItem(KEY) || 0);
    if(t && Date.now() - t < HIDE_DAYS * 86400000) return;
  }catch(e){}

  const ua = navigator.userAgent || "";
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isIOSSafari = isIOS && /safari/i.test(ua) &&
    !/crios|fxios|edgios|instagram|fban|fbav|whatsapp/i.test(ua);

  // Cire tsohon banner na Chrome ("Install app"), muna amfani da namu
  window.addEventListener("beforeinstallprompt", (e) => e.preventDefault());

  let bar = null;

  function dismiss(){
    try{ localStorage.setItem(KEY, String(Date.now())); }catch(e){}
    if(bar){ bar.remove(); bar = null; }
  }

  function build(text, link){

    if(bar) return;

    bar = document.createElement("div");
    bar.setAttribute("role", "dialog");
    bar.style.cssText =
      "position:fixed;left:12px;right:12px;" +
      "bottom:calc(76px + env(safe-area-inset-bottom,0px));" +
      "z-index:99999;display:flex;align-items:center;gap:10px;" +
      "padding:12px 14px;border-radius:14px;color:#fff;" +
      "background:linear-gradient(135deg,#0d3b2c,#175e3f);" +
      "border-bottom:3px solid #c9a227;" +
      "box-shadow:0 8px 28px rgba(0,0,0,.35);" +
      "font-family:Inter,Arial,sans-serif;max-width:460px;margin:0 auto;";

    const img = document.createElement("img");
    img.src = "apple-touch-icon.png";
    img.alt = "";
    img.style.cssText = "width:40px;height:40px;border-radius:10px;flex:none";
    img.onerror = () => img.remove();

    const msg = document.createElement("div");
    msg.style.cssText = "flex:1;font-size:13px;line-height:1.35";
    msg.innerHTML = "<b style='font-size:14px'>Arewa Market</b><br>" + text;

    bar.appendChild(img);
    bar.appendChild(msg);

    if(link){
      const a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.label;
      a.setAttribute("download", "");
      a.style.cssText =
        "flex:none;padding:9px 14px;border-radius:9px;background:#c9a227;" +
        "color:#0d3b2c;font-weight:700;font-size:13px;text-decoration:none;";
      bar.appendChild(a);
    }

    const x = document.createElement("button");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.textContent = "✕";
    x.style.cssText =
      "flex:none;width:auto;height:auto;padding:4px 6px;border:0;background:none;" +
      "color:#fff;font-size:16px;cursor:pointer;box-shadow:none;display:block;";
    x.addEventListener("click", dismiss);
    bar.appendChild(x);

    document.body.appendChild(bar);
  }

  /* ----- Android: sauke APK ----- */
  if(isAndroid){
    window.addEventListener("load", () => {
      setTimeout(() => build(
        "Download our Android app.",
        { href: APK_URL, label: "Download" }
      ), 1500);
    });
  }

  /* ----- iPhone / iPad (Safari) ----- */
  if(isIOSSafari){
    window.addEventListener("load", () => {
      setTimeout(() => build(
        "To install: tap <b>Share</b> (⬆︎), then <b>Add to Home Screen</b>.",
        null
      ), 2500);
    });
  }

})();
