import { randomUUID, randomInt } from 'crypto'
import { supabase } from './supabase'
import { AppError } from './errors'
import {
  EARN_POINTS,
  TIER_BOOST_PCT,
  type ConsumerTier,
  type SpinResult,
} from '@serendipeatery/shared'

// ─── Types ────────────────────────────────────────────────────────────────

interface PrizeRow {
  id: string
  sale_id: string
  name: string
  type: 'percent' | 'amount' | 'free' | 'free_with'
  value: number
  max_spins: number
  spins_used: number
}

interface SaleRow {
  id: string
  business_id: string
  status: string
  max_spins_total: number
  spins_used: number
}

export interface SpinInput {
  userId: string
  saleId: string
  spinLat: number
  spinLng: number
}

export interface SpinOutput {
  result: SpinResult
  animationSeed: number       // slot index the client should land on
  updatedPrizeCounts: Array<{ prizeId: string; spinsUsed: number; maxSpins: number }>
}

// ─── Weighted Selection with Loyalty Boost ────────────────────────────────

/**
 * Build weighted slot array, apply loyalty boost (shift weight from
 * common → rare prizes), then pick a winner.
 *
 * Ghost slots: exhausted prizes (spins_used >= max_spins) are excluded
 * from the selection pool entirely — they stay on the wheel visually
 * but can never be selected.
 */
function selectPrize(prizes: PrizeRow[], consumerTier: ConsumerTier): {
  winner: PrizeRow
  slotIndex: number
  totalSlots: number
} {
  // Filter to prizes with remaining capacity (ghost out exhausted ones)
  const available = prizes.filter((p) => p.spins_used < p.max_spins)
  if (available.length === 0) {
    throw new AppError(409, 'NO_PRIZES_LEFT', 'No prizes remaining')
  }

  // Sort by value ascending — index 0 is most common, last is rarest
  const sorted = [...available].sort((a, b) => a.value - b.value)

  // Base weights = remaining slots
  const baseWeights = sorted.map((p) => p.max_spins - p.spins_used)
  const totalBase = baseWeights.reduce((s, w) => s + w, 0)

  // Apply loyalty boost: shift weight from common → rare
  const boostPct = TIER_BOOST_PCT[consumerTier] ?? 0
  const weights = baseWeights.map((w, i) => {
    if (sorted.length === 1) return w
    const position = i / (sorted.length - 1) // 0 = most common, 1 = rarest
    // Common prizes lose weight, rare prizes gain weight
    const shift = (position - 0.5) * 2 * (boostPct / 100) // range: -boost% to +boost%
    const adjusted = w * (1 + shift)
    return Math.max(adjusted, 0.01) // never fully zero
  })

  const totalWeight = weights.reduce((s, w) => s + w, 0)

  // Cryptographically random roll
  const roll = (randomInt(0, 1_000_000) / 1_000_000) * totalWeight
  let cumulative = 0
  let winnerIdx = 0

  for (let i = 0; i < sorted.length; i++) {
    cumulative += weights[i]
    if (roll <= cumulative) {
      winnerIdx = i
      break
    }
  }

  const winner = sorted[winnerIdx]

  // Build a visual slot array for animation (all prizes, including ghosts)
  const allSlots: string[] = []
  for (const p of prizes) {
    const slots = Math.max(1, Math.ceil((p.max_spins / Math.max(totalBase, 1)) * prizes.length * 3))
    for (let i = 0; i < slots; i++) allSlots.push(p.id)
  }

  // Find a slot index that corresponds to the winning prize
  const winnerSlots = allSlots
    .map((id, idx) => ({ id, idx }))
    .filter((s) => s.id === winner.id)
  const slotIndex = winnerSlots[randomInt(0, winnerSlots.length)].idx

  return { winner, slotIndex, totalSlots: allSlots.length }
}

// ─── Main Spin Engine ─────────────────────────────────────────────────────

export async function executeSpin(input: SpinInput): Promise<SpinOutput> {
  const { userId, saleId, spinLat, spinLng } = input

  // ── 1. Acquire row lock on sale + prizes via Supabase RPC ──────────
  // This uses FOR UPDATE to prevent race conditions where two users
  // could win the same last prize simultaneously.
  const { data: lockResult, error: lockErr } = await supabase.rpc('lock_sale_for_spin', {
    p_sale_id: saleId,
    p_user_id: userId,
  })

  if (lockErr) {
    // If the RPC doesn't exist yet, fall back to regular queries
    // (allows incremental deployment)
    if (lockErr.code === '42883') {
      return executeSpinWithoutLock(input)
    }
    throw new AppError(500, 'LOCK_FAILED', `Failed to acquire spin lock: ${lockErr.message}`)
  }

  // lockResult returns: { sale, prizes, user, already_spun }
  const locked = lockResult as {
    sale: SaleRow
    prizes: PrizeRow[]
    user: { points: number; consumer_tier: string } | null
    already_spun: boolean
  }

  if (locked.already_spun) {
    throw new AppError(409, 'ALREADY_SPUN', 'You already spun for this sale')
  }

  if (locked.sale.status !== 'live') {
    throw new AppError(404, 'SALE_NOT_LIVE', 'This sale is not currently live')
  }

  if (locked.sale.spins_used >= locked.sale.max_spins_total) {
    throw new AppError(409, 'SPINS_EXHAUSTED', 'All spins for this sale have been used')
  }

  // ── 2. Server-side prize selection (before any animation) ──────────
  const consumerTier = (locked.user?.consumer_tier ?? 'explorer') as ConsumerTier
  const { winner, slotIndex, totalSlots } = selectPrize(locked.prizes, consumerTier)

  // ── 3. Record the win atomically ──────────────────────────────────
  return recordSpinResult({
    userId,
    saleId,
    businessId: locked.sale.business_id,
    spinLat,
    spinLng,
    winner,
    slotIndex,
    totalSlots,
    userPoints: locked.user?.points ?? 0,
    consumerTier,
    prizes: locked.prizes,
  })
}

