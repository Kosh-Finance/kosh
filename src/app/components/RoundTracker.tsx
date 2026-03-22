'use client';

interface RoundTrackerProps {
  totalRounds: number;
  currentRound: number;
  defaultedRounds?: number[];
  compact?: boolean;
}

export function RoundTracker({
  totalRounds,
  currentRound,
  defaultedRounds = [],
  compact = false,
}: RoundTrackerProps) {
  const height = compact ? '4px' : '6px';

  return (
    <div>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span className="label">Round progress</span>
          <span className="label" style={{ color: 'var(--text-muted)' }}>
            {Math.min(currentRound, totalRounds)} / {totalRounds}
          </span>
        </div>
      )}

      <div
        className="round-tracker"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalRounds}
        aria-valuenow={currentRound}
        aria-label={`Round ${currentRound} of ${totalRounds}`}
        style={{ height }}
      >
        {Array.from({ length: totalRounds }, (_, i) => {
          const isCompleted = i < currentRound;
          const isCurrent   = i === currentRound;
          const isDefaulted = defaultedRounds.includes(i);

          let segClass = 'round-segment';
          if (isDefaulted)       segClass += ' defaulted';
          else if (isCompleted)  segClass += ' paid';
          else if (isCurrent)    segClass += ' pending';

          return (
            <div
              key={i}
              className={segClass}
              style={{
                height,
                opacity: !isCompleted && !isCurrent && !isDefaulted ? 0.4 : 1,
                animation: isCurrent ? 'pulseDot 1.5s ease-in-out infinite' : undefined,
              }}
              title={
                isDefaulted ? `Round ${i + 1}: Default`
                : isCompleted ? `Round ${i + 1}: Completed`
                : isCurrent   ? `Round ${i + 1}: In progress`
                :                `Round ${i + 1}: Upcoming`
              }
            />
          );
        })}
      </div>

      {!compact && totalRounds <= 8 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem' }}>
          {Array.from({ length: totalRounds }, (_, i) => (
            <span
              key={i}
              className="label"
              style={{
                color: i < currentRound
                  ? 'var(--violet)'
                  : i === currentRound
                  ? 'var(--text-muted)'
                  : 'var(--text-faint)',
                fontSize: '0.5rem',
              }}
            >
              {i + 1}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MemberSlots({
  memberCap,
  memberCount,
  defaultedSlots = [],
}: {
  memberCap: number;
  memberCount: number;
  defaultedSlots?: number[];
}) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {Array.from({ length: memberCap }, (_, i) => {
        const filled   = i < memberCount;
        const defaulted = defaultedSlots.includes(i);
        return (
          <div
            key={i}
            title={
              defaulted ? `Member ${i + 1}: Defaulted`
              : filled   ? `Member ${i + 1}: Joined`
              :            `Member ${i + 1}: Open slot`
            }
            style={{
              width: 10,
              height: 10,
              borderRadius: '2px',
              background: defaulted
                ? 'var(--red)'
                : filled
                ? 'var(--violet)'
                : 'transparent',
              border: `1px solid ${
                defaulted ? 'var(--red)' : filled ? 'var(--border-violet)' : 'var(--border)'
              }`,
              transition: 'background 300ms',
            }}
          />
        );
      })}
    </div>
  );
}
