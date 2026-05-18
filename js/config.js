// Brand identity — single source of truth so this product can be rebranded /
// resold by editing ONE file. Nothing here is a deployment URL: the site uses
// only relative links and works under any domain unchanged. Required CC BY
// attribution to Common Paper lives in js/templates.js and must NOT be renamed.
//
// Static prose in the .html pages (manifesto, privacy, terms) also names the
// brand; a buyer edits those by hand — they are content, not config. This file
// covers every brand string the running app generates.
export const BRAND = {
  app: "Foolscap",            // product name
  company: "Artivicolab",     // operator/legal entity shown to users
  site: "https://artivicolab.com",
  // Contact address, split so it never appears as a scrapeable string anywhere.
  emailUser: "artivicolab",
  emailDomain: "gmail.com",
};

export function brandEmail() {
  return BRAND.emailUser + "@" + BRAND.emailDomain;
}

// Optional federated identity confirmation (OpenID Connect / "Sign in with
// Google"). DELIBERATE POSTURE REVERSAL (owner decision, 2026-05): the project
// previously took identity as purely self-attested with NO third party. It now
// optionally lets each party prove control of a Google-verified email so a lone
// sender cannot convincingly sign BOTH sides. This stays "no server of ours":
// the flow is browser↔Google, the signed token is verified client-side against
// Google's PUBLIC keys (same pattern as Google STUN / GA already in use). The
// document is NEVER sent to Google — Google sees only a sign-in event, exactly
// like an email/SMS provider delivering a one-time code.
//
// Each provider id below is EMPTY by default → that provider is simply absent.
// If ALL are empty the feature is gone and signing falls back to honest
// self-attestation. A deployer enables a provider by registering an app with it
// and pasting the client/application id here. NOTE (resale trade-off): every
// provider requires the redirect URI (this site's `oauth.html`) registered per
// origin, so these are the only deployment/domain-specific values in the app.
//
// Serverless-feasible providers ONLY. Apple and Yahoo/AOL are deliberately NOT
// here: Apple requires `response_mode=form_post` (a server endpoint) to release
// the email, and Yahoo/AOL requires a confidential client secret exchanged
// server-side. Both would cross the "no server of ours" line — adding them is a
// separate explicit owner decision, not a config toggle.
//
// • google    — Google OAuth 2.0 "Web application" client id (Gmail + Workspace)
// • microsoft — Azure "App registration" Application (client) ID. Add the
//   oauth.html redirect URI under the **Web** platform and enable the
//   "ID tokens" implicit grant. Use the multi-tenant /common authority so
//   personal Outlook/Hotmail/Live AND work/school accounts both work.
export const OIDC = {
  google:
    "975206052494-esgv6r87nq2rkt9mijfatadursd3sllv.apps.googleusercontent.com",
  microsoft: "",
};
