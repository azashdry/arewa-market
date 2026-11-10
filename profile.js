/* =========================================================
   AREWA MARKET - PROFILE (irin Facebook)
   - Cover photo (mai asusu kaɗai ke canzawa) + hoton profile
   - Connections: followers / following (kowa) + friends (naka kaɗai)
   - Tabs: Posts, Photos, Products (idan seller ne)
   - Karatu kaɗan: counts ta getCountFromServer; posts <=30 sau ɗaya
========================================================= */
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where, limit,
  getCountFromServer, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const CLOUD = "https://res.cloudinary.com/";

let me = null;
let targetId = "";
let isOwn = false;
let data = {};
let isSeller = false;
let following = false;
let counts = { followers: null, following: null, posts: null, friends: null };
let postsCache = null;       // null = ba a ɗauko ba
let productsCache = null;
let currentTab = "posts";
const userCache = new Map();  // uid -> {name, photo}

/* ---------------- helpers ---------------- */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function toast(m) {
  const t = $("toast");
  t.textContent = m; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}
function cld(url, w) {
  if (typeof url !== "string") return "";
  if (url.indexOf("res.cloudinary.com") > -1 && url.indexOf("/upload/") > -1 && !/\/upload\/[^/]*(w_|c_|q_|f_)/.test(url)) {
    return url.replace("/upload/", "/upload/f_auto,q_auto,w_" + w + "/");
  }
  return url;
}
function httpUrl(u) { return typeof u === "string" && /^https?:\/\//.test(u) ? u : ""; }
function timeAgo(ms) {
  if (!ms) return "just now";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m";
  const h = Math.floor(m / 60); if (h < 24) return h + "h";
  const d = Math.floor(h / 24); if (d < 7) return d + "d";
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}
function tsMs(ts) { return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0; }
function nameOf(d) { return (d.name || d.businessName || d.displayName || "User").toString().slice(0, 80); }
function photoOf(d) {
  const c = [d.profileImageUrl, d.profileImage, d.sellerProfileImage, d.photoURL];
  for (let i = 0; i < c.length; i++) { const u = httpUrl(c[i]); if (u) return u; }
  return "";
}
function fmt(n) { return n == null ? "-" : Number(n).toLocaleString(); }

function avatarInner(name, photo) {
  const initial = esc((name || "?").trim().charAt(0).toUpperCase() || "?");
  return photo
    ? '<img src="' + esc(photo) + '" alt="" decoding="async" onerror="this.parentNode.textContent=\'' + initial + '\'">'
    : initial;
}

function openLightbox(src) { $("lbImg").src = src; $("lb").classList.add("open"); }
$("lb").addEventListener("click", () => { $("lb").classList.remove("open"); $("lbImg").removeAttribute("src"); });

/* ---------------- header ---------------- */
function renderTop() {
  const name = nameOf(data);
  const photo = photoOf(data);
  $("pName").textContent = name;
  $("pAvatar").innerHTML = avatarInner(name, photo);
  document.title = name + " - Arewa Market";

  const cover = httpUrl(data.coverUrl);
  const coverEl = $("cover");
  const old = coverEl.querySelector("img");
  if (old) old.remove();
  if (cover && cover.indexOf(CLOUD) === 0) {
    const im = document.createElement("img");
    im.src = cld(cover, 1200); im.alt = ""; im.decoding = "async";
    coverEl.insertBefore(im, coverEl.firstChild);
  }
  $("coverBtn").classList.toggle("on", isOwn);

  $("pBadge").innerHTML = isSeller ? '<span class="badge">&#9733; SELLER</span>' : "";
  const sub = [];
  if (isSeller && data.businessName && data.businessName !== name) sub.push(data.businessName);
  if (data.location) sub.push(data.location);
  $("pSub").textContent = sub.join(" \u00B7 ");

  renderStats();
  renderActions();
  renderAbout();
}

function renderStats() {
  const parts = [];
  parts.push('<button data-conn="followers"><b>' + fmt(counts.followers) + "</b> followers</button>");
  parts.push('<button data-conn="following"><b>' + fmt(counts.following) + "</b> following</button>");
  if (isOwn) parts.push('<button data-conn="friends"><b>' + fmt(counts.friends) + "</b> friends</button>");
  parts.push("<span><b>" + fmt(counts.posts) + "</b> posts</span>");
  $("pStats").innerHTML = parts.join("");
}

function renderActions() {
  const box = $("pActions");
  if (isOwn) {
    box.innerHTML =
      '<a class="btn btn-p" href="feed.html"><i class="ti ti-plus"></i> Create post</a>' +
      '<button type="button" class="btn btn-g" id="btnCover"><i class="ti ti-photo-edit"></i> Edit cover</button>';
    $("btnCover").addEventListener("click", () => $("coverFile").click());
  } else {
    box.innerHTML =
      '<button type="button" class="btn btn-p btn-f" id="btnFollow"><i class="ti ti-user-plus"></i> <span>Follow</span></button>' +
      '<a class="btn btn-g" href="messages.html?sellerId=' + encodeURIComponent(targetId) + '"><i class="ti ti-message-circle"></i> Message</a>';
    $("btnFollow").addEventListener("click", toggleFollow);
    paintFollow();
  }

  // Sellers: kira / WhatsApp / shafin kasuwanci
  const links = [];
  if (isSeller) {
    const phone = String(data.phone || "").replace(/[^0-9+]/g, "");
    if (phone) links.push('<a href="tel:' + esc(phone) + '"><i class="ti ti-phone"></i> Call</a>');
    let wa = String(data.whatsapp || "").replace(/[^0-9]/g, "");
    if (wa.startsWith("0")) wa = "234" + wa.substring(1);
    if (wa) links.push('<a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener"><i class="ti ti-brand-whatsapp"></i> WhatsApp</a>');
  }
  $("pLinks").innerHTML = links.join("");
}

function renderAbout() {
  const rows = [];
  const bio = (isSeller ? data.businessDescription : "") || data.bio || "";
  if (bio) rows.push('<div class="row"><i class="ti ti-info-circle"></i><div>' + esc(String(bio).slice(0, 500)) + "</div></div>");
  if (data.location) rows.push('<div class="row"><i class="ti ti-map-pin"></i><div>' + esc(data.location) + "</div></div>");
  const j = tsMs(data.createdAt);
  if (j) rows.push('<div class="row"><i class="ti ti-calendar"></i><div>Joined ' + esc(new Date(j).toLocaleDateString(undefined, { month: "long", year: "numeric" })) + "</div></div>");
  const el = $("pAbout");
  if (!rows.length) { el.style.display = "none"; return; }
  el.style.display = "block";
  el.innerHTML = "<h3>About</h3>" + rows.join("");
}

/* ---------------- counts ---------------- */
async function cnt(q) {
  try { const s = await getCountFromServer(q); return s.data().count; }
  catch (e) { console.error("count", e); return null; }
}

async function loadCounts() {
  const f = collection(db, "follows");
  const jobs = [
    cnt(query(f, where("followingId", "==", targetId))),
    cnt(query(f, where("followerId", "==", targetId))),
    cnt(query(collection(db, "posts"), where("authorId", "==", targetId)))
  ];
  if (isOwn) {
    const fr = collection(db, "friendRequests");
    jobs.push(cnt(query(fr, where("from", "==", me.uid), where("status", "==", "accepted"))));
    jobs.push(cnt(query(fr, where("to", "==", me.uid), where("status", "==", "accepted"))));
  }
  const r = await Promise.all(jobs);
  counts.followers = r[0]; counts.following = r[1]; counts.posts = r[2];
  if (isOwn) counts.friends = r[3] == null || r[4] == null ? null : r[3] + r[4];
  renderStats();
}

/* ---------------- follow ---------------- */
function paintFollow() {
  const b = $("btnFollow");
  if (!b) return;
  b.classList.toggle("following", following);
  b.querySelector("span").textContent = following ? "Following" : "Follow";
  b.querySelector("i").className = "ti " + (following ? "ti-user-check" : "ti-user-plus");
}
async function checkFollow() {
  try {
    const s = await getDoc(doc(db, "follows", me.uid + "_" + targetId));
    following = s.exists();
    paintFollow();
  } catch (e) { console.error("follow state", e); }
}
let followBusy = false;
async function toggleFollow() {
  if (followBusy) return;
  followBusy = true;
  const ref = doc(db, "follows", me.uid + "_" + targetId);
  const was = following;
  following = !was;
  if (counts.followers != null) counts.followers = Math.max(0, counts.followers + (was ? -1 : 1));
  paintFollow(); renderStats();
  try {
    if (was) await deleteDoc(ref);
    else await setDoc(ref, { followerId: me.uid, followingId: targetId, createdAt: serverTimestamp() });
  } catch (e) {
    console.error("follow", e);
    following = was;
    if (counts.followers != null) counts.followers = Math.max(0, counts.followers + (was ? 1 : -1));
    paintFollow(); renderStats();
    toast("Could not update follow. Try again.");
  }
  followBusy = false;
}

/* ---------------- cover upload ---------------- */
async function compress(file, maxSide, q) {
  try {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) { bmp = await createImageBitmap(file); }
    const r = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * r)), h = Math.max(1, Math.round(bmp.height * r));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", q));
    if (!blob) throw new Error("toBlob");
    return blob;
  } catch (e) {
    if (file.size <= 10 * 1024 * 1024) return file;
    throw new Error("Could not read this photo. Try another one.");
  }
}

