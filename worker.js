// =====================================================
// AREWA MARKET - PUSH WORKER (Cloudflare Workers, kyauta)
// -----------------------------------------------------
// /register : yana adana token na wayar mutum (a KV)
// /notify   : yana tabbatar da cewa saƙo/friend request na gaske ne,
//             sannan yana aika sanarwa ta Firebase Cloud Messaging.
//
// Ana buƙatar a Cloudflare:
//   - KV binding mai suna:  TOKENS
//   - Secret mai suna:      SERVICE_ACCOUNT   (duka JSON ɗin Firebase service account)
// =====================================================

const PROJECT = "arewa-market-4e603";

const ALLOWED_ORIGINS = [
  "https://azashdry.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MAX_TOKENS_PER_USER = 5;
const TOKEN_TTL = 60 * 24 * 3600;       // kwana 60
const REFRESH_AFTER = 30 * 24 * 3600;   // ana sabunta bayan kwana 30

/* ---------------- helpers ---------------- */

const enc = new TextEncoder();

function b64urlToBytes(s){
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while(s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(bytes){
  let bin = "";
  bytes = new Uint8Array(bytes);
  for(let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function jsonPart(s){ return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))); }
function pemToDer(pem){
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function corsHeaders(request){
  const origin = request.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function reply(request, status, body){
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) }
  });
}

/* ---------------- tabbatar da Firebase ID token ---------------- */

let jwksCache = null;
let jwksExpiry = 0;

async function getJwks(){
  if(jwksCache && Date.now() < jwksExpiry) return jwksCache;
  const r = await fetch(JWKS_URL);
  if(!r.ok) throw new Error("jwks");
  jwksCache = await r.json();
  jwksExpiry = Date.now() + 3600 * 1000;
  return jwksCache;
}

async function verifyIdToken(token){
  const parts = String(token || "").split(".");
  if(parts.length !== 3) throw new Error("bad token");

  const header = jsonPart(parts[0]);
  const payload = jsonPart(parts[1]);
  if(header.alg !== "RS256") throw new Error("alg");

  const jwks = await getJwks();
  const jwk = (jwks.keys || []).find(k => k.kid === header.kid);
  if(!jwk) throw new Error("kid");

  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), enc.encode(parts[0] + "." + parts[1])
  );
  if(!ok) throw new Error("signature");

  const now = Math.floor(Date.now() / 1000);
  if(payload.aud !== PROJECT) throw new Error("aud");
  if(payload.iss !== "https://securetoken.google.com/" + PROJECT) throw new Error("iss");
  if(!payload.exp || payload.exp <= now) throw new Error("expired");
  if(payload.iat && payload.iat > now + 300) throw new Error("iat");
  if(!payload.sub) throw new Error("sub");
  return payload.sub;
}

async function authUid(request){
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if(!m) throw new Error("no token");
  return { uid: await verifyIdToken(m[1]), idToken: m[1] };
}

/* ---------------- Firestore REST (da token ɗin mai aikawa) ----------------
   Rules na Firestore ne ke hukunta ko mai aikawa yana da izinin karanta doc ɗin. */

async function fsGet(path, idToken){
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: "Bearer " + idToken } });
  if(!r.ok) return null;
  return r.json();
}
function fStr(doc, name){
  const f = doc && doc.fields && doc.fields[name];
  if(!f) return "";
  return f.stringValue ?? f.timestampValue ?? "";
}
function fArr(doc, name){
  const f = doc && doc.fields && doc.fields[name];
  const vals = f && f.arrayValue && f.arrayValue.values;
  return (vals || []).map(v => v.stringValue).filter(Boolean);
}

/* ---------------- FCM ---------------- */

let fcmAccess = null;
let fcmAccessExpiry = 0;

async function getFcmAccessToken(env){
  if(fcmAccess && Date.now() < fcmAccessExpiry) return fcmAccess;

  const sa = JSON.parse(env.SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const head = bytesToB64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = bytesToB64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })));

  const key = await crypto.subtle.importKey(
    "pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head + "." + claims));
  const jwt = head + "." + claims + "." + bytesToB64url(sig);

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + jwt
  });
  if(!r.ok) throw new Error("fcm auth " + r.status);
  const j = await r.json();
  fcmAccess = j.access_token;
  fcmAccessExpiry = Date.now() + (j.expires_in - 120) * 1000;
  return fcmAccess;
}

async function sendFcm(env, token, data){
  const at = await getFcmAccessToken(env);
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, {
    method: "POST",
    headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        data,
        webpush: { headers: { Urgency: "high", TTL: "86400" } }
      }
    })
  });
  if(r.ok) return "ok";
  const txt = await r.text();
  if(r.status === 404 || /UNREGISTERED/.test(txt)) return "dead";
  console.log("FCM error", r.status, txt);
  return "error";
}

/* ---------------- tokens a KV ---------------- */

async function readTokens(env, uid){
  const raw = await env.TOKENS.get("u:" + uid);
  if(!raw) return [];
  try{ const a = JSON.parse(raw); return Array.isArray(a) ? a : []; }catch(e){ return []; }
}
async function writeTokens(env, uid, list){
  if(!list.length){ await env.TOKENS.delete("u:" + uid); return; }
  await env.TOKENS.put("u:" + uid, JSON.stringify(list), { expirationTtl: TOKEN_TTL });
}

