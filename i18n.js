// =====================================================
// AREWA MARKET - HAUSA / ENGLISH (i18n)
// - Ana adana zaɓin harshe a localStorage ("am_lang")
// - Alamomi a HTML:
//     data-i18n="key"          -> textContent
//     data-i18n-ph="key"       -> placeholder
//     data-i18n-title="key"    -> title / aria-label
// - A cikin JS:  window.t("key", { n: 3 })
// - Sabbin abubuwan da aka ƙara a page ana fassara su ta atomatik
// =====================================================

const STORE_KEY = "am_lang";

const DICT = {
  en: {
    tagline: "Northern Nigeria's market in your hand",
    search_ph: "Search for products...",
    login: "Login",
    register: "Register",
    hero_h: "Buy & Sell Across Northern Nigeria",
    hero_p: "Discover products from sellers across Northern Nigeria. Search products, browse categories and find sellers easily.",
    hero_cta: "Shop Now →",
    tab_all: "🛍️ All Products",
    tab_following: "★ Following",
    tab_nearby: "📍 Near me",
    categories: "Categories",
    products: "Products",
    loading: "Loading...",
    all_states: "All States",
    all_lgas: "All LGAs",
    sort_featured: "Featured First",
    sort_newest: "Newest First",
    sort_price_low: "Price: Low to High",
    sort_price_high: "Price: High to Low",
    sort_name: "Name A-Z",
    count_one: "{n} product",
    count_many: "{n} products",

    nav_home: "Home",
    nav_friends: "Friends",
    nav_messages: "Messages",
    nav_dashboard: "Dashboard",
    nav_sell: "Sell",
    nav_pending: "Pending",
    nav_profile: "Profile",

    nb_login: "Log in to see products near you.",
    nb_enable: "Turn on your location to see sellers near you.",
    nb_btn: "Turn on location",
    nb_locating: "Finding your location...",
    nb_unsupported: "Your device does not support location.",
    nb_denied: "Location permission was denied. Enable it in settings and try again.",
    nb_nogps: "Could not get your location. Make sure GPS is on.",
    nb_save_fail: "Could not save your location. Please try again.",
    nb_load_fail: "Could not load sellers near you. Please try again.",
    nb_empty_h: "No products near you right now",
    nb_empty_p: "Only sellers who turned on their location are shown. Try another category or check All Products.",

    share_wa: "Share on WhatsApp",
    share_wa_text: "Check it out on Arewa Market:",
    voice_title: "Search by voice",
    voice_listening: "Listening...",
    voice_unsupported: "Voice search is not supported on this browser.",
    voice_fail: "Could not hear you. Please try again.",

    rp_btn: "🚩 Report seller",
    rp_title: "Report this user",
    rp_self: "You cannot report yourself.",
    rp_scam: "Scam: took my money and did not deliver",
    rp_fake: "Fake or counterfeit goods",
    rp_offsite: "Asked me to pay outside the app",
    rp_abuse: "Harassment or abuse",
    rp_other: "Other reason",
    rp_details_ph: "Tell us what happened (at least 10 characters)...",
    rp_evidence: "Add a screenshot or photo (optional)",
    rp_cancel: "Cancel",
    rp_send: "Send report",
    rp_need_reason: "Please choose a reason.",
    rp_need_details: "Please explain what happened (at least 10 characters).",
    rp_sending: "Sending report...",
    rp_cooldown: "You already reported this user in the last 24 hours.",
    rp_done: "Report sent. Our team will review it. Thank you.",
    rp_fail: "Could not send the report. Please try again.",
    safe_tip: "⚠️ Do not pay before you see the goods. Report anyone who asks you to pay outside the app."
  },

  ha: {
    tagline: "Kasuwar Arewa a Hannunka",
    search_ph: "Nemi kayayyaki...",
    login: "Shiga",
    register: "Yi Rajista",
    hero_h: "Saya da Sayarwa a Arewacin Najeriya",
    hero_p: "Gano kayayyaki daga masu sayarwa a duk Arewacin Najeriya. Nemi kaya, duba rukuni-rukuni, ka sami masu sayarwa cikin sauƙi.",
    hero_cta: "Fara Siyayya →",
    tab_all: "🛍️ Duka Kayayyaki",
    tab_following: "★ Waɗanda nake bi",
    tab_nearby: "📍 Kusa da kai",
    categories: "Rukuni-rukuni",
    products: "Kayayyaki",
    loading: "Ana lodawa...",
    all_states: "Duk Jihohi",
    all_lgas: "Duk Ƙananan Hukumomi",
    sort_featured: "Na Musamman Da Farko",
    sort_newest: "Sababbi Da Farko",
    sort_price_low: "Farashi: Ƙasa zuwa Sama",
    sort_price_high: "Farashi: Sama zuwa Ƙasa",
    sort_name: "Suna A-Z",
    count_one: "kaya {n}",
    count_many: "kayayyaki {n}",

    nav_home: "Gida",
    nav_friends: "Abokai",
    nav_messages: "Saƙonni",
    nav_dashboard: "Dashboard",
    nav_sell: "Sayar",
    nav_pending: "Ana Jira",
    nav_profile: "Ni",

    nb_login: "Ka shiga (login) don ganin kayayyaki kusa da kai.",
    nb_enable: "Ka kunna wurinka don ganin masu sayarwa kusa da kai.",
    nb_btn: "Kunna wuri",
    nb_locating: "Ana neman wurinka...",
    nb_unsupported: "Wayarka ba ta goyi bayan location.",
    nb_denied: "Ba a ba da izinin location ba. Ka kunna shi a settings, sai ka sake gwadawa.",
    nb_nogps: "Ba a samu wurinka ba. Ka tabbata GPS yana kunne.",
    nb_save_fail: "Ba a iya adana wurinka ba. Ka sake gwadawa.",
    nb_load_fail: "Ba a iya loda masu sayarwa kusa da kai ba. Ka sake gwadawa.",
    nb_empty_h: "Babu kayayyaki kusa da kai yanzu",
    nb_empty_p: "Masu sayarwa da suka kunna wurinsu ne kawai ake nuna wa. Gwada wani rukuni, ko duba Duka Kayayyaki.",

    share_wa: "Share zuwa WhatsApp",
    share_wa_text: "Duba a Arewa Market:",
    voice_title: "Nemi da murya",
    voice_listening: "Ina saurarenka...",
    voice_unsupported: "Wannan browser ɗin ba ya goyon bayan neman da murya.",
    voice_fail: "Ban ji ka ba. Ka sake gwadawa.",

    rp_btn: "🚩 Kai ƙara kan seller",
    rp_title: "Kai ƙarar wannan mai amfani",
    rp_self: "Ba za ka iya kai ƙarar kanka ba.",
    rp_scam: "Yaudara: ya karɓi kuɗina bai kawo kaya ba",
    rp_fake: "Kaya na jabu",
    rp_offsite: "Ya nemi in biya a wajen app",
    rp_abuse: "Cin zarafi ko zagi",
    rp_other: "Wani dalili",
    rp_details_ph: "Ka bayyana abin da ya faru (aƙalla haruffa 10)...",
    rp_evidence: "Ƙara screenshot ko hoto (zaɓi)",
    rp_cancel: "Soke",
    rp_send: "Aika ƙara",
    rp_need_reason: "Ka zaɓi dalili.",
    rp_need_details: "Ka bayyana abin da ya faru (aƙalla haruffa 10).",
    rp_sending: "Ana aika ƙara...",
    rp_cooldown: "Ka riga ka kai ƙarar wannan mai amfani a cikin awa 24 da suka wuce.",
    rp_done: "An aika ƙarar. Ma'aikatanmu za su duba ta. Na gode.",
    rp_fail: "Ba a iya aika ƙarar ba. Ka sake gwadawa.",
    safe_tip: "⚠️ Kada ka biya kafin ka ga kaya. Ka kai ƙarar duk wanda ya nemi ka biya a wajen app."
  }
};

