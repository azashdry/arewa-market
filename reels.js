/* =========================================================
   AREWA MARKET - REELS (salon TikTok, duk abu yana aiki)
   - Kallo: gungurawa tsaye; bidiyo DAYA kaɗai ke kunnawa a lokaci guda
   - Tabs: For You / Following
   - Like (da double-tap), Comment, Save, Share, Follow
   - Aika bidiyo: har dakika 45 da 50MB, ta Cloudinary
========================================================= */
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection, query, where, orderBy, limit, startAfter, getDocs, getDoc, addDoc, setDoc,
  doc, serverTimestamp, writeBatch, increment
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const PAGE = 5;
const MAX_SEC = 45;
const MAX_MB = 50;
const MAX_CAPTION = 200;
const COOLDOWN_MS = 30000;
const CLOUD = "https://res.cloudinary.com/";

const $ = (id) => document.getElementById(id);
const box = $("reels");

const S = {
  me: null, myData: {}, last: null, more: false, loading: false, muted: true,
  reels: new Map(), lastPostAt: 0, tab: "for",
  liked: new Set(), saved: new Set(), following: new Set(), folKnown: new Set(),
  busy: new Set(), cmId: null, lastCmAt: 0, speed: 1, hyd: new Set()
};
let pickedFile = null, pickedUrl = "", pickedDur = 0, busy = false;

