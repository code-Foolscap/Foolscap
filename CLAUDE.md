# CLAUDE.md — Foolscap

Guidance for any AI or contributor working in this repo. Read this before editing.

## What this is

**Foolscap** is a static, single-page web app that generates a small set of
openly-licensed legal contracts from a wizard form with a live-rendered preview
and browser print-to-PDF. Everything runs in the browser.
**No server, no signup, no upload — the user's documents and drafts never leave
their machine** (stored locally in IndexedDB; we never receive them).

**Analytics (owner decision, 2026-05) — now CONSENT-GATED.** GA4 (gtag in
`index.html`, `privacy.html`, `about.html`, placeholder `G-XXXXXXXXXX`) is no
longer always-on: each page's inline snippet sets Google Consent Mode
`analytics_storage: 'denied'` by default; `js/consent.js` shows an Accept/
Decline banner; only Accept calls `gtag('consent','update', granted)` and the
choice is stored in `localStorage` key `foolscap:consent`. Decline or no action
= no analytics cookies, no collection. The earlier "always-on, no EU consent
banner" gap is now CLOSED — do not revert to always-on. Still never collects
document/field/draft content. Keep `privacy.html` accurate; do NOT re-add
absolute "no analytics / nothing leaves" claims. Document-level privacy is the
real promise; analytics is opt-in and disclosed.

**Free, permanently.** No pricing, paywall, accounts, or payment code anywhere.
The monetization story is "a genuinely free tool as a portfolio anchor" — it
drives inbound for custom / white-label work; it is NOT a $29/mo SaaS (that
figure was rejected fantasy). If you find or are asked to add
billing/auth, don't — it's out of scope by design. (Analytics is now IN, per
the owner decision above.) Hosted at zero cost on Vercel / Netlify / GitHub
Pages.

The honest headline: "openly-licensed contract templates with a clean form
interface, attorney-reviewed, runs entirely in your browser." Until the
sourcing + review below is actually done, that claim is aspirational, not true —
do not market it as vetted.

The pitch is privacy: legal drafts are inherently sensitive, so a static tool
that physically cannot exfiltrate data beats any server-based competitor. The
product is the contract template + the rendering — both static assets.

## Core user flow

Land → pick a document type from a grid → two-pane builder appears (left: wizard
form for that doc's fields, right: live contract preview) → every keystroke
re-substitutes values into the template → "Print / Save PDF" opens the browser's
native print dialog with a clean, margined, serif contract → optionally save the
draft locally and reload it later.

## Architecture (strict layering — respect it)

Pure HTML/CSS/JS. **No frameworks, no build step, no external/runtime deps.**
Served over HTTP because of ES modules (`python3 -m http.server 8000`), never
`file://`.

| File | Responsibility | Hard rule |
|------|----------------|-----------|
| `index.html` | Picker grid + single inline-canvas builder + drafts/signing drawers | Markup only |
| `js/templates.js` | All document templates as JS constants | Owns ALL legal text; no logic |
| `js/engine.js` | Pure `{{key}}` → HTML substitution + completion ratio | NO DOM, NO storage, pure functions |
| `js/storage.js` | IndexedDB drafts persistence | The ONLY persistence layer |
| `js/app.js` | Wiring: pick → build form → live preview → save → print | The ONLY DOM/orchestration layer; NO legal logic |
| `css/style.css` | Editorial styling + `@media print` | Print rules show only the contract |

Keep these boundaries. `engine.js` must stay pure (unit-testable, no globals).
`app.js` must never contain legal text or template logic. `templates.js` must
never touch the DOM.

## Template format

Each entry in `DOCUMENTS` (in `js/templates.js`):

```js
{
  id: "kebab-id",
  name: "Human Name",
  category: "Confidentiality" | "Services" | "Tenancy" | ...,
  blurb: "One-line description for the picker card.",
  fields: [
    { key, label, type, placeholder?, default?, options?, required? }
  ],
  body: `# TITLE ... markdown-ish text with {{key}} placeholders ...`,
}
```

- Field `type`: `text` | `textarea` | `date` | `select` (needs `options[]`).
- `body` mini-format the engine understands: `# ` → `<h1>`, `## ` → `<h2>`,
  blank line → new paragraph, single newline → `<br>`. `{{key}}` is replaced;
  values are HTML-escaped. Unfilled placeholders render as a visible
  `[Label]` blank so the user sees what's missing.
