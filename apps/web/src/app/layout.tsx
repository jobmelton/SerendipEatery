import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import './globals.css'

export const metadata: Metadata = {
  title: 'SerendipEatery — Spin. Win. Connect. Eat.',
  description: 'Flash sales at restaurants and food trucks near you. Spin to win deals, battle strangers, make friends.',
  metadataBase: new URL('https://serendip.app'),
  openGraph: {
    title: 'SerendipEatery',
    description: 'Spin to win deals, battle strangers, make friends.',
    url: 'https://serendip.app',
    siteName: 'SerendipEatery',
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SerendipEatery',
    description: 'Spin to win deals, battle strangers, make friends.',
    images: ['/og-default.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
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
      }}
    >
      <html lang="en">
        <body className="bg-night text-white antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
