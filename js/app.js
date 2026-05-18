// Wiring only: pick document -> build form from schema -> live preview ->
// save/load drafts -> print. No legal logic here; templates own that.

import { DOCUMENTS, getDocument } from "./templates.js";
import { renderTemplate, completion } from "./engine.js";
import { saveDraft, listDrafts, deleteDraft } from "./storage.js";
import { createSession } from "./p2p.js";
import { BRAND, brandEmail } from "./config.js";
import {
  oidcConfigured,
  configuredProviders,
  providerLabel,
  signIn,
  verifyIdToken,
} from "./oidc.js";
import {
  sha256Hex,
  docFingerprintText,
  newSessionId,
  verificationBlock,
  SENDER_CONSENT,
  SIGNER_CONSENT,
} from "./verify.js";

// The receiver fills only their own (Party B) signature block.
const SIGNER_FIELDS = ["sigB", "sigNameB", "sigTitleB", "sigDateB"];

const els = {
  picker: document.getElementById("picker"),
  builder: document.getElementById("builder"),
  docGrid: document.getElementById("docGrid"),
  preview: document.getElementById("preview"),
  docCanvas: document.getElementById("docCanvas"),
  sealMount: document.getElementById("sealMount"),
  docTitle: document.getElementById("docTitle"),
  docSubtitle: document.getElementById("docSubtitle"),
  newDocBtn: document.getElementById("newDocBtn"),
  draftsBtn: document.getElementById("draftsBtn"),
  saveDraftBtn: document.getElementById("saveDraftBtn"),
  printBtn: document.getElementById("printBtn"),
  draftsPanel: document.getElementById("draftsPanel"),
  draftsList: document.getElementById("draftsList"),
  draftsEmpty: document.getElementById("draftsEmpty"),
  closeDrafts: document.getElementById("closeDrafts"),
  scrim: document.getElementById("scrim"),
  contactBtn: document.getElementById("contactBtn"),
  liveBtn: document.getElementById("liveBtn"),
  sessionPanel: document.getElementById("sessionPanel"),
  sessionBody: document.getElementById("sessionBody"),
  closeSession: document.getElementById("closeSession"),
  sessionBadge: document.getElementById("sessionBadge"),
  soundBtn: document.getElementById("soundBtn"),
  pagemark: document.getElementById("pagemark"),
};

// Per-page mark printed at the foot of every page of a signed contract:
// brand + the committed document SHA-256 + session reference. Shown only once
// a signing record exists; print-only (hidden on screen); not part of the
// document text or its hash.
function setPageMark() {
  const h = synRec && synRec.hash ? synRec.hash : ackRec && ackRec.hash ? ackRec.hash : "";
  if (!els.pagemark) return;
  els.pagemark.textContent = h
    ? `${BRAND.app} · Document SHA-256 ${h} · Session ${sessionId || "—"} · verify locally — not legal advice`
    : "";
}

/* Ceremony sound — synthesized (no asset files), default OFF. A low wax-seal
   "thud" when a document seals; a faint tick when the fingerprint is taken. */
let soundOn = false;
let actx = null;
function tone({ freq, dur, type = "sine", gain = 0.04, slideTo }) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    const t = actx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* audio unavailable — silent */
  }
}
const sealSound = () => {
  tone({ freq: 150, slideTo: 70, dur: 0.5, type: "sine", gain: 0.06 });
  tone({ freq: 90, dur: 0.6, type: "triangle", gain: 0.03 });
};
const tickSound = () => tone({ freq: 1500, dur: 0.05, type: "square", gain: 0.015 });

let current = null; // { doc, draftId|null }

function buildGrid() {
  els.docGrid.innerHTML = "";
  for (const doc of DOCUMENTS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "doc-card";
    card.setAttribute("role", "listitem");
    card.innerHTML = `
      <span class="doc-cat">${doc.category}</span>
      <span class="doc-name">${doc.name}</span>
      <span class="doc-blurb">${doc.blurb}</span>`;
    card.addEventListener("click", () => openDocument(doc.id));
    els.docGrid.appendChild(card);
  }
  // 8th cell: bring your own contract.
  const up = document.createElement("button");
  up.type = "button";
  up.className = "doc-card doc-card-upload";
  up.setAttribute("role", "listitem");
  up.innerHTML = `
    <span class="doc-cat">Bring your own</span>
    <span class="doc-name">Your contract</span>
    <span class="doc-blurb">Paste or upload a contract you already have, then review, sign, and seal it the same way.</span>`;
  up.addEventListener("click", openUpload);
  els.docGrid.appendChild(up);
}

const UPLOAD_FINEPRINT =
  "Foolscap is not a law firm and gives no legal advice. This is your own document — Foolscap only renders, signs, and fingerprints it. Have important agreements reviewed by a licensed attorney.";

function makeUploadedDoc(body) {
  return {
    id: "uploaded",
    name: "Your contract",
    category: "Uploaded",
    body: body || "",
    fields: [],
  };
}

function promptFile() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".txt,.md,.markdown,text/plain,text/markdown";
  inp.addEventListener("change", () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      if (!current || current.doc.id !== "uploaded") return;
      current.doc.body = String(r.result || "");
      renderDoc(true);
      schedulePush();
    };
    r.readAsText(file);
  });
  inp.click();
}

function openUpload() {
  current = { doc: makeUploadedDoc(""), draftId: null, values: {} };
  els.docTitle.textContent = "Your contract";
  els.docSubtitle.textContent = "Paste your contract below, or upload a .txt / .md file";
  renderDoc(true);
  els.sealMount.innerHTML = "";
  els.picker.hidden = true;
  els.builder.hidden = false;
  els.newDocBtn.hidden = false;
  updateActionBar();
  closeDrafts();
  savePersist();
}

// Survive a page refresh: keep the open document + entered values for this tab.
// (A live signing session can't survive a reload — only the document does.)
const PKEY = "foolscap:open";
function savePersist() {
  try {
    if (!current) {
      sessionStorage.removeItem(PKEY);
      return;
    }
    sessionStorage.setItem(
      PKEY,
      JSON.stringify({
        docId: current.doc.id,
        values: current.values,
        body: current.doc.id === "uploaded" ? current.doc.body : undefined,
      })
    );
  } catch {
    /* storage unavailable — refresh just won't restore */
  }
}
function restorePersist() {
  let s;
  try {
    s = JSON.parse(sessionStorage.getItem(PKEY) || "null");
  } catch {
    s = null;
  }
  if (!s || !s.docId) return;
  if (s.docId === "uploaded") {
    current = { doc: makeUploadedDoc(s.body || ""), draftId: null, values: {} };
  } else {
    const doc = getDocument(s.docId);
    if (!doc) return;
    current = {
      doc,
      draftId: null,
      values:
        s.values && typeof s.values === "object"
          ? { ...s.values }
          : defaultValues(doc),
    };
  }
  els.docTitle.textContent = current.doc.name;
  renderDoc(true);
  els.sealMount.innerHTML = "";
  updateMeta();
  els.picker.hidden = true;
  els.builder.hidden = false;
  els.newDocBtn.hidden = false;
  updateActionBar();
}

