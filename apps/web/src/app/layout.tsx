import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SerendipEatery — Spin your next meal',
  description: 'Flash sales at food trucks and restaurants near you. Spin the wheel. Win a deal. Walk in.',
  metadataBase: new URL('https://serendip.app'),
  openGraph: {
    title: 'SerendipEatery',
    description: 'Spin your next meal. Win a deal. Walk in.',
    url: 'https://serendip.app',
    siteName: 'SerendipEatery',
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SerendipEatery',
    description: 'Spin your next meal. Win a deal. Walk in.',
    images: ['/og-default.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-night text-white antialiased">
        {children}
      </body>
    </html>
  )
}
