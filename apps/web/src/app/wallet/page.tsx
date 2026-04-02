'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface WalletItem {
  id: string
  prize_name: string
  business_name: string | null
  coupon_code: string | null
  expires_at: string | null
  is_long_term: boolean
  is_lootable: boolean
}

interface UserStats {
  consumer_points: number
  consumer_tier: string
}

export default function WalletPage() {
  const { user, isSignedIn } = useUser()
  const [items, setItems] = useState<WalletItem[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCode, setShowCode] = useState<string | null>(null)

  useEffect(() => {
    if (!isSignedIn) return
    setLoading(true)

    // Fetch wallet items and user stats
    Promise.all([
      fetch(`${API_URL}/users/me/wallet`, {
        headers: { Authorization: `Bearer ${user?.id}` },
      }).then((r) => r.json()).then((d) => d.data ?? []).catch(() => []),
      fetch(`${API_URL}/users/me/stats`, {
        headers: { Authorization: `Bearer ${user?.id}` },
      }).then((r) => r.json()).then((d) => d.data).catch(() => null),
    ]).then(([walletData, statsData]) => {
      setItems(walletData)
      setStats(statsData)
    }).finally(() => setLoading(false))
  }, [isSignedIn, user?.id])

  const formatExpiry = (date: string | null) => {
    if (!date) return 'No expiry'
    const d = new Date(date)
    const now = new Date()
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0) return 'Expired'
    if (daysLeft === 1) return '1 day left'
    if (daysLeft <= 7) return `${daysLeft} days left`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const tierColors: Record<string, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen bg-night flex items-center justify-center">
        <p className="text-surface/50">Sign in to view your wallet</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-night">
      <header className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-btc text-sm font-medium hover:underline">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-surface mt-1">Wallet</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-16">
        {/* Stats bar */}
        {stats && (
          <div className="flex items-center gap-6 mb-8">
            <div className="bg-[#1a1230] rounded-xl px-5 py-3 flex items-center gap-3">
              <span className="text-2xl font-black text-btc">{stats.consumer_points}</span>
              <span className="text-surface/50 text-sm">points</span>
            </div>
            {stats.consumer_tier && (
              <div
                className="rounded-full px-4 py-1.5 text-xs font-bold uppercase"
                style={{
                  backgroundColor: tierColors[stats.consumer_tier] || '#F7941D',
                  color: '#000',
                }}
              >
                {stats.consumer_tier}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <p className="text-surface/50 animate-pulse">Loading wallet...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎒</div>
            <p className="text-surface/60 text-lg font-bold">No coupons yet</p>
            <p className="text-surface/40 mt-2">Win deals from flash sales and battles to fill your wallet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const expired = item.expires_at && new Date(item.expires_at) < new Date()
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-5 ${expired ? 'opacity-50' : ''}`}
                  style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}
                >
                  {/* Business initial */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 font-black text-night"
                    style={{ background: '#F7941D' }}
                  >
                    {(item.business_name || '?')[0].toUpperCase()}
                  </div>

                  <h3 className="font-bold text-surface text-lg">{item.prize_name}</h3>
                  {item.business_name && (
                    <p className="text-surface/40 text-sm">{item.business_name}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2 mb-4">
                    {item.is_long_term ? (
                      <span className="text-teal text-xs font-bold flex items-center gap-1">
                        🛡️ Long-term
                      </span>
                    ) : (
                      <span className={`text-xs ${expired ? 'text-red-400' : 'text-surface/50'}`}>
                        {formatExpiry(item.expires_at)}
                      </span>
                    )}
                    {item.is_lootable && (
                      <span className="text-xs text-btc/70 bg-btc/10 px-2 py-0.5 rounded">
                        Lootable
                      </span>
                    )}
                  </div>

                  {/* Use / Show code */}
                  {showCode === item.id ? (
                    <div className="bg-night rounded-xl p-4 text-center">
                      <p className="text-surface/50 text-xs mb-2">Show to cashier</p>
                      <p className="text-btc font-mono text-xl font-bold tracking-widest">
                        {item.coupon_code || 'NO CODE'}
                      </p>
                      <button
                        onClick={() => setShowCode(null)}
                        className="mt-3 text-surface/40 text-xs hover:text-surface/60"
                      >
                        Hide
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCode(item.id)}
                      disabled={!!expired}
                      className="w-full bg-btc text-night font-bold py-2.5 rounded-xl text-sm hover:bg-btc-dark transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {expired ? 'Expired' : 'Use Coupon'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
