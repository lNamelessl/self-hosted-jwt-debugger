import { useState } from 'react';
import ClaimChip from './ClaimChip';
import type { JwtPayload } from 'jwt-decode';
import { expState, fmtDuration, fmtUtc } from '../lib/time';

const ORDER = [
  'iss', 'sub', 'aud', 'azp', 'exp', 'nbf', 'iat', 'jti', 'scope',
  'client_id', 'sid', 'session_state', 'amr', 'acr', 'auth_time', 'nonce',
  'name', 'preferred_username', 'email', 'email_verified', 'picture',
  'roles', 'permissions', 'org_id', 'ver', 'typ',
];

function renderValue(v: unknown): string {
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
  return String(v);
}

export default function PayloadPanel({ payload, now }: { payload: JwtPayload & Record<string, unknown>; now: number }) {
  const [raw, setRaw] = useState(false);
  const entries = Object.entries(payload).sort((a, b) => {
    const ia = ORDER.indexOf(a[0]);
    const ib = ORDER.indexOf(b[0]);
    return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib);
  });

  return (
    <section className="card">
      <div className="card-head">
        <h2>Payload</h2>
        <button className="ghost small" onClick={() => setRaw(!raw)}>
          {raw ? 'Pretty' : 'Raw JSON'}
        </button>
      </div>
      {raw ? (
        <pre className="mono json">{JSON.stringify(payload, null, 2)}</pre>
      ) : (
        <dl className="claims">
          {entries.map(([k, v]) => (
            <div className="claim-row" key={k}>
              <dt>
                <ClaimChip name={k} />
              </dt>
              <dd className="mono">
                {renderValue(v)}
                {(k === 'exp' || k === 'nbf' || k === 'iat') && typeof v === 'number' && (
                  <span className="time-hint">
                    {k === 'exp' && expState(v, now)
                      ? ` (${expState(v, now) === 'expired' ? `expired ${fmtDuration(now - v)} ago` : `${fmtDuration(Math.abs(v - now))} ${v > now ? 'left' : 'ago'})`}`
                      : ` (${fmtUtc(v)})`}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
