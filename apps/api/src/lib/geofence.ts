import { supabase } from './supabase.js'
import { AppError } from './errors.js'

// ─── Constants ────────────────────────────────────────────────────────────

const CHECKIN_RADIUS_M = 10       // geofence radius for check-in
const TRUCK_MOVE_THRESHOLD_M = 5  // minimum movement to trigger new snapshot
const SPIN_WINDOW_MIN = 60        // minutes for spun_away → arrival
const INFLUENCED_WINDOW_MIN = 90  // minutes post-sale for influenced visits
const PASSIVE_WINDOW_MIN = 30     // minutes for notification → walk-in

// ─── Geofence Check (PostGIS) ─────────────────────────────────────────────

/**
 * Verify user is within 10m of the business using PostGIS ST_Distance.
 * All math is server-side — never trust client coordinates alone.
 */
export async function verifyInsideFence(
  saleId: string,
  userLat: number,
  userLng: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_inside_fence', {
    p_flash_sale_id: saleId,
    user_lat: userLat,
    user_lng: userLng,
  })
  if (error) throw new AppError(500, 'GEOFENCE_ERROR', `Geofence check failed: ${error.message}`)
  return data as boolean
}

// ─── Food Truck Location ──────────────────────────────────────────────────

/**
 * Get the latest geofence snapshot for a business.
 */
export async function getLatestSnapshot(businessId: string) {
  const { data, error } = await supabase
    .from('geofence_snapshots')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    throw new AppError(500, 'SNAPSHOT_FETCH_FAILED', 'Failed to fetch geofence snapshot')
  }
  return data
}

/**
 * Check if a food truck has moved more than 5m since its last ping.
 * If so, create a new geofence snapshot and update truck_location_pings.
 * Returns true if a new snapshot was created.
 */
export async function processTruckPing(
  businessId: string,
  saleId: string,
  lat: number,
  lng: number,
): Promise<{ moved: boolean; distanceM: number }> {
  // Get distance from last snapshot using PostGIS
  const { data: distResult, error: distErr } = await supabase.rpc('truck_distance_from_last', {
    p_business_id: businessId,
    p_lat: lat,
    p_lng: lng,
  })

  // If the RPC doesn't exist, fall back to manual calculation
  if (distErr && distErr.code === '42883') {
    return processTruckPingFallback(businessId, saleId, lat, lng)
  }
  if (distErr) throw new AppError(500, 'DISTANCE_ERROR', `Distance check failed: ${distErr.message}`)

  const distanceM = (distResult as number) ?? Infinity

  // Record the ping regardless
  await supabase.from('truck_location_pings').insert({
    business_id: businessId,
    lat,
    lng,
    distance_from_last_m: distanceM,
  })

  // If moved more than threshold, create new geofence snapshot
  if (distanceM > TRUCK_MOVE_THRESHOLD_M) {
    await supabase.from('geofence_snapshots').insert({
      sale_id: saleId,
      business_id: businessId,
      lat,
      lng,
      radius_m: CHECKIN_RADIUS_M,
    })

    // Update the business's lat/lng
    await supabase
      .from('businesses')
      .update({ lat, lng })
      .eq('id', businessId)

    return { moved: true, distanceM }
  }

  return { moved: false, distanceM }
}

/**
 * Fallback when PostGIS RPC isn't deployed — uses snapshot table directly.
 */
async function processTruckPingFallback(
  businessId: string,
  saleId: string,
  lat: number,
  lng: number,
): Promise<{ moved: boolean; distanceM: number }> {
  const lastSnapshot = await getLatestSnapshot(businessId)

  // No previous snapshot = always create one
  if (!lastSnapshot) {
    await supabase.from('geofence_snapshots').insert({
      sale_id: saleId,
      business_id: businessId,
      lat,
      lng,
      radius_m: CHECKIN_RADIUS_M,
    })
    await supabase.from('truck_location_pings').insert({
      business_id: businessId,
      lat,
      lng,
      distance_from_last_m: 0,
    })
    return { moved: true, distanceM: 0 }
  }

  // Haversine approximation for short distances (server-side, not client)
  const distanceM = haversineMeters(lastSnapshot.lat, lastSnapshot.lng, lat, lng)

  await supabase.from('truck_location_pings').insert({
    business_id: businessId,
    lat,
    lng,
    distance_from_last_m: distanceM,
  })

  if (distanceM > TRUCK_MOVE_THRESHOLD_M) {
    await supabase.from('geofence_snapshots').insert({
      sale_id: saleId,
      business_id: businessId,
      lat,
      lng,
      radius_m: CHECKIN_RADIUS_M,
    })
    await supabase
      .from('businesses')
      .update({ lat, lng })
      .eq('id', businessId)

    return { moved: true, distanceM }
  }

  return { moved: false, distanceM }
}

