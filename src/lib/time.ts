import { useEffect, useState } from 'react';

export const EXPIRING_SOON_S = 300; // < 5 minutes -> amber "expiring soon"

export type ExpState = 'expired' | 'expiring-soon' | 'valid';

export function expState(exp: number | undefined, now: number): ExpState | null {
  if (exp === undefined || !Number.isFinite(exp)) return null;
  const diff = exp - now;
  if (diff <= 0) return 'expired';
  if (diff <= EXPIRING_SOON_S) return 'expiring-soon';
  return 'valid';
}

/** "2d 3h", "4h 12m", "4m 59s", "42s" — absolute value of the seconds given. */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.abs(Math.round(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function fmtUtc(unixSeconds: number): string {
  return `${new Date(unixSeconds * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

/** Seconds-since-epoch clock that re-renders once per second — drives the live badges. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
