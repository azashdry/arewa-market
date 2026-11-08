// =====================================================
// AREWA MARKET - BOTTOM NAV HELPER
// - Profile link
// - Alamar saƙonnin da ba a karanta ba (Messages)
// - Alamar friend request (Friends)
// - Tsarin gani kamar Facebook (sabbin gumaka, rubutu a ƙasa, layi a saman tab mai aiki)
// =====================================================

import { auth, db } from "./firebase.js";
import { t } from "./i18n.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection, query, where, onSnapshot, doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const style = document.createElement("style");
style.textContent = `
/* ===== Facebook-style bottom nav ===== */
:root{--nav-accent:#075e36;--nav-idle:#65676b}
.bottom-nav{background:#fff;border-top:1px solid #e4e6eb;box-shadow:none}
.bottom-nav .bn-item{
  padding:9px 2px 6px;gap:2px;justify-content:center;
  color:var(--nav-idle);font-weight:500;min-width:0;
}
.bottom-nav .bn-label{
  display:block;max-width:100%;font-size:10.5px;line-height:1.2;font-weight:500;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.bottom-nav .bn-icon{position:relative;font-size:0;line-height:0;display:flex;align-items:center;justify-content:center}
.bottom-nav .bn-icon svg{
  width:25px;height:25px;fill:none;stroke:currentColor;
  stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;
}
.bottom-nav .bn-item .ln{fill:none;stroke:currentColor}
.bottom-nav .bn-item.active{color:var(--nav-accent);font-weight:700}
.bottom-nav .bn-item.active .bn-label{font-weight:700}
.bottom-nav .bn-item.active .bn-icon svg{fill:currentColor}
.bottom-nav .bn-item.active .ln{stroke:#fff}
.bottom-nav .bn-item::before{left:14%;right:14%;height:3px;border-radius:0 0 3px 3px}
.bottom-nav .bn-item.active::before{background:var(--nav-accent)}
.bottom-nav .bn-item:active .bn-icon{transform:scale(.92)}
.bottom-nav .bn-av{
  box-sizing:border-box;width:25px;height:25px;border-radius:50%;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
  background:var(--nav-accent);color:#fff;font-size:12px;font-weight:700;line-height:1;
}
.bottom-nav .bn-av{margin:2px 0 2px}
.bottom-nav .bn-av img{width:100%;height:100%;object-fit:cover;display:block}
.bottom-nav .bn-av svg{width:19px;height:19px;fill:#fff;stroke:none}
.bottom-nav .bn-item.active .bn-av{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--nav-accent)}
.bottom-nav .bn-badge{
  position:absolute;top:-6px;right:-10px;min-width:16px;height:16px;
  padding:0 4px;border-radius:8px;background:#e41e3f;color:#fff;
  font-size:10px;font-weight:700;line-height:16px;text-align:center;
  box-shadow:0 0 0 2px #fff;
}`;
document.head.appendChild(style);

// ---- Gumaka (SVG): masu layi idan ba a zaɓe su ba, masu cika idan an zaɓe ----
const ICONS = {
  home:    '<path d="M3.5 11.2 12 4l8.5 7.2V20a1 1 0 0 1-1 1H15v-5.5H9V21H4.5a1 1 0 0 1-1-1z"/>',
  feed:    '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path class="ln" d="M8 9h8M8 13h8M8 17h4"/>',
  friends: '<circle cx="9" cy="8" r="3.2"/><path d="M2.8 19.6v-.5a5 5 0 0 1 5-5h2.4a5 5 0 0 1 5 5v.5a.4.4 0 0 1-.4.4H3.2a.4.4 0 0 1-.4-.4z"/><circle cx="17" cy="9" r="2.5"/><path d="M17.2 14h.6a4.2 4.2 0 0 1 4.2 4.2v.8a.5.5 0 0 1-.5.5H18"/>',
  messages:'<path d="M12 3.2c5 0 9 3.4 9 7.9s-4 7.9-9 7.9c-1 0-2-.1-2.9-.4L5 20.5l.9-3.3C4.2 15.800 3 13.600 3 11.100c0-4.500 4-7.900 9-7.900z"/>',
  store:   '<path d="M3.5 9.5 5 4.5h14l1.5 5a3 3 0 0 1-5.500 1.500 3 3 0 0 1-6 0 3 3 0 0 1-5.500-1.500z"/><path d="M5 12.500V20h14v-7.500"/><path class="ln" d="M10 20v-4h4v4"/>',
  person:  '<circle cx="12" cy="8.500" r="4"/><path d="M4.500 20.500a7.500 7.500 0 0 1 15 0z"/>'
};

