// =====================================================
// AREWA MARKET - BOTTOM NAV HELPER
// - Profile link
// - Alamar saƙonnin da ba a karanta ba (Messages)
// - Alamar friend request (Friends)
// =====================================================

import { auth, db } from "./firebase.js";
import { t } from "./i18n.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection, query, where, onSnapshot, doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const style = document.createElement("style");
style.textContent = `
.bottom-nav .bn-icon{position:relative}
.bottom-nav .bn-badge{
  position:absolute;top:-5px;right:-10px;min-width:16px;height:16px;
  padding:0 4px;border-radius:8px;background:#d93025;color:#fff;
  font-size:10px;font-weight:700;line-height:16px;text-align:center;
}`;
document.head.appendChild(style);

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
  const icon = a.querySelector("i.ti");
  const setLabel = key => {
    if (!label) return;
    label.setAttribute("data-i18n", key);
    label.textContent = t(key);
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
  if (icon) icon.className = "ti ti-building-store";
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