$("coverFile").addEventListener("change", async () => {
  const file = $("coverFile").files && $("coverFile").files[0];
  $("coverFile").value = "";
  if (!file || !isOwn) return;
  if (!/^image\//.test(file.type)) { toast("Please choose a photo."); return; }
  const btn = $("coverBtn");
  btn.disabled = true;
  toast("Uploading cover...");
  try {
    const blob = await compress(file, 1600, 0.82);
    const { uploadToCloudinary } = await import("./cloudinary-upload.js");
    const res = await uploadToCloudinary(blob);
    if (!res || typeof res.url !== "string" || res.url.indexOf(CLOUD) !== 0) throw new Error("Upload failed. Try again.");
    await updateDoc(doc(db, "users", me.uid), { coverUrl: res.url });
    data.coverUrl = res.url;
    renderTop();
    toast("Cover updated");
  } catch (e) {
    console.error("cover", e);
    toast(e && e.code === "permission-denied" ? "You are not allowed to change this." : (e && e.message) || "Could not update cover.");
  }
  btn.disabled = false;
});
$("coverBtn").addEventListener("click", () => $("coverFile").click());
$("pAvatar").addEventListener("click", () => {
  const p = photoOf(data);
  if (p) openLightbox(p);
});

/* ---------------- tabs ---------------- */
function imgsHtml(images) {
  const n = images.length;
  if (!n) return "";
  const w = n === 1 ? 900 : 600;
  return '<div class="imgs n' + n + '">' + images.map((u) =>
    '<img src="' + esc(cld(u, w)) + '" data-full="' + esc(cld(u, 1600)) + '" alt="" loading="lazy" decoding="async">'
  ).join("") + "</div>";
}

function postCard(p) {
  const likes = p.likeCount > 0 ? p.likeCount + (p.likeCount === 1 ? " like" : " likes") : "";
  return '<article class="post">' +
    '<div class="po-h">' + esc(timeAgo(p.createdAtMs)) + "</div>" +
    (p.text ? '<div class="po-t">' + esc(p.text) + "</div>" : "") +
    imgsHtml(p.images) +
    '<div class="po-f"><span>' + esc(likes) + '</span><a href="feed.html?post=' + encodeURIComponent(p.id) + '">Open post</a></div>' +
    "</article>";
}

async function loadPosts() {
  if (postsCache) return postsCache;
  // Babu orderBy a query (don kada a buƙaci index): ana jera su a nan
  const snap = await getDocs(query(collection(db, "posts"), where("authorId", "==", targetId), limit(30)));
  postsCache = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      text: typeof x.text === "string" ? x.text : "",
      images: Array.isArray(x.images) ? x.images.filter((u) => typeof u === "string" && u.indexOf(CLOUD) === 0).slice(0, 4) : [],
      likeCount: typeof x.likeCount === "number" ? x.likeCount : 0,
      createdAtMs: tsMs(x.createdAt)
    };
  }).sort((a, b) => b.createdAtMs - a.createdAtMs);
  return postsCache;
}

