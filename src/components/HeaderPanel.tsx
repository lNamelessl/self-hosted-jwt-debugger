import { useState } from 'react';
import ClaimChip from './ClaimChip';
import type { DecodedToken } from '../lib/decode';

function renderValue(v: unknown): string {
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
  return String(v);
}

export default function HeaderPanel({ token }: { token: DecodedToken }) {
  const [raw, setRaw] = useState(false);
  const { header, signature } = token;
  return (
    <section className="card">
      <div className="card-head">
        <h2>Header</h2>
        <button className="ghost small" onClick={() => setRaw(!raw)}>
          {raw ? 'Pretty' : 'Raw JSON'}
        </button>
      </div>
      {raw ? (
        <pre className="mono json">{JSON.stringify(header, null, 2)}</pre>
      ) : (
        <dl className="claims">
          {Object.entries(header).map(([k, v]) => (
            <div className="claim-row" key={k}>
              <dt>
                <ClaimChip name={k} />
              </dt>
              <dd className="mono">
                {k === 'alg' ? <span className="alg-badge">{String(v)}</span> : renderValue(v)}
              </dd>
            </div>
          ))}
          {String(header.alg ?? '') !== 'none' && signature !== '' && (
            <div className="claim-row">
              <dt>
                <span className="chip muted-chip">signature</span>
              </dt>
              <dd className="mono muted truncate" title={signature}>
                {signature.slice(0, 18)}…{signature.slice(-10)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
