import { supabase } from './supabase.js'
import { AppError } from './errors.js'
import {
  CONSUMER_TIER_THRESHOLDS,
  TIER_BOOST_PCT,
  type ConsumerTier,
  type BusinessTier,
  type EarnAction,
} from '../types/shared.js'

// ─── Business Tier Thresholds ─────────────────────────────────────────────

const BUSINESS_TIERS: Array<{ tier: BusinessTier; threshold: number }> = [
  { tier: 'operator', threshold: 0 },
  { tier: 'hustler', threshold: 500 },
  { tier: 'grinder', threshold: 2000 },
  { tier: 'vendor', threshold: 5000 },
  { tier: 'business_owner', threshold: 15000 },
  { tier: 'empire', threshold: 50000 },
]

const CONSUMER_TIERS: Array<{ tier: ConsumerTier; threshold: number }> = [
  { tier: 'explorer', threshold: 0 },
  { tier: 'regular', threshold: 500 },
  { tier: 'local_legend', threshold: 1500 },
  { tier: 'foodie_royale', threshold: 4000 },
  { tier: 'tastemaker', threshold: 10000 },
  { tier: 'influencer', threshold: 25000 },
  { tier: 'food_legend', threshold: 60000 },
  { tier: 'icon', threshold: 150000 },
]

// ─── Tier Calculation ─────────────────────────────────────────────────────

function resolveConsumerTier(points: number): ConsumerTier {
  let tier: ConsumerTier = 'explorer'
  for (const t of CONSUMER_TIERS) {
    if (points >= t.threshold) tier = t.tier
    else break
  }
  return tier
}

function resolveBusinessTier(points: number): BusinessTier {
  let tier: BusinessTier = 'operator'
  for (const t of BUSINESS_TIERS) {
    if (points >= t.threshold) tier = t.tier
    else break
  }
  return tier
}

// ─── Tier Boost (single source of truth for spin engine) ──────────────────

// Points ceiling at 10,000 for spin weighting — protects casual players.
// Above 10,000 (Tastemaker tier): points still accumulate for tier status
// but don't increase spin odds further.
const SPIN_WEIGHT_CEILING_TIER: ConsumerTier = 'tastemaker'

/**
 * Returns the boost multiplier for the spin engine.
 * This is THE single source of truth — spin.ts should call this.
 * Capped at Tastemaker tier (10,000 points) to prevent power users
 * from gaming the roulette into worthlessness for casual players.
 */
export function calculateTierBoost(tier: ConsumerTier): number {
  // Cap boost at tastemaker level regardless of actual tier
  const ceilingBoost = TIER_BOOST_PCT[SPIN_WEIGHT_CEILING_TIER] ?? 30
  const actualBoost = TIER_BOOST_PCT[tier] ?? 0
  return Math.min(actualBoost, ceilingBoost)
}

// ─── Tier Progress ────────────────────────────────────────────────────────

export interface TierProgress {
  currentTier: string
  currentThreshold: number
  nextTier: string | null
  nextThreshold: number | null
  points: number
  pointsToNext: number | null
  progressPct: number
  boostPct: number
}

export function getTierProgress(points: number, type: 'consumer' | 'business' = 'consumer'): TierProgress {
  const tiers = type === 'consumer' ? CONSUMER_TIERS : BUSINESS_TIERS

  let currentIdx = 0
  for (let i = 0; i < tiers.length; i++) {
    if (points >= tiers[i].threshold) currentIdx = i
    else break
  }

  const current = tiers[currentIdx]
  const next = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null

  const pointsToNext = next ? next.threshold - points : null
  const progressPct = next
    ? ((points - current.threshold) / (next.threshold - current.threshold)) * 100
    : 100

  const boostPct = type === 'consumer'
    ? calculateTierBoost(current.tier as ConsumerTier)
    : 0

  return {
    currentTier: current.tier,
    currentThreshold: current.threshold,
    nextTier: next?.tier ?? null,
    nextThreshold: next?.threshold ?? null,
    points,
    pointsToNext,
    progressPct: Math.min(Math.max(progressPct, 0), 100),
    boostPct,
  }
}