// The contract IS the form. Values live in `current.values`, kept in sync by a
// delegated listener so the canvas is never re-rendered mid-edit (carets stay).
function defaultValues(doc) {
  const v = {};
  for (const f of doc.fields) if (f.default != null) v[f.key] = f.default;
  return v;
}

function readValues() {
  return current ? { ...current.values } : {};
}

// mode: true = all editable (drafter) | false = static (locked/print) |
// array of keys = only those editable (receiver signs just their own block).
function renderDoc(mode) {
  const partial = Array.isArray(mode);
  const editable = mode === true;
  // `.locked` disables all fields; never apply it in partial mode (the
  // signer's own block must stay interactive — other fields are already
  // rendered static by the engine).
  els.docCanvas.classList.toggle("locked", mode === false);
  if (current.doc.id === "uploaded") {
    els.docCanvas.innerHTML = `${
      editable
        ? '<div class="own-tools"><button type="button" id="ownUpload" class="btn">Upload .txt / .md file</button></div>'
        : ""
    }<div id="ownDoc" class="own-doc" ${
      editable ? 'contenteditable="true"' : ""
    } role="textbox" data-ph="Paste or type your contract here…"></div><p class="fineprint">${UPLOAD_FINEPRINT}</p>`;
    document.getElementById("ownDoc").textContent = current.doc.body || "";
    if (editable) document.getElementById("ownUpload").onclick = promptFile;
    return;
  }
  els.docCanvas.innerHTML = renderTemplate(
    current.doc.body,
    current.doc.fields,
    current.values,
    partial ? { editableKeys: mode } : { editable }
  );
}

function updateMeta() {
  if (!current.doc.fields.length) {
    els.docSubtitle.textContent =
      current.doc.id === "uploaded"
        ? "Your uploaded contract"
        : current.doc.category;
    return;
  }
  const pct = Math.round(
    completion(current.doc.fields, current.values) * 100
  );
  els.docSubtitle.textContent = `${current.doc.category} · ${pct}% complete`;
}

// One delegated listener for the whole canvas — no per-field wiring, no
// re-render while typing.
els_docCanvasListeners();
function els_docCanvasListeners() {
  const onEdit = (e) => {
    if (!current) return;
    if (current.doc.id === "uploaded") {
      const od = e.target.closest("#ownDoc");
      if (od) {
        current.doc.body = od.innerText;
        schedulePush();
      }
      return;
    }
    const el = e.target.closest("[data-key]");
    if (!el) return;
    const key = el.getAttribute("data-key");
    const v =
      el.tagName === "SELECT" ? el.value : el.textContent.replace(/ /g, " ").trim();
    setVal(key, v);
    if (el.tagName === "SELECT") {
      // keep the plain-text twin (shown in print / locked) in sync
      const twin = el.parentNode && el.parentNode.querySelector(".sel-val");
      if (twin) twin.textContent = v + (twin.dataset.punct || "");
    } else if (el.classList.contains("fld")) {
      el.classList.toggle("empty", v === "");
    }
    updateMeta();
    schedulePush();
  };
  els.docCanvas.addEventListener("input", onEdit);
  els.docCanvas.addEventListener("change", onEdit);
  els.docCanvas.addEventListener("click", (e) => {
    const sig = e.target.closest(".sigfield");
    if (!sig || !current) return;
    if (els.docCanvas.classList.contains("locked")) return; // sealed: read-only
    e.preventDefault();
    const k = sig.getAttribute("data-key");
    openSignaturePad(k, sig.getAttribute("data-label"), current.values[k] || "");
  });
}

