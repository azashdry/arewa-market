/* =========================================================
   AREWA MARKET - FEED COMPOSER (Mataki na 1 / sashe na 3)
   - Akwatin rubuta post (<=2000), hotuna har 4, "Attach product"
   - Hotuna ana matse su a waya (max 1280px, JPEG 0.8) kafin Cloudinary
   - Idan hoto ɗaya ya kasa, ba a yin post (babu rabin post)
   - Yana amfani da window.AMFeed daga feed.js
========================================================= */
import {
  collection, addDoc, getDocs, query, where, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const MAX_TEXT = 2000;
const MAX_IMAGES = 4;
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.8;
const COOLDOWN_MS = 10000;
const ORIGINAL_MAX_MB = 10;      // iyakar Cloudinary a cloudinary-upload.js
const CACHE_KEY = "am_feed_v1";

let F = null;                    // window.AMFeed
let picked = [];                 // [{blob, preview}]
let productId = "";
let productName = "";
let busy = false;
let lastPostAt = 0;
let myProducts = null;           // null = ba a ɗauko ba tukuna

/* ---------------- CSS ---------------- */
const css = document.createElement("style");
css.textContent = `
.cmp{background:#fff;border-radius:14px;padding:12px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.cmp-top{display:flex;gap:10px;align-items:flex-start}
.cmp-top .avatar{width:40px;height:40px;border-radius:50%;background:#075e36;color:#fff;display:flex;align-items:center;justify-content:center;font:700 16px 'Inter',sans-serif;overflow:hidden;flex-shrink:0}
.cmp-top .avatar img{width:100%;height:100%;object-fit:cover}
.cmp textarea{flex:1;min-width:0;border:0;outline:0;resize:none;font:15px/1.45 'Inter',sans-serif;background:#f3f1ec;border-radius:12px;padding:10px 12px;min-height:44px;max-height:220px;color:#222}
.cmp-prev{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
.cmp-prev .it{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#eee}
.cmp-prev img{width:100%;height:100%;object-fit:cover;display:block}
.cmp-prev button{position:absolute;top:3px;right:3px;width:24px;height:24px;border:0;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;font-size:15px;line-height:24px;padding:0}
.cmp-prod{display:none;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;background:#fff4d6;border-radius:10px;font:600 13px 'Inter',sans-serif;color:#6b5400}
.cmp-prod.on{display:flex}
.cmp-prod span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-prod button{border:0;background:transparent;color:#6b5400;font-size:18px;padding:0 4px}
.cmp-picker{display:none;margin-top:8px;max-height:200px;overflow:auto;border:1px solid #e6e2da;border-radius:10px}
.cmp-picker.on{display:block}
.cmp-picker button{display:block;width:100%;text-align:left;border:0;background:#fff;padding:10px 12px;font:14px 'Inter',sans-serif;border-bottom:1px solid #f0ede6;color:#222}
.cmp-picker .none{padding:12px;font-size:13px;color:#777}
.cmp-bar{display:flex;align-items:center;gap:6px;margin-top:10px}
.cmp-bar .tool{border:0;background:#eef1ef;color:#333;border-radius:9px;padding:9px 11px;font:600 13px 'Inter',sans-serif;display:flex;align-items:center;gap:5px}
.cmp-bar .tool:disabled{opacity:.5}
.cmp-count{margin-left:auto;font-size:12px;color:#888}
.cmp-count.warn{color:#d93025;font-weight:700}
.cmp-go{border:0;background:#075e36;color:#fff;border-radius:9px;padding:10px 18px;font:700 14px 'Inter',sans-serif}
.cmp-go:disabled{opacity:.5}
.cmp-msg{font-size:12.5px;margin-top:8px;color:#b3261e;display:none}
.cmp-msg.on{display:block}
.cmp-msg.info{color:#075e36}
`;
document.head.appendChild(css);

/* ---------------- helpers ---------------- */
function myName() {
  const d = F.state.myData || {};
  const n = (d.name || d.businessName || (F.state.me && F.state.me.displayName) || "User").toString().trim();
  return (n || "User").slice(0, 80);
}

function myPhoto() {
  const d = F.state.myData || {};
  const p = d.profileImageUrl || d.profileImage || d.photoURL || (F.state.me && F.state.me.photoURL) || "";
  // data: URL ko doguwar link ba za a ajiye ba (rules: <=600)
  return typeof p === "string" && /^https?:\/\//.test(p) && p.length <= 600 ? p : "";
}

function msg(text, info) {
  const m = document.getElementById("cmpMsg");
  if (!m) return;
  m.textContent = text || "";
  m.className = "cmp-msg" + (text ? " on" : "") + (info ? " info" : "");
}

// Matse hoto: max 1280px, JPEG. Idan ya kasa, a yi amfani da na asali (idan <=10MB)
async function compress(file) {
  try {
    let bmp;
    if (window.createImageBitmap) {
      try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
      catch (e) { bmp = await createImageBitmap(file); }
    } else {
      bmp = await new Promise((res, rej) => {
        const img = new Image(), u = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(u); res(img); };
        img.onerror = rej;
        img.src = u;
      });
    }
    const w0 = bmp.width, h0 = bmp.height;
    const ratio = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * ratio));
    const h = Math.max(1, Math.round(h0 * ratio));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";            // PNG mai haske ya zama fari, ba baƙi ba
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("toBlob");
    return blob;
  } catch (e) {
    if (file.size <= ORIGINAL_MAX_MB * 1024 * 1024) return file;
    throw new Error("Could not read this photo. Try another one.");
  }
}

