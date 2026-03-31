import { supabase } from './supabase'

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

// ─── Start All Fix Workers ────────────────────────────────────────────────

export function startFixWorkers(): void {
  console.log('[fix] Starting one-tap fix workers...')

  // Fix stuck visits every 5 minutes
  setInterval(fixStuckVisits, 5 * 60 * 1000)

  // Fix orphaned billing events every 30 minutes
  setInterval(fixOrphanedBillingEvents, 30 * 60 * 1000)

  // Fix stale truck snapshots every hour
  setInterval(fixTruckSnapshots, 60 * 60 * 1000)

  // Run once on startup
  fixStuckVisits()
  fixOrphanedBillingEvents()
  fixTruckSnapshots()
}
