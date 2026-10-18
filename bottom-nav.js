// =====================================================
// AREWA MARKET - BOTTOM NAV HELPER
// - Profile link
// - Alamar saƙonnin da ba a karanta ba (Messages)
// - Alamar friend request (Friends)
// =====================================================

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
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
  if (mode === "seller") {
    a.setAttribute("href", "seller-dashboard.html");
    if (label) label.textContent = "Dashboard";
  } else if (mode === "guest") {
    a.setAttribute("href", "login.html");
    if (label) label.textContent = "Sell";
  } else {
    a.setAttribute("href", "seller-apply.html");
    if (label) label.textContent = mode === "pending" ? "Pending" : "Sell";
  }
  if (icon) icon.className = "ti ti-building-store";
}

let unsubs = [];

onAuthStateChanged(auth, user => {
  unsubs.forEach(u => u());
  unsubs = [];

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

  getDoc(doc(db, "users", user.uid)).then(d => {
    const u = d.exists() ? d.data() : {};
    if (u.sellerStatus === "approved" && u.isSeller === true) setSellTab("seller");
    else if (u.sellerStatus === "pending") setSellTab("pending");
    else setSellTab("buyer");
  }).catch(() => {});

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