const ICON = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/><circle cx="8" cy="10" r="1.3" fill="#000" fill-opacity=".55"/><circle cx="12" cy="10" r="1.3" fill="#000" fill-opacity=".55"/><circle cx="16" cy="10" r="1.3" fill="#000" fill-opacity=".55"/></svg>',
  mark: '<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M14 9V4l8 8-8 8v-5.1c-5.5 0-9.2 1.7-12 5.1 1.1-5.4 4.4-10.2 12-11z"/></svg>'
};

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
function fmt(n) {
  n = Math.max(0, Number(n) || 0);
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 10000 ? 1 : (n < 100000 ? 1 : 0)).replace(/\.0$/, "") + "K";
  return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
}
function ago(ms) {
  if (!ms) return "now";
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}
function posterOf(url) {
  if (typeof url !== "string" || url.indexOf("res.cloudinary.com") < 0 || url.indexOf("/video/upload/") < 0) return "";
  return url.replace("/video/upload/", "/video/upload/so_0,f_jpg,w_540,q_auto/").replace(/\.[A-Za-z0-9]+(\?.*)?$/, ".jpg");
}
// Bidiyo mai sauki don kallo: 540px, H.264, ƙaramin bitrate (na asali ana ajiye shi don download)
function playUrl(url) {
  if (typeof url !== "string" || url.indexOf("/video/upload/") < 0) return url;
  return url.replace("/video/upload/", "/video/upload/f_mp4,vc_h264,ac_aac,q_auto:eco,w_540,c_limit/");
}
function httpUrl(u) { return typeof u === "string" && /^https?:\/\//.test(u) ? u : ""; }
function tsMs(ts) { return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0; }
function num(x) { return typeof x === "number" && isFinite(x) && x > 0 ? x : 0; }
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
    likeCount: num(d.likeCount),
    commentCount: num(d.commentCount),
    saveCount: num(d.saveCount),
    shareCount: num(d.shareCount),
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
function reelEl(id) { return box.querySelector('.reel[data-id="' + id + '"]'); }

/* ---------------- render ---------------- */
function reelHtml(r) {
  return (
    '<section class="reel loading" data-id="' + esc(r.id) + '">' +
      '<video playsinline loop muted preload="none" webkit-playsinline' +
        (posterOf(r.videoUrl) ? ' poster="' + esc(posterOf(r.videoUrl)) + '"' : "") +
        ' data-src="' + esc(playUrl(r.videoUrl)) + '" data-orig="' + esc(r.videoUrl) + '"></video>' +
      '<div class="spin"></div>' +
      '<div class="shade"></div><div class="shade t"></div>' +
      '<div class="pi"><i class="ti ti-player-play-filled"></i></div>' +
      '<div class="hint"></div>' +
      '<div class="rail">' +
        '<div class="ra"><a class="av" href="profile.html?id=' + encodeURIComponent(r.authorId) + '">' + avatarInner(r.authorName, r.authorPhoto) + '</a>' +
          '<button type="button" class="plus fol gone" aria-label="Follow"><i class="ti ti-plus"></i></button></div>' +
        '<button type="button" class="rb lk" aria-label="Like">' + ICON.heart + '<span class="n">0</span></button>' +
        '<button type="button" class="rb cm" aria-label="Comments">' + ICON.chat + '<span class="n">0</span></button>' +
        '<button type="button" class="rb sv" aria-label="Save">' + ICON.mark + '<span class="n">0</span></button>' +
        '<button type="button" class="rb shr" aria-label="Share">' + ICON.share + '<span class="n">0</span></button>' +
        '<button type="button" class="rb dl" aria-label="Download">' + ICON.down + '<span style="font-size:11px">Download</span></button>' +
      "</div>" +
      '<div class="info">' +
        '<a class="who" href="profile.html?id=' + encodeURIComponent(r.authorId) + '"><b>' + esc(r.authorName) + "</b></a>" +
        (r.caption ? '<div class="cap">' + esc(r.caption) + "</div>" : "") +
      "</div>" +
    "</section>"
  );
}

// Zana alamomin (zuciya, bookmark, counts, +) bisa ga halin yanzu
function paint(id) {
  const el = reelEl(id), r = S.reels.get(id);
  if (!el || !r) return;
  const lk = el.querySelector(".lk"), sv = el.querySelector(".sv");
  lk.classList.toggle("on", S.liked.has(id));
  sv.classList.toggle("on", S.saved.has(id));
  lk.querySelector(".n").textContent = fmt(r.likeCount);
  el.querySelector(".cm .n").textContent = fmt(r.commentCount);
  sv.querySelector(".n").textContent = fmt(r.saveCount);
  el.querySelector(".shr .n").textContent = fmt(r.shareCount);
  paintFollow(el, r.authorId);
}
function paintFollow(el, authorId) {
  const b = el.querySelector(".fol");
  if (!b) return;
  const hide = !S.me || authorId === S.me.uid || !S.folKnown.has(authorId) || S.following.has(authorId);
  if (!b.classList.contains("done")) b.classList.toggle("gone", hide);
}
function paintAuthor(authorId) {
  box.querySelectorAll(".reel").forEach((el) => {
    const r = S.reels.get(el.dataset.id);
    if (r && r.authorId === authorId) paintFollow(el, authorId);
  });
}

// Duba ko na like/save, da wanda nake bi (a lokaci guda)
async function hydrate(list) {
  if (!S.me) return;
  const uid = S.me.uid;
  list = list.filter((r) => !S.hyd.has(r.id));
  list.forEach((r) => S.hyd.add(r.id));
  const authors = Array.from(new Set(list.map((r) => r.authorId).filter((a) => a && a !== uid && !S.folKnown.has(a))));
  await Promise.all([
    ...list.map(async (r) => {
      try {
        const [l, s] = await Promise.all([
          getDoc(doc(db, "reels", r.id, "likes", uid)),
          getDoc(doc(db, "reels", r.id, "saves", uid))
        ]);
        if (l.exists()) S.liked.add(r.id);
        if (s.exists()) S.saved.add(r.id);
      } catch (e) { /* ba komai */ }
      paint(r.id);
    }),
    ...authors.map(async (a) => {
      try {
        const f = await getDoc(doc(db, "follows", uid + "_" + a));
        if (f.exists()) S.following.add(a);
        S.folKnown.add(a);
      } catch (e) { /* ba komai */ }
      paintAuthor(a);
    })
  ]);
}

/* ---------------- gesture / wiring ---------------- */
function togglePlay(el, v) {
  const pi = el.querySelector(".pi");
  if (v.paused) { activate(v); pi.querySelector("i").className = "ti ti-player-play-filled"; }
  else { v.pause(); pi.querySelector("i").className = "ti ti-player-pause-filled"; }
  pi.classList.add("on");
  clearTimeout(pi._t);
  pi._t = setTimeout(() => pi.classList.remove("on"), 450);
}
function burst(el, ev) {
  const rect = el.getBoundingClientRect();
  const h = document.createElement("div");
  h.className = "hrt";
  h.innerHTML = ICON.heart;
  h.style.left = (ev.clientX - rect.left) + "px";
  h.style.top = (ev.clientY - rect.top) + "px";
  h.firstChild.style.cssText = "width:100%;height:100%;fill:inherit";
  el.appendChild(h);
  setTimeout(() => h.remove(), 850);
}

function wire(el) {
  const v = el.querySelector("video");
  v.addEventListener("loadedmetadata", () => {
    v.classList.toggle("fit", v.videoWidth / (v.videoHeight || 1) > 0.8);
  });
  v.addEventListener("canplay", () => el.classList.remove("loading"));
  v.addEventListener("playing", () => el.classList.remove("loading"));
  v.addEventListener("waiting", () => el.classList.add("loading"));
  v.addEventListener("error", () => {
    // Idan sigar mai sauki ta ki buɗewa, a koma ta asali (sau ɗaya kawai)
    if (v.getAttribute("src") && v.dataset.fb !== "1" && v.dataset.orig && v.getAttribute("src") !== v.dataset.orig) {
      v.dataset.fb = "1";
      v.dataset.src = v.dataset.orig;
      v.src = v.dataset.orig;
      if (v === activeVideo) v.play().catch(() => {});
      return;
    }
    el.classList.remove("loading");
    if (!navigator.onLine && v === activeVideo) toast("No internet - video cannot play");
  });
  // Tsaro: idan wannan bidiyo ba shi ne mai aiki ba, kar ya taba yin sauti
  v.addEventListener("play", () => { if (v !== activeVideo) { v.pause(); v.muted = true; } });

  // ---- Gestures ----
  // Tap daya: kunna/dakatar. Tap biyu: tsakiya = like, hagu = baya 10s, dama = gaba 10s.
  // Rike dama = gaba da sauri. Rike hagu = komawa baya da sauri.
  let tapT = null, lastTap = 0, lastZone = "", down = null, holdT = null, hold = null, justHeld = false;
  let seekT = 0, seekAcc = 0, seekSide = "";
  const hint = el.querySelector(".hint");
  const zoneOf = (x) => {
    const rc = el.getBoundingClientRect();
    const p = (x - rc.left) / (rc.width || 1);
    return p < 0.35 ? "l" : (p > 0.65 ? "r" : "c");
  };
  const showHint = (txt, cls, ms) => {
    hint.className = "hint " + cls + " on";
    hint.textContent = txt;
    clearTimeout(hint._t);
    if (ms) hint._t = setTimeout(() => hint.classList.remove("on"), ms);
  };
  const seek = (dir) => {
    const d = v.duration;
    if (!isFinite(d) || !d) return;
    const now = Date.now();
    seekAcc = (seekSide === dir && now - seekT < 800) ? seekAcc + 10 : 10;
    seekSide = dir; seekT = now;
    v.currentTime = dir === "r" ? Math.min(d - 0.1, v.currentTime + 10) : Math.max(0, v.currentTime - 10);
    showHint((dir === "r" ? "+" : "-") + seekAcc + "s", dir, 700);
  };
  function endHold() {
    clearTimeout(holdT);
    if (!hold) return;
    clearInterval(hold.iv);
    v.playbackRate = S.speed;
    if (hold.wasPlaying && v === activeVideo) v.play().catch(() => {});
    hold = null;
    hint.classList.remove("on");
    justHeld = true;
    setTimeout(() => { justHeld = false; }, 120);
  }
  el.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("a, .rail, button")) return;
    down = { x: ev.clientX, y: ev.clientY };
    const z = zoneOf(ev.clientX);
    if (z === "c") return;
    clearTimeout(holdT);
    holdT = setTimeout(() => {
      if (!down || v !== activeVideo || !isFinite(v.duration)) return;
      const wasPlaying = !v.paused;
      if (z === "r") {
        if (!wasPlaying) return;
        hold = { z, wasPlaying };
        v.playbackRate = S.speed >= 2 ? 3 : 2;
        showHint((S.speed >= 2 ? "3x" : "2x") + " \u25B6\u25B6", "t");
      } else {
        hold = { z, wasPlaying };
        v.pause();
        hold.iv = setInterval(() => { v.currentTime = Math.max(0, v.currentTime - 0.3); }, 100);
        showHint("\u25C0\u25C0 Rewind", "t");
      }
    }, 350);
  });
  el.addEventListener("pointermove", (ev) => {
    if (down && !hold && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 12) clearTimeout(holdT);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((n) => el.addEventListener(n, () => { down = null; endHold(); }));
  el.addEventListener("contextmenu", (ev) => ev.preventDefault());

  el.addEventListener("click", (ev) => {
    if (ev.target.closest("a") || ev.target.closest(".rail") || justHeld) return;
    const z = zoneOf(ev.clientX), now = Date.now();
    // Idan ana ta seek, kowane tap na gaba a gefe daya yana ƙara 10s
    if (z !== "c" && seekSide === z && now - seekT < 800) { clearTimeout(tapT); lastTap = 0; seek(z); return; }
    if (now - lastTap < 300 && z === lastZone) {
      clearTimeout(tapT); lastTap = 0;
      if (z === "c") { burst(el, ev); setLike(el.dataset.id, true); }
      else seek(z);
      return;
    }
    lastTap = now; lastZone = z;
    tapT = setTimeout(() => togglePlay(el, v), 300);
  });

  el.querySelector(".lk").addEventListener("click", () => setLike(el.dataset.id));
  el.querySelector(".cm").addEventListener("click", () => openComments(el.dataset.id));
  el.querySelector(".sv").addEventListener("click", () => toggleSave(el.dataset.id));
  el.querySelector(".shr").addEventListener("click", () => shareReel(el.dataset.id));
  el.querySelector(".dl").addEventListener("click", () => downloadReel(el.dataset.id));
  el.querySelector(".fol").addEventListener("click", () => followAuthor(el.dataset.id));

  playObs.observe(el);
  loadObs.observe(el);
}

/* ---------------- observers ---------------- */
// Bidiyo DAYA kaɗai ke aiki a lokaci guda. Duk sauran ana tsayar da su, a rufe sautinsu.
let activeVideo = null;
const ratios = new Map();

function silenceAll(except) {
  box.querySelectorAll("video").forEach((v) => {
    if (v === except) return;
    if (!v.paused) v.pause();
    v.muted = true;
  });
}
function activate(v) {
  activeVideo = v;
  silenceAll(v);
  if (!v) return;
  if (!v.src && v.dataset.src) v.src = v.dataset.src;
  v.preload = "auto";
  v.muted = S.muted;
  v.defaultPlaybackRate = S.speed;
  v.playbackRate = S.speed;
  const p = v.play();
  if (p && p.catch) p.catch(() => {
    if (v !== activeVideo) return;
    v.muted = true;            // browser ya hana sauti kai tsaye
    v.play().catch(() => {});
  });
}
function pickActive() {
  let best = null, bestR = 0;
  ratios.forEach((r, el) => { if (r > bestR) { bestR = r; best = el; } });
  const v = best && bestR >= 0.6 ? best.querySelector("video") : null;
  if (v === activeVideo) return;
  activate(v);
  if (best) { const rr = S.reels.get(best.dataset.id); if (rr) hydrate([rr]); }
  if (best && S.more) {
    const idx = Array.from(box.children).indexOf(best);
    if (idx >= box.children.length - 3) loadMore();
  }
}
const playObs = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) ratios.set(en.target, en.intersectionRatio);
    else ratios.delete(en.target);
  });
  pickActive();
}, { root: box, threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });

document.addEventListener("visibilitychange", () => {
  if (document.hidden) silenceAll(null);
  else if (activeVideo) activate(activeVideo);
});
window.addEventListener("pagehide", () => silenceAll(null));

// Saka src ga bidiyon da ke kusa; cire ga na nesa (don adana data da memory)
const loadObs = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    const v = en.target.querySelector("video");
    if (!v) return;
    if (en.isIntersecting) {
      if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.preload = "metadata"; }
    } else if (v.src) {
      v.pause();
      v.removeAttribute("src");
      v.load();
      en.target.classList.add("loading");
    }
  });
}, { root: box, rootMargin: "100% 0px 100% 0px", threshold: 0 });

/* ---------------- load ---------------- */
async function fetchPage(after) {
  const parts = [collection(db, "reels"), orderBy("createdAt", "desc")];
  if (after) parts.push(startAfter(after));
  parts.push(limit(PAGE));
  const snap = await getDocs(query(...parts));
  return { list: snap.docs.map((d) => normalize(d.id, d.data())).filter((r) => r.videoUrl), last: snap.docs.length ? snap.docs[snap.docs.length - 1] : null, full: snap.docs.length === PAGE };
}

function addReels(list, atTop) {
  const fresh = list.filter((r) => !S.reels.has(r.id) || !reelEl(r.id));
  if (!fresh.length) return;
  const html = fresh.map(reelHtml).join("");
  const before = box.children.length;
  box.insertAdjacentHTML(atTop ? "afterbegin" : "beforeend", html);
  const els = atTop ? Array.from(box.children).slice(0, fresh.length) : Array.from(box.children).slice(before);
  fresh.forEach((r) => S.reels.set(r.id, r));
  els.forEach(wire);
  fresh.forEach((r) => paint(r.id));
}