// Draw-or-type signature pad. Serverless, no dependency — Canvas API only.
// `existing` (if any) is loaded back in so re-signing edits the current
// signature instead of starting from a blank canvas; Cancel keeps it.
function openSignaturePad(key, label, existing, onDone) {
  const reSign = !!existing;
  const ov = document.createElement("div");
  ov.className = "sigpad-overlay";
  ov.innerHTML = `
    <div class="sigpad" role="dialog" aria-label="Signature">
      <div class="sigpad-head">
        <strong>${reSign ? "Re-sign" : "Signature"}${label ? " — " + label : ""}</strong>
        <span class="sigpad-tabs">
          <button type="button" class="btn sigpad-tab is-on" data-tab="draw">Draw</button>
          <button type="button" class="btn sigpad-tab" data-tab="type">Type</button>
        </span>
      </div>
      <div class="sigpad-body">
        <canvas class="sigpad-canvas" width="900" height="280"></canvas>
        <input class="session-code sigpad-typed" type="text" placeholder="Type your full name" hidden>
        <p class="muted small sigpad-hint">Draw your signature in the box above.</p>
      </div>
      <div class="sigpad-actions">
        <button type="button" class="btn btn-ghost" id="sigClear">Clear pad</button>
        ${reSign ? '<button type="button" class="btn btn-ghost" id="sigRemove">Remove signature</button>' : ""}
        <button type="button" class="btn btn-ghost" id="sigCancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="sigApply">${reSign ? "Replace signature" : "Apply signature"}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  const cv = ov.querySelector(".sigpad-canvas");
  const typed = ov.querySelector(".sigpad-typed");
  const hint = ov.querySelector(".sigpad-hint");
  const ctx = cv.getContext("2d");
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#0a0a0a";
  let drawing = false;
  let drew = false;
  let mode = "draw";

  function pos(ev) {
    const r = cv.getBoundingClientRect();
    const t = ev.touches ? ev.touches[0] : ev;
    return {
      x: ((t.clientX - r.left) / r.width) * cv.width,
      y: ((t.clientY - r.top) / r.height) * cv.height,
    };
  }
  function start(ev) {
    if (mode !== "draw") return;
    ev.preventDefault();
    drawing = true;
    const pt = pos(ev);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  }
  function move(ev) {
    if (!drawing) return;
    ev.preventDefault();
    const pt = pos(ev);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    drew = true;
  }
  function end() {
    drawing = false;
  }
  cv.addEventListener("pointerdown", start);
  cv.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);

  ov.querySelectorAll(".sigpad-tab").forEach((tb) => {
    tb.addEventListener("click", () => {
      ov.querySelectorAll(".sigpad-tab").forEach((x) => x.classList.remove("is-on"));
      tb.classList.add("is-on");
      mode = tb.getAttribute("data-tab");
      const isDraw = mode === "draw";
      cv.hidden = !isDraw;
      typed.hidden = isDraw;
      hint.textContent = isDraw
        ? "Draw your signature in the box above."
        : "Your typed name becomes your signature.";
      if (!isDraw) typed.focus();
    });
  });

  // Re-sign: load the current signature back so it can be edited/kept,
  // instead of presenting a blank canvas.
  if (reSign && existing.startsWith("type:")) {
    typed.value = existing.slice(5);
    ov.querySelector('.sigpad-tab[data-tab="type"]').click();
  } else if (reSign && existing.startsWith("draw:")) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      drew = true; // current signature is on the canvas; Apply keeps it
    };
    img.src = existing.slice(5);
    hint.textContent =
      "Your current signature is loaded — edit it, Clear to start over, or Cancel to keep it.";
  }

  function close() {
    window.removeEventListener("pointerup", end);
    ov.remove();
  }
  ov.querySelector("#sigClear").onclick = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    drew = false;
    typed.value = "";
  };
  ov.querySelector("#sigCancel").onclick = close;
  const removeBtn = ov.querySelector("#sigRemove");
  if (removeBtn) {
    removeBtn.onclick = () => {
      // Un-sign: blank the field entirely (e.g. signed in the wrong spot).
      setVal(key, "");
      close();
      renderDoc(currentRenderMode());
      updateMeta();
      schedulePush();
    };
  }
  ov.addEventListener("click", (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector("#sigApply").onclick = () => {
    let val = "";
    if (mode === "draw") {
      if (!drew) {
        hint.textContent = "Draw your signature first.";
        return;
      }
      val = "draw:" + cv.toDataURL("image/png");
    } else {
      const name = typed.value.trim();
      if (!name) {
        hint.textContent = "Type your name first.";
        return;
      }
      val = "type:" + name;
    }
    setVal(key, val);
    close();
    renderDoc(currentRenderMode());
    updateMeta();
    schedulePush();
    if (onDone) onDone(val);
  };
}

function openDocument(id, draft) {
  const doc = getDocument(id);
  if (!doc) return;
  current = {
    doc,
    draftId: draft ? draft.id : null,
    values: draft ? { ...draft.fieldValues } : defaultValues(doc),
  };
  els.docTitle.textContent = doc.name;
  renderDoc(true);
  els.sealMount.innerHTML = "";
  updateMeta();
  els.picker.hidden = true;
  els.builder.hidden = false;
  els.newDocBtn.hidden = false;
  updateActionBar();
  closeDrafts();
  savePersist();
}

function backToPicker() {
  if (session) endSession();
  current = null;
  els.sealMount.innerHTML = "";
  els.builder.hidden = true;
  els.picker.hidden = false;
  els.newDocBtn.hidden = true;
  savePersist();
}

async function doSaveDraft() {
  if (!current) return;
  const name = prompt("Name this draft:", current.doc.name);
  if (name === null) return;
  const id = await saveDraft({
    id: current.draftId || undefined,
    documentType: current.doc.id,
    draftName: name.trim() || current.doc.name,
    fieldValues: readValues(),
  });
  current.draftId = id;
  els.saveDraftBtn.textContent = "Saved";
  setTimeout(() => (els.saveDraftBtn.textContent = "Save draft"), 1500);
}

async function openDrafts() {
  const drafts = await listDrafts();
  els.draftsList.innerHTML = "";
  els.draftsEmpty.hidden = drafts.length > 0;
  for (const d of drafts) {
    const li = document.createElement("li");
    const when = new Date(d.updatedAt).toLocaleString();
    li.innerHTML = `
      <button class="draft-open" type="button">
        <strong>${d.draftName || d.documentType}</strong>
        <span class="muted">${getDocument(d.documentType)?.name || d.documentType} · ${when}</span>
      </button>
      <button class="draft-del btn btn-ghost" type="button" aria-label="Delete draft">Delete</button>`;
    li.querySelector(".draft-open").addEventListener("click", () =>
      openDocument(d.documentType, d)
    );
    li.querySelector(".draft-del").addEventListener("click", async () => {
      await deleteDraft(d.id);
      openDrafts();
    });
    els.draftsList.appendChild(li);
  }
  els.draftsPanel.hidden = false;
  els.scrim.hidden = false;
}

function closeDrafts() {
  els.draftsPanel.hidden = true;
  if (els.sessionPanel.hidden) els.scrim.hidden = true;
}

/* ---- Live signing: serverless WebRTC P2P, manual signaling ---- */

let session = null;
let sessionState = "idle"; // idle|connecting|connected|disconnected|failed|closed
let pushTimer = null;
let sessionId = null;
let synRec = null; // { name, email, ts, hash, id* } — drafter's SYN
let synackRec = null; // { ts } — peer session established
let ackRec = null; // { name, email, ts, hash, id* } — signer's ACK
// This browser's optional Google-confirmed identity for THIS session:
// { idToken, email, iatISO }. Set when the local user completes sign-in;
// folded into the SYN/ACK so the peer can re-verify the signature.
let myIdentity = null;
// One-way fingerprints of the WebRTC handshake blobs — proves a specific
// handshake occurred between the two parties WITHOUT storing the blobs (which
// contain ICE candidates). Hash only — the raw SDP blob is not stored; the
// public STUN-observed IP is extracted separately and recorded in the cert.
let handshake = { synHash: "", ackHash: "" };
async function noteHandshake(offerBlob, answerBlob) {
  try {
    if (offerBlob) handshake.synHash = await sha256Hex(offerBlob);
    if (answerBlob) handshake.ackHash = await sha256Hex(answerBlob);
  } catch {
    /* hashing unavailable — handshake fingerprints simply omitted */
  }
}
let lockedDoc = null; // signer side: { id, values } snapshot from SYN
let sentForSigning = false; // drafter froze live edits after SYN
let bvals = {}; // signer-side: their Party-B block edits (survive re-render)
let sealHtml = ""; // rendered signing certificate, mounted after the document

// Which render mode applies right now, by role/state.
function currentRenderMode() {
  // The signer signs via the panel pad (the document overlay/scrim makes
  // in-document clicking unreliable), so their document is always read-only.
  if (session && session.role === "signer") return false;
  return sentForSigning || ackRec ? false : true; // drafter: locked after send
}
// Set a value; mirror the signer's own-block edits so they survive re-render.
function setVal(key, v) {
  current.values[key] = v;
  if (SIGNER_FIELDS.includes(key)) bvals[key] = v;
}

function val(id) {
  const e = document.getElementById(id);
  return e ? e.value.trim() : "";
}
function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}
function escAttr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function hashesMatch() {
  return !!(synRec && ackRec && synRec.hash === ackRec.hash);
}
let sealedOnce = false;
function paintSeal() {
  els.sealMount.innerHTML = sealHtml;
  setPageMark();
  const sealed = hashesMatch();
  els.builder.classList.toggle("sealed", sealed);
  if (sealed && !sealedOnce) {
    sealedOnce = true;
    sealSound();
  }
  if (!sealed) sealedOnce = false;
}
function refreshVerify() {
  sealHtml =
    synRec || ackRec
      ? `<section class="verify-record${
          synRec && ackRec ? (hashesMatch() ? " is-sealed" : " is-broken") : ""
        }">${renderTemplate(
          verificationBlock({
            sessionId,
            docName: current && current.doc ? current.doc.name : "",
            syn: synRec,
            synack: synackRec,
            ack: ackRec,
            handshake,
            brand: BRAND.app,
          }),
          [],
          {}
        )}</section>`
      : "";
  // Signer: render the exact locked document read-only, then the seal.
  if (session && session.role === "signer" && lockedDoc) {
    const doc =
      lockedDoc.id === "uploaded"
        ? makeUploadedDoc(lockedDoc.body || "")
        : getDocument(lockedDoc.id);
    if (doc) {
      // Locked contract values from the sender + the signer's own block edits.
      current = {
        doc,
        draftId: null,
        values: { ...(lockedDoc.values || {}), ...bvals },
      };
      els.docTitle.textContent = doc.name;
      renderDoc(currentRenderMode());
    }
  }
  paintSeal();
}

function sb(html) {
  els.sessionBody.innerHTML = html;
}
function sbError(msg, fieldId) {
  // Replace any prior error/marks — never stack on repeated clicks.
  els.sessionBody
    .querySelectorAll(".session-error")
    .forEach((n) => n.remove());
  els.sessionBody
    .querySelectorAll(".input-error")
    .forEach((n) => n.classList.remove("input-error"));
  // Error goes at the TOP of the panel, not buried at the bottom.
  els.sessionBody.insertAdjacentHTML(
    "afterbegin",
    `<p class="session-error" role="alert">${msg}</p>`
  );
  if (fieldId) {
    const f = document.getElementById(fieldId);
    if (f) {
      const mark = f.closest(".consent-row") || f;
      mark.classList.add("input-error");
      // Clear the highlight as soon as the user fixes it.
      const clear = () => {
        mark.classList.remove("input-error");
        f.removeEventListener("input", clear);
        f.removeEventListener("change", clear);
        f.removeEventListener("click", clear);
      };
      f.addEventListener("input", clear);
      f.addEventListener("change", clear);
      f.addEventListener("click", clear);
      if (typeof f.focus === "function") f.focus();
    }
  }
}
function copyBtn(id, text) {
  const b = document.getElementById(id);
  if (!b) return;
  b.onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked; user can select manually */
    }
    const old = b.textContent;
    b.textContent = "Copied";
    setTimeout(() => (b.textContent = old), 1200);
  };
}

// Footer reflects role + state: a signer never sees drafter actions, and the
// send button changes once the contract has been sent / signed.
function updateActionBar() {
  const sd = els.saveDraftBtn;
  const snd = document.getElementById("sendSignBtn");
  const pr = els.printBtn;
  if (!snd || !sd || !pr) return;
  const signerRole = session && session.role === "signer";
  const drafterRole = session && session.role === "drafter";
  const signed = !!(synRec && ackRec);
  // defaults (no session, or drafter still drafting)
  sd.hidden = false;
  snd.hidden = false;
  snd.disabled = false;
  snd.textContent = "Send for live signing";
  pr.hidden = false;
  if (signerRole) {
    sd.hidden = true; // a signer doesn't author/save the draft
    snd.hidden = true; // …and doesn't send it
  } else if (drafterRole && (sentForSigning || signed)) {
    sd.hidden = true;
    snd.disabled = true;
    snd.textContent = signed ? "Signed ✓" : "Sent — awaiting signature";
  }
}

function setBadge() {
  updateActionBar();
  if (!session) {
    els.sessionBadge.hidden = true;
    return;
  }
  const role = session.role === "drafter" ? "Drafter" : "Signer";
  let s;
  if (sessionState === "connected") {
    if (synRec && ackRec) s = hashesMatch() ? "signed · hashes match" : "signed · HASH MISMATCH";
    else if (synRec) s = session.role === "drafter" ? "sent for signing" : "ready to sign";
    else s = session.role === "drafter" ? "signer connected" : "connected";
  } else if (sessionState === "connecting") s = "waiting for code…";
  else if (sessionState === "disconnected") s = "reconnecting…";
  else if (sessionState === "failed") s = "connection failed";
  else if (sessionState === "closed") s = "ended";
  else s = "starting…";
  els.sessionBadge.textContent = `● You are the ${role} — ${s}`;
  els.sessionBadge.dataset.state =
    synRec && ackRec && !hashesMatch() ? "failed" : sessionState;
  els.sessionBadge.hidden = false;
}

function openSessionPanel() {
  els.sessionPanel.hidden = false;
  els.scrim.hidden = false;
}
function closeSessionPanel() {
  els.sessionPanel.hidden = true;
  if (els.draftsPanel.hidden) els.scrim.hidden = true;
}

let endedByUser = false; // distinguishes a clean end from a dropped peer

function showLostNotice(msg) {
  openSessionPanel();
  sb(
    `<p class="session-error">${msg}</p>` +
      `<div class="session-roles">` +
      `<button class="btn btn-primary" id="lostRestart" type="button">Start a new session</button>` +
      `<button class="btn btn-ghost" id="lostClose" type="button">Close</button>` +
      `</div>`
  );
  document.getElementById("lostRestart").onclick = () => {
    if (session) endSession();
    else renderSessionStart();
  };
  document.getElementById("lostClose").onclick = closeSessionPanel;
}

function endSession() {
  endedByUser = true;
  try {
    sessionStorage.removeItem("foolscap:insession");
  } catch {}
  if (session) session.close();
  session = null;
  sessionState = "idle";
  sessionId = null;
  synRec = null;
  synackRec = null;
  ackRec = null;
  myIdentity = null; // identity tokens are bound to one session id only
  lockedDoc = null;
  sentForSigning = false;
  handshake = { synHash: "", ackHash: "" };
  bvals = {};
  sealHtml = "";
  document.body.classList.remove("as-signer");
  els.builder.classList.remove("sealed");
  els.sealMount.innerHTML = "";
  setPageMark();
  setBadge();
  if (current && !els.builder.hidden) renderDoc(true);
  renderSessionStart();
}

// E-SIGN requires the option to use paper instead. This is that opt-out: it
// records nothing and signs nothing.
function paperInstead() {
  sb(`<p class="session-ok">No electronic signature will be recorded.</p>
      <p class="muted small">To sign on paper instead, print or save the PDF and arrange physical signing directly with the other party. Foolscap does not process paper signatures, and no signing certificate is created unless both parties choose to sign electronically here.</p>
      <button class="btn" id="backToSign" type="button">Back</button>
      <button class="btn btn-ghost" id="leaveSession" type="button">Leave</button>`);
  document.getElementById("leaveSession").onclick = endSession;
  document.getElementById("backToSign").onclick = () => {
    if (session && session.role === "drafter") renderDrafterConnected();
    else renderSignerConnected();
  };
}

function renderSessionStart() {
  const ok = oidcConfigured();
  const idNote = ok
    ? `<p class="session-note"><strong>Before you start — identity is required.</strong> To sign live, each party must confirm their identity with <strong>Google</strong> (any Google or Google&nbsp;Workspace account, not only @gmail.com) — this proves they control a real email so one person cannot sign both sides. There is <strong>no self-attested option</strong>: if you or the other party have no Google account, use <strong>Print / Save PDF</strong> and sign on paper instead. Yahoo, Outlook/Hotmail, iCloud and other non-Google email are not supported for live signing.</p>`
    : `<p class="session-note"><strong>Live signing is unavailable here.</strong> It requires identity confirmation with a sign-in provider, and none is configured. Use <strong>Print / Save PDF</strong> and sign on paper instead.</p>`;
  const roles = ok
    ? `<div class="session-roles">
      <button class="btn btn-primary" id="roleDrafter" type="button">I'm drafting — create an invite</button>
      <button class="btn" id="roleSigner" type="button">I'm signing — I have an invite</button>
    </div>`
    : "";
  sb(`
    <p class="muted small">Connect directly to the other party, browser-to-browser. Nothing goes through any server and no one sits in the middle — there is none. The contract goes straight to the person you invite, and only when you choose to send it.</p>
    ${idNote}
    ${roles}
    <button class="btn ${ok ? "btn-ghost" : "btn-primary"}" id="printInstead" type="button">Print / Save PDF &amp; sign on paper instead</button>`);
  if (ok) {
    document.getElementById("roleDrafter").onclick = startDrafter;
    document.getElementById("roleSigner").onclick = startSigner;
  }
  document.getElementById("printInstead").onclick = () => {
    closeSessionPanel();
    window.print();
  };
}

function markSessionActive() {
  endedByUser = false;
  try {
    sessionStorage.setItem("foolscap:insession", "1");
  } catch {}
}

async function startDrafter() {
  session = createSession({
    role: "drafter",
    onState: onSessionState,
    onMessage: onPeerMessage,
  });
  markSessionActive();
  setBadge();
  sb(`<p class="muted small">Generating invite…</p>`);
  let code;
  try {
    code = await session.createInvite();
  } catch {
    sbError("Couldn't create an invite in this browser.");
    return;
  }
  noteHandshake(code, null);
  sb(`
    <p class="session-step">1. Send this invite to the other party (email, chat, anywhere):</p>
    <textarea class="session-code" readonly rows="4">${code}</textarea>
    <button class="btn" id="copyInvite" type="button">Copy invite</button>
    <p class="session-step">2. Paste the answer they send back:</p>
    <textarea class="session-code" id="answerIn" rows="4" placeholder="Paste the answer code here"></textarea>
    <button class="btn btn-primary" id="connectAnswer" type="button">Connect</button>
    <p class="muted small">Keep this tab open. You can keep editing the contract while you wait — the connection survives tab switches and ends only when you close the page.</p>`);
  copyBtn("copyInvite", code);
  document.getElementById("connectAnswer").onclick = async () => {
    const a = document.getElementById("answerIn").value.trim();
    if (!a) return;
    try {
      await session.acceptAnswer(a);
      noteHandshake(code, a);
      sb(`<p class="muted small">Connecting… you can close this panel; the badge in the header shows live status.</p>`);
    } catch {
      sbError("That answer code didn't work. Ask them to resend it.");
    }
  };
}

function startSigner() {
  session = createSession({
    role: "signer",
    onState: onSessionState,
    onMessage: onPeerMessage,
  });
  markSessionActive();
  setBadge();
  sb(`
    <p class="session-step">1. Paste the invite you received:</p>
    <textarea class="session-code" id="inviteIn" rows="4" placeholder="Paste the invite code here"></textarea>
    <button class="btn btn-primary" id="makeAnswer" type="button">Generate answer</button>`);
  document.getElementById("makeAnswer").onclick = async () => {
    const inv = document.getElementById("inviteIn").value.trim();
    if (!inv) return;
    let answer;
    try {
      answer = await session.acceptInvite(inv);
    } catch {
      sbError("That invite code didn't work. Ask them to resend it.");
      return;
    }
    noteHandshake(inv, answer);
    sb(`
      <p class="session-step">2. Send this answer back to the other party:</p>
      <textarea class="session-code" readonly rows="4">${answer}</textarea>
      <button class="btn" id="copyAnswer" type="button">Copy answer</button>
      <p class="muted small">Once they paste it, the contract appears here live for you to review and sign. Keep this tab open.</p>`);
    copyBtn("copyAnswer", answer);
  };
}

// ---- REQUIRED federated identity confirmation (OpenID Connect) ----------
// Owner decision (2026-05): live signing is GATED on provider identity
// confirmation. There is NO self-attested live-signing path — a party either
// confirms with a provider or uses Print / sign on paper. This reverses the
// earlier "never hard-blocked / self-attested fallback" stance.
function identityRowHtml() {
  if (!oidcConfigured()) {
    return `<p class="session-note"><strong>Live signing unavailable.</strong> It requires confirming identity with a sign-in provider, and none is configured here. Use <strong>Print / Save PDF</strong> and sign on paper instead.</p>`;
  }
  if (myIdentity && myIdentity.email) {
    return `<p class="session-ok small">✔ Identity confirmed by ${escAttr(
      providerLabel(myIdentity.provider)
    )} sign-in as <strong>${escAttr(
      myIdentity.email
    )}</strong>. The other party's browser independently re-checks ${escAttr(
      providerLabel(myIdentity.provider)
    )}'s signature.</p>
      <button class="btn btn-ghost" id="idBtn-change" type="button">Use a different account</button>`;
  }
  const buttons = configuredProviders()
    .map(
      (p) =>
        `<button class="btn btn-primary" id="idBtn-${p.id}" data-prov="${escAttr(
          p.id
        )}" type="button">Confirm my identity with ${escAttr(p.label)}</button>`
    )
    .join("\n    ");
  return `<p class="session-step">Confirm your identity to sign (required):</p>
    ${buttons}
    <p class="muted small">Required for live signing — it proves to the other party that you control a real provider-verified email, so one person cannot sign both sides. Your browser talks directly to the provider; the document is never sent there (they only see a sign-in, like an email code). <strong>No supported account?</strong> There is no self-attested option — use <strong>Print / Save PDF</strong> and sign on paper instead.</p>`;
}

