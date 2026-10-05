# Multi-stage, digest-pinned (digests verified 2026-10-05 via Docker Hub API; re-pin on updates).
# Stage 2 runs on node:22-alpine (same as stage 1) because the JWKS helper is a Node script;
# the Caddy binary is copied in from the official digest-pinned caddy image — Caddy does all
# the serving ($PORT, /health, static, /jwks reverse proxy), Node only runs the tiny helper.

FROM node:22-alpine@sha256:2c752226d477b4a886378baa95b9af252be59301b725fdb0b7e15208131505a8 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine@sha256:2c752226d477b4a886378baa95b9af252be59301b725fdb0b7e15208131505a8

COPY --from=caddy:2-alpine@sha256:86d4376ad067063d998533bf06e0c78b97cc8d99cd7cc66f84393165a95a65ed /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
COPY server/jwks-proxy.mjs /app/jwks-proxy.mjs
COPY server/start.sh /app/start.sh
RUN chmod +x /usr/bin/caddy /app/start.sh

# Self-sufficient image: ENTRYPOINT cleared + shell CMD that reads $PORT at runtime.
ENTRYPOINT []
EXPOSE 8080
CMD ["sh", "/app/start.sh"]