function render() {
  const prev = document.getElementById("cmpPrev");
  prev.innerHTML = "";
  picked.forEach((p, i) => {
    const it = document.createElement("div");
    it.className = "it";
    const img = document.createElement("img");
    img.src = p.preview;
    img.alt = "";
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "×";
    b.setAttribute("aria-label", "Remove photo");
    b.addEventListener("click", () => {
      URL.revokeObjectURL(p.preview);
      picked.splice(i, 1);
      render();
    });
    it.appendChild(img); it.appendChild(b);
    prev.appendChild(it);
  });
  prev.style.display = picked.length ? "grid" : "none";
  document.getElementById("cmpPhoto").disabled = busy || picked.length >= MAX_IMAGES;
  updateState();
}

function updateState() {
  const ta = document.getElementById("cmpText");
  const len = ta.value.length;
  const c = document.getElementById("cmpCount");
  c.textContent = len + "/" + MAX_TEXT;
  c.className = "cmp-count" + (len > MAX_TEXT - 100 ? " warn" : "");
  const hasContent = ta.value.trim().length > 0 || picked.length > 0;
  document.getElementById("cmpGo").disabled = busy || !hasContent || len > MAX_TEXT;
}

function setProduct(id, name) {
  productId = id || "";
  productName = name || "";
  const box = document.getElementById("cmpProd");
  box.classList.toggle("on", !!productId);
  box.querySelector("span").textContent = productName ? "Product: " + productName : "";
  document.getElementById("cmpPicker").classList.remove("on");
}

async function openProductPicker() {
  const pk = document.getElementById("cmpPicker");
  if (pk.classList.contains("on")) { pk.classList.remove("on"); return; }
  pk.classList.add("on");
  if (myProducts === null) {
    pk.innerHTML = '<div class="none">Loading...</div>';
    try {
      const snap = await getDocs(query(
        collection(F.db, "products"),
        where("sellerId", "==", F.state.me.uid),
        limit(30)
      ));
      myProducts = snap.docs.map((d) => ({ id: d.id, name: (d.data().name || "Product").toString() }));
    } catch (e) {
      console.error("my products", e);
      pk.innerHTML = '<div class="none">Could not load your products.</div>';
      return;
    }
  }
  pk.innerHTML = "";
  if (!myProducts.length) {
    pk.innerHTML = '<div class="none">You have no products yet. Only sellers can attach a product.</div>';
    return;
  }
  myProducts.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.name;
    b.addEventListener("click", () => setProduct(p.id, p.name));
    pk.appendChild(b);
  });
}

function prependToCache(post) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const c = JSON.parse(raw);
    if (!c || !Array.isArray(c.posts)) return;
    c.posts.unshift(post);
    c.posts = c.posts.slice(0, 10);
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch (e) {}
}

