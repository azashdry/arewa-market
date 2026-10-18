// =====================================================
// AREWA MARKET - REPORT (korafi / yaudara)
// Yadda ake amfani:
//   import { openReportModal } from "./report.js";
//   openReportModal({
//     reportedUserId, reportedName,      // wajibi: id na wanda ake report
//     productId, productName,            // zaɓi
//     conversationId                     // zaɓi
//   });
// Ana adana report a collection "reports" (status: "pending")
// =====================================================

import { auth, db } from "./firebase.js";
import { t } from "./i18n.js";
import { uploadToImgbb } from "./imgbb-upload.js";
import {
  collection, addDoc, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;   // report ɗaya ga user ɗaya a kowane awa 24
const MIN_DETAILS = 10;

export const REPORT_REASONS = ["scam", "fake", "offsite", "abuse", "other"];

let styleAdded = false;

function addStyle() {
  if (styleAdded) return;
  styleAdded = true;
  const s = document.createElement("style");
  s.textContent = `
.rp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:5000;
  display:flex;align-items:flex-end;justify-content:center}
.rp-box{background:#fff;width:100%;max-width:480px;max-height:92vh;overflow:auto;
  border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));
  font-family:inherit;color:#222}
@media(min-width:600px){.rp-overlay{align-items:center}.rp-box{border-radius:18px}}
.rp-box h3{margin:0 0 4px;font-size:18px}
.rp-box .rp-sub{margin:0 0 12px;font-size:13px;color:#666}
.rp-opt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;margin-bottom:8px;
  border:1.5px solid #e2e2e2;border-radius:10px;cursor:pointer;font-size:14px}
.rp-opt input{margin-top:3px}
.rp-opt.sel{border-color:#075e36;background:#eef7f1}
.rp-box textarea{width:100%;min-height:90px;border:1.5px solid #e2e2e2;border-radius:10px;
  padding:10px;font:inherit;font-size:14px;box-sizing:border-box;resize:vertical;margin-top:6px}
.rp-file{margin-top:10px;font-size:13px}
.rp-msg{margin-top:10px;font-size:13px;padding:9px 11px;border-radius:8px;display:none}
.rp-msg.err{display:block;background:#fdeaea;color:#a12622}
.rp-msg.ok{display:block;background:#e6f4ea;color:#17692f}
.rp-actions{display:flex;gap:10px;margin-top:14px}
.rp-actions button{flex:1;padding:12px;border-radius:10px;border:0;font-weight:700;
  font-size:14px;cursor:pointer}
.rp-cancel{background:#eee;color:#333}
.rp-send{background:#c62828;color:#fff}
.rp-send:disabled{opacity:.6}`;
  document.head.appendChild(s);
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}

export function openReportModal(opts) {
  const o = opts || {};
  const me = auth.currentUser;

  if (!me) {
    window.location.href = "login.html";
    return;
  }
  if (!o.reportedUserId) return;
  if (o.reportedUserId === me.uid) {
    alert(t("rp_self"));
    return;
  }

  addStyle();

  const overlay = document.createElement("div");
  overlay.className = "rp-overlay";
  overlay.innerHTML = `
    <div class="rp-box" role="dialog" aria-modal="true">
      <h3>🚩 ${esc(t("rp_title"))}</h3>
      <p class="rp-sub">${esc(o.reportedName || "")}${o.productName ? " — " + esc(o.productName) : ""}</p>
      ${REPORT_REASONS.map((r, i) => `
        <label class="rp-opt">
          <input type="radio" name="rpReason" value="${r}">
          <span>${esc(t("rp_" + r))}</span>
        </label>`).join("")}
      <textarea id="rpDetails" maxlength="1000" placeholder="${esc(t("rp_details_ph"))}"></textarea>
      <div class="rp-file">
        <label>${esc(t("rp_evidence"))}<br>
          <input type="file" id="rpFile" accept="image/*">
        </label>
      </div>
      <div class="rp-msg" id="rpMsg"></div>
      <div class="rp-actions">
        <button type="button" class="rp-cancel" id="rpCancel">${esc(t("rp_cancel"))}</button>
        <button type="button" class="rp-send" id="rpSend">${esc(t("rp_send"))}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const $ = id => overlay.querySelector("#" + id);
  const msg = (text, type) => {
    const m = $("rpMsg");
    m.textContent = text;
    m.className = "rp-msg " + type;
  };
  const close = () => overlay.remove();

  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  $("rpCancel").addEventListener("click", close);

  overlay.querySelectorAll(".rp-opt").forEach(label => {
    label.addEventListener("click", () => {
      overlay.querySelectorAll(".rp-opt").forEach(l => l.classList.remove("sel"));
      label.classList.add("sel");
    });
  });

  $("rpSend").addEventListener("click", async () => {
    const reasonEl = overlay.querySelector('input[name="rpReason"]:checked');
    const details = $("rpDetails").value.trim();
    const file = $("rpFile").files[0] || null;
    const btn = $("rpSend");

    if (!reasonEl) return msg(t("rp_need_reason"), "err");
    if (details.length < MIN_DETAILS) return msg(t("rp_need_details"), "err");

    btn.disabled = true;
    msg(t("rp_sending"), "ok");

    try {
      // Iyakar report: ɗaya ga user ɗaya a kowane awa 24
      const prev = await getDocs(query(
        collection(db, "reports"),
        where("reporterId", "==", me.uid),
        where("reportedUserId", "==", o.reportedUserId)
      ));
      const now = Date.now();
      const tooSoon = prev.docs.some(d => {
        const ts = d.data().createdAt;
        const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : now;
        return now - ms < COOLDOWN_MS;
      });
      if (tooSoon) {
        btn.disabled = false;
        return msg(t("rp_cooldown"), "err");
      }

      let evidenceUrl = "";
      if (file) evidenceUrl = await uploadToImgbb(file);

      await addDoc(collection(db, "reports"), {
        reporterId: me.uid,
        reporterName: me.displayName || "",
        reportedUserId: o.reportedUserId,
        reportedName: o.reportedName || "",
        productId: o.productId || "",
        productName: o.productName || "",
        conversationId: o.conversationId || "",
        reason: reasonEl.value,
        details,
        evidenceUrl,
        status: "pending",
        createdAt: serverTimestamp()
      });

      msg(t("rp_done"), "ok");
      setTimeout(close, 1400);
    } catch (e) {
      console.error("report error", e);
      btn.disabled = false;
      msg((e && e.message) || t("rp_fail"), "err");
    }
  });
}

window.openReportModal = openReportModal;
