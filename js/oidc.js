// Federated identity confirmation via OpenID Connect, done ENTIRELY in the
// browser. NO server of ours: the popup talks directly to the provider, the
// provider returns a signed ID token, and we verify that token's signature
// client-side against the provider's PUBLIC JWKS — the same "public service,
// not our infrastructure" pattern as the STUN server and GA already in this
// codebase. The document is never sent anywhere; the provider only observes a
// sign-in event, exactly like an email/SMS provider delivering an OTP.
//
// Multi-provider. Only providers that work in a pure static, no-backend,
// implicit-`id_token` flow are here: GOOGLE and MICROSOFT. Apple (needs
// response_mode=form_post → a server) and Yahoo/AOL (confidential client secret
// → a server) are intentionally absent; adding them is a separate owner-level
// "we now run a server" decision, not a code gap.
//
// Boundary (mirrors p2p.js): browser APIs it cannot avoid (window.open,
// postMessage, fetch, Web Crypto) but NO DOM elements and NO storage. app.js
// does all wiring. Keep it that way.
//
// Why this defeats "one person signs both sides": you cannot mint a
// provider-signed token for an email you do not control; the token is bound to
// the shared session via `nonce`, and the OTHER party's browser re-verifies the
// signature against the provider's published keys.

import { OIDC } from "./config.js";

const SKEW = 300; // seconds of allowed clock skew on exp

function err(m) {
  return new Error(m);
}

// --- Provider registry ----------------------------------------------------
// verify(claims, clientId) returns the confirmed email or throws. Generic
// checks (signature, exp, nonce) are done by verifyIdToken; this only does the
// provider-specific issuer/audience/email rules.
const PROVIDERS = {
  google: {
    label: "Google",
    clientId: () => OIDC.google,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
    scope: "openid email",
    extra: {},
    verify(c, clientId) {
      if (!["https://accounts.google.com", "accounts.google.com"].includes(c.iss))
        throw err("Wrong token issuer.");
      if (c.aud !== clientId) throw err("Token not for this app.");
      if (c.email_verified !== true && c.email_verified !== "true")
        throw err("Google has not verified that email address.");
      if (!c.email) throw err("Token carries no email.");
      return c.email;
    },
  },
  microsoft: {
    label: "Microsoft",
    clientId: () => OIDC.microsoft,
    // /common ⇒ personal Outlook/Hotmail/Live AND work/school accounts.
    authUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    jwks: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    scope: "openid email profile",
    extra: { response_mode: "fragment" },
    verify(c, clientId) {
      if (c.aud !== clientId) throw err("Token not for this app.");
      // Multi-tenant: the issuer is tenant-scoped; it must be the v2.0 issuer
      // for the exact tenant id (`tid`) embedded in this token.
      if (!c.tid || c.iss !== `https://login.microsoftonline.com/${c.tid}/v2.0`)
        throw err("Wrong token issuer.");
      // Microsoft v2.0 personal accounts often carry the address in
      // preferred_username rather than email; accept either.
      const email =
        c.email ||
        (c.preferred_username && /@/.test(c.preferred_username)
          ? c.preferred_username
          : "");
      if (!email) throw err("Token carries no email.");
      return email;
    },
  },
};

export function providerLabel(id) {
  return (PROVIDERS[id] && PROVIDERS[id].label) || id || "provider";
}

// Providers the deployer has actually configured a client id for.
export function configuredProviders() {
  return Object.keys(PROVIDERS)
    .filter((id) => !!PROVIDERS[id].clientId())
    .map((id) => ({ id, label: PROVIDERS[id].label }));
}

export function oidcConfigured() {
  return configuredProviders().length > 0;
}

// Where the provider sends the browser back. Must be registered as an
// authorized redirect URI on EACH provider's app. Same-origin static page.
function redirectUri() {
  return (
    location.origin +
    location.pathname.replace(/[^/]*$/, "") +
    "oauth.html"
  );
}

