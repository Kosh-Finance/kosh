'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, ChevronDown, Copy, Check, Shield, AlertCircle } from 'lucide-react';

export default function AppNav() {
  const pathname = usePathname();
  const [status, setStatus]           = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [address, setAddress]         = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('kosh:wallet:connected') === 'true') {
      void connect(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function connect(silent = false) {
    setStatus('connecting');
    setError(null);
    try {
      // Lace injects window.midnight.mnLace asynchronously after page load.
      // Poll for up to 3 seconds before giving up.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lace = await (async (): Promise<import('@midnight-ntwrk/dapp-connector-api').InitialAPI | undefined> => {
        for (let i = 0; i < 30; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const found = (window as any).midnight?.mnLace;
          if (found) return found;
          await new Promise(r => setTimeout(r, 100));
        }
        return undefined;
      })();
      if (!lace) throw new Error('LACE_NOT_FOUND');
      const api   = await lace.connect('undeployed');
      const addrs = await api.getShieldedAddresses();
      setAddress(addrs.shieldedAddress ?? null);
      setStatus('connected');
      sessionStorage.setItem('kosh:wallet:connected', 'true');
    } catch (err: any) {
      sessionStorage.removeItem('kosh:wallet:connected');
      const msg = err?.message ?? '';
      if (!silent) {
        if (msg === 'LACE_NOT_FOUND' || msg.includes('inject') || msg.includes('undefined'))
          setError('Lace not detected. Make sure the Lace extension is enabled for this site and its network is set to "Undeployed".');
        else if (msg.includes('reject') || msg.includes('denied') || msg.includes('cancel'))
          setError('Connection rejected in Lace.');
        else
          setError(msg || 'Failed to connect.');
        setStatus('error');
      } else {
        setStatus('disconnected');
      }
    }
  }

  function disconnect() {
    setStatus('disconnected');
    setAddress(null);
    setError(null);
    setShowDropdown(false);
    sessionStorage.removeItem('kosh:wallet:connected');
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
                width: 256,
                background: '#0D0E14',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.875rem',
                zIndex: 100,
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
              }}>
                <p className="label" style={{ marginBottom: '0.5rem', padding: '0 0.125rem' }}>
                  Shielded Address
                </p>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '0.75rem',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.625rem',
                    color: 'var(--text-muted)', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {address}
                  </span>
                  <button
                    onClick={copyAddress}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                      color: copied ? 'var(--green)' : 'var(--text-faint)',
                      transition: 'color var(--t-fast)',
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0 0.125rem', marginBottom: '0.75rem',
                }}>
                  <Shield size={10} color="var(--violet)" />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    Midnight · Undeployed
                  </span>
                </div>

                <button
                  onClick={disconnect}
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
              onClick={() => connect()}
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

function shorten(addr: string): string {
  return addr.length <= 12 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