// Email is recorded SOLELY from the confirmed provider identity — there is no
// manual email entry anymore (no self-attested live-signing path). Shows the
// confirmed address once identity is done; nothing before that (the identity
// row above is what prompts the user).
function emailFieldHtml() {
  if (myIdentity && myIdentity.email) {
    return `<p class="session-ok small">Email — confirmed by ${escAttr(
      providerLabel(myIdentity.provider)
    )} sign-in: <strong>${escAttr(myIdentity.email)}</strong></p>`;
  }
  return "";
}

// Persist the typed name/title into current.values on every keystroke so a
// re-render (Google sign-in, signature pad, "use a different account") never
// wipes them. Drafter writes the A-block keys, signer the B-block keys.
function persistNameTitleInputs() {
  const map = [
    ["dName", "sigNameA"],
    ["dTitle", "sigTitleA"],
    ["sName", "sigNameB"],
    ["sTitle", "sigTitleB"],
  ];
  for (const [id, key] of map) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => setVal(key, el.value));
  }
}

function wireIdentityRow(rerender) {
  persistNameTitleInputs();
  // "Use a different account" simply clears the confirmed identity and redraws
  // so the provider buttons reappear.
  const change = document.getElementById("idBtn-change");
  if (change)
    change.onclick = () => {
      myIdentity = null;
      rerender();
    };
  configuredProviders().forEach((p) => {
    const btn = document.getElementById("idBtn-" + p.id);
    if (!btn) return;
    btn.onclick = async () => {
      if (!sessionId) {
        sbError("Connect to a session first, then confirm identity.");
        return;
      }
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Opening " + p.label + "…";
      try {
        // nonce = the shared session id: binds the token to THIS session so it
        // cannot be replayed from another session or pre-minted by the peer.
        myIdentity = await signIn(p.id, sessionId);
        tickSound();
        rerender();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = orig;
        sbError((e && e.message) || "Identity confirmation did not complete.");
      }
    };
  });
}

