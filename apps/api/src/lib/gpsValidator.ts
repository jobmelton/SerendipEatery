import { supabase } from './supabase'
import { AppError } from './errors'

const MAX_SPEED_KMH = 500 // flag if user moves faster than this between pings
const EARTH_RADIUS_KM = 6371

// ─── Validate Coordinates ─────────────────────────────────────────────────

export function validateCoordinates(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < -90 || lat > 90) return false
  if (lng < -180 || lng > 180) return false
  // Reject null island (0,0) — extremely unlikely to be real
  if (lat === 0 && lng === 0) return false
  return true
}

export function assertValidCoordinates(lat: number, lng: number): void {
  if (!validateCoordinates(lat, lng)) {
    throw new AppError(400, 'INVALID_COORDINATES', 'Invalid GPS coordinates')
  }
}

// ─── Haversine Distance ───────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Detect GPS Spoofing ──────────────────────────────────────────────────

export interface SpoofCheckResult {
  spoofed: boolean
  reason: string | null
  speedKmh: number | null
}

/**
 * Flag if user moved impossibly fast (>500km/h) between their last
 * recorded location ping and the current one.
 */
export async function detectSpoofing(
  userId: string,
  lat: number,
  lng: number,
  timestamp: Date = new Date(),
): Promise<SpoofCheckResult> {
  // Get user's most recent location ping
  const { data: lastPing } = await supabase
    .from('visit_intents')
    .select('spin_lat, spin_lng, spun_at')
    .eq('user_id', userId)
    .not('spin_lat', 'is', null)
    .not('spin_lng', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastPing || !lastPing.spin_lat || !lastPing.spin_lng || !lastPing.spun_at) {
    return { spoofed: false, reason: null, speedKmh: null }
  }

  const distKm = haversineKm(lastPing.spin_lat, lastPing.spin_lng, lat, lng)
  const timeDiffHours = (timestamp.getTime() - new Date(lastPing.spun_at).getTime()) / (1000 * 60 * 60)

  if (timeDiffHours <= 0) {
    return { spoofed: false, reason: null, speedKmh: null }
  }

  const speedKmh = distKm / timeDiffHours

  if (speedKmh > MAX_SPEED_KMH) {
    return {
      spoofed: true,
      reason: `Impossible speed: ${Math.round(speedKmh)} km/h over ${distKm.toFixed(1)} km`,
      speedKmh,
    }
  }

  return { spoofed: false, reason: null, speedKmh }
}

// ─── Require Minimum Pings ────────────────────────────────────────────────

/**
 * Require at least 2 location pings from a user for a sale before
 * allowing visit confirmation. Prevents single-ping spoofing.
 */
export async function requireMinimumPings(
  userId: string,
  saleId: string,
  minPings: number = 2,
): Promise<boolean> {
  const { count } = await supabase
    .from('visit_intents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('sale_id', saleId)
    .not('spin_lat', 'is', null)

  return (count ?? 0) >= minPings
}
