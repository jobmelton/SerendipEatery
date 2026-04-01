import { supabase } from './supabase.js'
import { AppError } from './errors.js'

// ─── Platform Stats (admin only) ──────────────────────────────────────────

export async function getPlatformStats() {
  const [users, businesses, sales, visits, billing] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('businesses').select('id', { count: 'exact', head: true }),
    supabase.from('flash_sales').select('id', { count: 'exact', head: true }),
    supabase.from('visit_intents').select('id', { count: 'exact', head: true }).eq('state', 'confirmed'),
    supabase.from('billing_events').select('amount_cents'),
  ])

  const totalRevenue = (billing.data ?? []).reduce((sum, e) => sum + (e.amount_cents ?? 0), 0)

  return {
    totalUsers: users.count ?? 0,
    totalBusinesses: businesses.count ?? 0,
    totalSales: sales.count ?? 0,
    totalConfirmedVisits: visits.count ?? 0,
    totalRevenueCents: totalRevenue,
  }
}

// ─── Business Analytics ───────────────────────────────────────────────────

export async function getBusinessAnalytics(businessId: string) {
  // Visits by day (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentVisits } = await supabase
    .from('visit_intents')
    .select('state, created_at, user_id')
    .eq('business_id', businessId)
    .gte('created_at', thirtyDaysAgo.toISOString())

  // Group visits by day
  const visitsByDay: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    visitsByDay[d.toISOString().slice(0, 10)] = 0
  }
  for (const v of recentVisits ?? []) {
    if (v.state === 'confirmed' || v.state === 'influenced') {
      const day = v.created_at.slice(0, 10)
      if (visitsByDay[day] !== undefined) visitsByDay[day]++
    }
  }

  const chartData = Object.entries(visitsByDay).map(([date, count]) => ({ date, visits: count }))

  // Conversion rate
  const { data: salesData } = await supabase
    .from('flash_sales')
    .select('spins_used, max_spins_total')
    .eq('business_id', businessId)
    .eq('status', 'ended')

  const totalSpins = (salesData ?? []).reduce((sum, s) => sum + (s.spins_used ?? 0), 0)
  const confirmedCount = (recentVisits ?? []).filter((v) => v.state === 'confirmed').length
  const conversionRate = totalSpins > 0 ? Math.round((confirmedCount / totalSpins) * 100) : 0

  // Revenue
  const { data: billingEvents } = await supabase
    .from('billing_events')
    .select('amount_cents, type, created_at')
    .eq('business_id', businessId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  const revenue30d = (billingEvents ?? []).reduce((sum, e) => sum + (e.amount_cents ?? 0), 0)

  // Top prizes
  const { data: prizes } = await supabase
    .from('prizes')
    .select('name, spins_used, max_spins, sale_id')
    .in('sale_id', (salesData ?? []).map(() => '')) // simplified
  // Fallback: get prizes from all sales for this business
  const { data: allPrizes } = await supabase
    .from('flash_sales')
    .select('prizes(name, spins_used, max_spins)')
    .eq('business_id', businessId)
    .limit(20)

  const flatPrizes = (allPrizes ?? []).flatMap((s: any) => s.prizes ?? [])
  const topPrizes = [...flatPrizes]
    .sort((a, b) => b.spins_used - a.spins_used)
    .slice(0, 5)

  // Customer tier breakdown
  const userIds = [...new Set((recentVisits ?? []).map((v) => v.user_id))]
  let tierBreakdown: Record<string, number> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('consumer_tier')
      .in('id', userIds.slice(0, 100))

    for (const u of users ?? []) {
      const tier = u.consumer_tier ?? 'explorer'
      tierBreakdown[tier] = (tierBreakdown[tier] ?? 0) + 1
    }
  }

  // Repeat visit rate
  const userVisitMap = new Map<string, number>()
  for (const v of recentVisits ?? []) {
    if (v.state === 'confirmed') {
      userVisitMap.set(v.user_id, (userVisitMap.get(v.user_id) ?? 0) + 1)
    }
  }
  const totalCustomers = userVisitMap.size
  const repeatCustomers = [...userVisitMap.values()].filter((c) => c > 1).length
  const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0

  // Today's stats
  const today = new Date().toISOString().slice(0, 10)
  const visitsToday = chartData.find((d) => d.date === today)?.visits ?? 0
  const todayBilling = (billingEvents ?? []).filter((e) => e.created_at.slice(0, 10) === today)
  const revenueToday = todayBilling.reduce((sum, e) => sum + (e.amount_cents ?? 0), 0)

  const { count: activeSales } = await supabase
    .from('flash_sales')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'live')

  return {
    visitsToday,
    revenueTodayCents: revenueToday,
    activeSales: activeSales ?? 0,
    conversionRate,
    chartData,
    revenue30dCents: revenue30d,
    topPrizes,
    tierBreakdown,
    repeatRate,
    totalCustomers,
    recentBilling: (billingEvents ?? []).slice(0, 10),
  }
}

