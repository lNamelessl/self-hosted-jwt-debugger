const PREFIX = '#/token=';

/** Token currently embedded in the location hash, or ''. */
export function readTokenFromLocation(): string {
  const h = window.location.hash;
  if (!h.startsWith(PREFIX)) return '';
  try {
    return decodeURIComponent(h.slice(PREFIX.length));
  } catch {
    return h.slice(PREFIX.length);
  }
}

export function hasTokenInHash(): boolean {
  return window.location.hash.startsWith(PREFIX);
}

/** Keep the URL hash in sync with the token (replaceState — no history spam).
 *  The #fragment is never sent to the server, which is what keeps this shareable
 *  link from leaking the token in HTTP traffic; it IS visible to anyone who gets
 *  the URL, which is why the UI shows a privacy warning. */
export function syncTokenToLocation(token: string): void {
  const next = token
    ? `${window.location.pathname}${window.location.search}${PREFIX}${encodeURIComponent(token)}`
    : `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', next);
}

export function buildShareUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}${window.location.search}${PREFIX}${encodeURIComponent(token)}`;
}
