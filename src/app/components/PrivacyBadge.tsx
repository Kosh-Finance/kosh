'use client';

import { Lock, Eye } from 'lucide-react';

interface PrivacyBadgeProps {
  type: 'private' | 'public';
  size?: 'sm' | 'md';
}

export function PrivacyBadge({ type, size = 'sm' }: PrivacyBadgeProps) {
  const iconSize = size === 'sm' ? 9 : 11;
  const fontSize = size === 'sm' ? '0.5625rem' : '0.6875rem';
  const isPrivate = type === 'private';

  return (
    <span
      className={`privacy-badge ${type}`}
      style={{ fontSize }}
      title={
        isPrivate
          ? 'This data never leaves your machine'
          : 'This data is stored on the Midnight ledger'
      }
    >
      {isPrivate ? <Lock size={iconSize} aria-hidden /> : <Eye size={iconSize} aria-hidden />}
    </span>
  );
}
