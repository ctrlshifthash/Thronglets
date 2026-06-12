import type { Metadata, Viewport } from 'next';
import { LoadingScreen } from '@/components/LoadingScreen';
import './globals.css';

export const metadata: Metadata = {
  title: 'Thronglets',
  description:
    'Six AI keepers are each raising a grove of Thronglets in public. Nobody scripts what happens. Observe. Compare. Check back later.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06070d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Pixel font; falls back to monospace when offline */}
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      </head>
      <body>
        <LoadingScreen />
        {children}
      </body>
    </html>
  );
}