function b64urlToBytes(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJSON(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

function randomState() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Per-JWKS-URL key cache (providers rotate keys infrequently).
const jwksCache = {}; // url -> { at, keys }
async function signingKey(jwksUrl, kid) {
  const c = jwksCache[jwksUrl];
  const fresh = c && c.keys && Date.now() - c.at < 3600e3;
  if (!fresh) {
    const r = await fetch(jwksUrl, { cache: "no-store" });
    if (!r.ok) throw err("Could not fetch provider signing keys.");
    jwksCache[jwksUrl] = { at: Date.now(), keys: (await r.json()).keys || [] };
  }
  let jwk = jwksCache[jwksUrl].keys.find((k) => k.kid === kid);
  if (!jwk) {
    // kid absent → force one refresh in case keys just rotated.
    const r = await fetch(jwksUrl, { cache: "no-store" });
    if (r.ok)
      jwksCache[jwksUrl] = { at: Date.now(), keys: (await r.json()).keys || [] };
    jwk = jwksCache[jwksUrl].keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw err("Unknown provider signing key.");
  return crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

// Verify a provider ID token fully client-side. Returns { email, iat } on
// success, throws with a human-readable reason otherwise. `nonce` MUST equal
// the shared session id — that binds the token to THIS signing session and
// stops a token minted elsewhere/earlier from being replayed.
export async function verifyIdToken(providerId, idToken, { nonce }) {
  const P = PROVIDERS[providerId];
  if (!P) throw err("Unknown identity provider.");
  const clientId = P.clientId();
  if (!clientId) throw err("Identity provider not enabled.");
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw err("Malformed identity token.");
  const header = b64urlToJSON(parts[0]);
  if (header.alg !== "RS256") throw err("Unexpected token algorithm.");
  const key = await signingKey(P.jwks, header.kid);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!ok) throw err("Token signature is not valid (not from the provider).");
  const c = b64urlToJSON(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (typeof c.exp !== "number" || c.exp + SKEW < now)
    throw err("Identity token has expired.");
  if (String(c.nonce) !== String(nonce))
    throw err("Token is not bound to this signing session.");
  const email = P.verify(c, clientId);
  return { email, iat: c.iat };
}

// Open the provider's sign-in popup, receive the signed ID token, verify it
// locally, and return { provider, idToken, email, iatISO }. `nonce` is the
// shared session id. Rejects on cancel, popup-block, timeout, or bad token.
export function signIn(providerId, nonce) {
  return new Promise((resolve, reject) => {
    const P = PROVIDERS[providerId];
    if (!P || !P.clientId())
      return reject(err("Identity provider not enabled."));
    const state = randomState();
    const url =
      P.authUrl +
      "?" +
      new URLSearchParams(
        Object.assign(
          {
            client_id: P.clientId(),
            redirect_uri: redirectUri(),
            response_type: "id_token",
            scope: P.scope,
            nonce: String(nonce),
            state,
            prompt: "select_account",
          },
          P.extra
        )
      ).toString();

    const w = 480;
    const h = 640;
    const left = Math.max(0, (screen.width - w) / 2);
    const top = Math.max(0, (screen.height - h) / 2);
    const popup = window.open(
      url,
      "foolscap_oidc",
      `width=${w},height=${h},left=${left},top=${top}`
    );
    if (!popup)
      return reject(
        err("Pop-up blocked — allow pop-ups for this site and retry.")
      );

    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMsg);
      clearInterval(closedTimer);
    };
    const onMsg = async (e) => {
      if (e.origin !== location.origin) return;
      const d = e.data;
      if (!d || d.source !== "foolscap-oidc" || d.state !== state) return;
      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {}
      if (d.error) return reject(err("Sign-in failed: " + d.error));
      try {
        const { email, iat } = await verifyIdToken(providerId, d.idToken, {
          nonce,
        });
        resolve({
          provider: providerId,
          idToken: d.idToken,
          email,
          iatISO: iat
            ? new Date(iat * 1000).toISOString()
            : new Date().toISOString(),
        });
      } catch (e2) {
        reject(e2);
      }
    };
    window.addEventListener("message", onMsg);

    const closedTimer = setInterval(() => {
      if (settled) return;
      if (popup.closed) {
        cleanup();
        reject(err("Sign-in window was closed before completing."));
      }
    }, 600);
  });
}
