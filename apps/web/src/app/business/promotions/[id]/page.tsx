'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { NavBar } from '@/components/NavBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface PrizeAnalytics {
  name: string
  probability: number
  timesWon: number
  conversionRate: number
  revenueGenerated: number
  bestTimeOfDay: string
}

interface FullAnalytics {
  notifications_sent: number
  notification_open_rate: number
  spins_total: number
  spin_rate: number
  prizes_claimed: number
  claim_rate: number
  confirmed_visits: number
  conversion_rate: number
  missed_notifications: number
  missed_spins: number
  geofence_entries_total: number
  geofence_entries_missed: number
  prizes: PrizeAnalytics[]
  peak_spin_hour: string
  peak_visit_hour: string
  avg_time_to_visit: number
  tier_breakdown: Record<string, number>
  business_plan: string
}

export default function PromotionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [sale, setSale] = useState<any>(null)
  const [analytics, setAnalytics] = useState<FullAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/sales/${id}`).then(r => r.json()),
      fetch(`${API_URL}/analytics/sale/${id}/full`).then(r => r.json()).catch(() => ({ data: null })),
    ])
      .then(([saleRes, analyticsRes]) => {
        setSale(saleRes.data)
        setAnalytics(analyticsRes.data ?? null)
      })
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
  const isFreeTier = analytics?.business_plan === 'trial'
  const hasMissed = (analytics?.missed_notifications ?? 0) + (analytics?.missed_spins ?? 0) > 0
  const totalMissed = (analytics?.missed_notifications ?? 0) + (analytics?.missed_spins ?? 0)

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
              {sale.shadow_mode ? 'Visit limit reached' : sale.status}
            </span>
          </div>

          {/* ─── Row 1: Funnel Metrics ─── */}
          {analytics && (
            <div className="mb-6">
              <h2 className="text-sm font-bold text-surface/50 uppercase tracking-wider mb-3">Conversion Funnel</h2>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <FunnelCard label="Notified" value={analytics.notifications_sent} />
                <span className="text-surface/20 text-lg shrink-0">&rarr;</span>
                <FunnelCard label="Spun" value={analytics.spins_total} pct={analytics.spin_rate} />
                <span className="text-surface/20 text-lg shrink-0">&rarr;</span>
                <FunnelCard label="Claimed" value={analytics.prizes_claimed} pct={analytics.claim_rate} />
                <span className="text-surface/20 text-lg shrink-0">&rarr;</span>
                <FunnelCard label="Visited" value={analytics.confirmed_visits} pct={analytics.conversion_rate} color="#1D9E75" />
              </div>
            </div>
          )}

          {/* ─── Stats Grid ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1230] rounded-xl p-4">
              <p className="text-2xl font-black text-surface">{spinsUsed}</p>
              <p className="text-surface/40 text-xs">Spins Used</p>
            </div>
            <div className="bg-[#1a1230] rounded-xl p-4">
              <p className="text-2xl font-black text-surface">{analytics?.confirmed_visits ?? sale.confirmed_visits ?? 0}</p>
              <p className="text-surface/40 text-xs">Confirmed Visits</p>
            </div>
            <div className="bg-[#1a1230] rounded-xl p-4">
              <p className="text-2xl font-black text-btc">{analytics?.conversion_rate ?? 0}%</p>
              <p className="text-surface/40 text-xs">Conversion Rate</p>
            </div>
            <div className="bg-[#1a1230] rounded-xl p-4">
              <p className="text-2xl font-black text-teal">${((analytics?.confirmed_visits ?? 0) * 1.5).toFixed(2)}</p>
              <p className="text-surface/40 text-xs">Revenue Impact</p>
            </div>
          </div>

          {/* ─── Spins progress ─── */}
          <div className="bg-[#1a1230] rounded-xl p-4 mb-6">
            <div className="flex justify-between text-xs text-surface/40 mb-1">
              <span>Spins: {spinsUsed} / {spinsTotal}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-btc transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* ─── Row 2: Prize Performance Table ─── */}
          {analytics && analytics.prizes.length > 0 && (
            <section className="bg-[#1a1230] rounded-2xl p-5 mb-6">
              <h2 className="text-lg font-bold text-surface mb-3">Prize Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-surface/40 text-xs text-left border-b border-white/5">
                      <th className="pb-2 pr-4">Prize</th>
                      <th className="pb-2 pr-4">Probability</th>
                      <th className="pb-2 pr-4">Times Won</th>
                      <th className="pb-2 pr-4">Visit Rate</th>
                      <th className="pb-2">Best Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.prizes.map((p, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="py-2.5 pr-4 text-surface font-bold">{p.name}</td>
                        <td className="py-2.5 pr-4 text-surface/60">{p.probability}%</td>
                        <td className="py-2.5 pr-4 text-surface/60">{p.timesWon}</td>
                        <td className="py-2.5 pr-4 text-teal font-bold">{p.conversionRate}%</td>
                        <td className="py-2.5 text-surface/40">{p.bestTimeOfDay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ─── Row 3: Missed Opportunity Banner (Free tier) ─── */}
          {isFreeTier && hasMissed && (
            <div className="rounded-2xl p-5 mb-6" style={{ background: 'linear-gradient(135deg, #7a3800, #4a2000)', border: '1px solid #F7941D' }}>
              <p className="text-surface font-bold text-lg mb-1">
                You missed {totalMissed} potential customers after your 5-visit limit
              </p>
              <p className="text-surface/60 text-sm mb-4">
                Upgrade to unlock unlimited visits and capture all this traffic
              </p>
              <div className="flex gap-3">
                <Link href="/billing?plan=starter" className="bg-btc text-night font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-btc-dark transition">
                  Upgrade Now
                </Link>
                <Link href="/pricing" className="text-btc text-sm hover:underline flex items-center">
                  See plans &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* ─── Locked Sections (Free tier: blurred) ─── */}
          {analytics && (
            <>
              {/* Geofence entries */}
              <section className="relative bg-[#1a1230] rounded-2xl p-5 mb-6 overflow-hidden">
                <h2 className="text-lg font-bold text-surface mb-3">Geofence Activity</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-black text-surface">{analytics.geofence_entries_total}</p>
                    <p className="text-surface/40 text-xs">Total entries</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-red-400">{analytics.geofence_entries_missed}</p>
                    <p className="text-surface/40 text-xs">Missed (no notification)</p>
                  </div>
                </div>
                {isFreeTier && (
                  <div className="absolute inset-0 backdrop-blur-md bg-night/60 flex items-center justify-center rounded-2xl">
                    <div className="text-center">
                      <p className="text-surface font-bold mb-2">Upgrade to see full geofence data</p>
                      <Link href="/pricing" className="text-btc text-sm hover:underline">View plans &rarr;</Link>
                    </div>
                  </div>
                )}
              </section>

              {/* Time Analysis */}
              <section className="relative bg-[#1a1230] rounded-2xl p-5 mb-6 overflow-hidden">
                <h2 className="text-lg font-bold text-surface mb-3">Time Analysis</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xl font-black text-btc">{analytics.peak_spin_hour}</p>
                    <p className="text-surface/40 text-xs">Peak spin hour</p>
                  </div>
                  <div>
                    <p className="text-xl font-black text-teal">{analytics.peak_visit_hour}</p>
                    <p className="text-surface/40 text-xs">Peak visit hour</p>
                  </div>
                  <div>
                    <p className="text-xl font-black text-surface">{analytics.avg_time_to_visit}m</p>
                    <p className="text-surface/40 text-xs">Avg time to visit</p>
                  </div>
                </div>
                {isFreeTier && (
                  <div className="absolute inset-0 backdrop-blur-md bg-night/60 flex items-center justify-center rounded-2xl">
                    <div className="text-center">
                      <p className="text-surface font-bold mb-2">Upgrade to see time optimization</p>
                      <Link href="/pricing" className="text-btc text-sm hover:underline">View plans &rarr;</Link>
                    </div>
                  </div>
                )}
              </section>

              {/* Tier Breakdown */}
              <section className="relative bg-[#1a1230] rounded-2xl p-5 mb-6 overflow-hidden">
                <h2 className="text-lg font-bold text-surface mb-3">Customer Tiers</h2>
                <div className="space-y-2">
                  {Object.entries(analytics.tier_breakdown).map(([tier, count]) => {
                    const total = Object.values(analytics.tier_breakdown).reduce((a, b) => a + b, 0)
                    const tierPct = total > 0 ? Math.round((count / total) * 100) : 0
                    return (
                      <div key={tier} className="flex items-center gap-3">
                        <span className="text-surface/50 text-xs w-24 capitalize">{tier.replace(/_/g, ' ')}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-btc rounded-full" style={{ width: `${tierPct}%` }} />
                        </div>
                        <span className="text-surface/40 text-xs w-8 text-right">{isFreeTier ? '?' : `${tierPct}%`}</span>
                      </div>
                    )
                  })}
                </div>
                {isFreeTier && (
                  <div className="absolute inset-0 backdrop-blur-md bg-night/60 flex items-center justify-center rounded-2xl">
                    <div className="text-center">
                      <p className="text-surface font-bold mb-2">Upgrade to see full tier breakdown</p>
                      <Link href="/pricing" className="text-btc text-sm hover:underline">View plans &rarr;</Link>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {/* ─── Actions ─── */}
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

function FunnelCard({ label, value, pct, color }: { label: string; value: number; pct?: number; color?: string }) {
  return (
    <div className="bg-[#1a1230] rounded-xl px-4 py-3 min-w-[100px] text-center shrink-0">
      <p className="text-xl font-black" style={{ color: color || '#fff8f2' }}>{value}</p>
      <p className="text-surface/40 text-xs">{label}{pct !== undefined ? ` (${pct}%)` : ''}</p>
    </div>
  )
}