- **Adding a new document is pure data** — append one object, no code changes.

### Legal-content rules (critical)

- **v1 scope is exactly SEVEN templates** (owner feedback, 2026-05): Mutual NDA,
  One-Way NDA, Independent Contractor Agreement, Statement of Work, Professional
  Services Agreement, Partnership Agreement, AI Addendum. Chosen for: two-party,
  P2P-signable, not heavily regulated, not notarization-dependent. **Dropped**
  (do not re-add): Cloud Service Agreement, Photography/Model Release, BAA, DPA,
  SLA, ToS, Term Sheet, LOI, Order Form, Amendment, Design Partner, will, lease,
  employment offer, generic sales agreement.
- **Common Paper / CC BY 4.0 method (the model to copy for sourcing):** the CSA
  is NOT transcribed. We use Common Paper's intended pattern — a fillable Cover
  Page (Order Form + Key Terms Variables → our `fields`) that **incorporates the
  unmodified Standard Terms by reference (URL)**. Because the core Standard Terms
  text is never edited, CC BY 4.0 needs only attribution + link (no "altered
  text" claim). `CSA_FOOTER` carries that true attribution; never copy it onto a
  template not actually built from that source. Editing incorporated Standard
  Terms text directly would require an added "modified from" note — avoid it.
- **Sourcing posture (integrity-critical):** production templates must be
  *adapted from named, openly-licensed sources* (e.g. Common Paper CC-BY NDAs,
  YC contractor/IP forms, public law-firm form NDAs) and carry that attribution
  in the generated-doc footer, then pass one paid attorney review before launch.
  Each body ends with a shared `FOOTER` whose `Source:` line is deliberately
  `PENDING`. **Do not replace PENDING with a real source name unless the body
  has actually been adapted from that source and reviewed** — labeling
  hand-written text "Adapted from X" is the precise dishonesty this avoids.
- Never generate legal clauses dynamically or with AI at runtime — hallucinated
  legal language is dangerous.
- Keep the "not legal advice" disclaimer in `index.html` and `README.md` intact.

## Persistence (IndexedDB)

DB `foolscap` v1, object store `drafts` (keyPath `id`, autoIncrement), index
`updatedAt` for most-recent-first listing. Record shape:
`{ id, documentType, draftName, fieldValues, createdAt, updatedAt }`.
Drafts live only on the user's device. No sync, no export to any server.

## Design direction

**Award/craft direction (owner feedback, 2026-05) — the product is a ceremony
that produces a document.** Design system, do not dilute it:
- **Serif everywhere** (`--serif`), including UI/buttons/nav. `--mono` only for
  technical marks (codes, certificate body). No sans. (Paid fonts like Söhne/GT
  Sectra were requested but cannot be licensed here — quality serif fallbacks
  used; do not claim licensed fonts.)
- **Monochrome**: near-black ink on warm off-white. Exactly ONE accent
  `--seal` (oxblood) used ONLY on the signing seal/heart. Don't add colors.
- **Weight, not bounce**: `--ease-heavy` + `--slow`; transitions feel like
  closing a book.
- **The contract IS the form**: single inline-editable canvas (`#docCanvas`,
  `.fld` spans / `.fld-select`), NOT a two-pane wizard. The old left form pane
  is gone — do not reinstate it.
- **The certificate is an artifact**: `.verify-record` is a guilloche'd
  notarial seal block that prints into the PDF; the wax seal stamps in on match.
- Optional synthesized ceremony sound, default OFF (`#soundBtn`).
No marketing fluff, testimonials, or "trusted by" logos. The product is the
ceremony.

**Mobile-first (required).** Base CSS targets small screens (single column:
stacked form + preview, full-width controls). Use `@media (min-width: …)` to
progressively introduce the desktop two-pane grid and wider chrome — never
desktop-first `max-width` patch-downs. Known gap: `css/style.css` is currently
still desktop-first and needs refactoring to honor this.

## Explicitly NOT building

No accounts. No email collection. (Always-on GA4 analytics IS present by owner
decision — see "What this is"; it never sees document content.) No third-party
e-signature/DocuSign integration. No cloud sync or server-backed collaboration.
No version history beyond single "save draft". No runtime AI-generated clauses.
No payment/pricing of any kind. No jurisdiction-swap engine. No re-adding the 6
dropped document types.

**Electronic Signing Certificate (owner feedback, 2026-05).** `js/verify.js`
(pure: Web Crypto + formatting, no DOM/storage). Internally still a syn/syn-ack/
ack wire protocol over the P2P channel, but ALL user-facing text is plain
language — "Electronic Signing Certificate", "Sender / Session established /
Signer". Keep SYN/SYN-ACK/ACK and "P2P" jargon OUT of the human-readable
certificate body and marketing copy — EXCEPT one owner-directed exception
(2026-05): the technical "Connection handshake (SYN / SYN-ACK / ACK)" metadata
sub-block intentionally uses those labels. Do not "fix" that away.

**Receiver signs their own block (owner decision 2026-05, REVERSES the earlier
"certificate only" choice).** The document fingerprint now covers contract
TERMS ONLY — `verify.js` `docFingerprintText()` / `FINGERPRINT_EXCLUDE` strips
the signature-block keys (`sigA/sigNameA/sigTitleA/sigDateA` + B) before
hashing. So each party fills their own signature block (draw/type + name +
title + date) and both still compute the SAME hash; signatures are an overlay,
the certificate (consent+identity+time) is the proof. Engine gained
`opts.editableKeys` (only listed keys editable). Signer renders with
`SIGNER_FIELDS` editable (their Party-B block) while everything else is static;
their edits live in `bvals` (survive re-render), ride back to the sender in the
ACK `bvals` so both PDFs match. Signing is blocked unless the signer's block
Signature+Name+Date are filled AND the block Print Name matches the name they
typed in the consent step (name-match). Keep `FINGERPRINT_EXCLUDE` in sync with
`SIG` keys in templates.js. Do NOT hash signature-block fields.

Each party must affirm an explicit E-SIGN/UETA-style consent checkbox
(`SENDER_CONSENT` / `SIGNER_CONSENT`) before sending/signing; the consent string
+ timestamp is recorded into the certificate alongside identity, timestamps, and
the SHA-256 fingerprint + match line. The certificate also carries a "Record
metadata" block (document name, session ref, "timestamps are UTC", what the
fingerprint covers) and a "Connection handshake" block holding ONE-WAY SHA-256
fingerprints of the WebRTC offer/answer — never the raw SDP blobs (kept small +
private; only the hash + the extracted public IP are recorded).
EXPLICIT OWNER DECISION (Option 3, "Yes — full implementation", reverses the
earlier "no IP" stance): the certificate now records each party's PUBLIC IP as a
neutral public STUN service observed it during the WebRTC handshake
(`srflxIP()` in p2p.js → `localIP()`/`remoteIP()`; carried in syn/ack as `ip`,
peer-observed cross-check as `ipSeen`). verify.js shows it per party and emits a
"Network check" corroboration line (same IP ⇒ possibly same person/network;
caveats stated: shared office/VPN/Wi-Fi & carrier-grade NAT false positives, a
determined faker can route around it, mDNS means only the PUBLIC IP is seen —
corroborating, NOT conclusive). This stays serverless (STUN is public, never
receives the document; still no server of ours). Do NOT reintroduce any
"no IP / no IP collected / does not collect IP" copy anywhere — it is now false.

