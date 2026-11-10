/* =========================================================
   AREWA MARKET - REELS (Mataki na 2 / sashe na 1)
   - Kallo: gungurawa tsaye, bidiyo yana kunna ga wanda ke kan allo kaɗai
   - Ana saka src ne kawai ga bidiyon da ke kusa (don adana data)
   - Aika bidiyo: har dakika 45 da 50MB, ta Cloudinary (cloudinary-upload.js)
   - Hoton farko (poster) Cloudinary ne ke samar da shi daga bidiyon
========================================================= */
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection, query, orderBy, limit, startAfter, getDocs, getDoc, addDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const PAGE = 6;
const MAX_SEC = 45;
const MAX_MB = 50;
const MAX_CAPTION = 200;
const COOLDOWN_MS = 30000;
const CLOUD = "https://res.cloudinary.com/";

const $ = (id) => document.getElementById(id);
const box = $("reels");

const S = { me: null, myData: {}, last: null, more: false, loading: false, muted: true, reels: new Map(), lastPostAt: 0 };
let pickedFile = null, pickedUrl = "", pickedDur = 0, busy = false;

/* ---------------- helpers ---------------- */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function toast(m) {
  const t = $("toast");
  t.textContent = m; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400);
}
// Hoton farko daga bidiyon Cloudinary (frame na farko, .jpg)
function posterOf(url) {
  if (typeof url !== "string" || url.indexOf("res.cloudinary.com") < 0 || url.indexOf("/video/upload/") < 0) return "";
  return url.replace("/video/upload/", "/video/upload/so_0,f_jpg,w_540,q_auto/").replace(/\.[A-Za-z0-9]+(\?.*)?$/, ".jpg");
}
function httpUrl(u) { return typeof u === "string" && /^https?:\/\//.test(u) ? u : ""; }
function tsMs(ts) { return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0; }
function avatarInner(name, photo) {
  const initial = esc((name || "?").trim().charAt(0).toUpperCase() || "?");
  return photo
    ? '<img src="' + esc(photo) + '" alt="" loading="lazy" onerror="this.parentNode.textContent=\'' + initial + '\'">'
    : initial;
}
function normalize(id, d) {
  return {
    id,
    authorId: d.authorId || "",
    authorName: d.authorName || "User",
    authorPhoto: httpUrl(d.authorPhoto || ""),
    caption: typeof d.caption === "string" ? d.caption : "",
    videoUrl: typeof d.videoUrl === "string" && d.videoUrl.indexOf(CLOUD) === 0 ? d.videoUrl : "",
    duration: typeof d.duration === "number" ? d.duration : 0,
    likeCount: typeof d.likeCount === "number" ? d.likeCount : 0,
    createdAtMs: tsMs(d.createdAt) || d.createdAtMs || 0
  };
}
function myName() {
  const d = S.myData || {};
  return ((d.name || d.businessName || (S.me && S.me.displayName) || "User").toString().trim() || "User").slice(0, 80);
}
function myPhoto() {
  const d = S.myData || {};
  const c = [d.profileImageUrl, d.profileImage, d.sellerProfileImage, d.photoURL, S.me && S.me.photoURL];
  for (const u of c) { const h = httpUrl(u); if (h && h.length <= 600) return h; }
  return "";
}

/* ---------------- render ---------------- */
function reelHtml(r) {
  return (
    '<section class="reel loading" data-id="' + esc(r.id) + '">' +
      '<video playsinline loop muted preload="none" webkit-playsinline' +
        (posterOf(r.videoUrl) ? ' poster="' + esc(posterOf(r.videoUrl)) + '"' : "") +
        ' data-src="' + esc(r.videoUrl) + '"></video>' +
      '<div class="spin"></div>' +
      '<div class="shade"></div>' +
      '<div class="pi"><i class="ti ti-player-play-filled"></i></div>' +
      '<div class="info">' +
        '<a class="who" href="profile.html?id=' + encodeURIComponent(r.authorId) + '">' +
          '<span class="av">' + avatarInner(r.authorName, r.authorPhoto) + "</span><b>" + esc(r.authorName) + "</b></a>" +
        (r.caption ? '<div class="cap">' + esc(r.caption) + "</div>" : "") +
      "</div>" +
    "</section>"
  );
}

function wire(el) {
  const v = el.querySelector("video");
  v.addEventListener("loadedmetadata", () => {
    // Bidiyon tsaye (9:16) cika allo; na kwance ana nuna duka
    v.classList.toggle("fit", v.videoWidth / (v.videoHeight || 1) > 0.8);
  });
  v.addEventListener("canplay", () => el.classList.remove("loading"));
  v.addEventListener("playing", () => el.classList.remove("loading"));
  v.addEventListener("waiting", () => el.classList.add("loading"));
  v.addEventListener("error", () => el.classList.remove("loading"));
  el.addEventListener("click", (ev) => {
    if (ev.target.closest("a")) return;
    const pi = el.querySelector(".pi");
    if (v.paused) { v.play().catch(() => {}); pi.querySelector("i").className = "ti ti-player-play-filled"; }
    else { v.pause(); pi.querySelector("i").className = "ti ti-player-pause-filled"; }
    pi.classList.add("on");
    clearTimeout(pi._t);
    pi._t = setTimeout(() => pi.classList.remove("on"), 450);
  });
  playObs.observe(el);
  loadObs.observe(el);
}

/* ---------------- observers ---------------- */
// Kunna wanda yake kan allo (>=70%), dakatar da sauran
const playObs = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    const v = en.target.querySelector("video");
    if (!v) return;
    if (en.isIntersecting && en.intersectionRatio >= 0.7) {
      if (!v.src && v.dataset.src) v.src = v.dataset.src;
      v.muted = S.muted;
      const p = v.play();
      if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => {}); });
      const idx = Array.from(box.children).indexOf(en.target);
      if (S.more && idx >= box.children.length - 3) loadMore();
    } else {
      v.pause();
    }
  });
}, { root: box, threshold: [0, 0.7] });