function kindOf(a) {
  if (a.id === "navProfileLink") return "profile";
  const h = (a.getAttribute("href") || "").toLowerCase();
  if (h.includes("index.html")) return "home";
  if (h.includes("feed.html")) return "feed";
  if (h.includes("friends.html")) return "friends";
  if (h.includes("messages.html")) return "messages";
  if (h.includes("seller-dashboard") || h.includes("seller-apply") || a.dataset.sell) return "store";
  return null;
}

function svg(inner) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + "</svg>";
}

// Maye gurbin gumakan tsohon nav da sabbin gumaka, a duk shafi
function applyIcons() {
  const nav = document.querySelector(".bottom-nav");
  if (!nav) return;
  nav.querySelectorAll("a.bn-item").forEach(a => {
    const kind = kindOf(a);
    const box = a.querySelector(".bn-icon");
    if (!kind || !box) return;
    const badge = box.querySelector(".bn-badge");
    if (kind === "profile") {
      box.innerHTML = '<span class="bn-av">' + svg(ICONS.person) + "</span>";
    } else {
      box.innerHTML = svg(ICONS[kind]);
    }
    if (badge) box.appendChild(badge);
    const label = a.querySelector(".bn-label");
    a.setAttribute("aria-label", (label && label.textContent.trim()) || kind);
  });
}

// Hoton mutum a Profile tab (idan yana da hoto), in ba haka ba harafin farko na sunansa
function setProfileAvatar(u) {
  const av = document.querySelector("#navProfileLink .bn-av");
  if (!av) return;
  const url = u && (u.profileImageUrl || u.profileImage || u.sellerProfileImage || u.photoURL);
  const name = u && (u.name || u.fullName || u.shopName || u.displayName || "");
  av.innerHTML = "";
  if (url) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = url;
    img.onerror = () => { av.innerHTML = ""; fallback(); };
    av.appendChild(img);
  } else {
    fallback();
  }
  function fallback() {
    if (name) av.textContent = name.trim().charAt(0).toUpperCase();
    else av.innerHTML = svg(ICONS.person);
  }
}

// Maɓallin Feed: ana saka shi ta nan, don ya bayyana a duk shafuka ba tare da gyara kowanne ba
function ensureFeedTab() {
  const nav = document.querySelector(".bottom-nav");
  if (!nav || nav.querySelector('a[href="feed.html"]')) return;
  const a = document.createElement("a");
  a.href = "feed.html";
  a.className = "bn-item";
  a.innerHTML =
    '<span class="bn-icon"></span>' +
    '<span class="bn-label">Feed</span>';
  const home = nav.querySelector('a[href="index.html"]');
  if (home && home.nextSibling) nav.insertBefore(a, home.nextSibling);
  else if (home) nav.appendChild(a);
  else nav.insertBefore(a, nav.firstChild);
}
ensureFeedTab();
applyIcons();

function setBadge(page, count) {
  const link = document.querySelector('.bottom-nav a[href="' + page + '"] .bn-icon');
  if (!link) return;
  let b = link.querySelector(".bn-badge");
  if (!count) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("span"); b.className = "bn-badge"; link.appendChild(b); }
  b.textContent = count > 99 ? "99+" : String(count);
}