function showEmpty(msg, withBtn) {
  box.innerHTML = '<div class="empty" id="emptyBox"><i class="ti ti-movie" style="font-size:48px;color:#fff"></i>' + msg +
    (withBtn ? '<button type="button" id="emptyAdd">Post a reel</button>' : "") + "</div>";
  const b = $("emptyAdd"); if (b) b.addEventListener("click", openUpload);
}

function resetFeed() {
  silenceAll(null);
  activeVideo = null;
  ratios.clear();
  playObs.disconnect();
  loadObs.disconnect();
  box.innerHTML = "";
  S.last = null; S.more = false;
}

async function loadFirst() {
  S.loading = true;
  try {
    let pinned = null;
    const want = new URLSearchParams(location.search).get("id");
    if (want && /^[A-Za-z0-9]{4,40}$/.test(want)) {
      try {
        const d = await getDoc(doc(db, "reels", want));
        if (d.exists()) { const n = normalize(d.id, d.data()); if (n.videoUrl) pinned = n; }
      } catch (e) { /* ba komai */ }
    }
    const p = await fetchPage(null);
    S.last = p.last; S.more = p.full;
    box.innerHTML = "";
    const list = pinned ? [pinned].concat(p.list.filter((r) => r.id !== pinned.id)) : p.list;
    if (!list.length) showEmpty("No reels yet.<br>Be the first to share a short video!", true);
    else addReels(list, false);
  } catch (e) {
    console.error("reels load", e);
    if (!navigator.onLine) offlineBox();
    else box.innerHTML = '<div class="empty">Could not load reels.<br>Check your internet and try again.<button type="button" onclick="location.reload()">Refresh</button></div>';
  }
  S.loading = false;
}

