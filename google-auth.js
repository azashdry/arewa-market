// =====================================================
// AREWA MARKET - CONTINUE WITH GOOGLE
// Yana aiki a login.html da register.html duka:
//  - Idan user sabo ne  -> yana ƙirƙirar account (register)
//  - Idan user tsohon ne -> yana shigar da shi (login)
// =====================================================

import { auth, db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ---------- Referral helpers (iri ɗaya da na register.html) ---------- */

function createReferralCode(name){
  const cleanName = String(name || "USER")
    .toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8) || "USER";
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `AREWA-${cleanName}-${randomPart}`;
}

async function generateUniqueReferralCode(name){
  for(let i = 0; i < 5; i++){
    const code = createReferralCode(name);
    const snap = await getDocs(
      query(collection(db, "users"), where("referralCode", "==", code))
    );
    if(snap.empty) return code;
  }
  throw new Error("Unable to generate a unique referral code. Please try again.");
}

async function findReferrer(code){
  if(!code) return null;
  try{
    let snap = await getDocs(
      query(collection(db, "users"), where("referralCode", "==", code))
    );
    if(snap.empty){
      snap = await getDocs(
        query(collection(db, "users"), where("previousReferralCodes", "array-contains", code))
      );
    }
    if(snap.empty) return null;
    return { uid: snap.docs[0].id };
  }catch(e){
    console.error("REFERRER LOOKUP ERROR:", e);
    return null;
  }
}


/* ---------- Redirect bayan shiga (iri ɗaya da login.html) ---------- */

function redirectAfterLogin(userData){

  const saved = sessionStorage.getItem("arewaMarketRedirect");
  sessionStorage.removeItem("arewaMarketRedirect");

  if(saved && saved.includes("messages.html?sellerId=")){
    window.location.replace(saved);
    return;
  }

  const isApprovedSeller =
    userData.role === "seller" &&
    userData.isSeller === true &&
    userData.sellerStatus === "approved";

  window.location.replace(
    isApprovedSeller ? "seller-dashboard.html" : "index.html"
  );
}


/* ---------- Saƙon kuskure ---------- */

export function googleErrorMessage(error){
  switch(error && error.code){
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";  // mutum ya rufe window ɗin, babu buƙatar saƙo
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Please allow popups and try again.";
    case "auth/network-request-failed":
      return "Network connection problem. Please check your internet and try again.";
    case "auth/unauthorized-domain":
      return "This website domain is not authorized for Google sign-in yet.";
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled yet.";
    case "auth/account-exists-with-different-credential":
      return "An account with this email already exists. Please sign in with your email and password.";
    default:
      return (error && error.message) || "Unable to continue with Google. Please try again.";
  }
}


/* ---------- Babban function ---------- */

export async function continueWithGoogle(){

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  const user = result.user;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  /* ----- TSOHON USER: LOGIN ----- */
  if(snap.exists()){

    const userData = snap.data();

    if(userData.active === false){
      await auth.signOut();
      throw { code: "custom/deactivated",
              message: "Your account has been deactivated. Please contact Arewa Market." };
    }

    redirectAfterLogin(userData);
    return;
  }

  /* ----- SABON USER: REGISTER ----- */
  try{

    const name = user.displayName || (user.email || "User").split("@")[0];

    let referralCode = localStorage.getItem("arewaReferralCode");
    referralCode = referralCode ? String(referralCode).trim().toUpperCase() : "";

    let referredBy = "";
    let referredByUserId = "";

    if(referralCode){
      const referrer = await findReferrer(referralCode);
      if(referrer && referrer.uid && referrer.uid !== user.uid){
        referredBy = referralCode;
        referredByUserId = referrer.uid;
      }
    }

    const hasReferrer = Boolean(referredByUserId);

    const userData = {
      name: name,
      nameLower: name.toLowerCase(),
      email: user.email || "",
      role: "buyer",
      isSeller: false,
      sellerStatus: "none",
      active: true,
      phoneHash: "",
      referralCode: await generateUniqueReferralCode(name),
      referredBy: referredBy,
      referredByUserId: referredByUserId,
      referralStatus: hasReferrer ? "registered" : "",
      referralJoinedAt: hasReferrer ? serverTimestamp() : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(userRef, userData);

    localStorage.removeItem("arewaReferralCode");

    redirectAfterLogin(userData);

  }catch(error){
    await auth.signOut();
    throw error;
  }
}
