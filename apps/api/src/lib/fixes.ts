import { supabase } from './supabase.js'
import { sendMonthlyMissedReminder } from './billing.js'

// ─── Fix Stuck Visits ─────────────────────────────────────────────────────
// Finds visit_intents stuck in spun_away past their 60min window, marks expired

export async function fixStuckVisits(): Promise<number> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('visit_intents')
    .update({ state: 'expired' })
    .in('state', ['spun_away', 'inside_fence'])
    .lt('expires_at', now)
    .not('expires_at', 'is', null)
    .select('id')

  if (error) {
    console.error('[fix] fixStuckVisits error:', error.message)
    return 0
  }

  const count = data?.length ?? 0
  if (count > 0) {
    console.log(`[fix] Expired ${count} stuck visit intents`)
  }
  return count
}

// ─── Fix Orphaned Billing Events ──────────────────────────────────────────
// Finds billing events without a matching confirmed visit, flags for review

export async function fixOrphanedBillingEvents(): Promise<number> {
  const { data: orphaned, error } = await supabase
    .from('billing_events')
    .select('id, visit_intent_id')
    .not('visit_intent_id', 'is', null)
    .is('flagged_for_review', null)

  if (error || !orphaned) {
    console.error('[fix] fixOrphanedBillingEvents query error:', error?.message)
    return 0
  }

  let flagged = 0
  for (const event of orphaned) {
    // Check if the visit intent exists and is confirmed
    const { data: intent } = await supabase
      .from('visit_intents')
      .select('id, state')
      .eq('id', event.visit_intent_id)
      .single()

    if (!intent || (intent.state !== 'confirmed' && intent.state !== 'influenced' && intent.state !== 'passive')) {
      await supabase
        .from('billing_events')
        .update({ flagged_for_review: true })
        .eq('id', event.id)
      flagged++
    }
  }

  if (flagged > 0) {
    console.log(`[fix] Flagged ${flagged} orphaned billing events for review`)
  }
  return flagged
}

// ─── Fix Stale Truck Snapshots ────────────────────────────────────────────
// Removes geofence snapshots older than 24h for trucks with no active sales

export async function fixTruckSnapshots(): Promise<number> {
  const twentyFourHoursAgo = new Date()
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

  // Find businesses of type 'truck' with no active sales
  const { data: activeTruckSales } = await supabase
    .from('flash_sales')
    .select('business_id')
    .eq('status', 'live')

  const activeBizIds = new Set((activeTruckSales ?? []).map((s) => s.business_id))

  // Delete stale snapshots for inactive trucks
  const { data: stale, error } = await supabase
    .from('geofence_snapshots')
    .select('id, business_id')
    .lt('created_at', twentyFourHoursAgo.toISOString())

  if (error || !stale) {
    console.error('[fix] fixTruckSnapshots query error:', error?.message)
    return 0
  }

  const toDelete = stale.filter((s) => !activeBizIds.has(s.business_id)).map((s) => s.id)

  if (toDelete.length > 0) {
    await supabase
      .from('geofence_snapshots')
      .delete()
      .in('id', toDelete)

    console.log(`[fix] Removed ${toDelete.length} stale geofence snapshots`)
  }

  return toDelete.length
}

// ─── Reset Monthly Visit Counts ──────────────────────────────────────────
// Runs on 1st of each month. Handles paid plans, free tier graduation, and reminders.

