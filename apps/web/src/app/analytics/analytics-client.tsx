'use client'

import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

interface Props {
  businessName: string
  chartData: Array<{ date: string; visits: number }>
  totalRevenueCents: number
  conversionRate: number
  totalVisits: number
  totalSales: number
  topPrizes: Array<{ name: string; spins_used: number; max_spins: number }>
  tierBreakdown: Record<string, number>
  repeatRate: number
}

const TIER_LABELS: Record<string, string> = {
  explorer: 'Explorer', regular: 'Regular', local_legend: 'Local Legend',
  foodie_royale: 'Foodie Royale', tastemaker: 'Tastemaker', influencer: 'Influencer',
  food_legend: 'Food Legend', icon: 'Icon',
}

export function AnalyticsClient(props: Props) {
  const {
    businessName, chartData, totalRevenueCents, conversionRate,
    totalVisits, totalSales, topPrizes, tierBreakdown, repeatRate,
  } = props

  const maxVisits = Math.max(...chartData.map((d) => d.visits), 1)

  return (
    <main className="min-h-screen bg-night px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-surface">Analytics</h1>
            <p className="text-surface/50 text-sm">{businessName}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-btc text-sm font-medium hover:underline">Dashboard</Link>
            <UserButton appearance={{ variables: { colorPrimary: '#F7941D' } }} afterSignOutUrl="/" />
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-[#1a1230] rounded-xl p-4">
            <p className="text-2xl font-extrabold text-btc">${(totalRevenueCents / 100).toFixed(2)}</p>
            <p className="text-surface/50 text-xs mt-1">Revenue (30d)</p>
          </div>
          <div className="bg-[#1a1230] rounded-xl p-4">
            <p className="text-2xl font-extrabold text-surface">{totalVisits}</p>
            <p className="text-surface/50 text-xs mt-1">Confirmed Visits</p>
          </div>
          <div className="bg-[#1a1230] rounded-xl p-4">
            <p className="text-2xl font-extrabold text-surface">{conversionRate}%</p>
            <p className="text-surface/50 text-xs mt-1">Conversion Rate</p>
          </div>
          <div className="bg-[#1a1230] rounded-xl p-4">
            <p className="text-2xl font-extrabold text-surface">{totalSales}</p>
            <p className="text-surface/50 text-xs mt-1">Total Sales</p>
          </div>
          <div className="bg-[#1a1230] rounded-xl p-4">
            <p className="text-2xl font-extrabold text-surface">{repeatRate}%</p>
            <p className="text-surface/50 text-xs mt-1">Repeat Rate</p>
          </div>
        </div>

        {/* Visits Chart */}
        <section className="bg-[#1a1230] rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold text-surface mb-4">Visits — Last 30 Days</h2>
          <div className="flex items-end gap-[2px] h-48">
            {chartData.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div
                  className="w-full bg-btc hover:bg-btc-light rounded-t transition"
                  style={{ height: `${Math.max((d.visits / maxVisits) * 100, 3)}%`, minHeight: 2 }}
                />
                <div className="absolute -top-8 bg-night text-surface text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none">
                  {d.visits}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-surface/30 text-xs">{chartData[0]?.date.slice(5)}</span>
            <span className="text-surface/30 text-xs">{chartData[chartData.length - 1]?.date.slice(5)}</span>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Prizes */}
          <section className="bg-[#1a1230] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-surface mb-4">Top Prizes</h2>
            {topPrizes.length === 0 ? (
              <p className="text-surface/40 text-sm">No prize data yet</p>
            ) : (
              <div className="space-y-3">
                {topPrizes.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-btc font-bold text-sm w-6">#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-surface text-sm font-medium">{p.name}</p>
                      <div className="h-2 bg-white/10 rounded mt-1 overflow-hidden">
                        <div
                          className="h-full bg-purple rounded"
                          style={{ width: `${p.max_spins > 0 ? (p.spins_used / p.max_spins) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-surface/50 text-xs">{p.spins_used}/{p.max_spins}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tier Breakdown */}
          <section className="bg-[#1a1230] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-surface mb-4">Customer Tiers</h2>
            {Object.keys(tierBreakdown).length === 0 ? (
              <p className="text-surface/40 text-sm">No customer data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(tierBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([tier, count]) => {
                    const total = Object.values(tierBreakdown).reduce((s, c) => s + c, 0)
                    return (
                      <div key={tier} className="flex items-center gap-3">
                        <span className="text-surface text-sm font-medium w-28">
                          {TIER_LABELS[tier] ?? tier}
                        </span>
                        <div className="flex-1 h-2 bg-white/10 rounded overflow-hidden">
                          <div
                            className="h-full bg-teal rounded"
                            style={{ width: `${(count / total) * 100}%` }}
                          />
                        </div>
                        <span className="text-surface/50 text-xs w-8 text-right">{count}</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
