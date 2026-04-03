'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/NavBar'
import { ShadowModeBanner } from '@/components/ShadowModeBanner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(29,158,117,0.15)', text: '#1D9E75' },
  live: { bg: 'rgba(29,158,117,0.15)', text: '#1D9E75' },
  shadow: { bg: 'rgba(120,120,120,0.15)', text: '#888' },
  scheduled: { bg: 'rgba(83,74,183,0.2)', text: '#534AB7' },
  ended: { bg: 'rgba(255,255,255,0.05)', text: '#888' },
  draft: { bg: 'rgba(247,148,29,0.1)', text: '#F7941D' },
  cancelled: { bg: 'rgba(229,62,62,0.1)', text: '#E53E3E' },
}

const TABS = ['active', 'scheduled', 'ended', 'draft'] as const

export default function PromotionsPage() {
  const [tab, setTab] = useState<string>('active')
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [shadowInfo, setShadowInfo] = useState<{ shadow_mode: boolean; shadow_mode_reason?: string; shadow_mode_at?: string; missed_count?: number } | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/sales/mine?status=${tab === 'active' ? 'live' : tab}`)
      .then((r) => r.json())
      .then((d) => setSales(d.data ?? []))
      .catch(() => setSales([]))
      .finally(() => setLoading(false))
  }, [tab])

  const filtered = sales.filter((s) =>
    !search || (s.title ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const fmt = (d: string) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <NavBar variant="business" />
      <main className="min-h-screen bg-night px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Shadow mode banner */}
          {shadowInfo?.shadow_mode && (
            <ShadowModeBanner
              shadowMode={shadowInfo.shadow_mode}
              reason={shadowInfo.shadow_mode_reason}
              shadowModeAt={shadowInfo.shadow_mode_at}
              missedCount={shadowInfo.missed_count}
            />
          )}

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-surface">Promotions</h1>
            <Link href="/business/setup" className="bg-btc text-night font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-btc-dark transition">
              + Create New
            </Link>
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search promotions..."
            className="w-full bg-[#1a1230] text-surface border border-white/10 rounded-xl px-4 py-2.5 text-sm mb-4 focus:border-btc focus:outline-none placeholder:text-surface/20"
          />

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition ${tab === t ? 'bg-btc text-night' : 'bg-white/5 text-surface/40 hover:text-surface/60'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Sales list */}
          {loading ? (
            <p className="text-surface/30 text-center py-12 animate-pulse">Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-surface/40 mb-2">No {tab} promotions</p>
              <Link href="/business/setup" className="text-btc text-sm hover:underline">Create your first promotion</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((sale) => {
                const isShadow = sale.shadow_mode === true
                const displayStatus = isShadow ? 'shadow' : sale.status
                const sc = STATUS_COLORS[displayStatus] ?? STATUS_COLORS.draft
                const spinsTotal = sale.max_spins_total ?? 100
                const spinsUsed = sale.spins_used ?? 0
                const pct = Math.min((spinsUsed / spinsTotal) * 100, 100)

                return (
                  <div key={sale.id} className="bg-[#1a1230] rounded-2xl p-5" style={{ border: isShadow ? '1px solid rgba(120,120,120,0.3)' : '1px solid rgba(247,148,29,0.08)' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {/* Status dot */}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isShadow ? 'bg-gray-400 animate-pulse' : sale.status === 'live' ? 'bg-teal' : 'bg-btc/40'}`} />
                        <div>
                          <h3 className="text-surface font-bold">{sale.title || 'Flash Sale'}</h3>
                          <p className="text-surface/40 text-xs mt-0.5">{fmt(sale.starts_at)} — {fmt(sale.ends_at)}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize" style={{ background: sc.bg, color: sc.text }}
                        title={isShadow ? `Notifications paused — ${sale.missed_count ?? 0} missed opportunities` : undefined}>
                        {isShadow ? 'Shadow Mode' : sale.status}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-4 text-xs text-surface/40 mb-3">
                      <span>{sale.prizes?.length ?? 0} prizes</span>
                      <span>{spinsUsed}/{spinsTotal} spins</span>
                      <span>{sale.confirmed_visits ?? 0} visits</span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full bg-btc" style={{ width: `${pct}%` }} />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {(sale.status === 'live' || sale.status === 'active') && (
                        <>
                          <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 text-surface/50 hover:text-surface transition">Pause</button>
                          <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">End Now</button>
                          <Link href={`/business/promotions/${sale.id}`} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-btc/10 text-btc hover:bg-btc/20 transition">View Analytics</Link>
                        </>
                      )}
                      {sale.status === 'scheduled' && (
                        <>
                          <Link href={`/business/promotions/${sale.id}`} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 text-surface/50 hover:text-surface transition">Edit</Link>
                          <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">Cancel</button>
                        </>
                      )}
                      {sale.status === 'ended' && (
                        <>
                          <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 text-surface/50 hover:text-surface transition">Duplicate</button>
                          <Link href={`/business/promotions/${sale.id}`} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-btc/10 text-btc hover:bg-btc/20 transition">View Report</Link>
                        </>
                      )}
                      {sale.status === 'draft' && (
                        <>
                          <Link href={`/business/promotions/${sale.id}`} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 text-surface/50 hover:text-surface transition">Edit</Link>
                          <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-btc text-night hover:bg-btc-dark transition">Go Live</button>
                          <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
