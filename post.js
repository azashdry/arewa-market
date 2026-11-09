// =====================================================
// AREWA MARKET - POST LINK PREVIEW (Vercel serverless function, kyauta)
// -----------------------------------------------------
// GET /api/post?id=POSTID
// Yana ba da shafin HTML mai og:title / og:description / og:image na post ɗin,
// don WhatsApp, Facebook, Telegram da X su nuna hoto da rubutun post ɗin.
// Mutum na gaske (browser) ana tura shi kai tsaye zuwa feed.html?post=ID.
//
// Ba ya buƙatar sirri ko Environment Variable. Yana karanta post guda ɗaya
// ta Firestore REST (rules: "allow get: if true" a posts).
// =====================================================

const PROJECT = "arewa-market-4e603";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const SITE = "https://azashdry.github.io/arewa-market";
const SELF = "https://arewa-push.vercel.app/api/post";
const DEFAULT_IMG = SITE + "/og-image.png";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function clip(s, n) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}

function str(doc, name) {
  const f = doc && doc.fields && doc.fields[name];
  return f && typeof f.stringValue === "string" ? f.stringValue : "";
}

function firstImage(doc) {
  const f = doc && doc.fields && doc.fields.images;
  const vals = f && f.arrayValue && f.arrayValue.values;
  if (!vals) return "";
  for (const v of vals) {
    const u = v && v.stringValue;
    if (typeof u === "string" && u.indexOf("https://res.cloudinary.com/") === 0) return u;
  }
  return "";
}

// Hoton 1200x630 (JPG, don duk crawlers)
function ogImage(u) {
  if (!u) return DEFAULT_IMG;
  if (u.indexOf("/upload/") > -1 && !/\/upload\/[^/]*(w_|c_|q_|f_)/.test(u)) {
    return u.replace("/upload/", "/upload/f_jpg,q_auto,c_fill,g_auto,w_1200,h_630/");
  }
  return u;
}

function page(o) {
  const dest = o.id ? `${SITE}/feed.html?post=${encodeURIComponent(o.id)}` : `${SITE}/feed.html`;
  const self = o.id ? `${SELF}?id=${encodeURIComponent(o.id)}` : SELF;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Arewa Market">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${esc(self)}">
<meta property="og:image" content="${esc(o.img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${esc(o.img)}">
<meta http-equiv="refresh" content="0;url=${esc(dest)}">
<script>location.replace(${JSON.stringify(dest).replace(/</g, "\\u003c")});</script>
</head>
<body style="font-family:Arial,sans-serif;text-align:center;padding:40px 16px;color:#222">
<p>Opening Arewa Market...</p>
<p><a href="${esc(dest)}">Tap here if it does not open</a></p>
</body>
</html>`;
}

function send(res, status, html) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", status === 200
    ? "public, s-maxage=300, stale-while-revalidate=600"
    : "public, s-maxage=60");
  res.status(status).send(html);
}

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  let id = "";
  try { id = new URL(req.url, "http://x").searchParams.get("id") || ""; } catch (e) {}

  const generic = {
    id: "", title: "Arewa Market",
    desc: "Northern Nigeria's market in your hand.", img: DEFAULT_IMG
  };

  if (!/^[A-Za-z0-9]{6,40}$/.test(id)) return send(res, 404, page(generic));

  let doc = null;
  try {
    const r = await fetch(`${FS}/posts/${id}`);
    if (r.ok) doc = await r.json();
  } catch (e) {
    console.log("post fetch error:", e && e.message);
  }

  if (!doc || !doc.fields) {
    return send(res, 404, page({ ...generic, id, desc: "This post is no longer available." }));
  }

  const author = clip(str(doc, "authorName"), 60) || "Arewa Market";
  const text = clip(str(doc, "text"), 200);
  const img = firstImage(doc);

  return send(res, 200, page({
    id,
    title: `${author} on Arewa Market`,
    desc: text || (img ? "Shared a photo on Arewa Market" : "See this post on Arewa Market"),
    img: ogImage(img)
  }));
};
