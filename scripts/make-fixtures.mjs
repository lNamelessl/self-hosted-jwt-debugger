#!/usr/bin/env node
/**
 * Generates test tokens for the acceptance battery, signed at runtime with freshly
 * generated keys (nothing secret is committed). Writes fixtures/tokens.json + prints it.
 * Offsets are relative to "now" so expiry badges can be asserted exactly:
 *   hs256_expired        exp = now - 3600   -> red "expired"
 *   hs256_expiring_soon  exp = now + 30     -> amber "expiring soon" (ticks down live)
 *   hs256_valid          exp = now + 3600   -> green "valid"
 *   hs256_not_yet_valid  nbf = now + 3600   -> "not yet valid"
 *   hs256_tampered       valid token, signature's last char flipped -> must FAIL verification
 *   hs256_wrong_secret   signed with a different secret             -> must FAIL verification
 *   alg_none             unsigned token                             -> warning, cannot verify
 *   rs256 / es256        fresh keypairs, PEM public keys exported   -> verify via pasted key
 */
import { SignJWT, exportSPKI } from 'jose';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const enc = new TextEncoder();
const SECRET = enc.encode('demo-secret');
const OTHER = enc.encode('some-other-secret');
const now = Math.floor(Date.now() / 1000);

const claims = (over = {}) => ({
  iss: 'https://id.example.com',
  sub: 'user-123',
  aud: ['api://widgets', 'api://admin'],
  azp: 'client-abc',
  scope: 'openid profile email read:widgets',
  jti: `fix-${Math.random().toString(36).slice(2, 10)}`,
  ...over,
});

const hs = async (over, secret = SECRET, iatOver) => {
  const { exp, nbf, ...rest } = over;
  let b = new SignJWT(claims(rest)).setProtectedHeader({ alg: 'HS256', typ: 'JWT' });
  if (exp !== undefined) b = b.setExpirationTime(exp);
  if (nbf !== undefined) b = b.setNotBefore(nbf);
  b = b.setIssuedAt(iatOver ?? rest.iat ?? now - 60);
  return b.sign(secret);
};

const flipLastChar = (t) => {
  const parts = t.split('.');
  const last = parts[2];
  const ch = last[last.length - 1];
  parts[2] = last.slice(0, -1) + (ch === 'A' ? 'B' : 'A');
  return parts.join('.');
};

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

// RSA + EC keypairs, generated fresh on every run.
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const rsaPub = rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const ecPub = ec.publicKey.export({ type: 'spki', format: 'pem' }).toString();

const signRsa = (alg) =>
  new SignJWT(claims({})).setProtectedHeader({ alg, typ: 'JWT' }).setIssuedAt(now - 60).setExpirationTime(now + 3600).sign(rsa.privateKey);
const signEc = () =>
  new SignJWT(claims({})).setProtectedHeader({ alg: 'ES256', typ: 'JWT' }).setIssuedAt(now - 60).setExpirationTime(now + 3600).sign(ec.privateKey);

const hs256_valid = await hs({ exp: now + 3600 });
const hs256_wrong_secret = await hs({ exp: now + 3600 }, OTHER);
const alg_none = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims({ exp: now + 3600 }))}.`;

const fixtures = {
  generatedAt: new Date().toISOString(),
  now,
  secret: 'demo-secret',
  wrongSecret: 'some-other-secret',
  hs256_valid,
  hs256_expired: await hs({ exp: now - 3600 }, SECRET, now - 7200),
  hs256_expiring_soon: await hs({ exp: now + 30 }),
  hs256_not_yet_valid: await hs({ exp: now + 7200, nbf: now + 3600 }),
  hs256_tampered: flipLastChar(hs256_valid),
  hs256_wrong_secret,
  alg_none,
  rs256: await signRsa('RS256'),
  rs256_public_key_pem: rsaPub,
  es256: await signEc(),
  es256_public_key_pem: ecPub,
};

mkdirSync(new URL('../fixtures', import.meta.url), { recursive: true });
const out = new URL('../fixtures/tokens.json', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:');
writeFileSync(out, JSON.stringify(fixtures, null, 2) + '\n');
console.log(JSON.stringify(fixtures, null, 2));
console.error(`\nwritten to ${out}`);