/**
 * Fallback path when the lock_sale_for_spin RPC hasn't been deployed yet.
 * Uses regular queries — still safe but has a small race window.
 */
async function executeSpinWithoutLock(input: SpinInput): Promise<SpinOutput> {
  const { userId, saleId, spinLat, spinLng } = input

  // 1. Verify sale is live with prizes
  const { data: sale } = await supabase
    .from('flash_sales')
    .select('*, prizes(*)')
    .eq('id', saleId)
    .eq('status', 'live')
    .single()

  if (!sale) throw new AppError(404, 'SALE_NOT_LIVE', 'This sale is not currently live')
  if (sale.spins_used >= sale.max_spins_total) {
    throw new AppError(409, 'SPINS_EXHAUSTED', 'All spins for this sale have been used')
  }

  // 2. Check duplicate spin
  const { data: existing } = await supabase
    .from('visit_intents')
    .select('id')
    .eq('user_id', userId)
    .eq('sale_id', saleId)
    .single()

  if (existing) throw new AppError(409, 'ALREADY_SPUN', 'You already spun for this sale')

  // 3. Get user tier
  const { data: user } = await supabase
    .from('users')
    .select('points, consumer_tier')
    .eq('id', userId)
    .single()

  const consumerTier = (user?.consumer_tier ?? 'explorer') as ConsumerTier
  const { winner, slotIndex, totalSlots } = selectPrize(sale.prizes, consumerTier)

  return recordSpinResult({
    userId,
    saleId,
    businessId: sale.business_id,
    spinLat,
    spinLng,
    winner,
    slotIndex,
    totalSlots,
    userPoints: user?.points ?? 0,
    consumerTier,
    prizes: sale.prizes,
  })
}

// ─── Record Result ────────────────────────────────────────────────────────

interface RecordInput {
  userId: string
  saleId: string
  businessId: string
  spinLat: number
  spinLng: number
  winner: PrizeRow
  slotIndex: number
  totalSlots: number
  userPoints: number
  consumerTier: ConsumerTier
  prizes: PrizeRow[]
}

async function recordSpinResult(input: RecordInput): Promise<SpinOutput> {
  const {
    userId, saleId, businessId, spinLat, spinLng,
    winner, slotIndex, totalSlots, userPoints, consumerTier, prizes,
  } = input

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 60-min arrival window
  const prizeCode = randomUUID().slice(0, 8).toUpperCase()

  // ── Create visit intent with state "spun_away" ─────────────────────
  const { data: intent, error: intentErr } = await supabase
    .from('visit_intents')
    .insert({
      user_id: userId,
      sale_id: saleId,
      business_id: businessId,
      state: 'spun_away',
      prize_won: winner.name,
      prize_code: prizeCode,
      spin_lat: spinLat,
      spin_lng: spinLng,
      spun_at: now.toISOString(),
      entered_fence_at: null,
      confirmed_at: null,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (intentErr) throw new AppError(500, 'INTENT_FAILED', 'Failed to create visit intent')

  // ── Increment spins_used on sale and prize ─────────────────────────
  await supabase.rpc('increment_spins', { p_sale_id: saleId, p_prize_id: winner.id })

  // ── Award spin points with tier boost ──────────────────────────────
  const basePoints = EARN_POINTS.spin
  const boostPct = TIER_BOOST_PCT[consumerTier] ?? 0
  const pointsEarned = Math.round(basePoints * (1 + boostPct / 100))

  await supabase
    .from('users')
    .update({ points: userPoints + pointsEarned })
    .eq('id', userId)

  // ── Build updated prize counts ─────────────────────────────────────
  const updatedPrizeCounts = prizes.map((p) => ({
    prizeId: p.id,
    spinsUsed: p.id === winner.id ? p.spins_used + 1 : p.spins_used,
    maxSpins: p.max_spins,
  }))

  return {
    result: {
      prizeId: winner.id,
      prizeName: winner.name,
      prizeType: winner.type,
      prizeValue: winner.value,
      code: prizeCode,
      expiresAt,
      pointsEarned,
      visitIntentId: intent.id,
    },
    animationSeed: slotIndex,
    updatedPrizeCounts,
  }
}
