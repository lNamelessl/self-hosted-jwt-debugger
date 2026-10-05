import { useEffect, useMemo, useState } from 'react';
import { decodeToken } from './lib/decode';
import {
  verifyWithJwksUrl,
  verifyWithKeyMaterial,
  verifyWithSecret,
  type VerifyOutcome,
} from './lib/verify';
import { useNow } from './lib/time';
import { hasTokenInHash, readTokenFromLocation, syncTokenToLocation } from './lib/shareUrl';
import { SAMPLE_SECRET, SAMPLE_TOKEN } from './lib/sample';
import HeaderPanel from './components/HeaderPanel';
import PayloadPanel from './components/PayloadPanel';
import VerifyPanel from './components/VerifyPanel';
import TimeCard from './components/TimeCard';
import BatchPanel from './components/BatchPanel';
import ShareBar from './components/ShareBar';
import ThemeToggle from './components/ThemeToggle';

export type KeyMode = 'secret' | 'pem' | 'jwks-url';

export default function App() {
  const [token, setToken] = useState<string>(() => readTokenFromLocation());
  const [keyMode, setKeyMode] = useState<KeyMode>('secret');
  const [secret, setSecret] = useState('');
  const [keyText, setKeyText] = useState('');
  const [jwksUrl, setJwksUrl] = useState('');
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const now = useNow();

  const trimmed = token.trim();
  const decoded = useMemo(() => decodeToken(trimmed), [trimmed]);

  useEffect(() => {
    syncTokenToLocation(trimmed);
  }, [trimmed]);

  // Debounced auto-verification whenever the token or key material changes.
  useEffect(() => {
    let cancelled = false;
    setOutcome(null);
    setVerifying(false);
    if (!decoded.ok) return undefined;
    const timer = setTimeout(async () => {
      setVerifying(true);
      const res =
        keyMode === 'secret'
          ? await verifyWithSecret(trimmed, secret)
          : keyMode === 'pem'
            ? await verifyWithKeyMaterial(trimmed, keyText)
            : await verifyWithJwksUrl(trimmed, jwksUrl);
      if (!cancelled) {
        setOutcome(res);
        setVerifying(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, decoded.ok, keyMode, secret, keyText, jwksUrl]);

  const loadSample = () => {
    setKeyMode('secret');
    setSecret(SAMPLE_SECRET);
    setToken(SAMPLE_TOKEN);
  };

  const hasKey =
    (keyMode === 'secret' && secret !== '') ||
    (keyMode === 'pem' && keyText.trim() !== '') ||
    (keyMode === 'jwks-url' && jwksUrl.trim() !== '');

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            JWT
          </span>
          <div>
            <h1>JWT Debugger</h1>
            <p className="tagline">
              Self-hosted &amp; 100% client-side — tokens never leave your browser.
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {hasTokenInHash() && trimmed !== '' && <ShareBar token={trimmed} onClear={() => setToken('')} />}

      <nav className="tabs" role="tablist" aria-label="Modes">
        <button role="tab" aria-selected={tab === 'single'} className={tab === 'single' ? 'active' : ''} onClick={() => setTab('single')}>
          Single token
        </button>
        <button role="tab" aria-selected={tab === 'batch'} className={tab === 'batch' ? 'active' : ''} onClick={() => setTab('batch')}>
          Batch decode
        </button>
        <div className="spacer" />
        <button className="ghost" onClick={loadSample}>
          Try a sample token
        </button>
      </nav>

      {tab === 'single' ? (
        <main className="single">
          <section className="card input-card">
            <label htmlFor="token">Token</label>
            <textarea
              id="token"
              className="mono"
              rows={5}
              value={token}
              spellCheck={false}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              onChange={(e) => setToken(e.target.value)}
            />
            <div className="input-meta">
              <span>
                {!trimmed
                  ? 'Paste a JWT above — decoding happens locally.'
                  : decoded.ok
                    ? `Decoded · alg ${String(decoded.token.header.alg)}`
                    : 'Not a valid JWT yet.'}
              </span>
              <span>{token.length} chars</span>
            </div>
            {!decoded.ok && trimmed !== '' && (
              <p className="error-text" role="alert">
                {decoded.error}
              </p>
            )}
          </section>

          {decoded.ok && (
            <div className="grid">
              <div className="col">
                <HeaderPanel token={decoded.token} />
                <PayloadPanel payload={decoded.token.payload} now={now} />
              </div>
              <div className="col">
                <TimeCard payload={decoded.token.payload} now={now} />
                <VerifyPanel
                  mode={keyMode}
                  onMode={setKeyMode}
                  secret={secret}
                  onSecret={setSecret}
                  keyText={keyText}
                  onKeyText={setKeyText}
                  jwksUrl={jwksUrl}
                  onJwksUrl={setJwksUrl}
                  outcome={outcome}
                  verifying={verifying}
                  hasKey={hasKey}
                />
              </div>
            </div>
          )}
        </main>
      ) : (
        <BatchPanel secret={secret} now={now} />
      )}

      <footer className="footer">
        <span>
          Runs entirely in your browser via WebCrypto — no analytics, no external requests, no logs of your tokens.
          Signature verification is opt-in: add a key above to check a signature.
        </span>
      </footer>
    </div>
  );
}
