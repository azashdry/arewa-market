/* =========================================================
   AREWA MARKET - FEED ACTIONS (Mataki na 1 / sashe na 4)
   - Like (ɗan yatsa, kamar Facebook): batch tare da likeCount +1/-1
   - Comment: ana ɗauko su idan an buɗe (15 a lokaci)
   - Share: navigator.share (link: feed.html?post=ID)
   - Follow: collection "follows" (daidai da seller-profile / index)
   - Delete: mai post kaɗai
   Karatu kaɗan: yanayin like ana ajiye shi a localStorage;
   jerin waɗanda kake bi ana ɗauko shi sau ɗaya (query ɗaya).
========================================================= */
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, writeBatch,
  query, where, orderBy, limit, startAfter, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const F = window.AMFeed;
const COMMENT_PAGE = 15;
const MAX_COMMENT = 500;
const MAP_CAP = 400;

let uid = "";
let ready = false;
let likeMap = {};            // postId -> 1 | 0
let following = new Set();   // uid na waɗanda nake bi
let followingLoaded = false;
const busy = new Set();      // makullin don hana taɓa sau biyu
const checking = new Set();  // posts da ake duba like ɗinsu
const cstate = {};           // postId -> {last, more, loaded}

/* ---------------- CSS ---------------- */
const css = document.createElement("style");
css.textContent = `
.p-follow{flex-shrink:0;border:1.5px solid #075e36;color:#075e36;background:#fff;border-radius:16px;padding:6px 14px;font:700 13px 'Inter',sans-serif;cursor:pointer}
.p-follow.following{background:#eef1ef;border-color:#d5d9d6;color:#555}
.p-follow:disabled{opacity:.6}
.p-actions button{-webkit-tap-highlight-color:transparent}
.p-actions button .ti{font-size:19px}
.p-actions button.liked{color:#1877f2}
.p-actions button.liked .ti{color:#1877f2}
.post.hl{outline:2px solid #c9a227}
.cm-list{display:flex;flex-direction:column;gap:10px}
.cm-item{display:flex;gap:8px;align-items:flex-start}
.cm-item .avatar{width:32px;height:32px;font-size:13px}
.cm-body{flex:1;min-width:0}
.cm-bubble{background:#f3f1ec;border-radius:14px;padding:7px 12px;display:inline-block;max-width:100%}
.cm-name{font-weight:700;font-size:13px}
.cm-name a{color:inherit;text-decoration:none}
.cm-text{font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
.cm-meta{font-size:11.5px;color:#888;margin:2px 0 0 10px;display:flex;gap:10px}
.cm-meta button{border:0;background:transparent;color:#b3261e;font:600 11.5px 'Inter',sans-serif;padding:0}
.cm-earlier{border:0;background:transparent;color:#075e36;font:600 13px 'Inter',sans-serif;padding:4px 0 10px}
.cm-empty{font-size:13px;color:#888;padding:2px 0 10px}
.cm-form{display:flex;gap:8px;margin-top:12px}
.cm-form input{flex:1;min-width:0;border:0;outline:0;background:#f3f1ec;border-radius:18px;padding:10px 14px;font:14px 'Inter',sans-serif}
.cm-form button{border:0;background:#075e36;color:#fff;border-radius:18px;padding:0 16px;font:700 13px 'Inter',sans-serif}
.cm-form button:disabled{opacity:.5}
`;
document.head.appendChild(css);

/* ---------------- helpers ---------------- */
const $post = (id) => document.querySelector('.post[data-id="' + CSS.escape(id) + '"]');

