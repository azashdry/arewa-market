// =====================================================
// AREWA MARKET - PUSH NOTIFICATIONS (ɓangaren shafi)
// -----------------------------------------------------
// - Yana tambayar mutum izinin sanarwa (banner mai ladabi)
// - Yana ɗaukar token na wayar ya aika wa Worker
// - Yana ba da window.arewaNotify() don aika sanarwa
//   idan an aika saƙo ko friend request
// =====================================================

import { auth, app } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getMessaging,
  getToken,
  isSupported
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging.js";


/* ====== SAITI (ka cika waɗannan guda biyu) ====== */

// URL na Cloudflare Worker ɗinka, misali: https://arewa-push.azashdry.workers.dev
const WORKER_URL = "https://arewa-push.vercel.app";

// Firebase Console -> Project settings -> Cloud Messaging -> Web Push certificates -> Key pair
const VAPID_KEY = "BEerB-jewpbcrlUD-wq8jGl235JfnJ_Gb5tX2dm4bbHu_RrvxHgCMQpfFMd9jxlv5gta-XARuvHJsZeoXXHnm7Y";

/* ================================================ */

const configured =
  !WORKER_URL.startsWith("PASTE_") && !VAPID_KEY.startsWith("PASTE_");

const ASK_KEY = "arewaPushAskedAt";
const REG_KEY = "arewaPushReg";
const ASK_HIDE_DAYS = 3;


async function authHeaders(){
  const idToken = await auth.currentUser.getIdToken();
  return { "Authorization": "Bearer " + idToken, "Content-Type": "application/json" };
}


/* ---------- Rajistar token ---------- */

async function registerToken(){

  if(!(await isSupported())) return false;

  const reg = await navigator.serviceWorker.register("sw.js");
  await navigator.serviceWorker.ready;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg
  });
  if(!token) return false;

  const uid = auth.currentUser.uid;

  try{
    const prev = JSON.parse(localStorage.getItem(REG_KEY) || "null");
    if(prev && prev.token === token && prev.uid === uid &&
       Date.now() - prev.at < 7 * 86400000) return true;   // an riga an yi kwanan nan
  }catch(e){}

  const res = await fetch(WORKER_URL + "/register", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ token })
  });

  if(res.ok){
    try{ localStorage.setItem(REG_KEY, JSON.stringify({ token, uid, at: Date.now() })); }catch(e){}
  }
  return res.ok;
}


/* ---------- Aika sanarwa ---------- */

export async function notifyUser(payload){
  if(!configured || !auth.currentUser) return;
  try{
    fetch(WORKER_URL + "/notify", {
      method: "POST",
      keepalive: true,
      headers: await authHeaders(),
      body: JSON.stringify(payload)
    }).catch(() => {});
  }catch(e){}
}

window.arewaNotify = notifyUser;


/* ---------- Banner na neman izini ---------- */

function showAskBanner(){

  if(document.getElementById("pushAsk")) return;

  const bar = document.createElement("div");
  bar.id = "pushAsk";
  bar.style.cssText =
    "position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));" +
    "z-index:99990;display:flex;align-items:center;gap:10px;max-width:460px;margin:0 auto;" +
    "padding:12px 14px;border-radius:14px;color:#fff;font-family:Inter,Arial,sans-serif;" +
    "background:linear-gradient(135deg,#0d3b2c,#175e3f);border-bottom:3px solid #c9a227;" +
    "box-shadow:0 8px 28px rgba(0,0,0,.35)";

  const msg = document.createElement("div");
  msg.style.cssText = "flex:1;font-size:13px;line-height:1.35";
  msg.innerHTML = "<b style='font-size:14px'>🔔 Kunna sanarwa</b><br>" +
                  "Ka ga saƙonni da friend requests ko da app a rufe yake.";

  const yes = document.createElement("button");
  yes.type = "button";
  yes.textContent = "Kunna";
  yes.style.cssText =
    "flex:none;width:auto;height:auto;padding:9px 14px;border:0;border-radius:9px;" +
    "background:#c9a227;color:#0d3b2c;font-weight:700;font-size:13px;cursor:pointer;box-shadow:none";

  const no = document.createElement("button");
  no.type = "button";
  no.setAttribute("aria-label", "Daga baya");
  no.textContent = "✕";
  no.style.cssText =
    "flex:none;width:auto;height:auto;padding:4px 6px;border:0;background:none;" +
    "color:#fff;font-size:16px;cursor:pointer;box-shadow:none";

  function close(){ bar.remove(); }

  no.addEventListener("click", () => {
    try{ localStorage.setItem(ASK_KEY, String(Date.now())); }catch(e){}
    close();
  });

  yes.addEventListener("click", async () => {
    close();
    try{
      const perm = await Notification.requestPermission();
      if(perm === "granted") await registerToken();
      else localStorage.setItem(ASK_KEY, String(Date.now()));
    }catch(e){ console.error("push enable:", e); }
  });

  bar.appendChild(msg);
  bar.appendChild(yes);
  bar.appendChild(no);
  document.body.appendChild(bar);
}


/* ---------- Farawa ---------- */

onAuthStateChanged(auth, async (user) => {

  if(!user || !configured) return;
  if(!("Notification" in window) || !("serviceWorker" in navigator)) return;

  try{
    if(!(await isSupported())) return;   // misali iPhone idan ba a saka app ba
  }catch(e){ return; }

  if(Notification.permission === "granted"){
    registerToken().catch(e => console.error("push register:", e));
    return;
  }

  if(Notification.permission !== "default") return;   // an hana

  try{
    const t = Number(localStorage.getItem(ASK_KEY) || 0);
    if(t && Date.now() - t < ASK_HIDE_DAYS * 86400000) return;
  }catch(e){}

  setTimeout(showAskBanner, 4000);
});