function setSellTab(mode){
  const a = document.querySelector(
    '.bottom-nav a[href="seller-dashboard.html"], .bottom-nav a[href="seller-apply.html"], .bottom-nav a[href="login.html"][data-sell]'
  );
  if (!a) return;
  a.dataset.sell = "1";
  const label = a.querySelector(".bn-label");
  const setLabel = key => {
    if (!label) return;
    label.setAttribute("data-i18n", key);
    label.textContent = t(key);
    a.setAttribute("aria-label", label.textContent);
  };
  if (mode === "seller") {
    a.setAttribute("href", "seller-dashboard.html");
    setLabel("nav_dashboard");
  } else if (mode === "guest") {
    a.setAttribute("href", "login.html");
    setLabel("nav_sell");
  } else {
    a.setAttribute("href", "seller-apply.html");
    setLabel(mode === "pending" ? "nav_pending" : "nav_sell");
  }
  updateActive(auth.currentUser);
}

// Alamar shafin da kake ciki (ba sai kowane page ya rubuta "active" da hannu ba)
function updateActive(user){
  const nav = document.querySelector(".bottom-nav");
  if (!nav) return;

  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const items = nav.querySelectorAll("a.bn-item");
  items.forEach(a => a.classList.remove("active"));

  let target = null;
  if (file === "index.html" || file === "product.html" || file === "status.html" || file === "") {
    target = nav.querySelector('a[href="index.html"]');
  } else if (file === "feed.html") {
    target = nav.querySelector('a[href="feed.html"]');
  } else if (file === "friends.html") {
    target = nav.querySelector('a[href="friends.html"]');
  } else if (file === "messages.html") {
    target = nav.querySelector('a[href="messages.html"]');
  } else if (file === "seller-dashboard.html" || file === "seller-apply.html") {
    target = nav.querySelector("a[data-sell]");
  } else if (file === "seller-profile.html") {
    // Profile tab yana aiki ne kawai idan profile ɗinka ne ake kallo
    const id = new URLSearchParams(location.search).get("id");
    if (user && (!id || id === user.uid)) target = document.getElementById("navProfileLink");
  }
  if (target) target.classList.add("active");
}

updateActive(null);

let unsubs = [];

onAuthStateChanged(auth, user => {
  unsubs.forEach(u => u());
  unsubs = [];

  updateActive(user);

  const profile = document.getElementById("navProfileLink");
  if (profile) {
    profile.href = user ? "seller-profile.html?id=" + user.uid : "login.html";
  }

  if (!user) {
    setProfileAvatar(null);
    setSellTab("guest");
    setBadge("messages.html", 0);
    setBadge("friends.html", 0);
    return;
  }

  // Ana sauraron user doc kai tsaye: idan admin ya kashe user, ana fitar da shi nan take
  unsubs.push(onSnapshot(
    doc(db, "users", user.uid),
    d => {
      const u = d.exists() ? d.data() : {};

      if (u.active === false) {
        signOut(auth).finally(() => {
          window.location.href = "login.html?disabled=1";
        });
        return;
      }

      setProfileAvatar(u);

      if (u.sellerStatus === "approved" && u.isSeller === true) setSellTab("seller");
      else if (u.sellerStatus === "pending") setSellTab("pending");
      else setSellTab("buyer");
    },
    () => {}
  ));

  unsubs.push(onSnapshot(
    query(collection(db, "conversations"), where("participantIds", "array-contains", user.uid)),
    snap => {
      let total = 0;
      snap.docs.forEach(d => {
        const c = d.data().unreadCount;
        if (c && typeof c[user.uid] === "number") total += c[user.uid];
      });
      setBadge("messages.html", total);
    },
    () => {}
  ));

  unsubs.push(onSnapshot(
    query(collection(db, "friendRequests"), where("to", "==", user.uid), where("status", "==", "pending")),
    snap => setBadge("friends.html", snap.size),
    () => {}
  ));
});