async function loadProducts() {
  if (productsCache) return productsCache;
  const snap = await getDocs(query(collection(db, "products"), where("sellerId", "==", targetId), limit(20)));
  productsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return productsCache;
}

async function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.getAttribute("data-tab") === tab));
  const body = $("pBody");
  body.innerHTML = '<div class="empty">Loading...</div>';
  try {
    if (tab === "posts") {
      const list = await loadPosts();
      if (currentTab !== tab) return;
      body.innerHTML = list.length ? list.map(postCard).join("") : '<div class="empty">No posts yet.</div>';
    } else if (tab === "photos") {
      const list = await loadPosts();
      if (currentTab !== tab) return;
      const imgs = [];
      list.forEach((p) => p.images.forEach((u) => imgs.push(u)));
      body.innerHTML = imgs.length
        ? '<div class="grid3">' + imgs.map((u) => '<img src="' + esc(cld(u, 400)) + '" data-full="' + esc(cld(u, 1600)) + '" alt="" loading="lazy" decoding="async">').join("") + "</div>"
        : '<div class="empty">No photos yet.</div>';
    } else if (tab === "products") {
      const list = await loadProducts();
      if (currentTab !== tab) return;
      body.innerHTML = list.length
        ? '<div class="grid2">' + list.map((p) =>
            '<a class="pc" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
            '<img src="' + esc(httpUrl(p.imageUrl) || "") + '" alt="" loading="lazy" decoding="async">' +
            "<div><b>" + esc(p.name || "Product") + "</b><span>\u20A6" + esc(Number(p.price || 0).toLocaleString()) + "</span></div></a>"
          ).join("") + "</div>"
        : '<div class="empty">No products yet.</div>';
    }
  } catch (e) {
    console.error("tab", e);
    body.innerHTML = '<div class="empty">Could not load. Check your internet and try again.</div>';
  }
}

