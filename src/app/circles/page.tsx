'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Plus, Lock } from 'lucide-react';
import { formatAddress } from '@/app/hooks/useWallet';

interface RecentCircle {
  contractAddress: string;
  joinedAt: number;
  leafIndex: number;
}

export default function CirclesPage() {
  const router = useRouter();
  const [addr, setAddr]   = useState('');
  const [err, setErr]     = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCircle[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('kosh:recent-circles');
      if (raw) setRecent(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = addr.trim();
    if (!trimmed) { setErr('Enter a circle address'); return; }
    if (!/^[0-9a-fA-F]{40,}$/.test(trimmed.replace(/^0x/, ''))) {
      setErr('Invalid address format');
      return;
    }
    router.push(`/circles/${trimmed}`);
  }

  return (
    <div className="page">

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label" style={{ color: 'var(--violet)', marginBottom: '0.75rem' }}>
          Midnight Network
        </p>
        <h1 className="display-lg">Savings Circles</h1>
        <p style={{ marginTop: '0.625rem', color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.65 }}>
          Join a circle by address, or start a new private savings group.
        </p>
      </div>

      {/* Join */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <p className="label" style={{ marginBottom: '1rem' }}>Join a circle</p>
        <form onSubmit={handleJoin}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="input"
              type="text"
              placeholder="Contract address"
              value={addr}
              onChange={e => { setAddr(e.target.value); setErr(null); }}
              spellCheck={false}
              autoComplete="off"
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
            />
            <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
              Open <ArrowRight size={13} />
            </button>
          </div>
          {err && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--red)' }}>{err}</p>
          )}
        </form>
      </div>

      {/* Divider */}
      <div className="divider-label" style={{ margin: '1.5rem 0' }}>or</div>

      {/* Create */}
      <Link
        href="/circles/create"
        className="card"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          textDecoration: 'none', gap: '1rem', marginBottom: '2.5rem',
          transition: 'border-color var(--t-fast), background var(--t-fast)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-violet)';
          (e.currentTarget as HTMLElement).style.background  = 'var(--surface-hover)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
          (e.currentTarget as HTMLElement).style.background  = 'var(--surface)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 38, height: 38, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--violet-dim)',
            border: '1px solid var(--border-violet)',
            borderRadius: 'var(--radius-md)',
          }}>
            <Plus size={15} color="var(--violet)" />
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Create a new circle</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Set contribution, members, and round duration
            </p>
          </div>
        </div>
        <ArrowRight size={14} color="var(--text-faint)" style={{ flexShrink: 0 }} />
      </Link>

      {/* Recent */}
      {recent.length > 0 && (
        <div>
          <p className="label" style={{ marginBottom: '0.875rem' }}>Recently joined</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {recent.map(c => (
              <Link
                key={c.contractAddress}
                href={`/circles/${c.contractAddress}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none', gap: '1rem',
                  transition: 'border-color var(--t-fast), background var(--t-fast)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-violet)';
                  (e.currentTarget as HTMLElement).style.background  = 'var(--surface-hover)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.background  = 'var(--surface)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <Lock size={10} color="var(--violet)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                    {formatAddress(c.contractAddress, 12)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  {c.leafIndex >= 0 && (
                    <span className="badge badge-neutral">Slot {c.leafIndex}</span>
                  )}
                  <ArrowRight size={12} color="var(--text-faint)" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