EXPLICIT OWNER DECISION (federated identity / OIDC, "Yes — design and build it",
2026-05; REVERSES the prior "identity is purely self-attested; no third party;
Foolscap deliberately does not use a trusted third party for identity" posture).
Rationale: a lone sender could sign BOTH sides; no serverless-and-no-third-party
scheme can stop that (impossibility — sender mediates the channel). Solution
that stays "no server of OURS": optional "Sign in with Google" (OpenID Connect)
on EITHER party before sending/signing. `js/oidc.js` (browser-only: window.open
+ postMessage + fetch + Web Crypto, NO DOM/storage — same boundary as p2p.js)
opens Google's auth popup → `oauth.html` (static same-origin redirect catcher,
postMessages the token back, stores nothing) → token verified CLIENT-SIDE:
RS256 via Web Crypto against Google's PUBLIC JWKS, checking iss/aud(==clientId)/
exp/`nonce`==sessionId/email_verified. nonce=shared session id binds the token
to THIS session (no replay/pre-mint). Token rides in SYN/ACK; the OTHER party's
browser re-verifies the signature (`verifyPeerIdentity`), so neither side can
forge the other's. `js/config.js` `OIDC.googleClientId` EMPTY by default ⇒
feature simply absent + honest self-attested fallback; a deployer sets it (this
is the ONE non-zero-config, domain-bound value — Google requires the oauth.html
redirect URI registered per origin; documented resale trade-off). Signing is
NEVER hard-blocked on it. Document/contents/certificate are NEVER sent to Google
(it only sees a sign-in event, like an email/SMS OTP provider) — privacy
invariant intact. verify.js shows per-party "Identity: <email> confirmed by
Google sign-in …" or "self-attested only", an aggregate "Identity check" line
(distinct confirmed emails ⇒ strong two-party evidence; SAME email ⇒ likely one
person, do NOT rely), and adapts the closing paragraph. NOT re-checkable from
the printed cert later (token short-lived by design — same as an email/SMS
code); confirmation is a LIVE check by the counterparty. verify.js stays pure.
Do NOT reintroduce absolute "identity is self-attested / no third party /
Foolscap deliberately does not use a trusted third party / identity cannot be
confirmed" copy — it is now conditionally false; phrase it as "self-attested
UNLESS the optional provider sign-in was used". Do NOT add silently; this was an
explicit owner reversal.
MULTI-PROVIDER (owner: "maximize serverless coverage", 2026-05). `js/oidc.js` is
a provider registry; `js/config.js` `OIDC` is a per-provider id map
(`google`, `microsoft`). GOOGLE + MICROSOFT only — both work in the pure static
implicit-`id_token` flow (Microsoft via /common authority, Web-platform redirect
+ "ID tokens" implicit grant; issuer validated as the tenant-scoped
`login.microsoftonline.com/{tid}/v2.0`, email from `email`||`preferred_username`).
Buttons render one-per-configured-provider; SYN/ACK carry `idProvider`; the peer
re-verifies against THAT provider's JWKS. APPLE and YAHOO/AOL are DELIBERATELY
NOT supported and must NOT be added as a "config toggle": Apple needs
`response_mode=form_post` (a server endpoint) to release the email, Yahoo/AOL
needs a confidential client secret exchanged server-side — both cross the
"no server of ours" line, i.e. they are the SAME category as email-OTP and
require a separate explicit owner server-reversal, not silent addition.
TRIAL STATE (owner, 2026-05): Microsoft is built but NOT enabled — Azure
required a payment card the owner declined at trial stage. `OIDC.microsoft`
stays "" ⇒ the button never renders; GOOGLE is the only live provider. Honest
user copy is "Sign in with Google (any Google/Workspace account, not only
@gmail.com); more providers may come later" — do NOT write "Gmail only" (false:
Workspace business addresses also work) and do NOT advertise Microsoft until its
client id is actually set. Multi-provider code stays as-is (dormant, harmless).
IDENTITY NOW MANDATORY (explicit owner decision, 2026-05 — REVERSES the earlier
"signing is NEVER hard-blocked / honest self-attested fallback" stance above;
that wording is now obsolete, do not act on it). Live signing is GATED: a party
must confirm with a configured provider (Google) or there is NO signing — the
ONLY alternative is Print / sign on paper. Consequences enforced in app.js:
the manual email input is GONE (no `dEmail`/`sEmail`); the recorded email is
SOLELY the provider-verified one; `sendForSigning()` and `doSign()` hard-block
unless `myIdentity.email` is set, directing the user to confirm or print; the
live-signing gate (`renderSessionStart`) and `identityRowHtml` state "required,
no self-attested option, else print"; if `!oidcConfigured()` live signing is
unavailable and only Print is offered (role buttons suppressed). privacy.html
updated accordingly. Do NOT reintroduce a self-attested live-signing path or a
manual email field without a new explicit owner decision. (The verify.js
self-attested branches remain only as defensive dead-code for malformed/legacy
records — normal completed certs are always provider-confirmed both sides.)
The `#pagemark` element (brand + document SHA-256 + session ref) is now
DISABLED on screen AND print by explicit owner decision (2026-05): the printed
CONTRACT must carry NO Foolscap metadata outside the user's own form — no
brand, hash, session, date or URL stamp. The element + `setPageMark()` remain
as harmless inert code (CSS `display:none !important` both media); do NOT
re-enable it in print or reintroduce any per-page/end-of-doc Foolscap stamp
without a new explicit owner decision. The document SHA-256 still lives on the
certificate page, so nothing verifiable is lost. (History: it was once a
`position:fixed` per-page footer; Firefox overlapped body text; do not
reintroduce a position:fixed page footer either.) It is NOT in
`#docCanvas`/`#sealMount`, so it never affected the document or its hash.
Renders into the contract (`.verify-record`) and prints into the PDF. Still framed as a transparency /
integrity + consent record, NOT a legal-enforceability guarantee (no attorney
review/LLC yet). Deliberately NOT built — need a server / break the locked
serverless model / would be false (require an explicit owner call): server-side
IP/geo logging or a geolocation API (the STUN-observed public IP in the cert is
now built per Option 3 above and is the ONLY IP capture — anything beyond it
still requires an owner call), Twilio SMS factor, signaling server,
session-logging DB, async
encrypted holding, sender dashboard, reminder emails, API, integrations, SSO/
SCIM, SOC2/HIPAA, bulk send, white-label, notarization referral, and any
"court-proof / E-SIGN-compliant / attorney-reviewed" wording. Do not add
silently. Owner also fed back "cut to 1 template" — this CONTRADICTS the prior
explicit "7 templates" instruction; left at 7 pending owner confirmation, not
silently deleted.