// ─── Award Consumer Points ────────────────────────────────────────────────

export async function awardPoints(
  userId: string,
  amount: number,
  type: EarnAction | string,
  referenceId?: string,
): Promise<{ newPoints: number; newTier: ConsumerTier; tierChanged: boolean }> {
  // 1. Insert point transaction
  await supabase.from('point_transactions').insert({
    user_id: userId,
    amount,
    type,
    reference_id: referenceId ?? null,
  })

  // 2. Fetch current user
  const { data: user, error } = await supabase
    .from('users')
    .select('points, consumer_tier')
    .eq('id', userId)
    .single()

  if (error || !user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

  const newPoints = (user.points ?? 0) + amount
  const oldTier = user.consumer_tier as ConsumerTier
  const newTier = resolveConsumerTier(newPoints)
  const tierChanged = oldTier !== newTier

  // 3. Update user points and tier
  const updates: Record<string, unknown> = { points: newPoints }
  if (tierChanged) updates.consumer_tier = newTier

  await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)

  return { newPoints, newTier, tierChanged }
}

// ─── Award Business Points ────────────────────────────────────────────────

export async function awardBusinessPoints(
  businessId: string,
  amount: number,
  type: string,
): Promise<{ newPoints: number; newTier: BusinessTier; tierChanged: boolean }> {
  // 1. Insert point transaction
  await supabase.from('point_transactions').insert({
    business_id: businessId,
    amount,
    type,
  })

  // 2. Fetch current business
  const { data: biz, error } = await supabase
    .from('businesses')
    .select('biz_points, biz_tier')
    .eq('id', businessId)
    .single()

  if (error || !biz) throw new AppError(404, 'BIZ_NOT_FOUND', 'Business not found')

  const newPoints = (biz.biz_points ?? 0) + amount
  const oldTier = biz.biz_tier as BusinessTier
  const newTier = resolveBusinessTier(newPoints)
  const tierChanged = oldTier !== newTier

  // 3. Update business points and tier
  const updates: Record<string, unknown> = { biz_points: newPoints }
  if (tierChanged) updates.biz_tier = newTier

  await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId)

  return { newPoints, newTier, tierChanged }
}

// ─── Cross-Convert ────────────────────────────────────────────────────────

const BIZ_TO_CONSUMER_RATIO = 0.5 // 10 biz points = 5 consumer points

/**
 * Convert business points to consumer points.
 * Rate: 10 business points = 5 consumer points.
 */
export async function crossConvert(
  userId: string,
  businessId: string,
  businessPointsToConvert: number,
): Promise<{ consumerPointsGained: number; bizPointsRemaining: number }> {
  if (businessPointsToConvert <= 0) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be positive')
  }

  // Check business has enough points
  const { data: biz } = await supabase
    .from('businesses')
    .select('biz_points, owner_id')
    .eq('id', businessId)
    .single()

  if (!biz) throw new AppError(404, 'BIZ_NOT_FOUND', 'Business not found')
  if (biz.owner_id !== userId) throw new AppError(403, 'NOT_OWNER', 'You do not own this business')
  if ((biz.biz_points ?? 0) < businessPointsToConvert) {
    throw new AppError(400, 'INSUFFICIENT_POINTS', 'Not enough business points')
  }

  const consumerPointsGained = Math.floor(businessPointsToConvert * BIZ_TO_CONSUMER_RATIO)

  // Deduct biz points
  await supabase
    .from('businesses')
    .update({ biz_points: (biz.biz_points ?? 0) - businessPointsToConvert })
    .eq('id', businessId)

  // Award consumer points
  await awardPoints(userId, consumerPointsGained, 'biz_conversion', businessId)

  return {
    consumerPointsGained,
    bizPointsRemaining: (biz.biz_points ?? 0) - businessPointsToConvert,
  }
}
