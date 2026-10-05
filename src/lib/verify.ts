import { createLocalJWKSet, errors, importJWK, importSPKI, jwtVerify } from 'jose';
import { decodeToken } from './decode';

export type VerifyStatus =
  | 'verified'
  | 'invalid-signature'
  | 'claims-failed'
  | 'bad-key'
  | 'proxy-disabled'
  | 'error';

export interface VerifyOutcome {
  status: VerifyStatus;
  title: string;
  detail: string;
}

const VERIFIED: VerifyOutcome = {
  status: 'verified',
  title: 'Signature verified',
  detail: 'The signature matches the supplied key, and registered time claims (exp, nbf) are valid.',
};

export function outcomeFor(e: unknown): VerifyOutcome {
  if (e instanceof errors.JWSSignatureVerificationFailed) {
    return {
      status: 'invalid-signature',
      title: 'Invalid signature',
      detail: 'The signature does not match the supplied key — the token was modified, or was signed with a different key.',
    };
  }
  if (e instanceof errors.JWTExpired) {
    return {
      status: 'claims-failed',
      title: 'Signature valid — token expired',
      detail: 'The signature checks out, but the exp claim has passed, so jose rejects the token.',
    };
  }
  if (e instanceof errors.JWTClaimValidationFailed) {
    const err = e as unknown as { claim?: unknown; reason?: unknown };
    return {
      status: 'claims-failed',
      title: `Signature valid — claim "${String(err.claim)}" failed`,
      detail: String(err.reason ?? 'Registered-claim validation failed.'),
    };
  }
  if (e instanceof errors.JWTInvalid) {
    const msg = e.message || 'Token is invalid.';
    if (/signature|verify/i.test(msg)) {
      return { status: 'invalid-signature', title: 'Invalid signature', detail: msg };
    }
    return { status: 'claims-failed', title: 'Token rejected', detail: msg };
  }
  if (e instanceof errors.JWSInvalid) {
    const msg = e.message || 'Malformed JWS.';
    return /signature/i.test(msg)
      ? { status: 'invalid-signature', title: 'Invalid signature', detail: msg }
      : { status: 'error', title: 'Malformed token', detail: msg };
  }
  if (e instanceof Error) {
    return { status: 'error', title: 'Verification problem', detail: e.message };
  }
  return { status: 'error', title: 'Verification problem', detail: String(e) };
}

function notHmac(alg: string): VerifyOutcome {
  return {
    status: 'error',
    title: 'Not an HMAC token',
    detail: `Token alg is ${alg || 'unknown'} — shared-secret verification needs HS256/HS384/HS512. Switch the key type for RS/ES/PS tokens.`,
  };
}

function isHmac(alg: string): boolean {
  return alg.startsWith('HS');
}

export async function verifyWithSecret(token: string, secret: string): Promise<VerifyOutcome | null> {
  const t = token.trim();
  if (!t || !secret) return null;
  const dec = decodeToken(t);
  if (!dec.ok) return null;
  const alg = String(dec.token.header.alg ?? '');
  if (!isHmac(alg)) return notHmac(alg);
  try {
    await jwtVerify(t, new TextEncoder().encode(secret));
    return VERIFIED;
  } catch (e) {
    return outcomeFor(e);
  }
}

export async function verifyWithKeyMaterial(token: string, keyText: string): Promise<VerifyOutcome | null> {
  const t = token.trim();
  if (!t || !keyText.trim()) return null;
  const dec = decodeToken(t);
  if (!dec.ok) return null;
  const alg = String(dec.token.header.alg ?? '');
  if (isHmac(alg)) {
    return {
      status: 'error',
      title: 'HMAC token',
      detail: 'This token is signed with a shared secret — switch the key type to "Shared secret".',
    };
  }
  let key: CryptoKey | Uint8Array;
  try {
    key = keyText.trimStart().startsWith('-----')
      ? await importSPKI(keyText, alg)
      : await importJWK(JSON.parse(keyText) as Record<string, unknown>, alg);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: 'bad-key',
      title: 'Key rejected',
      detail: `Could not import the key for ${alg}. Provide a PEM in SPKI form (-----BEGIN PUBLIC KEY-----) or a JWK JSON object. (${msg})`,
    };
  }
  try {
    await jwtVerify(t, key);
    return VERIFIED;
  } catch (e) {
    return outcomeFor(e);
  }
}

export async function verifyWithJwksUrl(token: string, jwksUrl: string): Promise<VerifyOutcome | null> {
  const t = token.trim();
  if (!t || !jwksUrl.trim()) return null;
  let res: Response;
  try {
    res = await fetch(`/jwks?url=${encodeURIComponent(jwksUrl.trim())}`, { headers: { accept: 'application/json' } });
  } catch (e) {
    return {
      status: 'error',
      title: 'Proxy unreachable',
      detail: `Could not reach the same-origin /jwks endpoint: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (res.status === 403) {
    let msg = 'The JWKS proxy is disabled on this deployment.';
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* keep default */
    }
    return { status: 'proxy-disabled', title: 'JWKS proxy disabled', detail: msg };
  }
  if (!res.ok) {
    let detail = `The /jwks proxy returned HTTP ${res.status}.`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) detail = j.message;
    } catch {
      /* keep default */
    }
    return { status: 'error', title: 'JWKS fetch failed', detail };
  }
  let keySet: Parameters<typeof jwtVerify>[1];
  try {
    const jwks = (await res.json()) as Parameters<typeof createLocalJWKSet>[0];
    keySet = createLocalJWKSet(jwks);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { status: 'error', title: 'Invalid JWKS', detail: 'The proxy response was not a valid JSON document.' };
    }
    return outcomeFor(e);
  }
  try {
    await jwtVerify(t, keySet);
    return VERIFIED;
  } catch (e) {
    return outcomeFor(e);
  }
}