// Tab na "Following": reels na mutanen da nake bi (ba pagination, ana jera su a client)
async function loadFollowing() {
  S.loading = true;
  try {
    const fs = await getDocs(query(collection(db, "follows"), where("followerId", "==", S.me.uid), limit(30)));
    const ids = fs.docs.map((d) => d.data().followingId).filter(Boolean);
    ids.forEach((a) => { S.following.add(a); S.folKnown.add(a); });
    box.innerHTML = "";
    if (!ids.length) { showEmpty("You are not following anyone yet.<br>Follow people to see their reels here.", false); S.loading = false; return; }
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    const snaps = await Promise.all(chunks.map((c) => getDocs(query(collection(db, "reels"), where("authorId", "in", c), limit(20)))));
    const all = [];
    snaps.forEach((s) => s.docs.forEach((d) => all.push(normalize(d.id, d.data()))));
    const list = all.filter((r) => r.videoUrl).sort((a, b) => b.createdAtMs - a.createdAtMs);
    if (!list.length) showEmpty("No reels from people you follow yet.", false);
    else addReels(list, false);
  } catch (e) {
    console.error("following load", e);
    if (!navigator.onLine) offlineBox();
    else box.innerHTML = '<div class="empty">Could not load reels.<br>Check your internet and try again.<button type="button" onclick="location.reload()">Refresh</button></div>';
  }
  S.loading = false;
}

async function loadMore() {
  if (S.loading || !S.more || !S.last || S.tab !== "for") return;
  S.loading = true;
  try {
    const p = await fetchPage(S.last);
    S.last = p.last || S.last; S.more = p.full;
    addReels(p.list, false);
  } catch (e) { console.error("reels more", e); }
  S.loading = false;
}

