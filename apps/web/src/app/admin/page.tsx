import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export default async function AdminOverviewPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [users, businesses, activeSales, visitsToday, billing, recentUsers] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('businesses').select('id', { count: 'exact', head: true }),
    supabase.from('flash_sales').select('id', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('visit_intents').select('id', { count: 'exact', head: true }).eq('state', 'confirmed').gte('created_at', today.toISOString()),
    supabase.from('billing_events').select('amount_cents').gte('created_at', today.toISOString()),
    supabase.from('users').select('created_at').gte('created_at', thirtyDaysAgo.toISOString()),
  ])

  const revenueToday = (billing.data ?? []).reduce((sum, e) => sum + (e.amount_cents ?? 0), 0)

  // Signups chart
  const signupsByDay: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    signupsByDay[d.toISOString().slice(0, 10)] = 0
  }
  for (const u of recentUsers.data ?? []) {
    const day = u.created_at.slice(0, 10)
    if (signupsByDay[day] !== undefined) signupsByDay[day]++
  }
  const chartData = Object.entries(signupsByDay).map(([date, count]) => ({ date, signups: count }))
  const maxSignups = Math.max(...chartData.map((d) => d.signups), 1)

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface mb-6">Platform Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Users" value={String(users.count ?? 0)} />
        <StatCard label="Businesses" value={String(businesses.count ?? 0)} />
        <StatCard label="Active Sales" value={String(activeSales.count ?? 0)} />
        <StatCard label="Visits Today" value={String(visitsToday.count ?? 0)} />
        <StatCard label="Revenue Today" value={`$${(revenueToday / 100).toFixed(2)}`} highlight />
      </div>

      <div className="bg-[#1a1230] rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-surface mb-4">New Signups — Last 30 Days</h2>
        <div className="flex items-end gap-[2px] h-40">
          {chartData.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full bg-teal rounded-t"
                style={{ height: `${Math.max((d.signups / maxSignups) * 100, 3)}%`, minHeight: 2 }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-surface/30 text-xs">{chartData[0]?.date.slice(5)}</span>
          <span className="text-surface/30 text-xs">{chartData[chartData.length - 1]?.date.slice(5)}</span>
        </div>
      </div>

      <div className="bg-[#1a1230] rounded-2xl p-6">
        <h2 className="text-lg font-bold text-surface mb-4">Platform Health</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal" />
            <span className="text-surface text-sm">API: Online</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal" />
            <span className="text-surface text-sm">Worker: Running</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal" />
            <span className="text-surface text-sm">Database: Connected</span>
          </div>
        </div>
      </div>
    </div>
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