// Peer sent a token in their SYN/ACK — re-verify the provider's signature
// locally (the peer cannot forge a signature the provider's public keys won't
// validate) and fold the result into their record, then re-render so the
// certificate updates.
async function verifyPeerIdentity(rec, idToken, idProvider, rerender) {
  if (!rec) return;
  if (!idToken || !idProvider || !oidcConfigured()) {
    rec.idEmail = "";
    rec.idVerified = false;
    return;
  }
  try {
    const { email, iat } = await verifyIdToken(idProvider, idToken, {
      nonce: sessionId,
    });
    rec.idEmail = email;
    rec.idVerified = true;
    rec.idIssuer = providerLabel(idProvider);
    rec.idTime = iat
      ? new Date(iat * 1000).toISOString()
      : new Date().toISOString();
  } catch (e) {
    rec.idEmail = "";
    rec.idVerified = false;
    rec.idError = (e && e.message) || "Token did not verify.";
  }
  refreshVerify();
  if (typeof rerender === "function") rerender();
}

// Snapshot this browser's confirmed identity into a SYN/ACK record + wire msg.
function identityFields() {
  if (!myIdentity) return { idEmail: "", idVerified: false };
  return {
    idToken: myIdentity.idToken, // travels to the peer; NOT printed in the cert
    idProvider: myIdentity.provider,
    idEmail: myIdentity.email,
    idVerified: true, // locally verified at sign-in time
    idIssuer: providerLabel(myIdentity.provider),
    idTime: myIdentity.iatISO,
  };
}

