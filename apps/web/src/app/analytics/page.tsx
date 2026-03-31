import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { AnalyticsClient } from './analytics-client'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export default async function AnalyticsPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .limit(1)
    .single()

  if (!business) redirect('/dashboard')

  // Fetch analytics data server-side
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [visitsRes, salesRes, billingRes, prizesRes] = await Promise.all([
    supabase
      .from('visit_intents')
      .select('state, created_at, user_id')
      .eq('business_id', business.id)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('flash_sales')
      .select('spins_used, max_spins_total, status, created_at, prizes(name, spins_used, max_spins)')
      .eq('business_id', business.id),
    supabase
      .from('billing_events')
      .select('amount_cents, type, created_at')
      .eq('business_id', business.id)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('users')
      .select('consumer_tier')
      .in('id', []), // placeholder — filled below
  ])

  const visits = visitsRes.data ?? []
  const sales = salesRes.data ?? []
  const billing = billingRes.data ?? []

  // Visits by day
  const dayMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dayMap[d.toISOString().slice(0, 10)] = 0
  }
  for (const v of visits) {
    if (v.state === 'confirmed' || v.state === 'influenced') {
      const day = v.created_at.slice(0, 10)
      if (dayMap[day] !== undefined) dayMap[day]++
    }
  }
  const chartData = Object.entries(dayMap).map(([date, count]) => ({ date, visits: count }))

  // Top prizes
  const allPrizes = sales.flatMap((s: any) => s.prizes ?? [])
  const topPrizes = [...allPrizes].sort((a, b) => b.spins_used - a.spins_used).slice(0, 5)

  // Tier breakdown
  const userIds = [...new Set(visits.map((v) => v.user_id))]
  let tierBreakdown: Record<string, number> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('consumer_tier')
      .in('id', userIds.slice(0, 100))
    for (const u of users ?? []) {
      const t = u.consumer_tier ?? 'explorer'
      tierBreakdown[t] = (tierBreakdown[t] ?? 0) + 1
    }
  }

  // Revenue
  const totalRevenue = billing.reduce((sum, e) => sum + (e.amount_cents ?? 0), 0)
  const totalSpins = sales.filter((s: any) => s.status === 'ended').reduce((sum: number, s: any) => sum + (s.spins_used ?? 0), 0)
  const confirmedCount = visits.filter((v) => v.state === 'confirmed').length
  const conversionRate = totalSpins > 0 ? Math.round((confirmedCount / totalSpins) * 100) : 0

  // Repeat customers
  const userVisitMap = new Map<string, number>()
  for (const v of visits) {
    if (v.state === 'confirmed') {
      userVisitMap.set(v.user_id, (userVisitMap.get(v.user_id) ?? 0) + 1)
    }
  }
  const repeatRate = userVisitMap.size > 0
    ? Math.round(([...userVisitMap.values()].filter((c) => c > 1).length / userVisitMap.size) * 100)
    : 0

  return (
    <AnalyticsClient
      businessName={business.name}
      chartData={chartData}
      totalRevenueCents={totalRevenue}
      conversionRate={conversionRate}
      totalVisits={confirmedCount}
      totalSales={sales.length}
      topPrizes={topPrizes}
      tierBreakdown={tierBreakdown}
      repeatRate={repeatRate}
    />
  )
}
