import { useEffect, useMemo, useState } from 'react';
import { decodeToken } from '../lib/decode';
import { verifyWithSecret, type VerifyStatus } from '../lib/verify';
import { expState, fmtDuration, fmtUtc } from '../lib/time';

interface Row {
  raw: string;
  ok: boolean;
  reason: string;
  alg?: string;
  sub?: string;
  exp?: number;
  sig?: VerifyStatus | null;
}

const MAX_LINES = 200;

function trunc(s: string, n = 38): string {
  return s.length > n ? `${s.slice(0, 12)}…${s.slice(-n / 2)}` : s;
}

export default function BatchPanel({ secret, now }: { secret: string; now: number }) {
  const [text, setText] = useState('');
  const [checkSigs, setCheckSigs] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const lines = useMemo(
    () =>
      text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, MAX_LINES),
    [text],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Row[] = [];
      for (const line of lines) {
        const dec = decodeToken(line);
        if (!dec.ok) {
          next.push({ raw: trunc(line), ok: false, reason: dec.error });
          continue;
        }
        const p = dec.token.payload as Record<string, unknown>;
        const row: Row = {
          raw: trunc(line),
          ok: true,
          reason: '',
          alg: String(dec.token.header.alg ?? '?'),
          sub: p.sub !== undefined ? String(p.sub) : '',
          exp: typeof p.exp === 'number' ? p.exp : undefined,
          sig: null,
        };
        if (checkSigs && secret) {
          const out = await verifyWithSecret(line, secret);
          row.sig = out?.status ?? 'error';
          if (out && out.status !== 'verified') row.reason = `${out.title}`;
        }
        next.push(row);
      }
      if (!cancelled) setRows(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [lines, checkSigs, secret]);

  return (
    <main className="single">
      <section className="card input-card">
        <label htmlFor="batch">
          Batch decode — one token per line (max {MAX_LINES}). Tokens are decoded locally; nothing is sent anywhere.
        </label>
        <textarea
          id="batch"
          className="mono"
          rows={6}
          spellCheck={false}
          placeholder={'eyJhbGciOiJIUzI1NiIs…\neyJhbGciOiJSUzI1NiIs…\n…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="input-meta">
          <span>
            {lines.length} token{lines.length === 1 ? '' : 's'}
          </span>
          <label className="check">
            <input type="checkbox" checked={checkSigs} onChange={(e) => setCheckSigs(e.target.checked)} />
            Verify HS* signatures with the secret from the Single tab{!secret && ' (no secret entered — decoding only)'}
          </label>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="card">
          <table className="batch-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>alg</th>
                <th>sub</th>
                <th>Expiry</th>
                {checkSigs && <th>Signature</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const st = expState(r.exp, now);
                return (
                  <tr key={i}>
                    <td className="mono truncate" title={r.reason || r.raw}>
                      {r.raw}
                      {r.reason && <span className="error-text"> — {r.reason}</span>}
                    </td>
                    <td className="mono">{r.alg ? <span className="alg-badge">{r.alg}</span> : '—'}</td>
                    <td className="mono">{r.sub || '—'}</td>
                    <td>
                      {!r.ok ? (
                        <span className="badge expired">malformed</span>
                      ) : r.exp === undefined ? (
                        <span className="badge neutral">no exp</span>
                      ) : st === 'expired' ? (
                        <span className="badge expired">expired {fmtDuration(now - r.exp)} ago</span>
                      ) : st === 'expiring-soon' ? (
                        <span className="badge expiring">expires in {fmtDuration(r.exp - now)}</span>
                      ) : (
                        <span className="badge valid" title={fmtUtc(r.exp)}>
                          valid · {fmtDuration(r.exp - now)} left
                        </span>
                      )}
                    </td>
                    {checkSigs && (
                      <td>
                        {r.sig === 'verified' ? (
                          <span className="badge valid">verified</span>
                        ) : r.sig === 'invalid-signature' ? (
                          <span className="badge expired">invalid</span>
                        ) : r.sig === 'claims-failed' ? (
                          <span className="badge expiring">claims failed</span>
                        ) : r.sig ? (
                          <span className="badge neutral">{r.sig}</span>
                        ) : (
                          <span className="badge neutral">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
