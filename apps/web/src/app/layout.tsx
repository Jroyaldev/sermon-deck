import type { Metadata, Viewport } from 'next/types';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { SocketProvider } from '@/components/providers/socket-provider';
import { Analytics } from '@/components/analytics';

import './globals.css';

// Load Inter font with Latin subset for performance
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Application metadata
export const metadata: Metadata = {
  title: {
    default: 'SermonFlow | A Distraction-Free Sermon Writing App',
    template: '%s | SermonFlow',
  },
  description: 'A distraction-free, AI-powered sermon-writing application for pastors',
  keywords: [
    'sermon',
    'sermon writing',
    'pastor',
    'church',
    'ministry',
    'AI',
    'collaboration',
    'sermon preparation',
  ],
  authors: [
    {
      name: 'Jonathon Royal',
      url: 'https://github.com/Jroyaldev',
    },
  ],
  creator: 'Jonathon Royal',
  publisher: 'SermonFlow',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://sermonflow.com'
  ),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://sermonflow.com',
    title: 'SermonFlow | A Distraction-Free Sermon Writing App',
    description: 'A distraction-free, AI-powered sermon-writing application for pastors',
    siteName: 'SermonFlow',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SermonFlow',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SermonFlow | A Distraction-Free Sermon Writing App',
    description: 'A distraction-free, AI-powered sermon-writing application for pastors',
    images: ['/og-image.png'],
    creator: '@sermonflow',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon-16x16.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
      },
    ],
  },
  manifest: '/site.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

// Viewport configuration
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <QueryProvider>
              <SocketProvider>
                {children}
                <Toaster 
                  position="bottom-right"
                  toastOptions={{
                    duration: 5000,
                    style: {
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                    },
                  }}
                />
                <Analytics />
              </SocketProvider>
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
