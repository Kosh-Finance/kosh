'use client';

import { useState, useEffect } from 'react';

interface ZkProofSpinnerProps {
  label?: string;
  elapsedMs?: number;
}

const HEX = [
  '4f2a8c1e', '9b3d7f05', 'c82a1e4f', '7f05b39d',
  'e14c9a2b', '3d7f05c8', '2b1e4f9a', '05c8e13d',
  'a2b1e4c9', 'f9a2b1e4', 'c9a2b1e4', '1e4fc9a2',
];

export function ZkProofSpinner({ label = 'Generating proof', elapsedMs = 0 }: ZkProofSpinnerProps) {
  const [frame, setFrame] = useState(0);
  const [dots, setDots]   = useState(1);

  useEffect(() => {
    const h = setInterval(() => setFrame(i => (i + 1) % HEX.length), 180);
    const d = setInterval(() => setDots(d => (d % 3) + 1), 500);
    return () => { clearInterval(h); clearInterval(d); };
  }, []);

  const elapsed = Math.floor(elapsedMs / 1000);

  return (
    <div className="card" style={{ borderColor: 'var(--border-violet)', gap: '0.75rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="zk-spinner">
          <Brackets />
          {label}{'.'.repeat(dots)}
        </span>
        {elapsed > 0 && (
          <span className="label" style={{ color: 'var(--text-faint)' }}>{elapsed}s</span>
        )}
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-faint)',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem',
        overflow: 'hidden', height: '4.5rem',
      }}>
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            style={{
              opacity: Math.max(0.1, 1 - i * 0.05),
              color: i < 4 ? 'var(--violet)' : 'var(--text-faint)',
              transition: 'opacity 180ms',
            }}
          >
            0x{HEX[(frame + i) % HEX.length]}
          </span>
        ))}
      </div>

      <p style={{ fontSize: '0.625rem', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
        Proof runs locally · Your secrets never leave this device · Powered by Halo2 / BLS12-381
      </p>
    </div>
  );
}

function Brackets() {
  const [bright, setBright] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setBright(b => !b), 600);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{
      color: bright ? 'var(--violet)' : 'rgba(139,92,246,0.3)',
      transition: 'color 300ms', fontWeight: 600,
    }}>
      {'[ ]'}
    </span>
  );
}