function renderDrafterConnected() {
  if (synRec && ackRec) {
    const ok = hashesMatch();
    sb(
      `${
        ok
          ? `<p class="session-ok">✔ Signed by <strong>${escAttr(ackRec.name)}</strong> (${escAttr(ackRec.email)}) at ${escAttr(ackRec.ts)}. Document hashes match — unaltered. Use Print / Save PDF to keep the record. Anyone can re-check the fingerprint anytime at the <a href="verify.html" target="_blank" rel="noopener">Verify</a> page.</p>`
          : `<p class="session-error">Signed, but the document hashes DO NOT match — the text differed between signing events. Do not rely on this record.</p>`
      }<button class="btn btn-ghost" id="endSession" type="button">End session</button>`
    );
  } else if (synRec) {
    sb(`
      <p class="session-ok">● Sent for signing. Waiting for the other party to sign…</p>
      <div class="muted small">Recorded — ${escAttr(synRec.name)} · ${escAttr(synRec.ts)}</div>
      <p class="muted small">Live edits are paused so both parties sign the exact same text.</p>
      <button class="btn btn-ghost" id="endSession" type="button">End session</button>`);
  } else {
    const haveSig = !!(current && (current.values.sigA || "").trim());
    sb(`
      <p class="session-ok">● Connected. The other party sees your live edits in real time.</p>
      <p class="session-step">When the contract is ready: add your signature, confirm, and send.</p>
      <button class="btn ${haveSig ? "" : "btn-primary"}" id="dSigPad" type="button">${haveSig ? "Signature added ✓ — change" : "✍ Add your signature"}</button>
      <label class="session-step" for="dName">Your full legal name</label>
      <input id="dName" class="session-code" type="text" placeholder="John Smith" value="${escAttr((current && current.values.sigNameA) || "")}">
      <label class="session-step" for="dTitle">Your title (or “Individual”)</label>
      <input id="dTitle" class="session-code" type="text" placeholder="Individual" value="${escAttr((current && current.values.sigTitleA) || "")}">
      ${identityRowHtml()}
      ${emailFieldHtml()}
      <p class="muted small">Your name and today's date are placed in your signature block automatically.</p>
      <label class="consent-row"><input id="dConsent" type="checkbox"> ${escAttr(SENDER_CONSENT)}</label>
      <button class="btn btn-primary" id="sendSign" type="button">Send for signing</button>
      <button class="btn btn-ghost" id="paperInstead" type="button">Sign on paper instead</button>
      <button class="btn btn-ghost" id="endSession" type="button">End session</button>
      <p class="muted small">This locks the document, fingerprints it (SHA-256), and sends that exact text to the other party. The certificate records your consent above; it is not legal advice and does not by itself determine enforceability.</p>`);
    document.getElementById("dSigPad").onclick = () =>
      openSignaturePad(
        "sigA",
        "Your signature",
        current && current.values.sigA,
        () => renderDrafterConnected()
      );
    document.getElementById("sendSign").onclick = sendForSigning;
    document.getElementById("paperInstead").onclick = paperInstead;
    wireIdentityRow(renderDrafterConnected);
  }
  document.getElementById("endSession").onclick = endSession;
}