**Live signing exception (owner decision, 2026-05) — do NOT rip out.** Despite
"no collaboration / not the signing layer", the owner chose an OPT-IN,
serverless WebRTC live-signing feature: `js/p2p.js` (manual copy/paste
signaling, public STUN only, NO signaling/TURN server), wired in `app.js`,
panel in `index.html`. Drafter creates an invite; Signer pastes it; they
connect browser-to-browser; the current doc streams to the Signer who signs
live. Connection survives tab switches (no `visibilitychange` teardown) and
closes only on `pagehide`. Keep `p2p.js` DOM/storage-free.

The privacy invariant is **"Artivicolab/no server ever receives the document,
and there is no man-in-the-middle"** — P2P live signing does NOT break it. The
contract moves only when the user deliberately sends it, end-to-end, to the one
counterparty they chose (that is the point of a contract). Correct copy:
"the document never leaves your browser unless you choose to send it to your
counterparty." Do NOT frame this as a privacy concession or caveat. Accepted
limitation: no TURN, so strict/symmetric NATs may fail to connect.

## Current state

7 templates as pure data. Attribution status:

- **Statement of Work** — based on the Common Paper SOW template (CC BY 4.0,
  `/documents/statement-of-work/`); runs under a PSA; `SOW_FOOTER`.