/* ---------------- /register ---------------- */

async function handleRegister(request, env){
  const { uid } = await authUid(request);
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "");
  if(token.length < 20 || token.length > 4096) return reply(request, 400, { error: "bad token" });

  const now = Math.floor(Date.now() / 1000);
  let list = await readTokens(env, uid);
  const existing = list.find(x => x.t === token);

  if(existing && now - existing.at < REFRESH_AFTER) return reply(request, 200, { ok: true });

  list = list.filter(x => x.t !== token);
  list.unshift({ t: token, at: now });
  list = list.slice(0, MAX_TOKENS_PER_USER);
  await writeTokens(env, uid, list);
  return reply(request, 200, { ok: true });
}

/* ---------------- /notify ---------------- */

const recent = new Map();   // kariya daga sake aikawa (iya gwargwado)
function seenBefore(key){
  if(recent.has(key)) return true;
  recent.set(key, Date.now());
  if(recent.size > 500){
    const cutoff = Date.now() - 10 * 60 * 1000;
    for(const [k, t] of recent) if(t < cutoff) recent.delete(k);
  }
  return false;
}

function clip(s, n){
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function buildNotification(body, senderUid, idToken){

  const type = String(body.type || "");
  const toUid = String(body.toUid || "");
  if(!toUid || toUid === senderUid) return null;

  const senderDoc = await fsGet("users/" + senderUid, idToken);
  const senderName = clip(fStr(senderDoc, "name") || fStr(senderDoc, "fullName") ||
                          fStr(senderDoc, "displayName") || "Wani", 40);

  if(type === "message"){
    const cid = String(body.conversationId || "");
    if(!/^[A-Za-z0-9_-]{3,200}$/.test(cid)) return null;

    const conv = await fsGet("conversations/" + cid, idToken);
    if(!conv) return null;

    const ids = fArr(conv, "participantIds");
    if(!ids.includes(senderUid) || !ids.includes(toUid)) return null;
    if(fStr(conv, "lastSenderId") !== senderUid) return null;

    const stamp = fStr(conv, "lastMessageAt");
    if(seenBefore(`m|${cid}|${stamp}`)) return { dup: true };

    return {
      data: {
        title: senderName,
        body: clip(fStr(conv, "lastMessage") || "Sabon saƙo", 90),
        url: "messages.html",
        tag: "msg-" + cid,
        icon: "icon-192.png"
      }
    };
  }

  if(type === "friend_request" || type === "friend_accept"){
    const rid = String(body.requestId || "");
    if(!/^[A-Za-z0-9_-]{3,300}$/.test(rid)) return null;

    const fr = await fsGet("friendRequests/" + rid, idToken);
    if(!fr) return null;

    const from = fStr(fr, "from");
    const to = fStr(fr, "to");
    const status = fStr(fr, "status");

    if(type === "friend_request"){
      if(from !== senderUid || to !== toUid || status !== "pending") return null;
      if(seenBefore(`r|${rid}`)) return { dup: true };
      return { data: {
        title: "Sabon friend request",
        body: senderName + " ya aiko maka friend request",
        url: "friends.html", tag: "fr-" + senderUid, icon: "icon-192.png"
      }};
    }

    if(to !== senderUid || from !== toUid || status !== "accepted") return null;
    if(seenBefore(`a|${rid}`)) return { dup: true };
    return { data: {
      title: "Friend request an amince",
      body: senderName + " ya amince da friend request ɗinka",
      url: "friends.html", tag: "fa-" + senderUid, icon: "icon-192.png"
    }};
  }

  return null;
}

async function handleNotify(request, env){
  const { uid, idToken } = await authUid(request);
  const body = await request.json().catch(() => ({}));

  const built = await buildNotification(body, uid, idToken);
  if(!built) return reply(request, 403, { error: "not allowed" });
  if(built.dup) return reply(request, 200, { ok: true, duplicate: true });

  const toUid = String(body.toUid);
  const list = await readTokens(env, toUid);
  if(!list.length) return reply(request, 200, { ok: true, sent: 0 });

  const results = await Promise.all(list.map(x => sendFcm(env, x.t, built.data).catch(() => "error")));

  const alive = list.filter((x, i) => results[i] !== "dead");
  if(alive.length !== list.length) await writeTokens(env, toUid, alive);

  return reply(request, 200, { ok: true, sent: results.filter(r => r === "ok").length });
}

/* ---------------- fetch ---------------- */

export default {
  async fetch(request, env){

    if(request.method === "OPTIONS"){
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if(request.method !== "POST") return reply(request, 405, { error: "method" });

    const path = new URL(request.url).pathname;

    try{
      if(path === "/register") return await handleRegister(request, env);
      if(path === "/notify") return await handleNotify(request, env);
      return reply(request, 404, { error: "not found" });
    }catch(e){
      const msg = String(e && e.message || e);
      const authErr = /token|alg|kid|signature|aud|iss|expired|iat|sub|jwks/.test(msg);
      console.log("worker error:", msg);
      return reply(request, authErr ? 401 : 500, { error: authErr ? "unauthorized" : "server error" });
    }
  }
};
