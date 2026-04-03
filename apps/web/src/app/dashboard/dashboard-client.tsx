'use client'

import Link from 'next/link'
import { NavBar } from '@/components/NavBar'

interface Props {
  user: { firstName: string }
  business: any
  stats: {
    visitsToday: number
    revenueToday: number
    activeSales: number
    conversionRate: number
  }
  chartData: Array<{ date: string; visits: number }>
  recentBilling: any[]
}

export function DashboardClient({ user, business, stats, chartData, recentBilling }: Props) {
  const maxVisits = Math.max(...chartData.map((d) => d.visits), 1)

  return (
    <>
    <NavBar variant="business" />
    <main className="min-h-screen bg-night px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-surface">
            {business?.name ?? 'Dashboard'}
          </h1>
          <p className="text-surface/50 text-sm mt-1">
            Welcome back, {user.firstName}
          </p>
        </header>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Visits Today" value={String(stats.visitsToday)} />
          <StatCard label="Revenue Today" value={`$${(stats.revenueToday / 100).toFixed(2)}`} highlight />
          <StatCard label="Active Sales" value={String(stats.activeSales)} />
          <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} />
        </div>

        {/* 30-Day Visits Chart */}
        <section className="bg-[#1a1230] rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold text-surface mb-4">Visits — Last 30 Days</h2>
          <div className="flex items-end gap-[2px] h-40">
            {chartData.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full bg-btc rounded-t"
                  style={{ height: `${Math.max((d.visits / maxVisits) * 100, 3)}%`, minHeight: 2 }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-surface/30 text-xs">{chartData[0]?.date.slice(5)}</span>
            <span className="text-surface/30 text-xs">{chartData[chartData.length - 1]?.date.slice(5)}</span>
          </div>
        </section>

        {/* Recent Billing Events */}
        <section className="bg-[#1a1230] rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold text-surface mb-4">Recent Billing</h2>
          {recentBilling.length === 0 ? (
            <p className="text-surface/40 text-sm">No billing events yet</p>
          ) : (
            <div className="space-y-2">
              {recentBilling.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <p className="text-surface text-sm font-medium">
                      {event.type === 'confirmed_visit' ? 'Confirmed Visit' :
                       event.type === 'influenced_visit' ? 'Influenced Visit' :
                       event.type === 'subscription' ? 'Subscription' : event.type}
                    </p>
                    <p className="text-surface/40 text-xs">
                      {new Date(event.created_at).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${event.amount_cents < 0 ? 'text-teal' : 'text-btc'}`}>
                    {event.amount_cents < 0 ? '-' : ''}${(Math.abs(event.amount_cents) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAction href="/billing" label="Manage Billing" icon="💳" />
          <QuickAction href="/analytics" label="View Analytics" icon="📊" />
          <QuickAction href="/pricing" label="Upgrade Plan" icon="⬆️" />
          <QuickAction href="/" label="Back to Home" icon="🏠" />
        </section>

        {/* Consumer Account */}
        <section className="bg-[#1a1230] rounded-2xl p-5 mt-6" style={{ border: '1px solid rgba(247,148,29,0.1)' }}>
          <h3 className="text-surface font-bold text-sm mb-1">Want to discover deals too?</h3>
          <p className="text-surface/40 text-xs mb-3">Your business and consumer accounts share one login.</p>
          <Link href="/consumer" className="inline-block border border-btc text-btc font-bold px-4 py-2 rounded-lg text-xs hover:bg-btc/10 transition">
            Switch to Consumer Mode
          </Link>
        </section>
      </div>
    </main>
    </>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[#1a1230] rounded-xl p-4">
      <p className={`text-2xl font-extrabold ${highlight ? 'text-btc' : 'text-surface'}`}>{value}</p>
      <p className="text-surface/50 text-xs mt-1">{label}</p>
    </div>
  )
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="bg-[#1a1230] hover:bg-[#231840] rounded-xl p-4 flex flex-col items-center gap-2 transition"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-surface text-sm font-medium">{label}</span>
    </Link>
  )
}
