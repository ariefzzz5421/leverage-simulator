import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Leverage Lab — Risk before position',
  description: 'Explore live crypto prices, estimated liquidation, and position PnL before opening a trade.',
  applicationName: 'Leverage Lab',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