function setTab(tab) {
  if (S.tab === tab) { box.scrollTo({ top: 0, behavior: "smooth" }); return; }
  S.tab = tab;
  $("tabFor").classList.toggle("on", tab === "for");
  $("tabFol").classList.toggle("on", tab === "following");
  resetFeed();
  if (tab === "for") loadFirst(); else loadFollowing();
}
$("tabFor").addEventListener("click", () => setTab("for"));
$("tabFol").addEventListener("click", () => setTab("following"));

/* ---------------- mute ---------------- */
function paintMute() { $("muteBtn").querySelector("i").className = "ti " + (S.muted ? "ti-volume-off" : "ti-volume"); }
$("muteBtn").addEventListener("click", () => {
  S.muted = !S.muted;
  paintMute();
  if (activeVideo) activeVideo.muted = S.muted;
  toast(S.muted ? "Sound off" : "Sound on");
});

/* ---------------- speed ---------------- */
const SPEEDS = [1, 1.5, 2, 0.5];
function paintSpeed() { $("spdBtn").querySelector("span").textContent = S.speed + "x"; }
$("spdBtn").addEventListener("click", () => {
  S.speed = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length];
  paintSpeed();
  if (activeVideo) { activeVideo.defaultPlaybackRate = S.speed; activeVideo.playbackRate = S.speed; }
  toast("Speed " + S.speed + "x");
});

/* ---------------- download ---------------- */
// Cloudinary fl_attachment yana tilasta saukewa maimakon kunnawa
function downloadReel(id) {
  const r = S.reels.get(id);
  if (!r || !r.videoUrl) return;
  const url = r.videoUrl.replace("/video/upload/", "/video/upload/fl_attachment:arewa-reel-" + String(id).slice(0, 8) + "/");
  const a = document.createElement("a");
  a.href = url; a.download = "arewa-reel.mp4"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  toast("Downloading...");
}

/* ---------------- like / save ---------------- */
// Zuciya da bookmark: takarda daya ga kowane mutum + counter, a batch guda (kamar yadda rules suka bukata)
async function toggleSub(id, col, field, set, onlyOn) {
  const r = S.reels.get(id);
  if (!r || !S.me) return;
  if (!navigator.onLine) { toast("No internet connection"); return; }
  const key = col + id;
  if (S.busy.has(key)) return;
  const was = set.has(id);
  if (onlyOn && was) return;
  S.busy.add(key);

  // nuna nan take
  if (was) { set.delete(id); r[field] = Math.max(0, r[field] - 1); }
  else { set.add(id); r[field] += 1; }
  paint(id);

  try {
    const b = writeBatch(db);
    const sub = doc(db, "reels", id, col, S.me.uid);
    if (was) b.delete(sub);
    else b.set(sub, { uid: S.me.uid, createdAt: serverTimestamp() });
    b.update(doc(db, "reels", id), { [field]: increment(was ? -1 : 1) });
    await b.commit();
  } catch (e) {
    console.error(col, e);
    // dawo da yadda yake
    if (was) { set.add(id); r[field] += 1; } else { set.delete(id); r[field] = Math.max(0, r[field] - 1); }
    paint(id);
    toast(e && e.code === "permission-denied" ? "You are not allowed to do this right now." : "Could not update. Try again.");
  }
  S.busy.delete(key);
}
function setLike(id, onlyOn) { return toggleSub(id, "likes", "likeCount", S.liked, onlyOn); }
async function toggleSave(id) {
  const was = S.saved.has(id);
  await toggleSub(id, "saves", "saveCount", S.saved, false);
  if (S.saved.has(id) !== was) toast(was ? "Removed from saved" : "Saved");
}

