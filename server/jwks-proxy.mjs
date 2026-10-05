#!/usr/bin/env node
/**
 * JWKS proxy — zero-dependency Node helper (node:http / node:https / node:dns only).
 *
 * GET /jwks?url=<percent-encoded JWKS URL>
 *   -> fetches the JWKS from a public host and relays the JSON body so the browser
 *      can verify the JWT locally. The proxy never sees tokens, only JWKS URLs.
 *
 * Disabled unless JWKS_PROXY_ENABLED === "true" (default: OFF — always answer 403).
 *
 * SSRF guard, in order:
 *   1. Scheme allowlist: http/https only.
 *   2. Resolve the hostname (ALL addresses, IPv4 + IPv6) and classify every one of
 *      them against a blocklist BEFORE connecting: loopback, RFC1918 private,
 *      CGNAT 100.64/10, link-local 169.254/16 (includes cloud metadata
 *      169.254.169.254), ULA fc00::/7, benchmark 198.18/15, multicast/reserved
 *      ranges, plus IPv6 ::, ::1, fe80::/10, fc00::/7 and IPv4-mapped/NAT64/6to4
 *      embedded IPv4 (unwrapped and re-checked).
 *   3. Connect to the vetted IP address directly (SNI + Host header still use the
 *      original hostname, so TLS certificate validation is unaffected) — this pins
 *      the connection to the address that was checked, defeating DNS rebinding.
 *   4. Redirects are followed manually (max 3) and each hop re-runs the full guard.
 *   5. 5 s timeout, 512 KB response cap, response must be valid JSON, GET only.
 */

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns/promises';

const PORT = Number(process.env.JWKS_PROXY_PORT || 8081);
const HOST = '127.0.0.1';
const ENABLED = process.env.JWKS_PROXY_ENABLED === 'true';
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

class HttpError extends Error {
  constructor(status, code, message, blocked = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.blocked = blocked;
  }
}

// ---------------------------------------------------------------- IPv4 guard

