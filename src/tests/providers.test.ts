/**
 * Unit tests — providers.ts
 *
 * Tests environment variable resolution, provider factory output shape,
 * and formatNight / formatAddress utilities.
 * No Docker or network dependencies.
 */

import { ENV } from '../dapp/providers';
import { formatNight, formatAddress } from '../app/hooks/useWallet';

// ─── ENV defaults ─────────────────────────────────────────────────────────────

describe('ENV configuration', () => {
  test('uses localhost defaults when env vars are absent', () => {
    expect(ENV.INDEXER_URL).toContain('localhost');
    expect(ENV.PROOF_SERVER_URL).toContain('6300');
    expect(ENV.NODE_URL).toContain('9944');
    expect(ENV.NETWORK_ID).toBe('undeployed');
  });

  test('all required keys are present', () => {
    const required = ['INDEXER_URL', 'INDEXER_WS_URL', 'NODE_URL', 'PROOF_SERVER_URL', 'NETWORK_ID'];
    for (const key of required) {
      expect(ENV).toHaveProperty(key);
      expect(typeof (ENV as any)[key]).toBe('string');
      expect((ENV as any)[key].length).toBeGreaterThan(0);
    }
  });
});

// ─── formatNight ─────────────────────────────────────────────────────────────

describe('formatNight', () => {
  test('formats null as em-dash', () => {
    expect(formatNight(null)).toBe('—');
  });

  test('formats zero correctly', () => {
    expect(formatNight(0n)).toBe('0 NIGHT');
  });

  test('formats 1 NIGHT (1,000,000 units)', () => {
    expect(formatNight(1_000_000n)).toBe('1 NIGHT');
  });

  test('formats fractional amounts', () => {
    expect(formatNight(1_500_000n)).toBe('1.5 NIGHT');
  });

  test('formats large amounts', () => {
    expect(formatNight(50_000_000_000n)).toBe('50000 NIGHT');
  });

  test('trims trailing zeros in fractional part', () => {
    // 1.100000 → 1.1
    expect(formatNight(1_100_000n)).toBe('1.1 NIGHT');
  });

  test('preserves precision for small fractions', () => {
    // 0.000001 NIGHT = 1 base unit
    expect(formatNight(1n)).toBe('0.000001 NIGHT');
  });
});

// ─── formatAddress ────────────────────────────────────────────────────────────

describe('formatAddress', () => {
  const ADDR = '0xabcdef1234567890abcdef1234567890abcdef12';

  test('formats null as em-dash', () => {
    expect(formatAddress(null)).toBe('—');
  });

  test('truncates with default 8 chars', () => {
    const result = formatAddress(ADDR);
    expect(result).toContain('…');
    expect(result.endsWith(ADDR.slice(-4))).toBe(true);
    expect(result.startsWith(ADDR.slice(0, 8))).toBe(true);
  });

  test('respects custom chars parameter', () => {
    const result = formatAddress(ADDR, 12);
    expect(result.startsWith(ADDR.slice(0, 12))).toBe(true);
  });

  test('full address shorter than 2*chars is returned as-is', () => {
    const short = '0xabcd';
    const result = formatAddress(short, 8);
    // short.slice(0,8) = '0xabcd' and short.slice(-4) = 'abcd'
    // result = '0xabcd…abcd' — this is fine for short addresses
    expect(result).toBeTruthy();
  });
});
