import { jwtDecode, type JwtHeader, type JwtPayload } from 'jwt-decode';

export interface DecodedToken {
  header: JwtHeader & Record<string, unknown>;
  payload: JwtPayload & Record<string, unknown>;
  signature: string;
}

export type DecodeResult = { ok: true; token: DecodedToken } | { ok: false; error: string };

export function decodeToken(raw: string): DecodeResult {
  const t = raw.trim();
  if (!t) return { ok: false, error: 'Paste a JWT to decode it.' };
  const parts = t.split('.');
  if (parts.length < 2 || parts.length > 3 || parts[0] === '' || parts[1] === '') {
    return { ok: false, error: `A JWT has 3 dot-separated segments (2 for unsigned tokens); got ${parts.length}.` };
  }
  try {
    const header = jwtDecode<JwtHeader & Record<string, unknown>>(t, { header: true });
    const payload = jwtDecode<JwtPayload & Record<string, unknown>>(t);
    return { ok: true, token: { header, payload, signature: parts[2] ?? '' } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Malformed token.' };
  }
}
