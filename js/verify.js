// Electronic Signing Certificate for P2P signing. PURE: Web Crypto + string
// formatting only — no DOM, no storage, no network. js/app.js does the wiring.
//
// HONESTY: this records each party's explicit consent to electronic signing,
// their identity as entered, timestamps, and a SHA-256 fingerprint of the exact
// document, plus the public IP a neutral STUN service observed for each party
// during the WebRTC handshake — all computed in the parties' own browsers over
// a direct connection with no server of ours. It is provided for transparency.
// It is NOT legal advice and does not by itself determine enforceability; the
// IP is corroborating, not verified geolocation. Identity is self-attested
// UNLESS a party used the optional federated sign-in (OIDC) confirmation, in
// which case an external provider (e.g. Google) attested control of that email
// and the OTHER party's browser re-verified the provider's signature — still
// not a government-identity or legal-enforceability determination. Do not let
// UI/copy claim it is court-proof or E-SIGN-"compliant", do NOT reintroduce
// any "no IP recorded" or absolute "no third party / identity cannot be
// confirmed" wording — it captures consent + integrity + (optionally)
// provider-confirmed email control, which is the point.

// E-SIGN / UETA-style consent each party affirms before signing. Covers the
// substantive elements: consent to transact electronically, intent that the
// action is the signature, having read the document, ability to access and
// RETAIN the PDF, and the right to decline and sign on paper instead. The full
// text is embedded verbatim into the certificate so the consent record travels
// inside the document itself.
export const SENDER_CONSENT =
  "I consent to conduct this transaction electronically and to sign this document with an electronic signature. I have read this document, my action is my signature, and I intend to be legally bound by it. I confirm I can access, download, and retain the signed PDF. I understand I may instead decline and arrange paper signing, and that if I do not sign, no signature is recorded.";
export const SIGNER_CONSENT =
  "I consent to conduct this transaction electronically and to sign this document with an electronic signature. I have read this document, my action is my signature, and I intend to be legally bound by it. I confirm I can access, download, and retain the signed PDF. I understand I may instead decline and arrange paper signing, and that if I do not sign, no signature is recorded.";

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Deterministic plain-text fill of a template body.
export function plainFill(body, values) {
  return String(body).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = values ? values[k] : undefined;
    return v != null && String(v).trim() !== "" ? String(v) : `[${k}]`;
  });
}

// Signature-block fields are EXCLUDED from the document fingerprint so each
// party can sign their own block (signature image, printed name, title, date)
// without changing the hash — the contract terms are what's fingerprinted, and
// both parties therefore compute the SAME hash regardless of who signed what.
// The signatures are an overlay; the certificate (consent + identity + time)
// is the proof. Keep this list in sync with the `SIG` keys in templates.js.
export const FINGERPRINT_EXCLUDE = [
  "sigA", "sigNameA", "sigTitleA", "sigDateA",
  "sigB", "sigNameB", "sigTitleB", "sigDateB",
];

export function docFingerprintText(body, values) {
  const ex = new Set(FINGERPRINT_EXCLUDE);
  const v = {};
  for (const k in values || {}) if (!ex.has(k)) v[k] = values[k];
  return plainFill(body, v);
}

export function newSessionId() {
  try {
    return crypto.randomUUID().split("-").slice(0, 2).join("");
  } catch {
    return (
      Math.random().toString(16).slice(2, 10) +
      Math.random().toString(16).slice(2, 6)
    );
  }
}

// Peer-supplied text is attacker-controllable; the engine only escapes
// substituted values, not static block text, so escape here before composing.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function party(label, p) {
  if (!p) return `${label}: pending`;
  const lines = [
    `${label}: ${esc(p.name)} · ${esc(p.email)}`,
    `Consent ${esc(p.consentTs)} · signed ${esc(p.ts)}`,
    `SHA-256 ${esc(p.hash)}`,
  ];
  // STUN-observed public IP. `ip` is what this party's own browser saw; if a
  // peer-observed value (ipSeen, the same IP as the neutral STUN server
  // reported it in the SDP they sent) is present and differs, show both — a
  // mismatch means the self-reported value can't be trusted.
  if (p.ipSeen && p.ip && p.ipSeen !== p.ip)
    lines.push(`IP ${esc(p.ip)} (peer-observed ${esc(p.ipSeen)} — MISMATCH)`);
  else if (p.ip || p.ipSeen)
    lines.push(`IP ${esc(p.ip || p.ipSeen)} (STUN-observed)`);
  else lines.push("IP unavailable (STUN blocked)");
  // Federated identity. `idVerified` is set only after the OTHER party's
  // browser re-verified the provider's signature on a token bound to this
  // session — a lone signer cannot mint such a token for an email they do not
  // control. Short-lived by design (like an email/SMS code): it is checked
  // live at signing, not re-checkable from this printed record later.
  if (p.idVerified && p.idEmail) {
    let l = `Identity ${esc(p.idEmail)} via ${esc(p.idIssuer || "Google")}${
      p.idTime ? " " + esc(p.idTime) : ""
    } (peer-verified)`;
    if (p.email && p.idEmail.toLowerCase() !== String(p.email).toLowerCase())
      l += ` — differs from entered ${esc(p.email)}`;
    lines.push(l);
  } else {
    lines.push("Identity self-attested (no provider check)");
  }
  return lines.join("\n");
}