// ─── Consumer Analytics ───────────────────────────────────────────────────

export async function getConsumerAnalytics(userId: string) {
  const { data: visits } = await supabase
    .from('visit_intents')
    .select('*, flash_sales(businesses(name, cuisine))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: user } = await supabase
    .from('users')
    .select('points, consumer_tier, streak_days')
    .eq('id', userId)
    .single()

  // Favorite businesses
  const bizCounts = new Map<string, { name: string; count: number }>()
  for (const v of visits ?? []) {
    const name = (v as any).flash_sales?.businesses?.name ?? 'Unknown'
    const bizId = v.business_id
    const existing = bizCounts.get(bizId)
    if (existing) existing.count++
    else bizCounts.set(bizId, { name, count: 1 })
  }
  const favorites = [...bizCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Points earned over time (last 30 days from point_transactions)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: transactions } = await supabase
    .from('point_transactions')
    .select('amount, created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true })

  // Savings estimate from prizes
  const confirmedVisits = (visits ?? []).filter((v) => v.state === 'confirmed')
  const estimatedSavings = confirmedVisits.length * 5.0 // rough $5 avg savings per prize

  return {
    points: user?.points ?? 0,
    tier: user?.consumer_tier ?? 'explorer',
    streak: user?.streak_days ?? 0,
    totalVisits: confirmedVisits.length,
    recentVisits: (visits ?? []).slice(0, 10),
    favorites,
    pointsHistory: transactions ?? [],
    estimatedSavings,
  }
}

// ─── Sale Analytics (real-time during sale) ───────────────────────────────

export async function getSaleAnalytics(saleId: string) {
  const { data: sale } = await supabase
    .from('flash_sales')
    .select('*, prizes(*), businesses(name)')
    .eq('id', saleId)
    .single()

  if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found')

  const { data: intents } = await supabase
    .from('visit_intents')
    .select('state, created_at, spin_lat, spin_lng')
    .eq('sale_id', saleId)

  const allIntents = intents ?? []
  const confirmed = allIntents.filter((v) => v.state === 'confirmed')
  const spunsAway = allIntents.filter((v) => v.state === 'spun_away')

  // Spins per minute
  const saleStart = new Date(sale.starts_at).getTime()
  const elapsed = Math.max((Date.now() - saleStart) / 60000, 1)
  const spinsPerMin = Math.round((sale.spins_used / elapsed) * 10) / 10

  // Conversion rate
  const conversionRate = sale.spins_used > 0
    ? Math.round((confirmed.length / sale.spins_used) * 100)
    : 0

  // Prize velocity
  const prizeVelocity = (sale.prizes ?? []).map((p: any) => ({
    name: p.name,
    spinsUsed: p.spins_used,
    maxSpins: p.max_spins,
    velocity: elapsed > 0 ? Math.round((p.spins_used / elapsed) * 10) / 10 : 0,
    exhausted: p.spins_used >= p.max_spins,
  }))

  // Geographic spread (unique lat/lng points)
  const geoPoints = allIntents
    .filter((v) => v.spin_lat && v.spin_lng)
    .map((v) => ({ lat: v.spin_lat, lng: v.spin_lng }))

  return {
    saleId,
    businessName: (sale as any).businesses?.name ?? 'Unknown',
    status: sale.status,
    spinsUsed: sale.spins_used,
    maxSpins: sale.max_spins_total,
    spinsPerMin,
    conversionRate,
    confirmedVisits: confirmed.length,
    pendingArrivals: spunsAway.length,
    prizeVelocity,
    geoPoints: geoPoints.slice(0, 100),
    elapsedMinutes: Math.round(elapsed),
  }
}
