import { CLAIMS, STANDARD_CLAIMS } from '../lib/claims';

/** Claim key chip with a dictionary tooltip (hover / keyboard focus). */
export default function ClaimChip({ name }: { name: string }) {
  const meta = CLAIMS[name];
  return (
    <span className={`chip ${meta ? (STANDARD_CLAIMS.has(name) ? 'standard' : 'known') : 'unknown'}`} tabIndex={0}>
      {name}
      {meta && (
        <span className="tooltip" role="tooltip">
          <b>{meta.label}</b>
          {meta.desc}
        </span>
      )}
      {!meta && (
        <span className="tooltip" role="tooltip">
          <b>Custom claim</b>
          Not in the claim dictionary — an application-specific claim.
        </span>
      )}
    </span>
  );
}
