import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { PWAInit } from '@/components/PWAInit'
import './globals.css'

export const metadata: Metadata = {
  title: 'SerendipEatery — Fate has good taste.',
  description: 'Flash deals at restaurants and food trucks near you. You didn\'t find it — it found you.',
  metadataBase: new URL('https://serendip.app'),
  openGraph: {
    title: 'SerendipEatery',
    description: 'Fate has good taste. You didn\'t find it — it found you.',
    url: 'https://serendip.app',
    siteName: 'SerendipEatery',
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SerendipEatery',
    description: 'Fate has good taste. You didn\'t find it — it found you.',
    images: ['/og-default.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  manifest: '/manifest.json',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'SerendipEatery',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#F7941D',
          colorBackground: '#0f0a1e',
          colorText: '#fff8f2',
          colorInputBackground: '#1a1230',
          colorInputText: '#fff8f2',
        },
        elements: {
          socialButtonsBlockButton: {
            // Provider order is set in Clerk Dashboard.
            // Recommended order: Google, Apple, Facebook, Instagram,
            // TikTok, Twitter/X, Snapchat, Discord, Spotify, GitHub, LinkedIn
          },
          socialButtonsBlockButtonText: { fontWeight: '600' },
          card: { borderRadius: '1rem' },
        },
      }}
    >
      <html lang="en">
        <body className="bg-night text-white antialiased">
          <PWAInit />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
