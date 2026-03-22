'use client';

import { useState, useEffect } from 'react';
import type { CircleStatus } from '@/dapp/interact';

interface StatusBadgeProps {
  status: CircleStatus | string;
  pulse?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; cssClass: string; dot: boolean }> = {
  OPEN:              { label: 'Open',           cssClass: 'status-open',              dot: false },
  ACTIVE:            { label: 'Active',          cssClass: 'status-round-in-progress', dot: true  },
  ROUND_IN_PROGRESS: { label: 'Round Live',      cssClass: 'status-round-in-progress', dot: true  },
  PAYOUT_PENDING:    { label: 'Payout Pending',  cssClass: 'status-payout-pending',    dot: true  },
  DEFAULT_DETECTED:  { label: 'Default',         cssClass: 'status-default-detected',  dot: false },
  COMPLETED:         { label: 'Completed',       cssClass: 'status-completed',         dot: false },
};

export function StatusBadge({ status, pulse = true }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, cssClass: 'status-open', dot: false };

  return (
    <span className={config.cssClass}>
      {config.dot && pulse && (
        <span className="live-dot" style={{ width: 5, height: 5 }} />
      )}
      {config.label}
    </span>
  );
}

export function CountdownTimer({ deadlineTimestamp }: { deadlineTimestamp: bigint }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function tick() {
      const now = Math.floor(Date.now() / 1000);
      setRemaining(Math.max(0, Number(deadlineTimestamp) - now));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineTimestamp]);

  if (remaining === 0) {
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--red)' }}>
        Expired
      </span>
    );
  }

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  const urgent  = remaining < 60;
  const warning = remaining < 300;

  const formatted = h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8125rem',
      color: urgent ? 'var(--red)' : warning ? 'var(--amber)' : 'var(--text)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {formatted}
    </span>
  );
}
