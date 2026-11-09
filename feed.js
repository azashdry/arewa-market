/* =========================================================
   AREWA MARKET - FEED (Mataki na 1 / sashe na 2: karantawa)
   - Yana karanta posts 10 a lokaci (+ "Show more")
   - Cache na shafin farko (localStorage: am_feed_v1) don buɗewa da sauri
   - Hotuna: lazy + Cloudinary w_/q_/f_auto
   - Maɓallan like/comment/share/delete suna da data-action;
     feed-actions.js (sashe na 4) zai haɗa su. Yanzu ba su aiki.
   - Gaba: feed-compose.js (sashe na 3) yana amfani da window.AMFeed
========================================================= */
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection, query, orderBy, limit, startAfter, getDocs, getDoc, doc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const PAGE_SIZE = 10;
const CACHE_KEY = "am_feed_v1";
const CACHE_MAX_AGE = 10 * 60 * 1000; // minti 10

const $ = (id) => document.getElementById(id);
const feedEl = $("feed");
const moreBtn = $("btnMore");

const state = {
  me: null,
  myData: {},
  lastDoc: null,
  hasMore: false,
  loading: false,
  posts: new Map() // id -> post
};

/* ---------------- helpers ---------------- */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

function timeAgo(ms) {
  if (!ms) return "just now";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  const d = Math.floor(h / 24);
  if (d < 7) return d + "d";
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}

// Cloudinary: ƙara w_/q_/f_auto idan URL ɗin bai riga yana da su ba
function cld(url, w) {
  if (typeof url !== "string") return "";
  if (url.indexOf("res.cloudinary.com") > -1 && url.indexOf("/upload/") > -1 &&
      !/\/upload\/[^/]*(w_|c_|q_|f_)/.test(url)) {
    return url.replace("/upload/", "/upload/f_auto,q_auto,w_" + w + "/");
  }
  return url;
}

function avatarHtml(name, photo) {
  const initial = esc((name || "?").trim().charAt(0).toUpperCase() || "?");
  if (photo) {
    return '<div class="avatar"><img src="' + esc(photo) + '" alt="" loading="lazy" decoding="async" ' +
      "onerror=\"this.parentNode.textContent='" + initial + "'\"></div>";
  }
  return '<div class="avatar">' + initial + "</div>";
}

// Firestore doc -> abu mai sauƙi (createdAtMs lamba ce, don cache)
function normalize(id, d) {
  const ts = d.createdAt;
  return {
    id,
    authorId: d.authorId || "",
    authorName: d.authorName || "User",
    authorPhoto: d.authorPhoto || "",
    text: typeof d.text === "string" ? d.text : "",
    images: Array.isArray(d.images) ? d.images.slice(0, 4) : [],
    productId: d.productId || "",
    likeCount: typeof d.likeCount === "number" ? d.likeCount : 0,
    createdAtMs: ts && typeof ts.toMillis === "function" ? ts.toMillis() : (d.createdAtMs || 0)
  };
}

/* ---------------- render ---------------- */
function imagesHtml(images) {
  const n = images.length;
  if (!n) return "";
  const w = n === 1 ? 900 : 600;
  const imgs = images.map((u, i) =>
    '<img src="' + esc(cld(u, w)) + '" data-full="' + esc(cld(u, 1600)) + '" data-i="' + i +
    '" alt="" loading="lazy" decoding="async">'
  ).join("");
  return '<div class="imgs n' + n + '">' + imgs + "</div>";
}

function postHtml(p) {
  const long = p.text.length > 280 || (p.text.match(/\n/g) || []).length > 5;
  const mine = state.me && p.authorId === state.me.uid;
  return (
    '<article class="post" data-id="' + esc(p.id) + '" data-author="' + esc(p.authorId) + '">' +
      '<div class="p-head">' +
        avatarHtml(p.authorName, p.authorPhoto) +
        '<div class="p-who">' +
          '<div class="p-name"><a href="profile.html?id=' + encodeURIComponent(p.authorId) + '">' + esc(p.authorName) + "</a></div>" +
          '<div class="p-time">' + esc(timeAgo(p.createdAtMs)) + "</div>" +
        "</div>" +
        (mine
          ? '<button class="p-more" data-action="delete" data-id="' + esc(p.id) + '" aria-label="Delete post"><i class="ti ti-trash"></i></button>'
          : (p.authorId ? '<button class="p-follow" data-action="follow" data-author="' + esc(p.authorId) + '">Follow</button>' : "")) +
      "</div>" +
      (p.text ? '<div class="p-text' + (long ? " clamp" : "") + '">' + esc(p.text) + "</div>" : "") +
      (long ? '<button class="p-seemore" data-seemore="1">See more</button>' : "") +
      imagesHtml(p.images) +
      (p.productId ? '<a class="p-product" href="product.html?id=' + encodeURIComponent(p.productId) + '"><i class="ti ti-shopping-bag"></i> View product</a>' : "") +
      '<div class="p-stats" data-stats="' + esc(p.id) + '"' + (p.likeCount > 0 ? "" : ' style="display:none"') + '><span data-likes="' + esc(p.id) + '">' + (p.likeCount > 0 ? p.likeCount + (p.likeCount === 1 ? " like" : " likes") : "") + "</span><span></span></div>" +
      '<div class="p-actions">' +
        '<button data-action="like" data-id="' + esc(p.id) + '"><i class="ti ti-thumb-up"></i> Like</button>' +
        '<button data-action="comment" data-id="' + esc(p.id) + '"><i class="ti ti-message-circle"></i> Comment</button>' +
        '<button data-action="share" data-id="' + esc(p.id) + '"><i class="ti ti-share-3"></i> Share</button>' +
      "</div>" +
      '<div class="p-comments" data-comments="' + esc(p.id) + '"></div>' +
    "</article>"
  );
}

