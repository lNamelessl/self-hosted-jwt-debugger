jwt.io for your team — self-hosted. Paste a JSON Web Token and inspect its header and
payload, watch live expiry countdowns, and verify signatures: HS256 with a shared secret,
RS256/ES256 with a pasted public key. Everything runs in your browser via WebCrypto, so
tokens never leave your deployment. No accounts, no analytics, no external requests — the
served Content-Security-Policy (`connect-src 'self'`) enforces that in the browser itself.

**What you get**

- Decode header + payload (pretty and raw JSON views) with claim-dictionary tooltips for iss, sub, aud, azp, scope, kid, amr and more
- In-browser signature verification: HS256/384/512 secrets; RS256/384/512, PS256/384/512, ES256/384/512 via pasted PEM or JWK; RS* via JWKS URL; tampered tokens visibly fail
- Live time badges — exp countdown (expired / expiring-soon / valid, ticking every second), nbf not-yet-valid, iat age, absolute UTC times
- Batch decode (one token per line) with per-token expiry status and optional bulk HS* verification
- Shareable `#/token=…` links (fragment never sent to the server) with an explicit privacy warning
- Dark/light theme, offline after first load

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/jwt-debugger)

This template provisions one web service built from the public GitHub repo. There are no
deploy-form variables: Railway injects `PORT` at runtime and the container binds to it.
After deploy, open your Railway domain and paste a token — decoding works immediately;
signature verification is opt-in per token (add a secret or public key in the UI).

# Deploy and Host

## About Hosting

Hosting runs a single stateless web service: a React (Vite) single-page app served by Caddy
inside a compact Alpine container. The image is self-sufficient — it listens on the
Railway-injected `PORT`, exposes `GET /health` (200) for the Railway healthcheck, and
restarts on failure (ON_FAILURE, max 10 retries). No database, no volumes, no background
workers. The only optional service variable is `JWKS_PROXY_ENABLED`: unset or `false` (the
default) keeps the same-origin `/jwks` proxy disabled (it answers 403); set it to `true` to
let the app verify RS256 tokens against a JWKS URL of an identity provider that doesn't
send CORS headers. The proxy is SSRF-hardened (http/https only; every resolved address is
checked against loopback, RFC1918, CGNAT 100.64/10, link-local 169.254/16 — which covers
cloud metadata 169.254.169.254 — and ULA fc00::/7 before any connection; redirects are
re-checked per hop; responses are capped at 512 KB) and relays only JWKS JSON — signature
verification always happens in the visitor's browser.

## Why Deploy

jwt.io's debugger is closed source and every paste happens on a third-party page; terminal
tools (jwt-cli, jwt-ui) don't help non-developers. This template gives your team a private
jwt.io equivalent in one click: tokens are pasted into your own deployment, are never sent
to the server or anywhere else, and the browser-enforced CSP proves it. Zero configuration,
zero required variables, negligible resource usage — the whole service is a static site
plus ~230 lines of optional proxy code.

## Common Use Cases

- Debugging OIDC/OAuth access and ID tokens during app development (inspect claims, scopes, aud, azp)
- Checking whether a token is expired or about to expire without running jq in a terminal
- Verifying that a token a customer pasted into a support ticket is genuine and correctly signed (paste your public key or JWKS URL)
- Triaging a list of leaked or suspicious tokens in batch mode (one per line)
- Sharing a suspicious token with a teammate via a `#/token=` link without any token ever touching a third-party site

## Dependencies for

### Deployment Dependencies

None. The template deploys one container with everything baked in — Caddy (from the
official digest-pinned image) serves the static app and the health endpoint; Node runs the
optional JWKS helper. There is no database, no external API dependency, and no build-time
or runtime service to provision. With `JWKS_PROXY_ENABLED=true` (optional), the container
fetches the JWKS URL you paste from the public internet on your behalf.
