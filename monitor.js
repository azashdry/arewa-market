// =====================================================
// AREWA MARKET - HEALTH MONITOR (client)
// Yana kama kurakurai a kowane shafi ya rubuta su a
// Firestore (errorLogs) don admin ya gani a health.html
// =====================================================

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  setDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const MAX_PER_SESSION = 15;   // iyaka a kowane zama
const seen = new Set();       // kuskure daya, rahoto daya a kowane zama
const queue = [];             // kurakuran da suka faru kafin login
let sent = 0;
let uid = null;


function pageName(){
  return (location.pathname.split("/").pop() || "index.html").slice(0, 60);
}

// Cire dogayen ID/token daga sako (sirri + don a hada kuskure iri daya)
function clean(s, n){
  return String(s || "")
    .replace(/[A-Za-z0-9_-]{20,}/g, "<id>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);
}

function hash(str){
  let h = 5381;
  for(let i = 0; i < str.length; i++){
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function device(){
  const ua = navigator.userAgent || "";
  const os = ua.match(/(Android [\d.]+|iPhone OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_]+|Linux)/);
  const br = ua.match(/(SamsungBrowser|Edg|Firefox|Chrome|Safari)\/[\d.]+/);
  return ((os ? os[1] : "") + " | " + (br ? br[0] : "")).slice(0, 100);
}

const IGNORE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection/i
];

function report(kind, message, source, code){

  try{

    message = clean(message, 300);

    if(!message) return;

    if(IGNORE.some(r => r.test(message))) return;

    // kar mu rubuta kurakuran monitor din kansa (guje wa madauki)
    if(/errorLogs|monitor\.js/i.test(message + " " + source)) return;

    // idan babu intanet, ba kuskuren app ba ne
    if(navigator.onLine === false) return;

    const page = pageName();

    const id = hash(page + "|" + kind + "|" + message.slice(0, 120));

    if(seen.has(id)) return;

    seen.add(id);

    const item = {
      id,
      page,
      kind,
      message,
      source: clean(source, 120),
      code: clean(code, 40)
    };

    if(uid){
      send(item);
    }else if(queue.length < 20){
      queue.push(item);
    }

  }catch(e){}

}

async function send(item){

  if(sent >= MAX_PER_SESSION) return;

  sent++;

  try{

    await setDoc(
      doc(db, "errorLogs", item.id),
      {
        page: item.page,
        kind: item.kind,
        message: item.message,
        source: item.source,
        code: item.code,
        count: increment(1),
        status: "open",
        lastSeen: serverTimestamp(),
        lastUid: uid,
        lastDevice: device()
      },
      { merge: true }
    );

  }catch(e){
    // ba za mu kara rahoto ba idan rubutu ya kasa
  }

}

onAuthStateChanged(auth, user => {

  uid = user ? user.uid : null;

  if(uid){
    queue.splice(0).forEach(send);
  }

});


/* ---------- JavaScript errors + resource (hoto/script) ---------- */

window.addEventListener("error", e => {

  const t = e.target;

  if(t && t !== window && t.tagName){

    const tag = t.tagName;

    if(tag === "IMG" || tag === "SCRIPT" || tag === "LINK"){

      let where = "";

      try{
        const u = new URL(t.src || t.href, location.href);
        where = tag === "IMG" ? u.host : u.host + u.pathname;
      }catch(_){}

      report("resource", "Failed to load " + tag.toLowerCase() + ": " + where, "", "");

    }

    return;

  }

  report(
    "js",
    e.message,
    ((e.filename || "").split("/").pop() || "") + ":" + (e.lineno || 0),
    ""
  );

}, true);


/* ---------- Unhandled promise (misali Firestore permission-denied) ---------- */

window.addEventListener("unhandledrejection", e => {

  const r = e.reason;

  const code = r && r.code ? String(r.code) : "";

  const msg =
    (code ? code + ": " : "") +
    ((r && r.message) ? r.message : String(r));

  report("promise", msg, "", code);

});


/* ---------- console.error (kurakuran da app ya kama amma bai nuna ba) ---------- */

const origError = console.error;

console.error = function(...args){

  try{

    const obj = args.find(x => x && typeof x === "object" && (x.code || x.message));

    const code = obj && obj.code ? String(obj.code) : "";

    const text =
      (typeof args[0] === "string" ? args[0] : "") +
      (obj ? " " + (code ? code + ": " : "") + (obj.message || "") : "");

    report("console", text || String(args[0]), "console.error", code);

  }catch(_){}

  return origError.apply(console, args);

};


/* ---------- Hotunan da suka lalace kafin monitor ya fara aiki ---------- */

window.addEventListener("load", () => {

  setTimeout(() => {

    document.querySelectorAll("img").forEach(img => {

      if(img.src && img.complete && img.naturalWidth === 0){

        try{

          report(
            "resource",
            "Failed to load img: " + new URL(img.src, location.href).host,
            "",
            ""
          );

        }catch(_){}

      }

    });

  }, 2500);

});