function skeleton() {
  const one = '<div class="sk"><i style="width:45%;height:14px;margin-bottom:10px"></i><i style="width:90%;height:12px;margin-bottom:6px"></i><i style="width:70%;height:12px;margin-bottom:12px"></i><i style="width:100%;height:160px"></i></div>';
  return one + one;
}

function renderList(list, append) {
  if (!append) feedEl.innerHTML = "";
  const html = list.map(postHtml).join("");
  feedEl.insertAdjacentHTML("beforeend", html);
  list.forEach((p) => state.posts.set(p.id, p));
  $("feedEmpty").style.display = state.posts.size === 0 ? "block" : "none";
  window.dispatchEvent(new CustomEvent("amfeed:rendered", { detail: { posts: list } }));
}

// Ana amfani da shi daga feed-compose.js bayan an yi post
function prependPost(p) {
  state.posts.set(p.id, p);
  feedEl.insertAdjacentHTML("afterbegin", postHtml(p));
  $("feedEmpty").style.display = "none";
  window.dispatchEvent(new CustomEvent("amfeed:rendered", { detail: { posts: [p] } }));
}

function removePost(id) {
  state.posts.delete(id);
  const el = feedEl.querySelector('.post[data-id="' + CSS.escape(id) + '"]');
  if (el) el.remove();
  $("feedEmpty").style.display = state.posts.size === 0 ? "block" : "none";
}

/* ---------------- cache ---------------- */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !Array.isArray(c.posts) || Date.now() - c.t > CACHE_MAX_AGE) return null;
    return c.posts;
  } catch (e) { return null; }
}
function writeCache(list) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), posts: list })); } catch (e) {}
}

/* ---------------- load ---------------- */
async function fetchPage(after) {
  const parts = [collection(db, "posts"), orderBy("createdAt", "desc")];
  if (after) parts.push(startAfter(after));
  parts.push(limit(PAGE_SIZE));
  const snap = await getDocs(query(...parts));
  return {
    list: snap.docs.map((d) => normalize(d.id, d.data())),
    last: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    full: snap.docs.length === PAGE_SIZE
  };
}

async function loadFirst() {
  state.loading = true;
  $("feedError").innerHTML = "";

  const cached = readCache();
  if (cached && cached.length) {
    state.posts.clear();
    renderList(cached, false);
  } else {
    feedEl.innerHTML = skeleton();
  }

  try {
    const page = await fetchPage(null);
    state.lastDoc = page.last;
    state.hasMore = page.full;
    state.posts.clear();
    renderList(page.list, false);
    writeCache(page.list);
  } catch (e) {
    console.error("feed load", e);
    if (!state.posts.size) feedEl.innerHTML = "";
    $("feedError").innerHTML = '<div class="err">Could not load the feed. Check your internet and refresh.</div>';
  }
  moreBtn.style.display = state.hasMore ? "block" : "none";
  state.loading = false;
  window.dispatchEvent(new CustomEvent("amfeed:loaded"));
}

async function loadMore() {
  if (state.loading || !state.hasMore || !state.lastDoc) return;
  state.loading = true;
  moreBtn.disabled = true;
  moreBtn.textContent = "Loading...";
  try {
    const page = await fetchPage(state.lastDoc);
    state.lastDoc = page.last || state.lastDoc;
    state.hasMore = page.full;
    renderList(page.list, true);
  } catch (e) {
    console.error("feed more", e);
    toast("Could not load more. Try again.");
  }
  moreBtn.disabled = false;
  moreBtn.textContent = "Show more";
  moreBtn.style.display = state.hasMore ? "block" : "none";
  state.loading = false;
}

/* ---------------- events ---------------- */
moreBtn.addEventListener("click", loadMore);

feedEl.addEventListener("click", (ev) => {
  const t = ev.target;

  // "See more" na doguwar rubutu
  const sm = t.closest("[data-seemore]");
  if (sm) {
    const txt = sm.previousElementSibling;
    if (txt) txt.classList.remove("clamp");
    sm.remove();
    return;
  }

  // Duba hoto girma
  const img = t.closest(".imgs img");
  if (img) {
    $("lbImg").src = img.getAttribute("data-full") || img.src;
    $("lb").classList.add("open");
  }
});

$("lb").addEventListener("click", () => {
  $("lb").classList.remove("open");
  $("lbImg").removeAttribute("src");
});

/* ---------------- API ga sauran fayiloli ---------------- */
window.AMFeed = {
  state, db, auth, esc, toast, timeAgo, cld, avatarHtml,
  normalize, postHtml, prependPost, removePost, writeCache, readCache
};

/* ---------------- start ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("login.html"); return; }
  state.me = user;
  const link = $("navProfileLink");
  if (link) link.href = "profile.html?id=" + user.uid;

  // Bayanan mai amfani (don suna/hoto a post daga baya). Karatu ɗaya ne.
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    state.myData = snap.exists() ? snap.data() : {};
  } catch (e) { console.error("user doc", e); }

  window.dispatchEvent(new CustomEvent("amfeed:ready"));
  loadFirst();
});
