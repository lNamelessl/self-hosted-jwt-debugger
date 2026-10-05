import { expState, fmtDuration, fmtUtc } from '../lib/time';
import type { JwtPayload } from 'jwt-decode';

export default function TimeCard({ payload, now }: { payload: JwtPayload & Record<string, unknown>; now: number }) {
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : undefined;
  const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
  const st = expState(exp, now);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Time claims</h2>
        <span className="muted small-text">live — updates every second</span>
      </div>
      <div className="badges">
        {exp === undefined ? (
          <span className="badge neutral">No exp claim — token never expires</span>
        ) : st === 'expired' ? (
          <span className="badge expired">Expired — {fmtDuration(now - exp)} ago</span>
        ) : st === 'expiring-soon' ? (
          <span className="badge expiring">Expiring soon — {fmtDuration(exp - now)} left</span>
        ) : (
          <span className="badge valid">Valid — expires in {fmtDuration(exp - now)}</span>
        )}

        {nbf !== undefined && nbf > now && (
          <span className="badge expiring">Not yet valid — valid in {fmtDuration(nbf - now)}</span>
        )}
        {nbf !== undefined && nbf <= now && <span className="badge valid">nbf passed — valid since {fmtDuration(now - nbf)} ago</span>}

        {iat !== undefined && iat > now && <span className="badge expiring">iat in the future</span>}
        {iat !== undefined && iat <= now && <span className="badge neutral">Issued {fmtDuration(now - iat)} ago</span>}
      </div>
      {(exp !== undefined || nbf !== undefined || iat !== undefined) && (
        <table className="time-table">
          <tbody>
            {iat !== undefined && (
              <tr>
                <td>iat</td>
                <td className="mono">{fmtUtc(iat)}</td>
              </tr>
            )}
            {nbf !== undefined && (
              <tr>
                <td>nbf</td>
                <td className="mono">{fmtUtc(nbf)}</td>
              </tr>
            )}
            {exp !== undefined && (
              <tr>
                <td>exp</td>
                <td className="mono">{fmtUtc(exp)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