- **Professional Services Agreement** — Common Paper PSA Standard Terms **v1.1**
  by reference (CC BY 4.0); `PSA_FOOTER`.
- **Partnership Agreement** — Common Paper Partnership Standard Terms **v1.1** by
  reference (CC BY 4.0); `PARTNER_FOOTER`.
- **AI Addendum** — Common Paper AI Addendum **v1.0** by reference, supplements a
  Primary Agreement (CC BY 4.0); `AI_FOOTER`.

Older status (still accurate for the kept docs):

- **Mutual NDA** — Cover Page on Common Paper Mutual NDA Standard Terms **v1.0**
  (verified 2026-05, CC BY 4.0), incorporated by reference; `MNDA_FOOTER`.
- **One-Way NDA** — Common Paper has NO one-way standard; this is the Common
  Paper Mutual NDA applied unilaterally via a Cover Page modification (not a
  Standard-Terms edit); `MNDA_ONEWAY_FOOTER`.
- **Independent Contractor Agreement** — still hand-written boilerplate with the
  honest `Source: PENDING` footer; NOT yet adapted from a named source or
  attorney-reviewed. Do not relabel it. (CSA + Photography/Model Release were
  removed in the 7-template scope cut.)

Engine, IndexedDB drafts, live preview, print stylesheet, picker/builder UI, the
serverless P2P live-signing flow, and the SYN/SYN-ACK/ACK verification record
work end-to-end. Six of seven templates carry true, verified CC BY 4.0
attribution; the contractor agreement remains honestly PENDING.

