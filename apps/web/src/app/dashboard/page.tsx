import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { DashboardClient } from './dashboard-client'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export default async function DashboardPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .limit(1)
    .single()

  // Get today's stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let stats = { visitsToday: 0, revenueToday: 0, activeSales: 0, conversionRate: 0 }
  let recentBilling: any[] = []
  let chartData: Array<{ date: string; visits: number }> = []

  if (business) {
    // Visits today
    const { count: visitsToday } = await supabase
      .from('visit_intents')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('state', 'confirmed')
      .gte('created_at', today.toISOString())

    // Active sales
    const { count: activeSales } = await supabase
      .from('flash_sales')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'live')

    // Revenue today
    const { data: todayBilling } = await supabase
      .from('billing_events')
      .select('amount_cents')
      .eq('business_id', business.id)
      .gte('created_at', today.toISOString())

    const revenueToday = (todayBilling ?? []).reduce((sum, e) => sum + (e.amount_cents ?? 0), 0)

    // Conversion rate (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: salesData } = await supabase
      .from('flash_sales')
      .select('spins_used')
      .eq('business_id', business.id)
      .eq('status', 'ended')
      .gte('created_at', thirtyDaysAgo.toISOString())

    const totalSpins = (salesData ?? []).reduce((sum, s) => sum + (s.spins_used ?? 0), 0)

    const { count: confirmed30d } = await supabase
      .from('visit_intents')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('state', 'confirmed')
      .gte('created_at', thirtyDaysAgo.toISOString())

    stats = {
      visitsToday: visitsToday ?? 0,
      revenueToday,
      activeSales: activeSales ?? 0,
      conversionRate: totalSpins > 0 ? Math.round(((confirmed30d ?? 0) / totalSpins) * 100) : 0,
    }

    // 30-day chart
    const { data: recentVisits } = await supabase
      .from('visit_intents')
      .select('created_at, state')
      .eq('business_id', business.id)
      .in('state', ['confirmed', 'influenced'])
      .gte('created_at', thirtyDaysAgo.toISOString())

    const dayMap: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dayMap[d.toISOString().slice(0, 10)] = 0
    }
    for (const v of recentVisits ?? []) {
      const day = v.created_at.slice(0, 10)
      if (dayMap[day] !== undefined) dayMap[day]++
    }
    chartData = Object.entries(dayMap).map(([date, visits]) => ({ date, visits }))

    // Recent billing
    const { data: billing } = await supabase
      .from('billing_events')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(10)

    recentBilling = billing ?? []
  }

  return (
    <DashboardClient
      user={{ firstName: user.firstName ?? 'Chef' }}
      business={business}
      stats={stats}
      chartData={chartData}
      recentBilling={recentBilling}
    />
  )
}
