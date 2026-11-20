import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import Shell from '@/components/Shell';

// Self-hosted at build time by next/font (no font CDN at runtime). See docs/DESIGN.md.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-grotesk', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: 'Tidemere · Market Data Discovery (Snowflake example)',
  description: 'Find, understand and query licensed market data in plain English, read in place from a share. Synthetic data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`} suppressHydrationWarning>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
