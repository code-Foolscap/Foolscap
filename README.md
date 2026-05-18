# Foolscap

A private, static legal-contract builder. Pick a document type, fill the
wizard, watch the contract render live, print a clean PDF. No account, no
upload, no server — the draft never leaves the browser.

**Not legal advice.** Foolscap renders general templates for convenience.
Have important agreements reviewed by a licensed attorney.

## Run

It uses ES modules, so open it through a server (not `file://`):

```
cd foolscap
python3 -m http.server 8000
# open http://localhost:8000
```

Deploy by dropping the folder on Vercel, Netlify, or GitHub Pages.

## Structure

```
index.html      single page: document grid + two-pane builder
css/style.css    editorial styling + @media print (contract only, clean paper)
js/templates.js  document templates as JS constants (schema + boilerplate)
js/engine.js     pure {{key}} -> HTML substitution, no DOM/storage
js/storage.js    IndexedDB drafts (db "foolscap", store "drafts")
js/app.js        wiring: pick -> build form -> live preview -> save -> print
```

`engine.js` stays pure (no DOM). `templates.js` owns all legal text.
`app.js` is the only DOM/orchestration layer.

## Templates

Mutual NDA, One-Way NDA, Independent Contractor Agreement, and
Photography/Model Release — the deliberately-narrowed core four — plus a
**Cloud Service Agreement Cover Page** built on the Common Paper Cloud
Service Agreement Standard Terms v2.1 (CC BY 4.0). Adding a document is
pure data: append an entry to `DOCUMENTS` in `js/templates.js`.

The Mutual NDA, One-Way NDA, and Cloud Service Agreement are built on
Common Paper CC BY 4.0 Standard Terms (Mutual NDA v1.0, CSA v2.1),
incorporated by reference with verified attribution footers — Common
Paper's intended model: a fillable Cover Page over unmodified Standard
Terms. (Common Paper has no one-way NDA standard, so the One-Way NDA is
the Mutual NDA applied unilaterally via a stated Cover Page modification.)
The Independent Contractor Agreement and Photography/Model Release still
carry an honest `Source: PENDING` footer — not yet adapted from a named
source or attorney-reviewed.

## Roadmap

- Replace each body with text adapted from a named, openly-licensed source
  (e.g. Common Paper CC BY 4.0 NDAs) and set the footer attribution
- Draft JSON export / import (server-free backup)
- Download as .docx alongside print-to-PDF (in-browser)
- One attorney review pass before launch; disclaimer + ToS pages
- Free, permanently — no accounts, no jurisdiction-swap (governing law is
  just a text field)

## Privacy & analytics

Your documents and drafts are stored locally (IndexedDB) and never
uploaded. The website itself loads Google Analytics 4 for anonymous,
aggregate usage stats (never document content) — disclosed in
[privacy.html](privacy.html). Replace the `G-XXXXXXXXXX` placeholder in
`index.html` and `privacy.html` with the real Measurement ID before
deploying. An EU cookie-consent banner is not yet implemented (analytics
is always-on by owner decision).
