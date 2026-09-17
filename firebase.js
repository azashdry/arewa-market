// =====================================================
// AREWA MARKET - FIREBASE CONNECTION
// =====================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  initializeAuth,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =====================================================
// FIREBASE CONFIG
// DO NOT CHANGE ANY VALUE
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyD48Bay25k24a5WckgM6AmuK3p68oGT6vk",
  authDomain: "arewa-market-4e603.firebaseapp.com",
  projectId: "arewa-market-4e603",
  storageBucket: "arewa-market-4e603.firebasestorage.app",
  messagingSenderId: "217844252739",
  appId: "1:217844252739:web:81b00d9ac29277c42d94f6",
  measurementId: "G-ZTQHETHX4T"
};


// =====================================================
// INITIALIZE FIREBASE
// =====================================================

const app =
  initializeApp(firebaseConfig);


// =====================================================
// FIREBASE AUTH
// Keeps login session between pages
// =====================================================

const auth =
  initializeAuth(
    app,
    {
      persistence:
        browserLocalPersistence
    }
  );


// =====================================================
// FIRESTORE
// =====================================================

const db =
  getFirestore(app);


// =====================================================
// EXPORT
// Other Arewa Market files will use these
// =====================================================

export {
  app,
  auth,
  db
};