/* ---------------- follow ---------------- */
async function followAuthor(id) {
  const r = S.reels.get(id), el = reelEl(id);
  if (!r || !el || !S.me || r.authorId === S.me.uid) return;
  if (!navigator.onLine) { toast("No internet connection"); return; }
  const key = "fol" + r.authorId;
  if (S.busy.has(key)) return;
  S.busy.add(key);
  const btn = el.querySelector(".fol");
  try {
    await setDoc(doc(db, "follows", S.me.uid + "_" + r.authorId), {
      followerId: S.me.uid, followingId: r.authorId, createdAt: serverTimestamp()
    });
    S.following.add(r.authorId);
    btn.classList.add("done");
    btn.innerHTML = '<i class="ti ti-check"></i>';
    toast("Following " + r.authorName);
    setTimeout(() => { btn.classList.remove("done"); paintAuthor(r.authorId); }, 700);
  } catch (e) {
    console.error("follow", e);
    toast("Could not follow. Try again.");
  }
  S.busy.delete(key);
}

/* ---------------- share ---------------- */
async function shareReel(id) {
  const r = S.reels.get(id);
  if (!r || !S.me) return;
  const url = location.origin + location.pathname.replace(/[^/]*$/, "") + "reels.html?id=" + encodeURIComponent(id);
  let done = false;
  try {
    if (navigator.share) { await navigator.share({ title: "Arewa Market Reels", text: r.caption || "", url }); done = true; }
    else if (navigator.clipboard) { await navigator.clipboard.writeText(url); toast("Link copied"); done = true; }
    else { prompt("Copy this link:", url); done = true; }
  } catch (e) { /* mutum ya fasa */ }
  if (!done) return;

  // Ana kirga share sau daya ga kowane mutum
  const key = "shr" + id;
  if (S.busy.has(key)) return;
  S.busy.add(key);
  try {
    const mine = doc(db, "reels", id, "shares", S.me.uid);
    const ex = await getDoc(mine);
    if (!ex.exists()) {
      const b = writeBatch(db);
      b.set(mine, { uid: S.me.uid, createdAt: serverTimestamp() });
      b.update(doc(db, "reels", id), { shareCount: increment(1) });
      await b.commit();
      r.shareCount += 1;
      paint(id);
    }
  } catch (e) { console.error("share count", e); }
  S.busy.delete(key);
}

/* ---------------- comments ---------------- */
function cmHtml(c, reel) {
  const mine = S.me && c.authorId === S.me.uid;
  const canDel = mine || (S.me && reel && reel.authorId === S.me.uid);
  return '<div class="cmi" data-id="' + esc(c.id) + '">' +
    '<a class="av" href="profile.html?id=' + encodeURIComponent(c.authorId) + '">' + avatarInner(c.authorName, c.authorPhoto) + "</a>" +
    '<div class="cmb"><div class="cmn">' + esc(c.authorName) + "<small>" + ago(c.createdAtMs) + "</small></div>" +
    '<div class="cmt">' + esc(c.text) + "</div></div>" +
    (canDel ? '<button type="button" class="cmd" data-del="' + esc(c.id) + '" aria-label="Delete"><i class="ti ti-trash"></i></button>' : "") +
    "</div>";
}

async function openComments(id) {
  const r = S.reels.get(id);
  if (!r) return;
  S.cmId = id;
  $("cmSheet").classList.add("on");
  $("cmTitle").textContent = fmt(r.commentCount) + " comments";
  $("cmList").innerHTML = '<div class="cmempty">Loading...</div>';
  $("cmInput").value = ""; $("cmSend").disabled = true;
  try {
    const snap = await getDocs(query(collection(db, "reels", id, "comments"), orderBy("createdAt", "desc"), limit(40)));
    if (S.cmId !== id) return;
    const list = snap.docs.map((d) => {
      const x = d.data();
      return { id: d.id, authorId: x.authorId || "", authorName: x.authorName || "User", authorPhoto: httpUrl(x.authorPhoto || ""), text: typeof x.text === "string" ? x.text : "", createdAtMs: tsMs(x.createdAt) };
    });
    $("cmList").innerHTML = list.length ? list.map((c) => cmHtml(c, r)).join("") : '<div class="cmempty">No comments yet. Be the first!</div>';
  } catch (e) {
    console.error("comments", e);
    $("cmList").innerHTML = '<div class="cmempty">Could not load comments.</div>';
  }
}
function closeComments() { $("cmSheet").classList.remove("on"); S.cmId = null; }

