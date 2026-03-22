import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import AppNav from './components/AppNav';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbmono',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Kosh — Private Savings Circles',
    template: '%s — Kosh',
  },
  description:
    'Privacy-preserving savings circles (ZK-ROSCA) on Midnight Network. ' +
    'Contribute anonymously, receive payouts fairly, build private participation history.',
  keywords: ['ROSCA', 'savings circle', 'Midnight Network', 'zero knowledge', 'ZK', 'privacy'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AppNav />
        {children}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '1.5rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginTop: 'auto',
        }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-jbmono)' }}>
            k∅sh © 2026
          </span>
          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {([
              { href: 'https://github.com/kosh-finance', label: 'GitHub' },
              { href: 'https://x.com/koshfinance', label: 'Twitter' },
              { href: 'https://docs.kosh.finance', label: 'Docs' },
            ] as const).map(({ href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--muted)', fontSize: '0.8125rem', textDecoration: 'none' }}
              >
                {label}
              </a>
            ))}
          </nav>
        </footer>
      </body>
    </html>
  );
}