let lang = "en";
try {
  const saved = localStorage.getItem(STORE_KEY);
  if (saved === "ha" || saved === "en") lang = saved;
} catch (e) { /* storage na iya rashin aiki */ }

export function getLang() { return lang; }

export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
  if (vars) {
    Object.keys(vars).forEach(k => { s = s.replace("{" + k + "}", vars[k]); });
  }
  return s;
}

export function applyI18n(root) {
  const scope = root && root.querySelectorAll ? root : document;
  const each = (sel, fn) => {
    if (scope !== document && scope.matches && scope.matches(sel)) fn(scope);
    scope.querySelectorAll(sel).forEach(fn);
  };
  each("[data-i18n]", el => {
    const v = t(el.getAttribute("data-i18n"));
    if (el.textContent !== v) el.textContent = v;
  });
  each("[data-i18n-ph]", el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
  });
  each("[data-i18n-title]", el => {
    const v = t(el.getAttribute("data-i18n-title"));
    el.setAttribute("title", v);
    el.setAttribute("aria-label", v);
  });
}

export function setLang(next) {
  if (next !== "ha" && next !== "en") return;
  lang = next;
  try { localStorage.setItem(STORE_KEY, next); } catch (e) {}
  document.documentElement.lang = next;
  applyI18n(document);
  updateToggle();
  window.dispatchEvent(new CustomEvent("langchange", { detail: next }));
}