/**
 * Haversine distance in meters — used only as fallback when PostGIS RPC
 * isn't available. Production should always use ST_Distance.
 */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Visit State Machine ──────────────────────────────────────────────────

export type VisitTransition =
  | 'checkin'       // user taps check-in button at the restaurant
  | 'expire'        // 60-min window elapsed
  | 'influenced'    // arrived within 90min post-sale without spinning
  | 'passive'       // got notification, walked in within 30min

interface TransitionResult {
  newState: string
  billingEvent: boolean
  confirmedAt: string | null
}

/**
 * Execute a state transition on a visit intent.
 * Returns the new state and whether a billing event should be created.
 */
export function resolveTransition(
  currentState: string,
  transition: VisitTransition,
  spunAt: string | null,
  expiresAt: string | null,
  saleEndedAt: string | null,
  notifiedAt: string | null,
  now: Date = new Date(),
): TransitionResult {
  const nowIso = now.toISOString()

  switch (transition) {
    case 'checkin': {
      // spun_away → inside_fence → confirmed (two-step, but we collapse if both conditions met)
      if (currentState === 'spun_away') {
        // Check 60-min window
        if (expiresAt && new Date(expiresAt) < now) {
          return { newState: 'expired', billingEvent: false, confirmedAt: null }
        }
        // User has spun and is now inside fence = confirmed
        return { newState: 'confirmed', billingEvent: true, confirmedAt: nowIso }
      }

      if (currentState === 'inside_fence') {
        // Was already inside fence, now confirming
        return { newState: 'confirmed', billingEvent: true, confirmedAt: nowIso }
      }

      // Already confirmed or other terminal state
      return { newState: currentState, billingEvent: false, confirmedAt: null }
    }

    case 'expire': {
      if (currentState === 'spun_away' || currentState === 'inside_fence') {
        return { newState: 'expired', billingEvent: false, confirmedAt: null }
      }
      return { newState: currentState, billingEvent: false, confirmedAt: null }
    }

    case 'influenced': {
      // Arrived within 90min post-sale without having spun
      if (saleEndedAt) {
        const saleEnd = new Date(saleEndedAt)
        const windowEnd = new Date(saleEnd.getTime() + INFLUENCED_WINDOW_MIN * 60 * 1000)
        if (now <= windowEnd) {
          return { newState: 'influenced', billingEvent: true, confirmedAt: nowIso }
        }
      }
      return { newState: currentState, billingEvent: false, confirmedAt: null }
    }

    case 'passive': {
      // Got notification, walked in within 30min
      if (notifiedAt) {
        const notifTime = new Date(notifiedAt)
        const windowEnd = new Date(notifTime.getTime() + PASSIVE_WINDOW_MIN * 60 * 1000)
        if (now <= windowEnd) {
          return { newState: 'passive', billingEvent: true, confirmedAt: nowIso }
        }
      }
      return { newState: currentState, billingEvent: false, confirmedAt: null }
    }

    default:
      return { newState: currentState, billingEvent: false, confirmedAt: null }
  }
}

// ─── Billing Event ────────────────────────────────────────────────────────

const BILLING_AMOUNTS: Record<string, number> = {
  confirmed: 50,    // $0.50 per confirmed visit
  influenced: 25,   // $0.25 per influenced visit
  passive: 10,      // $0.10 per passive visit
}

export async function createBillingEvent(
  businessId: string,
  visitIntentId: string,
  visitState: string,
): Promise<void> {
  const amountCents = BILLING_AMOUNTS[visitState]
  if (!amountCents) return

  const type = visitState === 'confirmed'
    ? 'confirmed_visit'
    : 'influenced_visit'

  await supabase.from('billing_events').insert({
    business_id: businessId,
    visit_intent_id: visitIntentId,
    type,
    amount_cents: amountCents,
  })
}