export async function resetMonthlyVisitCounts(): Promise<number> {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  let totalReset = 0

  // 1. Reset paid plan (Starter/Growth) monthly counters
  const { data: paidStale } = await supabase
    .from('businesses')
    .select('id')
    .in('billing_plan', ['starter', 'growth'])
    .or(`monthly_visit_reset_at.is.null,monthly_visit_reset_at.lt.${firstOfMonth.toISOString()}`)

  if (paidStale?.length) {
    await supabase
      .from('businesses')
      .update({
        monthly_visit_count: 0,
        shadow_mode: false,
        shadow_mode_reason: null,
        shadow_mode_at: null,
        monthly_visit_reset_at: now.toISOString(),
      })
      .in('id', paidStale.map(b => b.id))

    totalReset += paidStale.length
  }

  // 2. Graduate free tier businesses that had 100+ visits last month
  const { data: toGraduate } = await supabase
    .from('businesses')
    .select('id')
    .or(`billing_plan.eq.trial,plan.eq.trial`)
    .eq('free_tier_graduated', false)
    .gte('free_tier_visits_this_month', 100)
    .or(`monthly_visit_reset_at.is.null,monthly_visit_reset_at.lt.${firstOfMonth.toISOString()}`)

  if (toGraduate?.length) {
    await supabase
      .from('businesses')
      .update({
        free_tier_graduated: true,
        graduated_at: now.toISOString(),
      })
      .in('id', toGraduate.map(b => b.id))

    console.log(`[fix] Graduated ${toGraduate.length} free tier businesses`)
  }

  // 3. Reset all free tier monthly counters and shadow mode
  const { data: freeStale } = await supabase
    .from('businesses')
    .select('id, free_tier_graduated, free_tier_visits_this_month')
    .or(`billing_plan.eq.trial,plan.eq.trial`)
    .or(`monthly_visit_reset_at.is.null,monthly_visit_reset_at.lt.${firstOfMonth.toISOString()}`)

  if (freeStale?.length) {
    // Send monthly missed reminder to graduated businesses before resetting
    for (const biz of freeStale) {
      if (biz.free_tier_graduated) {
        // Count missed opportunities from last month
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const { count: missedLastMonth } = await supabase
          .from('missed_opportunities')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', biz.id)
          .gte('created_at', lastMonthStart.toISOString())
          .lt('created_at', firstOfMonth.toISOString())

        if ((missedLastMonth ?? 0) > 0) {
          await sendMonthlyMissedReminder(biz.id, missedLastMonth ?? 0)
        }
      }
    }

    await supabase
      .from('businesses')
      .update({
        free_tier_visits_this_month: 0,
        shadow_mode: false,
        shadow_mode_reason: null,
        shadow_mode_at: null,
        monthly_visit_reset_at: now.toISOString(),
      })
      .in('id', freeStale.map(b => b.id))

    totalReset += freeStale.length
  }

  if (totalReset > 0) {
    console.log(`[fix] Reset monthly visit counts for ${totalReset} businesses`)
  }
  return totalReset
}

// ─── Expire Stale Waiting Battles ────────────────────────────────────────

export async function expireWaitingBattles(): Promise<number> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('battles')
    .update({ status: 'expired', completed_at: now })
    .eq('status', 'waiting')
    .lt('expires_at', now)
    .not('expires_at', 'is', null)
    .select('id')

  if (error) {
    console.error('[fix] expireWaitingBattles error:', error.message)
    return 0
  }

  const count = data?.length ?? 0
  if (count > 0) console.log(`[fix] Expired ${count} waiting battles`)
  return count
}

// ─── Start All Fix Workers ────────────────────────────────────────────────

export function startFixWorkers(): void {
  console.log('[fix] Starting one-tap fix workers...')

  // Fix stuck visits every 5 minutes
  setInterval(fixStuckVisits, 5 * 60 * 1000)

  // Fix orphaned billing events every 30 minutes
  setInterval(fixOrphanedBillingEvents, 30 * 60 * 1000)

  // Fix stale truck snapshots every hour
  setInterval(fixTruckSnapshots, 60 * 60 * 1000)

  // Reset monthly visit counts every hour (idempotent — only acts on 1st of month)
  setInterval(resetMonthlyVisitCounts, 60 * 60 * 1000)

  // Expire stale waiting battles every 5 minutes
  setInterval(expireWaitingBattles, 5 * 60 * 1000)

  // Run once on startup
  fixStuckVisits()
  fixOrphanedBillingEvents()
  fixTruckSnapshots()
  resetMonthlyVisitCounts()
  expireWaitingBattles()
}
