'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Lock, AlertTriangle, Copy, Check, Shield } from 'lucide-react';
import { useWallet, formatNight, formatAddress } from '@/app/hooks/useWallet';
import { useContract } from '@/app/hooks/useContract';
import { StatusBadge, CountdownTimer } from '@/app/components/StatusBadge';
import { PrivacyBadge } from '@/app/components/PrivacyBadge';
import { RoundTracker, MemberSlots } from '@/app/components/RoundTracker';
import { ZkProofSpinner } from '@/app/components/ZkProofSpinner';
import { CircleStatus } from '@/dapp/interact';

export default function CircleDashboardPage() {
  const params          = useParams();
  const contractAddress = Array.isArray(params.id) ? params.id[0] : params.id;

  const wallet   = useWallet();
  const contract = useContract(contractAddress ?? null, null);

  const [copied, setCopied]                       = useState(false);
  const [reportLeaf, setReportLeaf]               = useState('');
  const [showDefaultForm, setShowDefaultForm]     = useState(false);
  const [participationReceipt, setReceipt]        = useState<string | null>(null);

  const { ledger, loading, proofState, proofElapsedMs, error, isMember, isMyPayoutRound } = contract;
  const isGenerating = proofState === 'generating' || proofState === 'submitting';

  // Track in recently-joined
  useEffect(() => {
    if (!contractAddress) return;
    try {
      const recent = JSON.parse(localStorage.getItem('kosh:recent-circles') ?? '[]');
      const idx    = recent.findIndex((c: any) => c.contractAddress === contractAddress);
      if (idx === -1) {
        recent.unshift({ contractAddress, joinedAt: Date.now(), leafIndex: contract.myLeafIndex ?? -1 });
      } else if (contract.myLeafIndex !== null) {
        recent[idx].leafIndex = contract.myLeafIndex;
      }
      localStorage.setItem('kosh:recent-circles', JSON.stringify(recent.slice(0, 10)));
    } catch { /* ignore */ }
  }, [contractAddress, contract.myLeafIndex]);

  async function copyAddress() {
    if (!contractAddress) return;
    await navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerateProof() {
    const receipt = await contract.generateParticipationProof();
    setReceipt(receipt);
  }

  async function handleReportDefault(e: React.FormEvent) {
    e.preventDefault();
    const idx = parseInt(reportLeaf, 10);
    if (isNaN(idx) || idx < 0) return;
    await contract.reportDefault(idx);
    setShowDefaultForm(false);
    setReportLeaf('');
  }

  const canContribute =
    isMember && ledger?.circleStatus === CircleStatus.ROUND_IN_PROGRESS && !loading;

  const canClaim = isMyPayoutRound && !loading;

  const canReport =
    ledger?.circleStatus === CircleStatus.ROUND_IN_PROGRESS &&
    ledger?.contributionsThisRound < ledger?.memberCap &&
    Number(ledger?.roundDeadline) < Math.floor(Date.now() / 1000);

  return (
    <div className="dashboard">

      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* Status */}
        <SidebarSection label="Status">
          {ledger
            ? <StatusBadge status={ledger.circleStatus} />
            : <div className="shimmer" style={{ height: 22, width: 90, borderRadius: 999 }} />}
        </SidebarSection>

        {/* Identity */}
        <SidebarSection label="Your identity">
          {isMember ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                <Lock size={10} color="var(--violet)" />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--violet)' }}>Private</span>
              </div>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-faint)', lineHeight: 1.5 }}>
                Slot {contract.myLeafIndex} · Payout round {contract.myLeafIndex}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Not a member</p>
          )}
        </SidebarSection>

        {/* Members */}
        {ledger && (
          <SidebarSection label="Members">
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '1.375rem', fontWeight: 600,
              color: 'var(--text)', lineHeight: 1, marginBottom: '0.625rem',
            }}>
              {ledger.memberCount}
              <span style={{ color: 'var(--text-faint)', fontSize: '0.9375rem', fontWeight: 400 }}>
                {' '}/ {ledger.memberCap}
              </span>
            </p>
            <MemberSlots memberCap={ledger.memberCap} memberCount={ledger.memberCount} />
          </SidebarSection>
        )}

        {/* Round progress */}
        {ledger && (
          <SidebarSection label="">
            <RoundTracker totalRounds={ledger.roundCount} currentRound={ledger.currentRound} />
          </SidebarSection>
        )}

        {/* Address */}
        <SidebarSection label="Circle address">
          <button
            onClick={copyAddress}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem',
            }}
          >
            {formatAddress(contractAddress ?? null, 10)}
            {copied
              ? <Check size={9} color="var(--green)" />
              : <Copy size={9} />}
          </button>
        </SidebarSection>

        {/* Low DUST */}
        {wallet.dustBalance !== null && wallet.dustBalance < 100n && (
          <div className="card card-red" style={{ fontSize: '0.6875rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertTriangle size={10} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: 'var(--red)', lineHeight: 1.5 }}>
                Low DUST balance. Transactions may fail.
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* ─── Main ────────────────────────────────────────────────── */}
      <main style={{ minWidth: 0 }}>

        {/* Loading */}
        {loading && !ledger && (
          <div style={{ paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[280, 200, 140].map(w => (
              <div key={w} className="shimmer" style={{ height: 14, width: w, borderRadius: 4 }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card card-red" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <AlertTriangle size={13} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--red)', marginBottom: '0.375rem' }}>{error}</p>
                <button
                  onClick={contract.clearError}
                  style={{ fontSize: '0.6875rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.65 }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {ledger && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Stats */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 1.375rem 0' }}>
                <Shield size={11} color="var(--violet)" />
                <span className="label" style={{ color: 'var(--violet)' }}>Circle details</span>
              </div>
              <div className="data-table" style={{ padding: '0 1.375rem 0.25rem' }}>
                <StatRow label="Pool balance" value={formatNight(ledger.contributionAmount * BigInt(ledger.memberCap))} privacy="public" />
                <StatRow label="Contribution / round" value={formatNight(ledger.contributionAmount)} privacy="public" />
                {ledger.circleStatus === CircleStatus.ROUND_IN_PROGRESS && (
                  <StatRow
                    label="Round deadline"
                    value={<CountdownTimer deadlineTimestamp={ledger.roundDeadline} />}
                    privacy="public"
                  />
                )}
                <StatRow label="Current round" value={`${ledger.currentRound + 1} / ${ledger.roundCount}`} privacy="public" />
                <StatRow label="Contributions received" value={`${ledger.contributionsThisRound} / ${ledger.memberCap}`} privacy="public" />
                <StatRow
                  label="Your slot"
                  value={isMember ? String(contract.myLeafIndex) : 'N/A'}
                  privacy="private"
                />
              </div>
            </div>

            {/* ZK proof in progress */}
            {isGenerating && (
              <ZkProofSpinner
                label={proofState === 'generating' ? 'Generating ZK proof' : 'Submitting transaction'}
                elapsedMs={proofElapsedMs}
              />
            )}

            {/* Action: Join */}
            {!isMember && ledger.circleStatus === CircleStatus.OPEN && !isGenerating && (
              <div className="card card-violet">
                <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.25rem' }}>
                  <Lock size={13} color="var(--violet)" style={{ flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>Join this circle</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                      Your identity is committed into the Merkle tree using a ZK proof. Your secret never leaves this device.
                    </p>
                  </div>
                </div>
                <button
                  className="btn-primary"
                  onClick={contract.joinCircle}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Join circle
                </button>
                <p style={{ marginTop: '0.625rem', fontSize: '0.6875rem', color: 'var(--text-faint)', textAlign: 'center' }}>
                  You'll be assigned payout slot {ledger.memberCount}
                </p>
              </div>
            )}

            {/* Action: Contribute */}
            {canContribute && !isGenerating && (
              <div className="card">
                <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.25rem' }}>
                  <Lock size={13} color="var(--violet)" style={{ flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
                      Contribute — Round {ledger.currentRound + 1}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                      Verified anonymously. No one can link this transaction to your identity.
                    </p>
                  </div>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 1rem', marginBottom: '0.875rem',
                  background: 'var(--violet-dim)', border: '1px solid var(--border-violet)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span className="label">Amount</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--violet)' }}>
                    {formatNight(ledger.contributionAmount)}
                  </span>
                </div>
                <button
                  className="btn-primary"
                  onClick={contract.contribute}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Contribute {formatNight(ledger.contributionAmount)}
                </button>
              </div>
            )}

            {/* Action: Claim payout */}
            {canClaim && !isGenerating && (
              <div className="card card-green">
                <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--green)', marginBottom: '0.375rem' }}>
                  Your payout is ready
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '1.125rem' }}>
                  All members contributed. You are the designated recipient for round {ledger.currentRound + 1}.
                </p>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 1rem', marginBottom: '0.875rem',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span className="label">You receive</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.0625rem', color: 'var(--green)' }}>
                    {formatNight(ledger.contributionAmount * BigInt(ledger.memberCap))}
                  </span>
                </div>
                <button
                  className="btn-primary"
                  onClick={contract.claimPayout}
                  style={{ width: '100%', justifyContent: 'center', background: 'var(--green)' }}
                >
                  Claim {formatNight(ledger.contributionAmount * BigInt(ledger.memberCap))}
                </button>
              </div>
            )}

            {/* State: Default detected */}
            {ledger.circleStatus === CircleStatus.DEFAULT_DETECTED && (
              <div className="card card-red">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <AlertTriangle size={13} color="var(--red)" />
                  <p style={{ fontWeight: 600, color: 'var(--red)' }}>Default detected</p>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  A member missed the deadline. Their commitment has been published.
                  All honest members remain fully anonymous.
                </p>
              </div>
            )}

            {/* Action: Report default */}
            {canReport && !isGenerating && (
              <div>
                <button
                  className="btn-danger"
                  onClick={() => setShowDefaultForm(f => !f)}
                  style={{ marginBottom: '0.75rem' }}
                >
                  <AlertTriangle size={12} />
                  Report a default
                </button>
                {showDefaultForm && (
                  <form onSubmit={handleReportDefault} className="card">
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '1rem' }}>
                      Only the defaulter's commitment hash will be published. Honest members stay private.
                    </p>
                    <div className="field" style={{ marginBottom: '0.875rem' }}>
                      <label className="input-label" htmlFor="report-leaf">
                        Defaulter slot index (0–{ledger.memberCap - 1})
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          id="report-leaf"
                          className="input"
                          type="number"
                          min="0"
                          max={ledger.memberCap - 1}
                          value={reportLeaf}
                          onChange={e => setReportLeaf(e.target.value)}
                          placeholder="0"
                          style={{ width: 100 }}
                        />
                        <button type="submit" className="btn-danger">Report</button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Completed: participation proof */}
            {ledger.circleStatus === CircleStatus.COMPLETED && isMember && !isGenerating && (
              <div>
                <div className="divider-label" style={{ marginBottom: '1.25rem' }}>Circle complete</div>
                {participationReceipt ? (
                  <div className="card">
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '0.875rem' }}>
                      Participation receipt — prove you completed this circle without revealing your identity.
                    </p>
                    <div className="hash-display" style={{ userSelect: 'all', marginBottom: '0.75rem' }}>
                      0x{participationReceipt}
                    </div>
                    <button
                      className="btn-ghost"
                      onClick={() => navigator.clipboard.writeText(`0x${participationReceipt}`)}
                    >
                      <Copy size={11} /> Copy receipt
                    </button>
                  </div>
                ) : (
                  <button className="btn-primary" onClick={handleGenerateProof}>
                    Generate participation proof
                  </button>
                )}
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <p className="label" style={{ marginBottom: '0.5rem' }}>{label}</p>}
      {children}
    </div>
  );
}

function StatRow({
  label,
  value,
  privacy,
}: {
  label: string;
  value: React.ReactNode;
  privacy: 'public' | 'private';
}) {
  return (
    <div className="data-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <PrivacyBadge type={privacy} />
        <span className="label" style={{ color: 'var(--text-faint)' }}>{label}</span>
      </div>
      <span className="data-row-value">{value}</span>
    </div>
  );
}