// Saka src ga bidiyon da ke kusa; cire ga na nesa (don adana data da memory)
const loadObs = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    const v = en.target.querySelector("video");
    if (!v) return;
    if (en.isIntersecting) {
      if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.preload = "auto"; }
    } else if (v.src) {
      v.pause();
      v.removeAttribute("src");
      v.load();
      en.target.classList.add("loading");
    }
  });
}, { root: box, rootMargin: "150% 0px 150% 0px", threshold: 0 });

/* ---------------- load ---------------- */
async function fetchPage(after) {
  const parts = [collection(db, "reels"), orderBy("createdAt", "desc")];
  if (after) parts.push(startAfter(after));
  parts.push(limit(PAGE));
  const snap = await getDocs(query(...parts));
  return { list: snap.docs.map((d) => normalize(d.id, d.data())).filter((r) => r.videoUrl), last: snap.docs.length ? snap.docs[snap.docs.length - 1] : null, full: snap.docs.length === PAGE };
}

function addReels(list, atTop) {
  const html = list.map(reelHtml).join("");
  const before = box.children.length;
  box.insertAdjacentHTML(atTop ? "afterbegin" : "beforeend", html);
  const els = atTop ? Array.from(box.children).slice(0, list.length) : Array.from(box.children).slice(before);
  list.forEach((r) => S.reels.set(r.id, r));
  els.forEach(wire);
}

function showEmpty() {
  box.innerHTML = '<div class="empty" id="emptyBox"><i class="ti ti-movie" style="font-size:48px;color:#c9a227"></i>No reels yet.<br>Be the first to share a short video!<button type="button" id="emptyAdd">Post a reel</button></div>';
  $("emptyAdd").addEventListener("click", openUpload);
}

async function loadFirst() {
  S.loading = true;
  try {
    const p = await fetchPage(null);
    S.last = p.last; S.more = p.full;
    box.innerHTML = "";
    if (!p.list.length) showEmpty(); else addReels(p.list, false);
  } catch (e) {
    console.error("reels load", e);
    box.innerHTML = '<div class="empty">Could not load reels.<br>Check your internet and try again.<button type="button" onclick="location.reload()">Refresh</button></div>';
  }
  S.loading = false;
}

async function loadMore() {
  if (S.loading || !S.more || !S.last) return;
  S.loading = true;
  try {
    const p = await fetchPage(S.last);
    S.last = p.last || S.last; S.more = p.full;
    addReels(p.list, false);
  } catch (e) { console.error("reels more", e); }
  S.loading = false;
}

/* ---------------- mute ---------------- */
function paintMute() { $("muteBtn").querySelector("i").className = "ti " + (S.muted ? "ti-volume-off" : "ti-volume"); }
$("muteBtn").addEventListener("click", () => {
  S.muted = !S.muted;
  paintMute();
  box.querySelectorAll("video").forEach((v) => { if (!v.paused) v.muted = S.muted; });
});

/* ---------------- upload ---------------- */
function umsg(t, info) {
  const m = $("upMsg");
  m.textContent = t || "";
  m.className = "msg" + (t ? " on" : "") + (info ? " info" : "");
}

function resetUpload() {
  if (pickedUrl) URL.revokeObjectURL(pickedUrl);
  pickedFile = null; pickedUrl = ""; pickedDur = 0;
  $("prev").style.display = "none";
  $("prevVid").removeAttribute("src");
  $("cap").value = ""; $("capCnt").textContent = "0/" + MAX_CAPTION;
  $("pickBtn").style.display = "";
  $("goBtn").disabled = true;
  umsg("");
}