$("pTabs").addEventListener("click", (ev) => {
  const t = ev.target.closest(".tab");
  if (t) showTab(t.getAttribute("data-tab"));
});
$("pBody").addEventListener("click", (ev) => {
  const im = ev.target.closest(".imgs img, .grid3 img");
  if (im) openLightbox(im.getAttribute("data-full") || im.src);
});

/* ---------------- connections sheet ---------------- */
async function userInfo(id) {
  if (userCache.has(id)) return userCache.get(id);
  let info = { name: "User", photo: "" };
  try {
    const s = await getDoc(doc(db, "users", id));
    if (s.exists()) info = { name: nameOf(s.data()), photo: photoOf(s.data()) };
  } catch (e) {}
  userCache.set(id, info);
  return info;
}

async function connIds(kind) {
  if (kind === "followers") {
    const s = await getDocs(query(collection(db, "follows"), where("followingId", "==", targetId), limit(50)));
    return s.docs.map((d) => d.data().followerId).filter(Boolean);
  }
  if (kind === "following") {
    const s = await getDocs(query(collection(db, "follows"), where("followerId", "==", targetId), limit(50)));
    return s.docs.map((d) => d.data().followingId).filter(Boolean);
  }
  const fr = collection(db, "friendRequests");
  const [a, b] = await Promise.all([
    getDocs(query(fr, where("from", "==", me.uid), where("status", "==", "accepted"), limit(50))),
    getDocs(query(fr, where("to", "==", me.uid), where("status", "==", "accepted"), limit(50)))
  ]);
  const ids = new Set();
  a.docs.forEach((d) => { if (d.data().to) ids.add(d.data().to); });
  b.docs.forEach((d) => { if (d.data().from) ids.add(d.data().from); });
  ids.delete(me.uid);
  return Array.from(ids);
}

async function openConn(kind) {
  const kinds = isOwn ? ["followers", "following", "friends"] : ["followers", "following"];
  const tabs = $("connTabs");
  tabs.innerHTML = kinds.map((k) =>
    '<button type="button" class="tab' + (k === kind ? " on" : "") + '" data-k="' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + "</button>"
  ).join("");
  $("connSheet").classList.add("on");
  await fillConn(kind);
}

let connToken = 0;
async function fillConn(kind) {
  const tok = ++connToken;
  const list = $("connList");
  list.innerHTML = '<div class="empty">Loading...</div>';
  try {
    const ids = await connIds(kind);
    const infos = await Promise.all(ids.map(async (id) => ({ id, ...(await userInfo(id)) })));
    if (tok !== connToken) return;
    list.innerHTML = infos.length
      ? infos.map((u) =>
          '<a class="c-row" href="profile.html?id=' + encodeURIComponent(u.id) + '"><div class="c-av">' +
          avatarInner(u.name, u.photo) + '</div><div class="c-name">' + esc(u.name) + "</div></a>"
        ).join("")
      : '<div class="empty">Nobody here yet.</div>';
  } catch (e) {
    console.error("conn", e);
    if (tok === connToken) list.innerHTML = '<div class="empty">Could not load. Try again.</div>';
  }
}

$("connTabs").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-k]");
  if (!b) return;
  $("connTabs").querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t === b));
  fillConn(b.getAttribute("data-k"));
});
$("connClose").addEventListener("click", () => $("connSheet").classList.remove("on"));
$("connSheet").addEventListener("click", (ev) => { if (ev.target === $("connSheet")) $("connSheet").classList.remove("on"); });
$("pStats").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-conn]");
  if (b) openConn(b.getAttribute("data-conn"));
});

$("backBtn").addEventListener("click", () => {
  if (history.length > 1) history.back(); else location.href = "index.html";
});

/* ---------------- start ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.replace("login.html"); return; }
  me = user;
  const qid = new URLSearchParams(location.search).get("id");
  targetId = qid && /^[A-Za-z0-9_-]{6,128}$/.test(qid) ? qid : user.uid;
  isOwn = targetId === user.uid;

  const link = $("navProfileLink");
  if (link) link.href = "profile.html?id=" + user.uid;

  try {
    const snap = await getDoc(doc(db, "users", targetId));
    if (!snap.exists()) {
      $("pErr").innerHTML = '<div class="err">Profile not found.</div>';
      $("pName").textContent = "";
      $("pBody").innerHTML = "";
      return;
    }
    data = snap.data();
  } catch (e) {
    console.error("profile", e);
    $("pErr").innerHTML = '<div class="err">Could not load this profile. Check your internet and refresh.</div>';
    return;
  }

  isSeller = data.role === "seller" && data.isSeller === true && data.sellerStatus === "approved";
  $("tabProducts").style.display = isSeller ? "" : "none";

  renderTop();
  if (!isOwn) checkFollow();
  loadCounts();
  showTab("posts");
});
