# Self-hosted JWT Debugger

A team-oriented, self-hosted alternative to jwt.io's debugger: paste a JSON Web Token and
inspect its header/payload, watch expiry countdowns, and **verify signatures locally**.
Everything runs in your browser — **tokens never leave your deployment**.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.app/new?github_url=https://github.com/lNamelessl/self-hosted-jwt-debugger)

## Why

jwt.io's debugger is closed source, and every paste on jwt.io is a token sent to a third
party's page. jwt-cli / jwt-ui are terminal tools. This is the missing web equivalent:
a single static page plus an optional tiny proxy, deployable to Railway in one click with
**zero required configuration**.

## Features

- **Decode** header + payload (pretty and raw JSON views) — fully client-side (`jwt-decode`)
- **Signature verification, 100% in the browser** via WebCrypto (`jose`):
  - HS256/384/512 with a pasted shared secret
  - RS256/384/512, PS256/384/512, ES256/384/512 with a pasted public key (PEM/SPKI or JWK)
  - RS* via a JWKS URL — fetched through the built-in same-origin proxy, verified locally
  - Distinguishes *invalid signature* from *valid signature but expired/claims failed*
- **Live time badges** — `exp` countdown (expired / expiring-soon / valid, ticking every
  second), `nbf` not-yet-valid countdown, `iat` age, absolute UTC times
- **Claim dictionary tooltips** — hover any standard/OIDC claim (`iss`, `sub`, `aud`, `azp`,
  `scope`, `kid`, `amr`, …) for an explanation
- **Batch decode** — one token per line, per-token expiry badges, optional bulk HS* checking
- **Shareable links** — token stored in the `#/token=…` hash fragment (never sent to the
  server) with an explicit privacy warning
- **Dark/light/auto theme**, keyboard-accessible tooltips, sample token button

## Privacy: demonstrable, not promised

- The build fails if any fetchable external URL sneaks into the bundle
  (`scripts/check-external-refs.mjs`) — no CDNs, fonts, or analytics, offline after first load.
- The served `Content-Security-Policy` is `connect-src 'self'` (plus a strict default-src):
  the browser itself refuses any non-same-origin request.
- No accounts, no cookies, no logging of token contents; the server is Caddy serving static
  files and never receives tokens.

## Deploy (Railway)

Click the deploy button — there are **no variables to fill in**. Railway injects `PORT` at
runtime and the Caddyfile binds to it (`{$PORT:8080}` fallback for local runs).

### Optional: enable the JWKS proxy

Verifying RS* tokens against a JWKS URL normally hits your identity provider directly —
fine when it sends CORS headers, but many don't. This image ships an optional, same-origin
`GET /jwks?url=<encoded>` proxy, **disabled by default**:

- Set service variable `JWKS_PROXY_ENABLED=true` to enable it (that's the only variable the
  app understands; anything else is ignored).
- The proxy is **SSRF-hardened**: http/https only; resolves the hostname and rejects any
  loopback / RFC1918 / CGNAT (100.64/10) / link-local (169.254/16, incl. cloud metadata
  169.254.169.254) / ULA (fc00::/7) / reserved address **before** connecting; connects to the
  vetted IP with TLS SNI + Host pinned to the original hostname (defeats DNS rebinding);
  follows max 3 redirects re-checking each; 5 s timeout; 512 KB cap; JSON only; GET only;
  bound to 127.0.0.1 so it is reachable only through Caddy.

The proxy only relays JWKS JSON — tokens are still verified client-side.

## Running locally

```bash
npm install
npm run build
npm run preview            # UI only (no /health, /jwks routes)

# or the real thing:
docker build -t jwt-debugger .
docker run -p 8080:8080 jwt-debugger   # no env needed; /health -> 200
curl -i http://localhost:8080/health

# with the proxy enabled:
docker run -p 8080:8080 -e JWKS_PROXY_ENABLED=true jwt-debugger
curl -i 'http://localhost:8080/jwks?url=https%3A%2F%2Fwww.googleapis.com%2Foauth2%2Fv3%2Fcerts'
curl -i 'http://localhost:8080/jwks?url=http%3A%2F%2F169.254.169.254%2F'   # -> 403 blocked_host
```

## Dev helpers

- `npm run fixtures` — generates fresh test tokens (`fixtures/tokens.json`, gitignored):
  valid / expired / expiring-soon / not-yet-valid / tampered / wrong-secret / alg=none /
  RS256 / ES256 with freshly generated keys. Nothing secret is committed.
- `npm run build` — includes `tsc --noEmit` and the external-reference gate.

## Stack

React 19 + Vite 8 + TypeScript; `jwt-decode` 4 for display, `jose` 6 for all crypto
(native WebCrypto — no server crypto). Served by Caddy (binary from the official digest-pinned
`caddy:2-alpine` image) inside a `node:22-alpine` (digest-pinned) runtime that also runs the
~230-line zero-dependency JWKS helper. Image listens on injected `$PORT`; `GET /health` → 200.

## Layout

```
src/            React app (decode/verify/time/batch/share/theme)
server/         jwks-proxy.mjs (SSRF guard) + start.sh (supervision)
Caddyfile       routes: /health, /jwks, static; strict CSP; {$PORT} binding
Dockerfile      multi-stage, digest-pinned
scripts/        check-external-refs.mjs, make-fixtures.mjs
railway.json    Dockerfile builder, /health healthcheck, ON_FAILURE restart
```
