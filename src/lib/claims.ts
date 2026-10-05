export interface ClaimMeta {
  label: string;
  desc: string;
}

/** Dictionary for the standard + common OIDC/OAuth claims — powers the hover tooltips. */
export const CLAIMS: Record<string, ClaimMeta> = {
  // JOSE header
  alg: { label: 'Algorithm', desc: 'Signing algorithm used on the token, e.g. HS256 (HMAC) or RS256 (RSA).' },
  kid: { label: 'Key ID', desc: 'Hints which key in a JWKS verifies this signature.' },
  typ: { label: 'Type', desc: 'Media type of the secured content, usually JWT (or at+jwt for access tokens).' },
  cty: { label: 'Content type', desc: 'Structural type of the payload, used with nested/encrypted JWTs.' },
  crit: { label: 'Critical', desc: 'Extensions that MUST be understood and processed.' },
  jwk: { label: 'Embedded JWK', desc: 'Public key embedded in the header (self-signed tokens). Treat with caution.' },
  x5t: { label: 'X.509 thumbprint', desc: 'SHA-1 thumbprint of the X.509 certificate that signed the token.' },
  // Registered claims
  iss: { label: 'Issuer', desc: 'Principal that issued the JWT — usually an https:// URI. Your API should verify it is a trusted issuer.' },
  sub: { label: 'Subject', desc: 'Who the token is about — typically the end-user ID.' },
  aud: { label: 'Audience', desc: 'Intended recipient(s) of the token. An API must reject tokens whose aud it does not recognize.' },
  exp: { label: 'Expiration time', desc: 'Unix seconds after which the token MUST NOT be accepted.' },
  nbf: { label: 'Not before', desc: 'Unix seconds before which the token MUST NOT be accepted.' },
  iat: { label: 'Issued at', desc: 'Unix seconds when the token was issued.' },
  jti: { label: 'JWT ID', desc: 'Unique identifier for this token; useful for revocation/deny-listing and replay prevention.' },
  // OIDC / OAuth
  azp: { label: 'Authorized party', desc: 'Party the token was issued for — usually the OAuth client_id (common in Keycloak/Auth0 tokens).' },
  scope: { label: 'Scopes', desc: 'Space-separated OAuth 2.0 scopes granted to this token.' },
  nonce: { label: 'Nonce', desc: 'Value from the OIDC authentication request, binding the token to that session (replay protection).' },
  amr: { label: 'Authentication methods', desc: 'How the user authenticated — e.g. pwd, otp, mfa.' },
  acr: { label: 'Auth context class', desc: 'Authentication Context Class Reference — assurance level of the session.' },
  auth_time: { label: 'Auth time', desc: 'Unix seconds when the end-user authenticated.' },
  session_state: { label: 'Session state', desc: 'OIDC session identifier (Keycloak).' },
  sid: { label: 'Session ID', desc: 'Back-channel/logout session identifier.' },
  client_id: { label: 'Client ID', desc: 'OAuth client the token was issued to.' },
  // Profile claims
  name: { label: 'Name', desc: "End-user's full display name." },
  preferred_username: { label: 'Preferred username', desc: "Shorthand name the end-user wishes to be known by." },
  email: { label: 'Email', desc: "End-user's preferred e-mail address." },
  email_verified: { label: 'Email verified', desc: 'True if the issuer verified the e-mail address.' },
  picture: { label: 'Picture', desc: 'URL of the profile photo.' },
  updated_at: { label: 'Updated at', desc: 'Unix seconds when the profile information was last updated.' },
  roles: { label: 'Roles', desc: 'Application roles granted to the subject (common in Keycloak/.NET tokens).' },
  permissions: { label: 'Permissions', desc: 'Fine-grained permissions granted to the subject.' },
  org_id: { label: 'Organization ID', desc: 'Organization/tenant the token belongs to.' },
  ver: { label: 'Version', desc: 'Token-format version used by the issuer.' },
};

/** Standard registered claims (RFC 7519) get a slightly stronger visual hint. */
export const STANDARD_CLAIMS = new Set(['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']);