function ls(key, val) {
  try {
    if (val === undefined) { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {}
  return null;
}

function trimMap(m, cap) {
  const keys = Object.keys(m);
  if (keys.length <= cap) return m;
  const out = {};
  keys.slice(keys.length - cap).forEach((k) => { out[k] = m[k]; });
  return out;
}

function saveLikes() { likeMap = trimMap(likeMap, MAP_CAP); ls("am_likes_v1_" + uid, likeMap); }
function saveFollowing() { ls("am_following_v1_" + uid, Array.from(following).slice(0, 500)); }

function myName() {
  const d = F.state.myData || {};
  const n = (d.name || d.businessName || (F.state.me && F.state.me.displayName) || "User").toString().trim();
  return (n || "User").slice(0, 80);
}
function myPhoto() {
  const d = F.state.myData || {};
  const p = d.profileImageUrl || d.profileImage || d.photoURL || (F.state.me && F.state.me.photoURL) || "";
  return typeof p === "string" && /^https?:\/\//.test(p) && p.length <= 600 ? p : "";
}

function shareUrl(id) {
  return new URL("feed.html?post=" + encodeURIComponent(id), location.href).href;
}

function init() {
  if (ready) return true;
  if (!F.state.me) return false;
  uid = F.state.me.uid;
  likeMap = ls("am_likes_v1_" + uid) || {};
  const cachedF = ls("am_following_v1_" + uid);
  if (Array.isArray(cachedF)) { following = new Set(cachedF); followingLoaded = true; }
  ready = true;
  loadFollowing();
  return true;
}

/* ---------------- LIKE ---------------- */
function paintLike(id) {
  const el = $post(id);
  if (!el) return;
  const liked = likeMap[id] === 1;
  const btn = el.querySelector('[data-action="like"]');
  if (btn) {
    btn.classList.toggle("liked", liked);
    const ic = btn.querySelector("i");
    if (ic) ic.className = "ti " + (liked ? "ti-thumb-up-filled" : "ti-thumb-up");
  }
  const post = F.state.posts.get(id);
  const n = post ? Math.max(0, post.likeCount) : 0;
  const stats = el.querySelector('[data-stats="' + CSS.escape(id) + '"]');
  const span = el.querySelector('[data-likes="' + CSS.escape(id) + '"]');
  if (span) span.textContent = n > 0 ? n + (n === 1 ? " like" : " likes") : "";
  if (stats) stats.style.display = n > 0 ? "" : "none";
}

async function verifyLikes(list) {
  const todo = list.filter((p) => likeMap[p.id] === undefined && !checking.has(p.id));
  list.forEach((p) => { if (likeMap[p.id] !== undefined) paintLike(p.id); });
  if (!todo.length) return;
  todo.forEach((p) => checking.add(p.id));
  await Promise.all(todo.map(async (p) => {
    try {
      const s = await getDoc(doc(F.db, "posts", p.id, "likes", uid));
      likeMap[p.id] = s.exists() ? 1 : 0;
      paintLike(p.id);
    } catch (e) { console.error("like check", e); }
    checking.delete(p.id);
  }));
  saveLikes();
}

async function toggleLike(id) {
  const key = "like:" + id;
  if (busy.has(key)) return;
  const post = F.state.posts.get(id);
  if (!post) return;
  busy.add(key);

  const was = likeMap[id] === 1;
  const next = !was;
  const oldCount = post.likeCount;
  post.likeCount = Math.max(0, oldCount + (next ? 1 : -1));
  likeMap[id] = next ? 1 : 0;
  paintLike(id);

  try {
    const batch = writeBatch(F.db);
    const likeRef = doc(F.db, "posts", id, "likes", uid);
    const postRef = doc(F.db, "posts", id);
    if (next) {
      batch.set(likeRef, { uid, createdAt: serverTimestamp() });
      batch.update(postRef, { likeCount: increment(1) });
    } else {
      batch.delete(likeRef);
      batch.update(postRef, { likeCount: increment(-1) });
    }
    await batch.commit();
    saveLikes();
  } catch (e) {
    console.error("like", e);
    // A koma: gano ainihin yanayin daga server
    post.likeCount = oldCount;
    try {
      const s = await getDoc(doc(F.db, "posts", id, "likes", uid));
      likeMap[id] = s.exists() ? 1 : 0;
    } catch (e2) { likeMap[id] = was ? 1 : 0; }
    paintLike(id);
    saveLikes();
    F.toast("Could not update like. Try again.");
  }
  busy.delete(key);
}

/* ---------------- FOLLOW ---------------- */
function paintFollow(authorId) {
  const on = following.has(authorId);
  document.querySelectorAll('.p-follow[data-author="' + CSS.escape(authorId) + '"]').forEach((b) => {
    b.textContent = on ? "Following" : "Follow";
    b.classList.toggle("following", on);
  });
}
function paintAllFollow() {
  const seen = new Set();
  document.querySelectorAll(".p-follow").forEach((b) => {
    const a = b.getAttribute("data-author");
    if (a && !seen.has(a)) { seen.add(a); paintFollow(a); }
  });
}

async function loadFollowing() {
  try {
    const snap = await getDocs(query(
      collection(F.db, "follows"), where("followerId", "==", uid), limit(500)
    ));
    const set = new Set();
    snap.forEach((d) => { const f = d.data().followingId; if (f) set.add(f); });
    following = set;
    followingLoaded = true;
    saveFollowing();
    paintAllFollow();
  } catch (e) { console.error("following", e); }
}

async function toggleFollow(authorId, btn) {
  if (!authorId || authorId === uid) return;
  const key = "follow:" + authorId;
  if (busy.has(key)) return;
  busy.add(key);
  const ref = doc(F.db, "follows", uid + "_" + authorId);
  const was = following.has(authorId);

  if (was) following.delete(authorId); else following.add(authorId);
  paintFollow(authorId);

  try {
    if (was) await deleteDoc(ref);
    else await setDoc(ref, { followerId: uid, followingId: authorId, createdAt: serverTimestamp() });
    saveFollowing();
  } catch (e) {
    console.error("follow", e);
    // A koma, kuma a duba ainihin yanayin
    try {
      const s = await getDoc(ref);
      if (s.exists()) following.add(authorId); else following.delete(authorId);
    } catch (e2) {
      if (was) following.add(authorId); else following.delete(authorId);
    }
    paintFollow(authorId);
    saveFollowing();
    F.toast("Could not update follow. Try again.");
  }
  busy.delete(key);
}

/* ---------------- SHARE ---------------- */
async function sharePost(id) {
  const post = F.state.posts.get(id);
  const url = shareUrl(id);
  const snippet = post && post.text ? post.text.replace(/\s+/g, " ").slice(0, 100) : "See this post on Arewa Market";
  try {
    if (navigator.share) {
      await navigator.share({ title: "Arewa Market", text: snippet, url });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(url);
    F.toast("Link copied");
  } catch (e) {
    window.prompt("Copy this link:", url);
  }
}

/* ---------------- DELETE POST ---------------- */
async function deletePost(id) {
  const post = F.state.posts.get(id);
  if (!post || post.authorId !== uid) return;
  if (!window.confirm("Delete this post?")) return;
  const key = "del:" + id;
  if (busy.has(key)) return;
  busy.add(key);
  try {
    await deleteDoc(doc(F.db, "posts", id));
    F.removePost(id);
    delete likeMap[id];
    saveLikes();
    try {
      const c = ls("am_feed_v1");
      if (c && Array.isArray(c.posts)) {
        c.posts = c.posts.filter((p) => p.id !== id);
        ls("am_feed_v1", c);
      }
    } catch (e) {}
    F.toast("Post deleted");
  } catch (e) {
    console.error("delete post", e);
    F.toast("Could not delete. Try again.");
  }
  busy.delete(key);
}

/* ---------------- COMMENTS ---------------- */
function commentHtml(c, postAuthorId) {
  const canDel = c.authorId === uid || postAuthorId === uid;
  return (
    '<div class="cm-item" data-cid="' + F.esc(c.id) + '">' +
      F.avatarHtml(c.authorName, c.authorPhoto) +
      '<div class="cm-body">' +
        '<div class="cm-bubble"><div class="cm-name"><a href="seller-profile.html?id=' + encodeURIComponent(c.authorId) + '">' + F.esc(c.authorName) + "</a></div>" +
        '<div class="cm-text">' + F.esc(c.text) + "</div></div>" +
        '<div class="cm-meta"><span>' + F.esc(F.timeAgo(c.createdAtMs)) + "</span>" +
        (canDel ? '<button data-cdel="' + F.esc(c.id) + '">Delete</button>' : "") + "</div>" +
      "</div>" +
    "</div>"
  );
}

function normComment(id, d) {
  const ts = d.createdAt;
  return {
    id,
    authorId: d.authorId || "",
    authorName: d.authorName || "User",
    authorPhoto: d.authorPhoto || "",
    text: typeof d.text === "string" ? d.text : "",
    createdAtMs: ts && typeof ts.toMillis === "function" ? ts.toMillis() : (d.createdAtMs || 0)
  };
}

function buildPanel(id, panel) {
  panel.innerHTML =
    '<button class="cm-earlier" style="display:none">View earlier comments</button>' +
    '<div class="cm-list"></div>' +
    '<div class="cm-empty" style="display:none">No comments yet. Be the first!</div>' +
    '<div class="cm-form"><input type="text" maxlength="' + MAX_COMMENT + '" placeholder="Write a comment..." aria-label="Write a comment">' +
    '<button type="button" disabled>Send</button></div>';

  const input = panel.querySelector("input");
  const send = panel.querySelector(".cm-form button");
  input.addEventListener("input", () => { send.disabled = !input.value.trim(); });
  input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); sendComment(id, panel); } });
  send.addEventListener("click", () => sendComment(id, panel));
  panel.querySelector(".cm-earlier").addEventListener("click", () => loadComments(id, panel, true));
}