// ---------- maɓallin canza harshe ----------
let toggleBtn = null;

function updateToggle() {
  if (!toggleBtn) return;
  toggleBtn.textContent = lang === "ha" ? "EN" : "HA";
  toggleBtn.title = lang === "ha" ? "Switch to English" : "Canza zuwa Hausa";
  toggleBtn.setAttribute("aria-label", toggleBtn.title);
}

function mountToggle() {
  if (toggleBtn) return;
  const host = document.querySelector(".header-inner");
  if (!host) return; // shafukan da ba su da header ba su da maɓallin

  toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "lang-toggle";
  toggleBtn.addEventListener("click", () => setLang(lang === "ha" ? "en" : "ha"));

  const style = document.createElement("style");
  style.textContent = `
.lang-toggle{
  border:1.5px solid rgba(255,255,255,.7);background:transparent;color:#fff;
  font-weight:700;font-size:12px;padding:6px 10px;border-radius:8px;
  cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;
}
.lang-toggle:active{background:rgba(255,255,255,.2)}`;
  document.head.appendChild(style);

  const nav = host.querySelector("#navArea");
  if (nav) host.insertBefore(toggleBtn, nav);
  else host.appendChild(toggleBtn);
  updateToggle();
}

// ---------- alamar shafi da dukan bottom-nav labels ----------
const NAV_LABELS = {
  "Home": "nav_home", "Friends": "nav_friends", "Messages": "nav_messages",
  "Dashboard": "nav_dashboard", "Sell": "nav_sell", "Pending": "nav_pending",
  "Profile": "nav_profile"
};

function tagNavLabels(root) {
  (root || document).querySelectorAll(".bottom-nav .bn-label").forEach(el => {
    if (el.hasAttribute("data-i18n")) return;
    const key = NAV_LABELS[el.textContent.trim()];
    if (key) el.setAttribute("data-i18n", key);
  });
}

// ---------- fassara sabbin abubuwa da aka ƙara daga baya ----------
let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    tagNavLabels();
    applyI18n(document);
  });
});

function start() {
  document.documentElement.lang = lang;
  mountToggle();
  tagNavLabels();
  applyI18n(document);
  observer.observe(document.body, { childList: true, subtree: true, characterData: false });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

window.t = t;
window.setLang = setLang;
window.getLang = getLang;
window.applyI18n = applyI18n;
