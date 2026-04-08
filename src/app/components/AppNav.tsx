'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, ChevronDown, Copy, Check, Shield, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useWallet } from '@/app/context/WalletContext';

export default function AppNav() {
  const pathname = usePathname();
  const { status, address, shieldedAddress, error, connect, disconnect } = useWallet();
  const [copied, setCopied]             = useState<'unshielded' | 'shielded' | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  async function copyAddress(value: string, type: 'unshielded' | 'shielded') {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    setTimeout(() => setCopied(null), 1500);
  }

  const isActive = (path: string) => pathname?.startsWith(path);

  return (
    <nav className="nav">
      {/* Logo */}
      <Link href="/circles" className="nav-logo">
        k<span>∅</span>sh
      </Link>

      {/* Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
        <NavLink href="/circles"        active={isActive('/circles') && pathname !== '/circles/create'}>Circles</NavLink>
        <NavLink href="/circles/create" active={pathname === '/circles/create'}>+ New</NavLink>
      </div>

      {/* Wallet */}
      <div style={{ position: 'relative' }}>
        {status === 'connected' && address ? (
          <>
            <button
              onClick={() => setShowDropdown(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4375rem 0.875rem',
                background: 'var(--violet-dim)',
                border: '1px solid var(--border-violet)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--violet)',
                fontSize: '0.8125rem', fontWeight: 600,
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
                transition: 'opacity var(--t-fast)',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <span className="live-dot" style={{ background: 'var(--violet)' }} />
              {shorten(address)}
              <ChevronDown size={11} />
            </button>

            {showDropdown && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 280,
                background: '#0D0E14',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.875rem',
                zIndex: 100,
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
              }}>

                {/* Wallet address (unshielded) */}
                <p className="label" style={{ marginBottom: '0.5rem', padding: '0 0.125rem' }}>
                  Wallet address
                </p>
                <AddressRow
                  value={address}
                  copied={copied === 'unshielded'}
                  onCopy={() => copyAddress(address, 'unshielded')}
                />

                {/* Shielded address */}
                {shieldedAddress && (
                  <>
                    <p className="label" style={{ margin: '0.75rem 0 0.5rem', padding: '0 0.125rem' }}>
                      Shielded address
                    </p>
                    <AddressRow
                      value={shieldedAddress}
                      copied={copied === 'shielded'}
                      onCopy={() => copyAddress(shieldedAddress, 'shielded')}
                      dim
                    />
                  </>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0 0.125rem', margin: '0.75rem 0',
                }}>
                  <Shield size={10} color="var(--violet)" />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    Midnight · Preprod
                  </span>
                </div>

                <button
                  onClick={() => { disconnect(); setShowDropdown(false); }}
                  style={{
                    width: '100%', padding: '0.5rem 0.75rem',
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-faint)',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                    transition: 'color var(--t-fast), border-color var(--t-fast)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color        = 'var(--red)';
                    e.currentTarget.style.borderColor  = 'rgba(239,68,68,0.3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color        = 'var(--text-faint)';
                    e.currentTarget.style.borderColor  = 'var(--border)';
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}
          </>
        ) : status === 'connecting' ? (
          <span className="zk-spinner" style={{ fontSize: '0.75rem' }}>Connecting…</span>
        ) : (
          <>
            <button
              className="btn-primary"
              onClick={connect}
              style={{ fontSize: '0.8125rem', padding: '0.5rem 1.125rem', gap: '0.375rem' }}
            >
              <Wallet size={13} />
              Connect Lace
            </button>

            {(status === 'error' && error) && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 280,
                padding: '0.75rem 1rem',
                background: '#0D0E14',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                zIndex: 100,
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <AlertCircle size={12} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>{error}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Backdrop to close dropdown */}
      {showDropdown && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </nav>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function AddressRow({
  value,
  copied,
  onCopy,
  dim = false,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
  dim?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.5rem 0.75rem',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: dim ? '0.5625rem' : '0.625rem',
        color: dim ? 'var(--text-faint)' : 'var(--text-muted)',
        flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
      <button
        onClick={onCopy}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
          color: copied ? 'var(--green)' : 'var(--text-faint)',
          transition: 'color var(--t-fast)',
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: '0.375rem 0.75rem',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: active ? 'var(--text)' : 'var(--text-muted)',
        background: active ? 'var(--surface)' : 'transparent',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        textDecoration: 'none',
        transition: 'color var(--t-fast), background var(--t-fast)',
      }}
    >
      {children}
    </Link>
  );
}

/** First 12 + last 6 — shows network prefix and a recognisable tail.
 *  e.g. mn_addr_prepr…xa47y5 */
function shorten(addr: string): string {
  return addr.length <= 18 ? addr : `${addr.slice(0, 12)}…${addr.slice(-6)}`;
}