async function loadComments(id, panel, older) {
  const st = cstate[id] || (cstate[id] = { last: null, more: false, loaded: false });
  const key = "cload:" + id;
  if (busy.has(key)) return;
  busy.add(key);
  const listEl = panel.querySelector(".cm-list");
  const earlier = panel.querySelector(".cm-earlier");
  const empty = panel.querySelector(".cm-empty");
  const post = F.state.posts.get(id);
  const postAuthor = post ? post.authorId : "";
  try {
    const parts = [collection(F.db, "posts", id, "comments"), orderBy("createdAt", "desc")];
    if (older && st.last) parts.push(startAfter(st.last));
    parts.push(limit(COMMENT_PAGE));
    const snap = await getDocs(query(...parts));
    const items = snap.docs.map((d) => normComment(d.id, d.data())).reverse(); // tsoho -> sabo
    if (snap.docs.length) st.last = snap.docs[snap.docs.length - 1];
    st.more = snap.docs.length === COMMENT_PAGE;
    st.loaded = true;
    const html = items.map((c) => commentHtml(c, postAuthor)).join("");
    if (older) listEl.insertAdjacentHTML("afterbegin", html);
    else listEl.innerHTML = html;
    earlier.style.display = st.more ? "block" : "none";
    empty.style.display = listEl.children.length ? "none" : "block";
  } catch (e) {
    console.error("comments", e);
    F.toast("Could not load comments.");
  }
  busy.delete(key);
}