const v4ToInt = (s) => {
  const p = s.split('.').map(Number);
  return (((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0);
};

/** true if ip is inside base/bits (IPv4 CIDR). */
function in4(ip, base, bits) {
  const xor = (v4ToInt(ip) ^ v4ToInt(base)) >>> 0;
  return xor < 2 ** (32 - bits);
}

const V4_BLOCKS = [
  ['0.0.0.0', 8],        // "this network"
  ['10.0.0.0', 8],       // RFC1918 private
  ['100.64.0.0', 10],    // CGNAT (RFC6598)
  ['127.0.0.0', 8],      // loopback
  ['169.254.0.0', 16],   // link-local (includes cloud metadata 169.254.169.254)
  ['172.16.0.0', 12],    // RFC1918 private
  ['192.0.0.0', 24],     // IETF protocol assignments
  ['192.0.2.0', 24],     // TEST-NET-1
  ['192.168.0.0', 16],   // RFC1918 private
  ['198.18.0.0', 15],    // benchmarking
  ['198.51.100.0', 24],  // TEST-NET-2
  ['203.0.113.0', 24],   // TEST-NET-3
  ['224.0.0.0', 4],      // multicast
  ['240.0.0.0', 4],      // reserved / broadcast
];

function ip4Blocked(ip) {
  return V4_BLOCKS.some(([base, bits]) => in4(ip, base, bits));
}

// ---------------------------------------------------------------- IPv6 guard

function expand6(ip) {
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const filler = Array(Math.max(0, 8 - h.length - t.length)).fill('0');
  return [...h, ...filler, ...t].map((g) => parseInt(g || '0', 16));
}

/** Unwrap IPv4 embedded in IPv6 (mapped ::ffff:0:0/96, NAT64 64:ff9b::/96, 6to4 2002::/16). */
function embeddedIpv4(groups) {
  const isMapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  const isNat64 = groups[0] === 0x0064 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0);
  const is6to4 = groups[0] === 0x2002;
  if (!isMapped && !isNat64 && !is6to4) return null;
  const b = [];
  if (is6to4) {
    b.push((groups[1] >> 8) & 0xff, groups[1] & 0xff, (groups[2] >> 8) & 0xff, groups[2] & 0xff);
  } else {
    b.push((groups[6] >> 8) & 0xff, groups[6] & 0xff, (groups[7] >> 8) & 0xff, groups[7] & 0xff);
  }
  return b.join('.');
}

function ip6Blocked(ip) {
  const groups = expand6(ip);
  const embedded = embeddedIpv4(groups);
  if (embedded) return ip4Blocked(embedded);
  const g0 = groups[0];
  if ((g0 & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g0 & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  const isGlobalUnicast = (g0 & 0xe000) === 0x2000; // 2000::/3
  return !isGlobalUnicast; // deny ::, ::1, documentation ranges, multicast, reserved…
}

function addressBlocked(ip) {
  const clean = ip.replace(/%.*$/, ''); // strip IPv6 zone id
  if (net.isIPv4(clean)) return ip4Blocked(clean);
  if (net.isIPv6(clean)) return ip6Blocked(clean);
  return true; // unknown -> deny
}

// ------------------------------------------------------------ resolve + fetch

async function resolveHost(hostname) {
  // WHATWG URL keeps brackets on IPv6 literals ("[::1]") — strip them for isIP/lookup.
  const h = hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (net.isIP(h)) return [h];
  const records = await dns.lookup(h, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

/** Full SSRF guard for a URL: scheme allowlist + resolve-all + classify. Returns vetted addresses. */
async function assertSafeRemote(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(403, 'blocked_scheme', `Only http and https are allowed (got "${url.protocol.replace(/:$/, '')}").`, true);
  }
  if (url.username || url.password) {
    throw new HttpError(403, 'blocked_url', 'URLs with embedded credentials are not allowed.', true);
  }
  let addresses;
  try {
    addresses = await resolveHost(url.hostname);
  } catch {
    throw new HttpError(502, 'resolve_failed', `Could not resolve host "${url.hostname}".`);
  }
  if (addresses.length === 0) {
    throw new HttpError(502, 'resolve_failed', `Could not resolve host "${url.hostname}".`);
  }
  const blocked = addresses.filter((a) => addressBlocked(a));
  if (blocked.length > 0) {
    throw new HttpError(403, 'blocked_host', `Refused: "${url.hostname}" resolves to a non-public address (${blocked[0]}).`, true);
  }
  return addresses;
}

/** GET the URL by connecting to the pre-vetted IP; SNI/Host stay the original hostname. */
function fetchPinned(url, address, redirects = 0) {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;
    const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
    const req = transport.request(
      {
        host: address,
        port,
        path: url.pathname + url.search,
        method: 'GET',
        servername: isHttps ? url.hostname : undefined,
        headers: {
          host: url.host,
          accept: 'application/json',
          'user-agent': 'jwt-debugger-jwks-proxy/1.0',
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if ([301, 302, 307, 308].includes(status) && res.headers.location) {
          res.resume(); // drain
          if (redirects >= MAX_REDIRECTS) {
            reject(new HttpError(502, 'too_many_redirects', `More than ${MAX_REDIRECTS} redirects.`));
            return;
          }
          let next;
          try {
            next = new URL(res.headers.location, url);
          } catch {
            reject(new HttpError(502, 'bad_redirect', 'Upstream sent an invalid redirect location.'));
            return;
          }
          assertSafeRemote(next)
            .then((safe) => fetchPinned(next, safe[0], redirects + 1))
            .then(resolve, reject);
          return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new HttpError(502, 'too_large', 'JWKS response exceeds the 512 KB limit.'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => {
          if (status !== 200) {
            reject(new HttpError(502, 'upstream_status', `Upstream returned HTTP ${status}.`));
            return;
          }
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
        res.on('error', (e) => reject(new HttpError(502, 'upstream_error', e.message)));
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new HttpError(502, 'timeout', 'Upstream did not respond within 5 s.'));
    });
    req.on('error', (e) => reject(new HttpError(502, 'upstream_error', e.message)));
    req.end();
  });
}

// ------------------------------------------------------------------- server

const server = http.createServer(async (req, res) => {
  const send = (status, obj) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify(obj));
  };
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/jwks') {
      send(404, { error: 'not_found', message: 'Only /jwks is served by this helper.' });
      return;
    }
    if (!ENABLED) {
      send(403, {
        error: 'jwks_proxy_disabled',
        message: 'The JWKS proxy is disabled on this deployment. Set the environment variable JWKS_PROXY_ENABLED=true to enable it.',
      });
      return;
    }
    if (req.method !== 'GET') {
      send(405, { error: 'method_not_allowed', message: 'Only GET is supported.' });
      return;
    }
    const target = url.searchParams.get('url');
    if (!target) {
      send(400, { error: 'missing_url', message: 'Provide ?url=<encoded JWKS URL>.' });
      return;
    }
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      send(400, { error: 'bad_url', message: 'The url parameter is not a valid URL.' });
      return;
    }
    const safe = await assertSafeRemote(parsed);
    const body = await fetchPinned(parsed, safe[0]);
    let json;
    try {
      json = JSON.parse(body);
    } catch {
      send(502, { error: 'not_json', message: 'Upstream response was not valid JSON.' });
      return;
    }
    send(200, json);
  } catch (e) {
    if (e instanceof HttpError) send(e.status, { error: e.code, message: e.message });
    else send(500, { error: 'internal', message: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[jwks-proxy] listening on http://${HOST}:${PORT} (enabled=${ENABLED})`);
});