$("cmClose").addEventListener("click", closeComments);
$("cmSheet").addEventListener("click", (ev) => { if (ev.target === $("cmSheet")) closeComments(); });
$("cmInput").addEventListener("input", () => { $("cmSend").disabled = !$("cmInput").value.trim(); });
$("cmInput").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); sendComment(); } });
$("cmSend").addEventListener("click", sendComment);

async function sendComment() {
  const id = S.cmId, r = S.reels.get(id);
  const text = $("cmInput").value.trim().slice(0, 500);
  if (!id || !r || !text || !S.me || $("cmSend").disabled) return;
  if (!navigator.onLine) { toast("No internet connection"); return; }
  if (Date.now() - S.lastCmAt < 3000) { toast("Please wait a moment."); return; }
  $("cmSend").disabled = true;
  try {
    const cref = doc(collection(db, "reels", id, "comments"));
    const data = { authorId: S.me.uid, authorName: myName(), text, createdAt: serverTimestamp() };
    const ph = myPhoto(); if (ph) data.authorPhoto = ph;
    const b = writeBatch(db);
    b.set(cref, data);
    b.update(doc(db, "reels", id), { commentCount: increment(1) });
    await b.commit();
    S.lastCmAt = Date.now();
    r.commentCount += 1; paint(id);
    $("cmTitle").textContent = fmt(r.commentCount) + " comments";
    $("cmInput").value = "";
    const empty = $("cmList").querySelector(".cmempty"); if (empty) $("cmList").innerHTML = "";
    $("cmList").insertAdjacentHTML("afterbegin", cmHtml({ id: cref.id, authorId: S.me.uid, authorName: myName(), authorPhoto: ph, text, createdAtMs: Date.now() }, r));
    $("cmList").scrollTop = 0;
  } catch (e) {
    console.error("comment post", e);
    toast(e && e.code === "permission-denied" ? "You are not allowed to comment right now." : "Could not post comment.");
    $("cmSend").disabled = false;
  }
}

$("cmList").addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-del]");
  if (!btn) return;
  const id = S.cmId, r = S.reels.get(id), cid = btn.dataset.del;
  if (!id || !r || btn.disabled) return;
  btn.disabled = true;
  try {
    const b = writeBatch(db);
    b.delete(doc(db, "reels", id, "comments", cid));
    b.update(doc(db, "reels", id), { commentCount: increment(-1) });
    await b.commit();
    r.commentCount = Math.max(0, r.commentCount - 1); paint(id);
    $("cmTitle").textContent = fmt(r.commentCount) + " comments";
    const row = btn.closest(".cmi"); if (row) row.remove();
    if (!$("cmList").children.length) $("cmList").innerHTML = '<div class="cmempty">No comments yet. Be the first!</div>';
  } catch (e) {
    console.error("comment delete", e);
    toast("Could not delete comment.");
    btn.disabled = false;
  }
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
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      createdAt: serverTimestamp()
    };
    const photo = myPhoto();
    if (photo) data.authorPhoto = photo;

    const ref = await addDoc(collection(db, "reels"), data);
    S.lastPostAt = Date.now();

    const eb = $("emptyBox"); if (eb) box.innerHTML = "";
    if (S.tab !== "for") setTab("for");
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

/* ---------------- offline / online ---------------- */
function offlineBox() {
  box.innerHTML = '<div class="empty"><i class="ti ti-wifi-off" style="font-size:48px"></i>No internet connection.<br>Reels need data to load and play.<button type="button" id="retryBtn">Try again</button></div>';
  const b = $("retryBtn"); if (b) b.addEventListener("click", () => (S.tab === "for" ? loadFirst() : loadFollowing()));
}
window.addEventListener("online", () => {
  if (!S.me) return;
  if (!box.querySelector(".reel")) { if (S.tab === "for") loadFirst(); else loadFollowing(); return; }
  const v = activeVideo;
  if (v && (v.error || v.readyState === 0)) {
    v.dataset.fb = "";
    v.removeAttribute("src");
    v.load();
    activate(v);
  }
});
window.addEventListener("offline", () => toast("You are offline"));

/* ---------------- start ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("login.html"); return; }
  S.me = user;
  paintMute();
  paintSpeed();
  try {
    const s = await getDoc(doc(db, "users", user.uid));
    S.myData = s.exists() ? s.data() : {};
  } catch (e) { console.error("user doc", e); }
  loadFirst();
});
