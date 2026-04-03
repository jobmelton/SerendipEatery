'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'

const CONSUMER_NAV = [
  { href: '/consumer', label: 'Deals', icon: '🎰' },
  { href: '/wallet', label: 'Lootbox', icon: '🎒' },
  { href: '/battles', label: 'Battles', icon: '⚔️' },
  { href: '/profile', label: 'Profile', icon: '🎁' },
]

const BUSINESS_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/business/promotions', label: 'Promotions', icon: '🎯' },
  { href: '/analytics', label: 'Analytics', icon: '📈' },
  { href: '/billing', label: 'Settings', icon: '⚙️' },
]

export function NavBar({ variant = 'consumer' }: { variant?: 'consumer' | 'business' }) {
  const { isSignedIn } = useUser()
  const pathname = usePathname()
  const router = useRouter()

  // Dual account mode — stored in localStorage
  const [mode, setMode] = useState<'consumer' | 'business'>(variant)
  const [hasDual, setHasDual] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('account_mode') as 'consumer' | 'business' | null
    if (stored) setMode(stored)
    setHasDual(localStorage.getItem('has_dual_account') === 'true')
  }, [])

  const switchMode = (newMode: 'consumer' | 'business') => {
    setMode(newMode)
    localStorage.setItem('account_mode', newMode)
    router.push(newMode === 'consumer' ? '/consumer' : '/dashboard')
  }

  if (!isSignedIn) return null

  const links = mode === 'business' ? BUSINESS_NAV : CONSUMER_NAV

  return (
    <nav className="bg-night border-b border-white/5 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-baseline gap-0.5 shrink-0">
          <span className="font-display text-lg font-black text-btc">S</span>
          <span className="font-display text-lg font-black text-surface">erendip</span>
          <span className="font-display text-lg font-black text-btc/40 hidden sm:inline">Eatery</span>
        </Link>

        {/* Mode switcher (dual accounts only) */}
        {hasDual && (
          <div className="flex bg-white/5 rounded-full p-0.5 mx-2">
            <button
              onClick={() => switchMode('consumer')}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${mode === 'consumer' ? 'bg-btc text-night' : 'text-surface/40'}`}
            >
              🍽️ <span className="hidden sm:inline">Consumer</span>
            </button>
            <button
              onClick={() => switchMode('business')}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${mode === 'business' ? 'bg-btc text-night' : 'text-surface/40'}`}
            >
              🏪 <span className="hidden sm:inline">Business</span>
            </button>
          </div>
        )}

        {/* Nav links */}
        <div className="flex items-center gap-0.5">
          {links.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  active ? 'bg-btc/10 text-btc' : 'text-surface/50 hover:text-surface/80'
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