// Compact one-page certificate. Engine mini-markup: "## " = heading, blank
// line = new block, single newline = <br>. Keeps every material fact; no
// repeated paragraphs (the consent statement is shown once at the end).
export function verificationBlock({ sessionId, docName, syn, synack, ack, handshake, brand }) {
  const hs = handshake || {};
  const APP = brand || "Foolscap";
  const matched = syn && ack ? syn.hash === ack.hash : null;
  const consent =
    (syn && syn.consent) || (ack && ack.consent) || "";
  const bothSame = syn && ack && syn.consent === ack.consent;
  const parts = [];

  parts.push("## Electronic Signing Certificate");
  parts.push(
    `${APP} · signed directly browser-to-browser — no server of ours, no intermediary, the document never relayed (a public STUN service only helps the browsers connect). Consent + integrity record for transparency: not legal advice, not a determination of enforceability.`
  );
  parts.push(
    `Document: ${esc(docName || "—")} · Session: ${esc(sessionId || "—")} · Times: UTC (ISO 8601)\nFingerprint = SHA-256 of the contract terms (excludes this certificate and the signature blocks, so each party signs their own and both hashes still match). Public IPs below are STUN-observed corroboration — not geolocation; no device or location stored.`
  );
  parts.push(party("Sender", syn));
  parts.push(party("Signer", ack));
  parts.push(
    `Session established ${synack ? esc(synack.ts) : "pending"} · Handshake SYN ${esc(hs.synHash || "—")} · ACK ${esc(hs.ackHash || "—")}\nOne-way SHA-256 of the exact WebRTC offer/answer the two browsers exchanged; both hold the same values, proving one shared direct session. Raw connection data is not stored.`
  );
  parts.push(
    matched === null
      ? "! Result: awaiting both signatures."
      : matched
      ? `! Result: MATCH — fingerprints identical; terms unaltered between signings. Re-checkable anytime at the ${APP} Verify page (no server/account).`
      : "! Result: NO MATCH — fingerprints differ; the terms changed between signings. Do not rely on this certificate."
  );
  if (syn && ack && syn.ip && ack.ip) {
    parts.push(
      syn.ip === ack.ip
        ? `Network: both public IPs identical (${esc(syn.ip)}) — corroborating only; a shared office/VPN/Wi-Fi or carrier-grade NAT can put different people behind one IP. Not proof.`
        : `Network: public IPs differ (Sender ${esc(syn.ip)} · Signer ${esc(ack.ip)}) — consistent with two networks; corroborating, not conclusive.`
    );
  }
  let bothIdOk = false;
  if (syn && ack) {
    const sV = syn.idVerified && syn.idEmail;
    const aV = ack.idVerified && ack.idEmail;
    if (sV && aV) {
      const same =
        String(syn.idEmail).toLowerCase() ===
        String(ack.idEmail).toLowerCase();
      bothIdOk = !same;
      parts.push(
        same
          ? `! Identity check: SAME provider-verified email both sides (${esc(syn.idEmail)}) — likely one person; do NOT rely as a two-party agreement.`
          : `! Identity check: distinct provider-verified emails (Sender ${esc(syn.idEmail)} · Signer ${esc(ack.idEmail)}), each token session-bound and re-verified by the other party — strong evidence two different people signed (email-account control, not government ID).`
      );
    } else if (sV || aV) {
      parts.push(
        `! Identity check: only ${esc(
          (sV ? syn : ack).idEmail
        )} provider-confirmed; the other self-attested — partial corroboration.`
      );
    } else {
      parts.push(
        "! Identity check: neither party used provider confirmation; both identities self-attested."
      );
    }
  }
  if (consent) {
    parts.push(
      bothSame || !(syn && ack)
        ? `Consent (each party): "${esc(consent)}"`
        : `Sender consent: "${esc(syn.consent)}"\nSigner consent: "${esc(ack.consent)}"`
    );
  }
  parts.push(
    bothIdOk
      ? `Provider-confirmed identity above evidences control of those email accounts at signing — not government identity, not a determination of legal enforceability. ${APP} never sees the document.`
      : "Identity is self-attested unless a provider check is shown above; where absent, names and emails are typed by the parties and this record does not by itself prove they are different people. Provider confirmation, where shown, evidences email-account control — not government identity or legal enforceability."
  );
  return parts.join("\n\n");
}
