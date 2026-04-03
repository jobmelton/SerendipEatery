'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { NavBar } from '@/components/NavBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function PromotionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [sale, setSale] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/sales/${id}`)
      .then((r) => r.json())
      .then((d) => setSale(d.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const fmt = (d: string) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) return (
    <><NavBar variant="business" /><main className="min-h-screen bg-night flex items-center justify-center"><p className="text-surface/30 animate-pulse">Loading...</p></main></>
  )

  if (!sale) return (
    <><NavBar variant="business" /><main className="min-h-screen bg-night flex items-center justify-center"><p className="text-surface/40">Promotion not found</p></main></>
  )

  const spinsTotal = sale.max_spins_total ?? 100
  const spinsUsed = sale.spins_used ?? 0
  const pct = Math.min((spinsUsed / spinsTotal) * 100, 100)
  const canEdit = ['scheduled', 'draft'].includes(sale.status)

  return (
    <>
      <NavBar variant="business" />
      <main className="min-h-screen bg-night px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/business/promotions" className="text-btc text-sm hover:underline">&larr; All Promotions</Link>

          <div className="flex items-start justify-between mt-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-surface">{sale.title || 'Flash Sale'}</h1>
              <p className="text-surface/40 text-sm mt-1">{fmt(sale.starts_at)} — {fmt(sale.ends_at)}</p>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full capitalize"
              style={{ background: sale.status === 'live' ? 'rgba(29,158,117,0.15)' : 'rgba(247,148,29,0.1)', color: sale.status === 'live' ? '#1D9E75' : '#F7941D' }}>
              {sale.status}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1230] rounded-xl p-4">
              <p className="text-2xl font-black text-surface">{spinsUsed}</p>
              <p className="text-surface/40 text-xs">Spins Used</p>
            </div>
            <div className="bg-[#1a1230] rounded-xl p-4">
              <p className="text-2xl font-black text-surface">{sale.confirmed_visits ?? 0}</p>
              <p className="text-surface/40 text-xs">Confirmed Visits</p>
            </div>
            <div className="bg-[#1a1230] rounded-xl p-4">
              <p className="text-2xl font-black text-btc">{spinsTotal > 0 ? Math.round((sale.confirmed_visits ?? 0) / Math.max(spinsUsed, 1) * 100) : 0}%</p>
              <p className="text-surface/40 text-xs">Conversion Rate</p>
            </div>
            <div className="bg-[#1a1230] rounded-xl p-4">
              <p className="text-2xl font-black text-teal">${((sale.confirmed_visits ?? 0) * 1.5).toFixed(2)}</p>
              <p className="text-surface/40 text-xs">Revenue Impact</p>
            </div>
          </div>

          {/* Spins progress */}
          <div className="bg-[#1a1230] rounded-xl p-4 mb-6">
            <div className="flex justify-between text-xs text-surface/40 mb-1">
              <span>Spins: {spinsUsed} / {spinsTotal}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-btc transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Prize breakdown */}
          <section className="bg-[#1a1230] rounded-2xl p-5 mb-6">
            <h2 className="text-lg font-bold text-surface mb-3">Prize Breakdown</h2>
            <div className="space-y-3">
              {(sale.prizes ?? []).map((prize: any) => (
                <div key={prize.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-surface text-sm font-bold">{prize.label || prize.name}</p>
                    <p className="text-surface/30 text-xs">{prize.spins_used ?? 0} / {prize.max_spins} won</p>
                  </div>
                  <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-btc" style={{ width: `${Math.min(((prize.spins_used ?? 0) / (prize.max_spins || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {canEdit && (
              <button className="bg-btc text-night font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-btc-dark transition">Edit</button>
            )}
            <button className="bg-white/5 text-surface/50 font-bold px-5 py-2.5 rounded-xl text-sm hover:text-surface transition">Duplicate</button>
            <button className="bg-white/5 text-surface/50 font-bold px-5 py-2.5 rounded-xl text-sm hover:text-surface transition">Download Report (CSV)</button>
          </div>
        </div>
      </main>
    </>
  )
}
