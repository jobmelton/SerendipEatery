'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'

const CONSUMER_NAV = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/consumer', label: 'Deals', icon: '🎰' },
  { href: '/wallet', label: 'Wallet', icon: '🎒' },
  { href: '/profile', label: 'Profile', icon: '🧭' },
]

const BUSINESS_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/analytics', label: 'Analytics', icon: '📈' },
  { href: '/billing', label: 'Billing', icon: '💳' },
  { href: '/business/onboarding', label: 'Guide', icon: '📖' },
]

export function NavBar({ variant = 'consumer' }: { variant?: 'consumer' | 'business' }) {
  const { isSignedIn } = useUser()
  const pathname = usePathname()
  const links = variant === 'business' ? BUSINESS_NAV : CONSUMER_NAV

  if (!isSignedIn) return null

  return (
    <nav className="bg-night border-b border-white/5 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-baseline gap-0.5 shrink-0">
          <span className="font-display text-lg font-black text-btc">S</span>
          <span className="font-display text-lg font-black text-surface">erendip</span>
          <span className="font-display text-lg font-black text-btc/40">Eatery</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  active
                    ? 'bg-btc/10 text-btc'
                    : 'text-surface/50 hover:text-surface/80'
                }`}
              >
                <span className="text-xs">{link.icon}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            )
          })}
        </div>

        {/* User button */}
        <UserButton
          appearance={{ variables: { colorPrimary: '#F7941D' } }}
          afterSignOutUrl="/"
        />
      </div>
    </nav>
  )
}