## Roadmap (revised, in order)

1. Done for 3 of 5 (Mutual NDA, One-Way NDA, CSA). Remaining: replace the
   Contractor Agreement and Media Release bodies with text genuinely adapted
   from a named, openly-licensed source (e.g. YC contractor/IP forms) and set
   their footer `Source:` line. Always VERIFY the source's exact name, version,
   and canonical URL (WebFetch/WebSearch) before writing an attribution — never
   fabricate a version/URL.
2. Draft **JSON export / import** for drafts (real backup independent of
   IndexedDB; still no server).
3. **Download as .docx** alongside print-to-PDF (in-browser `docx` lib — note:
   this is the one allowed runtime dependency; keep it vendored/local, no CDN).
4. One paid **attorney review pass** over the 4 templates before any real launch.
5. Disclaimer + site ToS pages; LLC + E&O before launch (liability hygiene).
6. "Continue where you left off" using the `updatedAt` index.

**Explicitly NOT on the roadmap:** jurisdiction-swap / regional-clause selection.
That crosses into the practice of law. Governing law stays a plain text field
the user types, like any other variable.

## Rebranding & domain portability (resale-ready)

- **Domain-portable already.** Every internal reference is relative (`*.html`,
  `css/style.css`, `js/*.js`). There is NO hardcoded base URL or own-domain
  absolute link anywhere — deploy under any domain with zero changes. Do not
  introduce absolute self-URLs.
- **Brand identity is centralized in `js/config.js`** (`BRAND`: app, company,
  site, split contact email). The running app derives every brand string it
  generates from there — certificate "Generated by …", contact mailto,
  per-page mark. `js/verify.js` stays pure and takes `brand` as a param.
- **Not auto-branded (by design):** static prose in `index.html`,
  `privacy.html`, `terms.html`, `about.html`, `verify.html` (manifesto, policy
  text, page copy) names the brand as *content*; a buyer edits those by hand.
  Don't add a build/templating step to "fix" this — no-build rule stands.
- **Must NOT be rebranded:** the Common Paper CC BY 4.0 attribution + links in
  `js/templates.js` footers (license requirement), and external URLs
  (commonpaper.com, creativecommons.org, Google).

## Working conventions

- Match the existing terse, comment-headed style of each module.
- No dependencies, no bundler, no transpile. If a change needs a build step,
  it's the wrong change.
- Test by serving locally and exercising: pick → fill → preview updates → print
  preview is clean → save draft → reload draft → delete draft.
