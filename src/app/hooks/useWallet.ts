'use client';

/**
 * Format a NIGHT balance for display.
 * 1 NIGHT = 1,000,000 base units
 */
export function formatNight(amount: bigint | null): string {
  if (amount === null) return '—';
  const whole = amount / 1_000_000n;
  const frac  = amount % 1_000_000n;
  if (frac === 0n) return `${whole} NIGHT`;
  const fracStr = String(frac).padStart(6, '0').replace(/0+$/, '');
  return `${whole}.${fracStr} NIGHT`;
}

/**
 * Format a contract address for display (truncated).
 */
export function formatAddress(address: string | null, chars = 8): string {
  if (!address) return '—';
  return `${address.slice(0, chars)}…${address.slice(-4)}`;
}
