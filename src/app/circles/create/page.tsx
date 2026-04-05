'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Copy, Check, Info, Wallet } from 'lucide-react';
import { ZkProofSpinner } from '@/app/components/ZkProofSpinner';
import { useWallet } from '@/app/context/WalletContext';

type Step = 'params' | 'review' | 'deploying' | 'done';

interface Params {
  amount: string;
  cap: 4 | 8 | 16;
  durationMin: number;
}

const DURATION_PRESETS = [
  { label: '10 min', value: 10 },
  { label: '1 day',  value: 1440 },
  { label: '1 week', value: 10080 },
];

export default function CreateCirclePage() {
  const { status, connectedApi, connect } = useWallet();

  const [step, setStep]         = useState<Step>('params');
  const [params, setParams]     = useState<Params>({ amount: '1', cap: 4, durationMin: 10 });
  const [elapsed, setElapsed]   = useState(0);
  const [deployed, setDeployed] = useState<string | null>(null);
  const [deployErr, setDeployErr] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  const amountN  = parseFloat(params.amount) || 0;
  const pool     = amountN * params.cap;
  const validAmt = amountN > 0 && amountN <= 10_000;

  async function deploy() {
    if (!connectedApi) return;

    setStep('deploying');
    setDeployErr(null);
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start), 500);
    try {
      const { deployFromBrowser } = await import('@/dapp/deploy');
      const { contractAddress } = await deployFromBrowser(
        {
          contributionAmount: BigInt(Math.floor(amountN * 1_000_000)),
          memberCap:   params.cap,
          roundCount:  params.cap,
          roundDuration: BigInt(params.durationMin * 60),
        },
        connectedApi,
      );
      const recent = JSON.parse(localStorage.getItem('kosh:recent-circles') ?? '[]');
      recent.unshift({ contractAddress, joinedAt: Date.now(), leafIndex: -1 });
      localStorage.setItem('kosh:recent-circles', JSON.stringify(recent.slice(0, 10)));
      setDeployed(contractAddress);
      setStep('done');
    } catch (err: unknown) {
      setDeployErr((err as Error)?.message ?? 'Deployment failed');
      setStep('review');
    } finally {
      clearInterval(timer);
    }
  }

  async function copyAddr() {
    if (!deployed) return;
    await navigator.clipboard.writeText(deployed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const reviewRows = [
    ['Contribution / round',   `${amountN} NIGHT`],
    ['Members',                String(params.cap)],
    ['Rounds',                 String(params.cap)],
    ['Round duration',         params.durationMin < 60 ? `${params.durationMin} min` : `${(params.durationMin / 60).toFixed(0)}h`],
    ['Each member receives',   `${pool.toFixed(2)} NIGHT`],
    ['Each member pays total', `${(amountN * params.cap).toFixed(2)} NIGHT`],
  ] as const;

  return (
    <div className="page-sm">

      {/* ── Step indicator ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem',
        fontSize: '0.75rem', color: 'var(--text-faint)',
      }}>
        <Link href="/circles" style={{ color: 'var(--text-faint)', textDecoration: 'none' }}>
          <ArrowLeft size={12} style={{ verticalAlign: 'middle' }} /> Circles
        </Link>
        <span>/</span>
        <span style={{ color: step === 'params' ? 'var(--text)' : 'var(--text-faint)' }}>Configure</span>
        <span>/</span>
        <span style={{ color: step === 'review' ? 'var(--text)' : 'var(--text-faint)' }}>Review</span>
        <span>/</span>
        <span style={{ color: step === 'done' ? 'var(--green)' : 'var(--text-faint)' }}>Deploy</span>
      </div>

      {/* ── Wallet gate ── */}
      {status !== 'connected' && step !== 'done' && (
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Connect Lace to deploy on Midnight preprod.
          </p>
          <button
            className="btn-primary"
            onClick={connect}
            style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem', gap: '0.375rem', flexShrink: 0 }}
          >
            <Wallet size={13} /> Connect Lace
          </button>
        </div>
      )}

      {/* ── params ── */}
      {step === 'params' && (
        <>
          <div style={{ marginBottom: '2.5rem' }}>
            <p className="label" style={{ color: 'var(--violet)', marginBottom: '0.625rem' }}>New circle</p>
            <h1 className="display-md">Configure the rules.</h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

            {/* Amount */}
            <div className="field">
              <label className="input-label" htmlFor="amount">Contribution per round</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="amount"
                  className="input"
                  type="number" min="0.000001" max="10000" step="0.1"
                  value={params.amount}
                  onChange={e => setParams(p => ({ ...p, amount: e.target.value }))}
                  style={{ paddingRight: '5.5rem', fontFamily: 'var(--font-mono)', fontSize: '1.25rem' }}
                />
                <span style={{
                  position: 'absolute', right: '1rem',
                  fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                  color: 'var(--text-muted)', pointerEvents: 'none',
                }}>
                  NIGHT
                </span>
              </div>
              {amountN > 0 && (
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  {amountN} × {params.cap} members = {pool.toFixed(2)} NIGHT pool
                </p>
              )}
            </div>

            {/* Member cap */}
            <div className="field">
              <label className="input-label">Members</label>
              <div className="seg-control">
                {([4, 8, 16] as const).map(cap => (
                  <button
                    key={cap}
                    type="button"
                    className={`seg-btn${params.cap === cap ? ' active' : ''}`}
                    onClick={() => setParams(p => ({ ...p, cap }))}
                  >
                    {cap}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-faint)' }}>
                Fixed at compile time. Each member receives payout once.
              </p>
            </div>

            {/* Duration */}
            <div className="field">
              <label className="input-label">Round duration</label>
              <div className="pill-group" style={{ marginBottom: '0.625rem' }}>
                {DURATION_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    className={`pill${params.durationMin === p.value ? ' active' : ''}`}
                    onClick={() => setParams(prev => ({ ...prev, durationMin: p.value }))}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  className="input"
                  type="number" min="1" max="43200"
                  value={params.durationMin}
                  onChange={e => setParams(p => ({ ...p, durationMin: Number(e.target.value) }))}
                  style={{ width: 96, fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>minutes</span>
              </div>
              {params.durationMin < 30 && (
                <p style={{ fontSize: '0.6875rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Info size={10} /> Short durations are for local testing only.
                </p>
              )}
            </div>

          </div>

          <div style={{ marginTop: '2.5rem' }}>
            <button
              className="btn-primary"
              onClick={() => setStep('review')}
              disabled={!validAmt}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Review <ArrowRight size={13} />
            </button>
          </div>
        </>
      )}

      {/* ── review ── */}
      {step === 'review' && (
        <>
          <div style={{ marginBottom: '2.5rem' }}>
            <p className="label" style={{ color: 'var(--violet)', marginBottom: '0.625rem' }}>Confirm</p>
            <h1 className="display-md">Review before deploying.</h1>
          </div>

          {/* Pool hero */}
          <div className="card card-violet" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <p className="label" style={{ marginBottom: '0.5rem' }}>Total pool</p>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(2rem, 8vw, 3rem)',
              fontWeight: 700,
              color: 'var(--violet)',
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}>
              {pool.toFixed(2)}
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>NIGHT per payout</p>
          </div>

          {/* Params */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.25rem' }}>
            <div className="data-table">
              {reviewRows.map(([label, value]) => (
                <div key={label} className="data-row" style={{ padding: '0.625rem 1.25rem' }}>
                  <span className="label">{label}</span>
                  <span className="data-row-value">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {deployErr && (
            <div className="card card-red" style={{ marginBottom: '1.25rem', fontSize: '0.8125rem', color: 'var(--red)' }}>
              {deployErr}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button className="btn-ghost" onClick={() => setStep('params')} style={{ flex: 1, justifyContent: 'center' }}>
              <ArrowLeft size={12} /> Edit
            </button>
            <button
              className="btn-primary"
              onClick={deploy}
              disabled={!connectedApi}
              style={{ flex: 2, justifyContent: 'center' }}
            >
              Deploy <ArrowRight size={13} />
            </button>
          </div>

          <p style={{ marginTop: '0.875rem', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-faint)' }}>
            Deploys to Midnight Preprod · Lace will prompt for approval
          </p>
        </>
      )}

      {/* ── deploying ── */}
      {step === 'deploying' && (
        <>
          <div style={{ marginBottom: '2rem' }}>
            <p className="label" style={{ color: 'var(--violet)', marginBottom: '0.625rem' }}>Deploying</p>
            <h1 className="display-md">Creating your circle…</h1>
          </div>
          <ZkProofSpinner label="Deploying contract" elapsedMs={elapsed} />
          <p style={{ marginTop: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Generating ZK proof and submitting to Midnight preprod. Lace will ask you to approve the transaction.
          </p>
        </>
      )}

      {/* ── done ── */}
      {step === 'done' && deployed && (
        <>
          <div style={{ marginBottom: '2rem' }}>
            <p className="label" style={{ color: 'var(--green)', marginBottom: '0.625rem' }}>Deployed</p>
            <h1 className="display-md">Share with your members.</h1>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <p className="label" style={{ marginBottom: '0.75rem' }}>Circle address</p>
            <div className="hash-display" style={{ userSelect: 'all' }}>{deployed}</div>
          </div>

          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button className="btn-ghost" onClick={copyAddr} style={{ flex: 1, justifyContent: 'center' }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <Link
              href={`/circles/${deployed}`}
              className="btn-primary"
              style={{ flex: 2, justifyContent: 'center', textDecoration: 'none' }}
            >
              Open circle <ArrowRight size={13} />
            </Link>
          </div>
        </>
      )}

    </div>
  );
}