async function sendForSigning() {
  if (!current) {
    sbError("Open a document first.");
    return;
  }
  const name = val("dName");
  const title = val("dTitle");
  if (!name) {
    sbError("Enter your full legal name.", "dName");
    return;
  }
  if (!(myIdentity && myIdentity.email)) {
    sbError(
      "Confirm your identity to send for signing — or use Print / Save PDF to sign on paper. There is no self-attested option."
    );
    return;
  }
  const email = myIdentity.email;
  const consentEl = document.getElementById("dConsent");
  if (!consentEl || !consentEl.checked) {
    sbError("You must affirm the electronic-signing consent to send.", "dConsent");
    return;
  }
  if (!(current.values.sigA || "").trim()) {
    sbError("Add your signature first (use the button above).", "dSigPad");
    return;
  }
  // Name & date go into the sender's block automatically.
  const today = new Date().toISOString().slice(0, 10);
  setVal("sigNameA", name);
  setVal("sigTitleA", title || "Individual");
  setVal("sigDateA", today);
  const values = readValues();
  const ts = new Date().toISOString();
  const consentTs = new Date().toISOString();
  const ip = session && session.localIP ? session.localIP() : "";
  const hash = await sha256Hex(docFingerprintText(current.doc.body, values));
  tickSound();
  const idf = identityFields();
  synRec = {
    name,
    email,
    ts,
    hash,
    consent: SENDER_CONSENT,
    consentTs,
    ip,
    idEmail: idf.idEmail,
    idVerified: idf.idVerified,
    idIssuer: idf.idIssuer,
    idTime: idf.idTime,
  };
  sentForSigning = true;
  session.send({
    t: "syn",
    id: current.doc.id,
    body: current.doc.id === "uploaded" ? current.doc.body : undefined,
    values,
    name,
    email,
    ts,
    hash,
    consent: SENDER_CONSENT,
    consentTs,
    ip,
    idToken: idf.idToken,
    idProvider: idf.idProvider,
    idEmail: idf.idEmail,
    sessionId,
  });
  renderDoc(false); // lock the canvas — the ceremony begins
  refreshVerify();
  setBadge();
  renderDrafterConnected();
}

function renderSignerConnected() {
  if (ackRec) {
    sb(`
      <p class="session-ok">✔ You signed as <strong>${escAttr(ackRec.name)}</strong> at ${escAttr(ackRec.ts)}. The verification record is now in the document — use Print / Save PDF to keep your copy. The fingerprint can be re-checked anytime at the <a href="verify.html" target="_blank" rel="noopener">Verify</a> page.</p>
      <button class="btn btn-ghost" id="leaveSession" type="button">Leave</button>`);
    document.getElementById("leaveSession").onclick = endSession;
    return;
  }
  if (!synRec) {
    sb(`
      <p class="session-ok">● Connected. Waiting for the drafter to send the contract for signing…</p>
      <p class="muted small">You will see the exact document and can review it before signing.</p>
      <button class="btn btn-ghost" id="leaveSession" type="button">Leave</button>`);
    document.getElementById("leaveSession").onclick = endSession;
    return;
  }
  const haveSig = !!(current && (current.values.sigB || "").trim());
  sb(`
    <p class="session-ok">● You have been asked to sign. Review the contract on the right.</p>
    <div class="muted small">Sent by ${escAttr(synRec.name)} · ${escAttr(synRec.ts)}</div>
    <p class="session-step">1. Add your signature:</p>
    <button class="btn ${haveSig ? "" : "btn-primary"}" id="sSigPad" type="button">${haveSig ? "Signature added ✓ — change" : "✍ Add your signature"}</button>
    <label class="session-step" for="sName">Your full legal name</label>
    <input id="sName" class="session-code" type="text" placeholder="Sarah Jones" value="${escAttr((current && current.values.sigNameB) || "")}">
    <label class="session-step" for="sTitle">Your title (or “Individual”)</label>
    <input id="sTitle" class="session-code" type="text" placeholder="Individual" value="${escAttr((current && current.values.sigTitleB) || "")}">
    ${identityRowHtml()}
    ${emailFieldHtml()}
    <p class="muted small">Your name and today's date are placed in your signature block automatically — no need to match anything by hand.</p>
    <label class="consent-row"><input id="sConsent" type="checkbox"> ${escAttr(SIGNER_CONSENT)}</label>
    <button class="btn btn-primary" id="doSign" type="button">Sign</button>
    <button class="btn btn-ghost" id="paperInstead" type="button">Sign on paper instead</button>
    <button class="btn btn-ghost" id="leaveSession" type="button">Leave</button>`);
  document.getElementById("leaveSession").onclick = endSession;
  document.getElementById("paperInstead").onclick = paperInstead;
  wireIdentityRow(renderSignerConnected);
  document.getElementById("sSigPad").onclick = () =>
    openSignaturePad(
      "sigB",
      "Your signature",
      current && current.values.sigB,
      () => renderSignerConnected()
    );
  document.getElementById("doSign").onclick = async () => {
    const name = val("sName");
    const title = val("sTitle");
    if (!name) {
      sbError("Enter your full legal name.", "sName");
      return;
    }
    if (!(myIdentity && myIdentity.email)) {
      sbError(
        "Confirm your identity to sign — or ask the sender for a paper copy to sign instead. There is no self-attested option."
      );
      return;
    }
    const email = myIdentity.email;
    const consentEl = document.getElementById("sConsent");
    if (!consentEl || !consentEl.checked) {
      sbError("You must affirm the electronic-signing consent to sign.", "sConsent");
      return;
    }
    if (!(current.values.sigB || "").trim()) {
      sbError("Add your signature first (use the button above).", "sSigPad");
      return;
    }
    // Name & date are placed in the block automatically → always consistent.
    const today = new Date().toISOString().slice(0, 10);
    setVal("sigNameB", name);
    setVal("sigTitleB", title || "Individual");
    setVal("sigDateB", today);
    const body =
      lockedDoc.id === "uploaded"
        ? lockedDoc.body || ""
        : getDocument(lockedDoc.id).body;
    const ts = new Date().toISOString();
    const consentTs = new Date().toISOString();
    const ip = session && session.localIP ? session.localIP() : "";
    // Fingerprint excludes the signature block, so this equals the sender's
    // hash regardless of either party's signature/name/date.
    const hash = await sha256Hex(docFingerprintText(body, current.values));
    const bsend = {};
    SIGNER_FIELDS.forEach((k) => (bsend[k] = current.values[k] || ""));
    tickSound();
    const idf = identityFields();
    ackRec = {
      name,
      email,
      ts,
      hash,
      consent: SIGNER_CONSENT,
      consentTs,
      ip,
      idEmail: idf.idEmail,
      idVerified: idf.idVerified,
      idIssuer: idf.idIssuer,
      idTime: idf.idTime,
    };
    session.send({
      t: "ack",
      name,
      email,
      ts,
      hash,
      consent: SIGNER_CONSENT,
      consentTs,
      ip,
      idToken: idf.idToken,
      idProvider: idf.idProvider,
      idEmail: idf.idEmail,
      bvals: bsend,
    });
    refreshVerify();
    setBadge();
    renderSignerConnected();
  };
}

