'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { NavBar } from '@/components/NavBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface WalletItem {
  id: string
  prize_name: string
  business_name: string
  coupon_type: 'flash' | 'high_value' | 'long_term'
  coupon_code: string
  expires_at: string | null
  auto_delete_at: string | null
  is_redeemed: boolean
  redeem_started_at: string | null
  redeem_expires_at: string | null
}

function timeLeft(target: string): string {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function isUrgent(target: string | null): boolean {
  if (!target) return false
  return new Date(target).getTime() - Date.now() < 3600000
}

export default function LootboxPage() {
  const { isSignedIn } = useUser()
  const [items, setItems] = useState<WalletItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/wallets/mine`)
      .then(r => r.json())
      .then(d => setItems(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const flash = items.filter(i => i.coupon_type === 'flash' && !i.is_redeemed)
  const highValue = items.filter(i => i.coupon_type === 'high_value' && !i.is_redeemed)
  const longTerm = items.filter(i => i.coupon_type === 'long_term' && !i.is_redeemed)

  if (!isSignedIn) {
    return (
      <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
        <p className="text-3xl mb-4">🎒</p>
        <h1 className="text-2xl font-black text-surface mb-2">Your Lootbox</h1>
        <p className="text-surface/40 mb-6">Sign in to see your deals</p>
        <Link href="/sign-in" className="bg-btc text-night font-bold px-8 py-3 rounded-full">Sign In</Link>
      </main>
    )
  }

  return (
    <>
      <NavBar variant="consumer" />
      <main className="min-h-screen bg-night px-6 py-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-surface mb-6">Your Lootbox</h1>

          {loading && <p className="text-surface/30 animate-pulse text-center py-12">Loading...</p>}

          {!loading && items.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">🎒</p>
              <p className="text-surface/40 mb-2">Your lootbox is empty</p>
              <p className="text-surface/30 text-sm mb-6">Spin the wheel or win a battle to fill it up</p>
              <Link href="/consumer" className="text-btc text-sm hover:underline">Find deals nearby →</Link>
            </div>
          )}

          {/* ─── Flash Coupons ─── */}
          {flash.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-bold text-surface/50 uppercase tracking-wider mb-3">Flash Coupons</h2>
              <div className="space-y-3">
                {flash.map(item => (
                  <div key={item.id}
                    className="rounded-xl p-4"
                    style={{
                      background: '#1a1230',
                      border: isUrgent(item.auto_delete_at) ? '2px solid #F7941D' : '1px solid rgba(247,148,29,0.1)',
                      animation: isUrgent(item.auto_delete_at) ? 'pulse 2s ease-in-out infinite' : undefined,
                    }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-surface font-bold">{item.prize_name}</p>
                        <p className="text-surface/40 text-xs">{item.business_name}</p>
                      </div>
                      {item.auto_delete_at && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${isUrgent(item.auto_delete_at) ? 'bg-btc/20 text-btc' : 'bg-white/5 text-surface/40'}`}>
                          {timeLeft(item.auto_delete_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-btc/60 text-xs mt-2">Show at counter — Use at {item.business_name}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─── High Value ─── */}
          {highValue.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-bold text-surface/50 uppercase tracking-wider mb-3">High Value</h2>
              <div className="space-y-3">
                {highValue.map(item => (
                  <div key={item.id}
                    className="rounded-xl p-4"
                    style={{ background: '#1a1230', border: '2px solid #FFD700' }}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-surface font-bold">{item.prize_name}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">High Value</span>
                        </div>
                        <p className="text-surface/40 text-xs">{item.business_name}</p>
                      </div>
                    </div>
                    <Link href={`/lootbox/redeem/${item.id}`}
                      className="block w-full bg-btc text-night font-bold py-2.5 rounded-xl text-center text-sm hover:bg-btc-dark transition">
                      Redeem
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─── Long Term ─── */}
          {longTerm.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-bold text-surface/50 uppercase tracking-wider mb-3">Long Term</h2>
              <div className="space-y-3">
                {longTerm.map(item => (
                  <div key={item.id}
                    className="rounded-xl p-4"
                    style={{ background: '#1a1230', border: '1px solid rgba(29,158,117,0.3)' }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-surface font-bold">{item.prize_name}</p>
                        <p className="text-surface/40 text-xs">{item.business_name}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/20 text-teal">Valid 1 year</span>
                    </div>
                    <p className="text-surface/30 text-xs mt-2">Show at counter — can be looted in battles</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  )
}
