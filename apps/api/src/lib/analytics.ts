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

// ─── Full Sale Analytics (comprehensive) ─────────────────────────────────

export async function getFullSaleAnalytics(saleId: string) {
  const { data: sale } = await supabase
    .from('flash_sales')
    .select('*, prizes(*), businesses(name, billing_plan, plan)')
    .eq('id', saleId)
    .single()

  if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found')

  const businessPlan = (sale as any).businesses?.billing_plan || (sale as any).businesses?.plan || 'trial'

  // Notification log
  const { count: notificationsSent } = await supabase
    .from('sale_notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('flash_sale_id', saleId)

  const { count: notificationsOpened } = await supabase
    .from('sale_notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('flash_sale_id', saleId)
    .not('opened_at', 'is', null)

  const notifSent = notificationsSent ?? 0
  const notifOpened = notificationsOpened ?? 0
  const notificationOpenRate = notifSent > 0 ? Math.round((notifOpened / notifSent) * 100) : 0

  // Spins
  const spinsTotal = sale.spins_used ?? 0
  const spinRate = notifSent > 0 ? Math.round((spinsTotal / notifSent) * 100) : 0

  // Visit intents
  const { data: intents } = await supabase
    .from('visit_intents')
    .select('id, state, created_at, user_id, prize_won, spun_at, confirmed_at')
    .eq('sale_id', saleId)

  const allIntents = intents ?? []
  const confirmed = allIntents.filter(v => v.state === 'confirmed')
  const prizesClaimed = allIntents.filter(v => v.prize_won).length
  const claimRate = spinsTotal > 0 ? Math.round((prizesClaimed / spinsTotal) * 100) : 0
  const conversionRate = prizesClaimed > 0 ? Math.round((confirmed.length / prizesClaimed) * 100) : 0

  // Missed opportunities
  const { data: missed } = await supabase
    .from('missed_opportunities')
    .select('opportunity_type, user_tier')
    .eq('flash_sale_id', saleId)

  const allMissed = missed ?? []
  const missedNotifications = allMissed.filter(m => m.opportunity_type === 'notification_blocked').length
  const missedSpins = allMissed.filter(m => m.opportunity_type === 'spin_blocked').length
  const geofenceEntries = allMissed.filter(m => m.opportunity_type === 'geofence_entry').length

  // Total geofence entries (confirmed + missed)
  const geofenceEntriesTotal = confirmed.length + geofenceEntries
  const geofenceEntriesMissed = geofenceEntries

  // Prize breakdown
  const prizes = (sale.prizes ?? []).map((p: any) => {
    const winners = allIntents.filter(v => v.prize_won === p.name || v.prize_won === p.label)
    const winnerVisits = winners.filter(v => v.state === 'confirmed')
    const prizeConversionRate = winners.length > 0 ? Math.round((winnerVisits.length / winners.length) * 100) : 0

    // Best time of day for this prize
    const hourCounts: Record<number, number> = {}
    for (const v of winnerVisits) {
      if (v.confirmed_at) {
        const h = new Date(v.confirmed_at).getHours()
        hourCounts[h] = (hourCounts[h] ?? 0) + 1
      }
    }
    const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
    const bestTimeOfDay = bestHour ? `${bestHour[0]}:00-${Number(bestHour[0]) + 1}:00` : 'N/A'

    const totalWeight = (sale.prizes ?? []).reduce((s: number, pr: any) => s + (pr.weight ?? pr.max_spins ?? 1), 0)
    const probability = totalWeight > 0 ? Math.round(((p.weight ?? p.max_spins ?? 1) / totalWeight) * 100) : 0

    return {
      name: p.label || p.name,
      probability,
      timesWon: p.spins_used ?? 0,
      conversionRate: prizeConversionRate,
      revenueGenerated: winnerVisits.length * 15, // estimated $15 avg check
      bestTimeOfDay,
    }
  })

  // Time analysis
  const spinHours: Record<number, number> = {}
  const visitHours: Record<number, number> = {}
  const timesToVisit: number[] = []

  for (const v of allIntents) {
    if (v.spun_at) {
      const h = new Date(v.spun_at).getHours()
      spinHours[h] = (spinHours[h] ?? 0) + 1
    }
    if (v.confirmed_at) {
      const h = new Date(v.confirmed_at).getHours()
      visitHours[h] = (visitHours[h] ?? 0) + 1
    }
    if (v.spun_at && v.confirmed_at) {
      const diff = (new Date(v.confirmed_at).getTime() - new Date(v.spun_at).getTime()) / 60000
      if (diff > 0 && diff < 120) timesToVisit.push(diff)
    }
  }

  const peakSpinEntry = Object.entries(spinHours).sort((a, b) => b[1] - a[1])[0]
  const peakVisitEntry = Object.entries(visitHours).sort((a, b) => b[1] - a[1])[0]
  const peakSpinHour = peakSpinEntry ? `${peakSpinEntry[0]}:00` : 'N/A'
  const peakVisitHour = peakVisitEntry ? `${peakVisitEntry[0]}:00` : 'N/A'
  const avgTimeToVisit = timesToVisit.length > 0
    ? Math.round(timesToVisit.reduce((a, b) => a + b, 0) / timesToVisit.length)
    : 0

  // User tier breakdown
  const userIds = [...new Set(allIntents.map(v => v.user_id))]
  const tierBreakdown: Record<string, number> = {
    explorer: 0, regular: 0, local_legend: 0,
    foodie_royale: 0, tastemaker: 0, influencer: 0,
  }

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('consumer_tier')
      .in('id', userIds.slice(0, 200))

    for (const u of users ?? []) {
      const tier = u.consumer_tier ?? 'explorer'
      if (tierBreakdown[tier] !== undefined) tierBreakdown[tier]++
    }
  }

  return {
    notifications_sent: notifSent,
    notification_open_rate: notificationOpenRate,
    spins_total: spinsTotal,
    spin_rate: spinRate,
    prizes_claimed: prizesClaimed,
    claim_rate: claimRate,
    confirmed_visits: confirmed.length,
    conversion_rate: conversionRate,
    missed_notifications: missedNotifications,
    missed_spins: missedSpins,
    geofence_entries_total: geofenceEntriesTotal,
    geofence_entries_missed: geofenceEntriesMissed,
    prizes,
    peak_spin_hour: peakSpinHour,
    peak_visit_hour: peakVisitHour,
    avg_time_to_visit: avgTimeToVisit,
    tier_breakdown: tierBreakdown,
    business_plan: businessPlan,
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