function openUpload() { $("upSheet").classList.add("on"); }
function closeUpload() { if (busy) return; $("upSheet").classList.remove("on"); resetUpload(); }

function probe(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = () => res({ url, dur: v.duration });
    v.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Could not read this video. Try another one.")); };
    v.src = url;
  });
}

function refreshGo() {
  $("goBtn").disabled = busy || !pickedFile;
}

$("addBtn").addEventListener("click", openUpload);
$("upClose").addEventListener("click", closeUpload);
$("upSheet").addEventListener("click", (ev) => { if (ev.target === $("upSheet")) closeUpload(); });
$("pickBtn").addEventListener("click", () => $("vidFile").click());
$("cap").addEventListener("input", () => { $("capCnt").textContent = $("cap").value.length + "/" + MAX_CAPTION; });

$("vidFile").addEventListener("change", async () => {
  const f = $("vidFile").files && $("vidFile").files[0];
  $("vidFile").value = "";
  if (!f) return;
  umsg("");
  if (!/^video\//.test(f.type)) { umsg("Please choose a video file."); return; }
  const mb = f.size / (1024 * 1024);
  if (mb > MAX_MB) { umsg("This video is too big (" + mb.toFixed(1) + " MB). The limit is " + MAX_MB + " MB. Choose a shorter video."); return; }
  try {
    const p = await probe(f);
    if (isFinite(p.dur) && p.dur > MAX_SEC + 0.5) {
      URL.revokeObjectURL(p.url);
      umsg("This video is too long (" + Math.round(p.dur) + " seconds). The limit is " + MAX_SEC + " seconds.");
      return;
    }
    if (pickedUrl) URL.revokeObjectURL(pickedUrl);
    pickedFile = f; pickedUrl = p.url; pickedDur = isFinite(p.dur) ? p.dur : 0;
    $("prevVid").src = pickedUrl;
    $("prev").style.display = "block";
    $("prevMeta").textContent = Math.round(pickedDur) + " seconds \u00B7 " + mb.toFixed(1) + " MB";
    $("pickBtn").style.display = "none";
    refreshGo();
  } catch (e) { umsg(e.message); }
});

$("goBtn").addEventListener("click", async () => {
  if (busy || !pickedFile) return;
  const wait = COOLDOWN_MS - (Date.now() - S.lastPostAt);
  if (wait > 0) { umsg("Please wait " + Math.ceil(wait / 1000) + "s before posting again."); return; }

  busy = true; refreshGo(); umsg("");
  const t0 = Date.now();
  const tick = setInterval(() => umsg("Uploading... " + Math.round((Date.now() - t0) / 1000) + "s (keep this page open)", true), 1000);
  umsg("Uploading... (keep this page open)", true);

  try {
    const { uploadToCloudinary } = await import("./cloudinary-upload.js");
    const res = await uploadToCloudinary(pickedFile);
    if (!res || typeof res.url !== "string" || res.url.indexOf(CLOUD) !== 0 || res.url.indexOf("/video/upload/") < 0) {
      throw new Error("Upload failed. Try again.");
    }
    const dur = Math.max(1, Math.round((res.duration && isFinite(res.duration) ? res.duration : pickedDur) || 1));
    clearInterval(tick);
    umsg("Posting...", true);

    const data = {
      authorId: S.me.uid,
      authorName: myName(),
      caption: $("cap").value.trim().slice(0, MAX_CAPTION),
      videoUrl: res.url,
      duration: Math.min(dur, 60),
      likeCount: 0,
      createdAt: serverTimestamp()
    };
    const photo = myPhoto();
    if (photo) data.authorPhoto = photo;

    const ref = await addDoc(collection(db, "reels"), data);
    S.lastPostAt = Date.now();

    const eb = $("emptyBox"); if (eb) box.innerHTML = "";
    addReels([normalize(ref.id, Object.assign({}, data, { createdAt: null, createdAtMs: Date.now() }))], true);
    busy = false;
    closeUpload();
    box.scrollTo({ top: 0 });
    toast("Reel posted!");
  } catch (e) {
    clearInterval(tick);
    console.error("reel post", e);
    umsg(e && e.code === "permission-denied" ? "You are not allowed to post right now." : (e && e.message) || "Could not post. Try again.");
    busy = false; refreshGo();
  }
});

/* ---------------- start ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("login.html"); return; }
  S.me = user;
  paintMute();
  try {
    const s = await getDoc(doc(db, "users", user.uid));
    S.myData = s.exists() ? s.data() : {};
  } catch (e) { console.error("user doc", e); }
  loadFirst();
});
