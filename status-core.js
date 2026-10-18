// =====================================================
// AREWA MARKET - STATUS CORE (shared by index + status)
// Status yana wanzuwa na awa 24, abokai ne kadai ke gani.
// =====================================================

import { auth, db } from "./firebase.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, limit, arrayUnion, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export const STATUS_LIFETIME_MS = 24 * 60 * 60 * 1000;

export const STATUS_COLORS = [
  "#075e36", "#0b6e8a", "#6a1b9a", "#b3261e",
  "#c9a227", "#37474f", "#e65100", "#1b5e20"
];

export function userName(u) {
  return (u && (u.name || u.businessName)) || "Arewa Market user";
}

export function userPhoto(u) {
  return (u && (u.profileImageUrl || u.profileImage || u.photoURL)) || "";
}

export function timeAgo(ms) {
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  return h + (h === 1 ? " hour ago" : " hours ago");
}

/* ---------- Abokai (friend requests da aka karba) ---------- */
export async function getFriendIds(uid) {
  const col = collection(db, "friendRequests");
  const [a, b] = await Promise.all([
    getDocs(query(col, where("from", "==", uid), where("status", "==", "accepted"))),
    getDocs(query(col, where("to", "==", uid), where("status", "==", "accepted")))
  ]);
  const ids = new Set();
  a.docs.forEach(d => ids.add(d.data().to));
  b.docs.forEach(d => ids.add(d.data().from));
  ids.delete(uid);
  return Array.from(ids);
}

/* ---------- Saka status ---------- */
export async function createStatus(uid, data) {
  const friendIds = await getFriendIds(uid);
  const now = Date.now();

  const payload = {
    ownerId: uid,
    type: data.type,                       // "text" | "image" | "video"
    text: data.text || "",
    bg: data.bg || STATUS_COLORS[0],
    mediaUrl: data.mediaUrl || "",
    caption: data.caption || "",
    productId: data.productId || "",
    productName: data.productName || "",
    viewerIds: [uid, ...friendIds].slice(0, 500),
    seenBy: [],
    createdAt: serverTimestamp(),
    createdAtMs: now,
    expiresAtMs: now + STATUS_LIFETIME_MS,
    expiresAt: Timestamp.fromMillis(now + STATUS_LIFETIME_MS)
  };

  const ref = await addDoc(collection(db, "statuses"), payload);
  return { id: ref.id, ...payload };
}

export async function deleteStatus(id) {
  await deleteDoc(doc(db, "statuses", id));
}

export async function markSeen(statusId) {
  const me = auth.currentUser;
  if (!me) return;
  await updateDoc(doc(db, "statuses", statusId), { seenBy: arrayUnion(me.uid) });
}

/* ---------- Karanta status na abokai (da nawa) ---------- */
export async function loadStatusGroups(uid) {
  const snap = await getDocs(query(
    collection(db, "statuses"),
    where("viewerIds", "array-contains", uid),
    limit(300)
  ));

  const now = Date.now();
  const items = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => (s.expiresAtMs || 0) > now)
    .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));

  const byOwner = new Map();
  items.forEach(s => {
    if (!byOwner.has(s.ownerId)) byOwner.set(s.ownerId, []);
    byOwner.get(s.ownerId).push(s);
  });

  const groups = await Promise.all(
    Array.from(byOwner.entries()).map(async ([ownerId, list]) => {
      let u = {};
      try {
        const d = await getDoc(doc(db, "users", ownerId));
        if (d.exists()) u = d.data();
      } catch (e) { /* ignore */ }

      return {
        ownerId,
        name: userName(u),
        photo: userPhoto(u),
        items: list,
        isMe: ownerId === uid,
        unseen: ownerId !== uid && list.some(s => !(s.seenBy || []).includes(uid)),
        latest: list[list.length - 1].createdAtMs || 0
      };
    })
  );

  groups.sort((a, b) => {
    if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
    if (a.unseen !== b.unseen) return a.unseen ? -1 : 1;
    return b.latest - a.latest;
  });

  return groups;
}