/* ---------------- submit ---------------- */
async function submit() {
  if (busy) return;
  const ta = document.getElementById("cmpText");
  const text = ta.value.trim();
  if (!text && !picked.length) return;
  if (text.length > MAX_TEXT) { msg("Text is too long (max " + MAX_TEXT + ")."); return; }

  const wait = COOLDOWN_MS - (Date.now() - lastPostAt);
  if (wait > 0) { msg("Please wait " + Math.ceil(wait / 1000) + "s before posting again."); return; }

  busy = true;
  render();
  msg("");

  try {
    // 1) Hotuna: matsawa + Cloudinary (a layi ɗaya-ɗaya, don waya mai jinkirin data)
    const urls = [];
    if (picked.length) {
      const { uploadToCloudinary } = await import("./cloudinary-upload.js");
      for (let i = 0; i < picked.length; i++) {
        msg("Uploading photo " + (i + 1) + " of " + picked.length + "...", true);
        const blob = await compress(picked[i].blob);
        const res = await uploadToCloudinary(blob);
        if (!res || typeof res.url !== "string" || res.url.indexOf("https://res.cloudinary.com/") !== 0) {
          throw new Error("Photo upload failed. Try again.");
        }
        urls.push(res.url);
      }
    }

    // 2) Post (filayen da rules suka yarda da kaɗai)
    msg("Posting...", true);
    const data = {
      authorId: F.state.me.uid,
      authorName: myName(),
      text,
      images: urls,
      likeCount: 0,
      createdAt: serverTimestamp()
    };
    const photo = myPhoto();
    if (photo) data.authorPhoto = photo;
    if (productId) data.productId = productId;

    const ref = await addDoc(collection(F.db, "posts"), data);

    // 3) Nuna a saman feed nan take
    const local = F.normalize(ref.id, Object.assign({}, data, { createdAt: null, createdAtMs: Date.now() }));
    F.prependPost(local);
    prependToCache(local);

    // 4) Tsabtace akwatin
    ta.value = "";
    ta.style.height = "auto";
    picked.forEach((p) => URL.revokeObjectURL(p.preview));
    picked = [];
    setProduct("", "");
    lastPostAt = Date.now();
    msg("");
    F.toast("Posted!");
  } catch (e) {
    console.error("post", e);
    if (e && e.code === "permission-denied") msg("You are not allowed to post right now.");
    else msg((e && e.message) ? e.message : "Could not post. Try again.");
  }

  busy = false;
  render();
}

/* ---------------- build UI ---------------- */
function build() {
  const slot = document.getElementById("composerSlot");
  if (!slot || slot.firstChild) return;

  slot.innerHTML =
    '<div class="cmp">' +
      '<div class="cmp-top">' + F.avatarHtml(myName(), myPhoto()) +
        '<textarea id="cmpText" rows="1" maxlength="' + MAX_TEXT + '" placeholder="What\'s on your mind?"></textarea>' +
      "</div>" +
      '<div class="cmp-prev" id="cmpPrev" style="display:none"></div>' +
      '<div class="cmp-prod" id="cmpProd"><i class="ti ti-shopping-bag"></i><span></span><button type="button" id="cmpProdX" aria-label="Remove product">×</button></div>' +
      '<div class="cmp-picker" id="cmpPicker"></div>' +
      '<div class="cmp-bar">' +
        '<button type="button" class="tool" id="cmpPhoto"><i class="ti ti-photo"></i> Photo</button>' +
        '<button type="button" class="tool" id="cmpProdBtn"><i class="ti ti-shopping-bag"></i> Product</button>' +
        '<span class="cmp-count" id="cmpCount">0/' + MAX_TEXT + "</span>" +
        '<button type="button" class="cmp-go" id="cmpGo" disabled>Post</button>' +
      "</div>" +
      '<div class="cmp-msg" id="cmpMsg"></div>' +
      '<input type="file" id="cmpFile" accept="image/*" multiple style="display:none">' +
    "</div>";

  const ta = document.getElementById("cmpText");
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
    updateState();
  });

  const fileEl = document.getElementById("cmpFile");
  document.getElementById("cmpPhoto").addEventListener("click", () => {
    if (picked.length >= MAX_IMAGES) return;
    fileEl.click();
  });
  fileEl.addEventListener("change", () => {
    const files = Array.from(fileEl.files || []);
    fileEl.value = "";
    const room = MAX_IMAGES - picked.length;
    let skipped = 0;
    files.forEach((f) => {
      if (!/^image\//.test(f.type)) { skipped++; return; }
      if (picked.length >= MAX_IMAGES) { skipped++; return; }
      picked.push({ blob: f, preview: URL.createObjectURL(f) });
    });
    if (files.length > room || skipped) msg("Maximum " + MAX_IMAGES + " photos per post.");
    else msg("");
    render();
  });

  document.getElementById("cmpProdBtn").addEventListener("click", openProductPicker);
  document.getElementById("cmpProdX").addEventListener("click", () => setProduct("", ""));
  document.getElementById("cmpGo").addEventListener("click", submit);
  updateState();
}

function init() {
  F = window.AMFeed;
  if (!F || !F.state || !F.state.me) return;
  build();
}

if (window.AMFeed && window.AMFeed.state && window.AMFeed.state.me && window.AMFeed.state.myData) {
  init();
}
window.addEventListener("amfeed:ready", init, { once: true });