async function sendComment(id, panel) {
  const input = panel.querySelector("input");
  const send = panel.querySelector(".cm-form button");
  const text = input.value.trim();
  if (!text || text.length > MAX_COMMENT) return;
  const key = "csend:" + id;
  if (busy.has(key)) return;
  busy.add(key);
  send.disabled = true;
  try {
    const data = { authorId: uid, authorName: myName(), text, createdAt: serverTimestamp() };
    const photo = myPhoto();
    if (photo) data.authorPhoto = photo;
    const ref = await addDoc(collection(F.db, "posts", id, "comments"), data);
    const post = F.state.posts.get(id);
    const c = normComment(ref.id, Object.assign({}, data, { createdAt: null, createdAtMs: Date.now() }));
    panel.querySelector(".cm-list").insertAdjacentHTML("beforeend", commentHtml(c, post ? post.authorId : ""));
    panel.querySelector(".cm-empty").style.display = "none";
    input.value = "";
  } catch (e) {
    console.error("send comment", e);
    F.toast(e && e.code === "permission-denied" ? "You are not allowed to comment." : "Could not send. Try again.");
    send.disabled = false;
    busy.delete(key);
    return;
  }
  busy.delete(key);
}

async function deleteComment(id, cid, itemEl) {
  if (!window.confirm("Delete this comment?")) return;
  const key = "cdel:" + cid;
  if (busy.has(key)) return;
  busy.add(key);
  try {
    await deleteDoc(doc(F.db, "posts", id, "comments", cid));
    const panel = itemEl.closest(".p-comments");
    itemEl.remove();
    if (panel && !panel.querySelector(".cm-list").children.length) panel.querySelector(".cm-empty").style.display = "block";
  } catch (e) {
    console.error("delete comment", e);
    F.toast("Could not delete. Try again.");
  }
  busy.delete(key);
}

function toggleComments(id) {
  const panel = document.querySelector('[data-comments="' + CSS.escape(id) + '"]');
  if (!panel) return;
  const open = panel.classList.toggle("open");
  if (!open) return;
  if (!panel.firstChild) buildPanel(id, panel);
  const st = cstate[id];
  if (!st || !st.loaded) loadComments(id, panel, false);
  const inp = panel.querySelector("input");
  if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 50);
}

/* ---------------- Post da aka raba (?post=ID) ---------------- */
async function openSharedPost() {
  const pid = new URLSearchParams(location.search).get("post");
  if (!pid || !/^[A-Za-z0-9]{6,40}$/.test(pid)) return;
  if (!F.state.posts.has(pid)) {
    try {
      const s = await getDoc(doc(F.db, "posts", pid));
      if (!s.exists()) { F.toast("This post is no longer available."); return; }
      F.prependPost(F.normalize(s.id, s.data()));
    } catch (e) { console.error("shared post", e); F.toast("Could not open this post."); return; }
  }
  const el = $post(pid);
  if (el) {
    el.classList.add("hl");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el.classList.remove("hl"), 3500);
  }
}

/* ---------------- Events ---------------- */
document.getElementById("feed").addEventListener("click", (ev) => {
  if (!init()) return;
  const t = ev.target;

  const cdel = t.closest("[data-cdel]");
  if (cdel) {
    const postEl = cdel.closest(".post");
    deleteComment(postEl.getAttribute("data-id"), cdel.getAttribute("data-cdel"), cdel.closest(".cm-item"));
    return;
  }

  const btn = t.closest("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");

  if (action === "like") toggleLike(id);
  else if (action === "comment") toggleComments(id);
  else if (action === "share") sharePost(id);
  else if (action === "delete") deletePost(id);
  else if (action === "follow") toggleFollow(btn.getAttribute("data-author"), btn);
});

window.addEventListener("amfeed:rendered", (ev) => {
  if (!init()) return;
  const list = (ev.detail && ev.detail.posts) || [];
  verifyLikes(list);
  if (followingLoaded) paintAllFollow();
});

let sharedDone = false;
window.addEventListener("amfeed:loaded", () => {
  if (sharedDone) return;
  sharedDone = true;
  if (init()) openSharedPost();
});
