import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppProvider } from '@features/boot/AppProvider';
import './globals.css';

export const metadata: Metadata = {
  title: "عالم مريم السحري · Mariam's Magical World",
  description: 'A bilingual early-learning adventure for young children.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon-192.png' },
  appleWebApp: { capable: true, title: 'عالم مريم', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#e8f6ff',
  // Children pinch accidentally; the game provides its own large controls instead.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Arabic is the default; LocaleSync updates lang/dir from saved settings on the client.
  return (
    <html lang="ar-EG" dir="rtl" suppressHydrationWarning>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
