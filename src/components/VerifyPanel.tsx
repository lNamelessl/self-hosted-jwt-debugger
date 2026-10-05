import type { KeyMode } from '../App';
import type { VerifyOutcome } from '../lib/verify';

const MODES: { id: KeyMode; label: string; hint: string }[] = [
  {
    id: 'secret',
    label: 'Shared secret',
    hint: 'For HS256/384/512 tokens — paste the signing secret. The secret stays in your browser.',
  },
  {
    id: 'pem',
    label: 'Public key',
    hint: 'For RS256/384/512, PS*, ES256/384/512 tokens — paste a PEM (BEGIN PUBLIC KEY) or a JWK JSON object.',
  },
  {
    id: 'jwks-url',
    label: 'JWKS URL',
    hint: 'Fetched through the built-in same-origin /jwks proxy (server-side opt-in). Verification still happens locally in your browser.',
  },
];

interface Props {
  mode: KeyMode;
  onMode: (m: KeyMode) => void;
  secret: string;
  onSecret: (s: string) => void;
  keyText: string;
  onKeyText: (s: string) => void;
  jwksUrl: string;
  onJwksUrl: (s: string) => void;
  outcome: VerifyOutcome | null;
  verifying: boolean;
  hasKey: boolean;
}

export default function VerifyPanel(props: Props) {
  const { mode, onMode, secret, onSecret, keyText, onKeyText, jwksUrl, onJwksUrl, outcome, verifying, hasKey } = props;
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <section className="card">
      <div className="card-head">
        <h2>Signature check</h2>
      </div>
      <div className="mode-switch" role="group" aria-label="Key type">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => onMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="hint">{active.hint}</p>

      {mode === 'secret' && (
        <input
          type="text"
          className="mono full"
          placeholder="signing secret"
          value={secret}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onSecret(e.target.value)}
        />
      )}
      {mode === 'pem' && (
        <textarea
          className="mono full"
          rows={5}
          spellCheck={false}
          placeholder={'-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq…\n-----END PUBLIC KEY-----\n\nor a JWK: {"kty":"RSA","n":"…","e":"AQAB"}'}
          value={keyText}
          onChange={(e) => onKeyText(e.target.value)}
        />
      )}
      {mode === 'jwks-url' && (
        <input
          type="url"
          className="mono full"
          placeholder="JWKS URL, e.g. idp.example.com/.well-known/jwks.json"
          value={jwksUrl}
          spellCheck={false}
          onChange={(e) => onJwksUrl(e.target.value)}
        />
      )}

      <div className="result" data-status={outcome?.status ?? 'idle'} aria-live="polite">
        {verifying ? (
          <span className="muted">Verifying…</span>
        ) : !outcome ? (
          <span className="muted">
            {hasKey
              ? 'Waiting for a valid token…'
              : 'Signature not checked yet — supply key material above. Decoding works without a key.'}
          </span>
        ) : (
          <>
            <strong>{outcome.title}</strong>
            <p>{outcome.detail}</p>
          </>
        )}
      </div>
    </section>
  );
}