function onSessionState(s) {
  sessionState = s;
  setBadge();
  if (s === "connected") {
    if (!synackRec) synackRec = { ts: new Date().toISOString() };
    if (session.role === "drafter") {
      if (!sessionId) sessionId = newSessionId();
      pushDoc();
      renderDrafterConnected();
    } else {
      document.body.classList.add("as-signer");
      renderSignerConnected();
    }
  } else if (s === "disconnected" || s === "failed" || s === "closed") {
    document.body.classList.remove("as-signer");
    // Peer dropped (reloaded/closed/network) — not our own clean end.
    if (!endedByUser && !(synRec && ackRec && hashesMatch())) {
      try {
        sessionStorage.removeItem("foolscap:insession");
      } catch {}
      showLostNotice(
        "Connection lost — the other party disconnected, reloaded, or the link dropped. A live signing session can't be resumed (nothing is stored on a server). Start a new one."
      );
    }
  }
}

function onPeerMessage(m) {
  if (!m || !m.t) return;
  if (m.t === "doc") {
    if (sentForSigning) return; // frozen after the sender locks it
    const doc =
      m.id === "uploaded" ? makeUploadedDoc(m.body || "") : getDocument(m.id);
    if (!doc) return;
    current = { doc, draftId: null, values: { ...(m.values || {}) } };
    els.docTitle.textContent = doc.name;
    els.docSubtitle.textContent = "Live from the sender — review before signing";
    renderDoc(false);
    paintSeal();
    els.picker.hidden = true;
    els.builder.hidden = false;
  } else if (m.t === "syn") {
    lockedDoc = { id: m.id, values: m.values || {}, body: m.body };
    synRec = {
      name: m.name,
      email: m.email,
      ts: m.ts,
      hash: m.hash,
      consent: m.consent,
      consentTs: m.consentTs,
      ip: m.ip || "",
      // The sender's public IP as the STUN server independently reported it in
      // the offer SDP they sent us — cross-checks the IP they self-report above.
      ipSeen: session && session.remoteIP ? session.remoteIP() : "",
      idEmail: m.idEmail || "",
      idVerified: false, // set true only after we re-verify the signature
    };
    if (m.sessionId) sessionId = m.sessionId;
    // Re-verify the sender's token against the provider's public keys (async;
    // updates the certificate when done). nonce must equal the shared session.
    verifyPeerIdentity(synRec, m.idToken, m.idProvider, renderSignerConnected);
    const doc =
      m.id === "uploaded" ? makeUploadedDoc(m.body || "") : getDocument(m.id);
    if (doc) {
      els.docTitle.textContent = `${doc.name} — for signing`;
      els.docSubtitle.textContent = "Review carefully, then sign";
      els.picker.hidden = true;
      els.builder.hidden = false;
    }
    refreshVerify();
    setBadge();
    renderSignerConnected();
  } else if (m.t === "ack") {
    ackRec = {
      name: m.name,
      email: m.email,
      ts: m.ts,
      hash: m.hash,
      consent: m.consent,
      consentTs: m.consentTs,
      ip: m.ip || "",
      // The signer's public IP as the STUN server independently reported it in
      // the answer SDP they sent us — cross-checks their self-reported IP.
      ipSeen: session && session.remoteIP ? session.remoteIP() : "",
      idEmail: m.idEmail || "",
      idVerified: false,
    };
    // Re-verify the signer's token client-side against the provider's keys.
    verifyPeerIdentity(ackRec, m.idToken, m.idProvider, renderDrafterConnected);
    // Merge the receiver's signed Party-B block so the sender's copy shows
    // their signature/name/title/date too (both PDFs end up identical).
    if (m.bvals && current) {
      for (const k of SIGNER_FIELDS) {
        if (m.bvals[k] != null) current.values[k] = m.bvals[k];
      }
      renderDoc(currentRenderMode());
    }
    refreshVerify();
    setBadge();
    renderDrafterConnected();
  }
}

function pushDoc() {
  if (
    session &&
    session.role === "drafter" &&
    sessionState === "connected" &&
    current &&
    !sentForSigning
  ) {
    session.send({
      t: "doc",
      id: current.doc.id,
      body: current.doc.id === "uploaded" ? current.doc.body : undefined,
      values: readValues(),
    });
  }
}
function schedulePush() {
  savePersist();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushDoc, 250);
}

els.newDocBtn.addEventListener("click", backToPicker);

// Clicking the logo always goes home (and clears the restore), so refresh can
// keep your document without the home page becoming unreachable.
const homeLink = document.getElementById("homeLink");
if (homeLink) {
  homeLink.addEventListener("click", (e) => {
    e.preventDefault();
    backToPicker();
  });
}
els.draftsBtn.addEventListener("click", openDrafts);
els.closeDrafts.addEventListener("click", closeDrafts);
els.scrim.addEventListener("click", () => {
  closeDrafts();
  closeSessionPanel();
});
els.saveDraftBtn.addEventListener("click", doSaveDraft);
els.printBtn.addEventListener("click", () => window.print());

function openSigningFlow() {
  if (!session) {
    renderSessionStart();
  } else if (sessionState === "connected") {
    session.role === "drafter"
      ? renderDrafterConnected()
      : renderSignerConnected();
  }
  closeDrafts();
  openSessionPanel();
}
els.liveBtn.addEventListener("click", openSigningFlow);
const sendSignBtn = document.getElementById("sendSignBtn");
if (sendSignBtn) sendSignBtn.addEventListener("click", openSigningFlow);
els.closeSession.addEventListener("click", closeSessionPanel);

els.soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  els.soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
  els.soundBtn.setAttribute("aria-pressed", String(soundOn));
  if (soundOn) tickSound(); // unlock audio + confirm
});

// Survive tab switches (no visibilitychange teardown). End only when the page
// is actually closing — that is the single disconnect trigger.
window.addEventListener("pagehide", () => {
  if (session) session.close();
});

// Contact: the address is assembled here at click time and never appears in
// the HTML, so it is not visible on the page or scrapeable from the markup.
if (els.contactBtn) {
  els.contactBtn.addEventListener("click", () => {
    const who = brandEmail();
    const subject = encodeURIComponent(`${BRAND.app} — feedback / missing contract / bug`);
    window.location.href = `mailto:${who}?subject=${subject}`;
  });
}

buildGrid();
restorePersist();

// A session was active when the page was reloaded — it cannot survive a
// refresh (peer-to-peer, nothing on a server). Tell the user clearly.
try {
  if (sessionStorage.getItem("foolscap:insession")) {
    sessionStorage.removeItem("foolscap:insession");
    showLostNotice(
      "Your live signing session ended when the page reloaded. Live sessions are peer-to-peer and cannot survive a refresh — nothing was saved on a server. Please start a new session; any signature you had already applied to the document is still here."
    );
  }
} catch {}
