#!/bin/sh
# Container entrypoint (baked into the image as CMD — no startCommand needed).
# Caddy serves static files + /health + reverse-proxies /jwks to the helper.
set -eu

# Railway runtime-injects PORT; the Caddyfile default ({$PORT:8080}) matches this.
: "${PORT:=8080}"
export PORT

# JWKS proxy helper (default OFF; also bound to 127.0.0.1 only). Watchdog loop
# keeps it alive; Caddy runs as PID1 so a Caddy crash restarts the container.
(
  while :; do
    node /app/jwks-proxy.mjs || true
    sleep 1
  done
) &

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
