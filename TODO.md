# Foolscap — TODO (paused 2026-05-18)

State at pause: live signing works end-to-end (Google identity required,
STUN-IP corroboration, trimmed one-page certificate with raster
guilloche/seal, clean print). All JS validates. This file tracks what's left.
See CLAUDE.md for the binding rules; do not violate them to close a TODO.

## 1. Pasted / uploaded own contracts — TOP PRIORITY (user-flagged)

The "Paste or upload a contract you already have" path (`makeUploadedDoc`,
`id:"uploaded"`, `js/app.js`) is the weak spot. An uploaded doc is raw text
with `fields: []` and **no `{{sigA}}…{{sigB}}` signature block**, so:

- [ ] **No signature block in pasted contracts.** Drawn/typed signatures set
      `current.values.sigB` etc., but the raw body has no `{{sig*}}`
      placeholders to render them — the printed uploaded contract shows NO
      signatures. Decide + build: auto-append a standard Party A / Party B
      signature block (Signature / Print Name / Title / Date ×2) to uploaded
      docs so both parties can actually sign, consistent with the template docs.
- [ ] Ensure `FINGERPRINT_EXCLUDE` / `docFingerprintText` still behaves: the
      appended block must be excluded from the hash so both parties match
      (same model as templates). Verify hash stability across each party
      signing their own block on an uploaded doc.
- [ ] `renderDoc` editable-keys / signer read-only mode assumes template
      fields — confirm the signer can edit ONLY their appended block on an
      uploaded doc and nothing else; the sender's text stays locked.
- [ ] Pasted text has no CC BY footer/attribution and no disclaimer — confirm
      that's acceptable (it's the user's own text) and that we don't imply
      Foolscap authored it. Keep the "not legal advice" framing.
- [ ] Sanitize/normalize very large or HTML-ish pastes (engine escapes values
      but the uploaded body is rendered through the markup path — check no
      injection / layout break from hostile paste).
- [ ] `.txt/.md` upload only today — decide if that's the intended limit
      (no .docx/.pdf parsing; keep no-deps).

## 2. Roadmap (from CLAUDE.md, still open)

- [ ] Re-source the **Independent Contractor Agreement** body from a named,
      openly-licensed source (e.g. YC) and set its footer `Source:` —
      currently honest `PENDING`, hand-written. Verify exact name/version/URL
      before writing attribution.
- [ ] **JSON export / import** of drafts (real backup, still no server).
- [ ] **Download as .docx** (the one allowed runtime dep — vendored/local, no
      CDN) alongside print-to-PDF.
- [ ] One paid **attorney review** pass over the templates before any real
      launch; then LLC + E&O. No "attorney-reviewed" copy until done.
- [ ] Disclaimer / ToS pages hardening for launch (liability hygiene).
- [ ] "Continue where you left off" using the `updatedAt` index.

## 3. Identity / providers

- [ ] **Microsoft** is built but dormant (`OIDC.microsoft:""`) — Azure wanted
      a payment card, declined at trial. Enable later only if that changes
      (register Azure app: Web platform redirect to `oauth.html`, "ID tokens"
      implicit grant, /common authority) then set the client id.
- [ ] Apple / Yahoo-AOL are NOT serverless-doable (Apple form_post, Yahoo
      confidential secret) — only revisit if the owner crosses the server line.
- [ ] Before production: flip the Google OAuth consent screen from **Testing**
      to **In production** (else only test users can sign in). Update the
      OAuth client's authorized redirect URIs to the real production origin's
      `oauth.html`.

## 4. QA / polish

- [ ] Re-print across Chrome, Firefox, Safari with headers/footers OFF —
      confirm clean pages, per-page margins consistent on multi-page contracts,
      certificate on its own page, larger seal not clipped, callout hierarchy
      (Result / Identity verdicts) reads heavier than metadata.
- [ ] Two-account end-to-end live-sign test (distinct Google accounts) →
      certificate shows distinct emails + "two different people" verdict.
- [ ] Same-account test → certificate shows "likely one person, do NOT rely".
- [ ] NO-MATCH (terms changed between signings) → no seal, oxblood broken
      state + warning, in screen and PDF.
- [ ] Mobile-first pass on `css/style.css` (still desktop-first — known gap).
- [ ] Connection-lost / refresh-mid-signing messaging sanity check.

## Notes

- Binding constraints live in CLAUDE.md (serverless; no false claims; identity
  now MANDATORY for live signing — no self-attested path; print carries no
  Foolscap metadata; CC BY attribution must stay on template docs).
- Browser print header/footer (URL/date/page #) is NOT removable in code —
  user disables "Headers and footers" in the print dialog. Resolved/accepted.
