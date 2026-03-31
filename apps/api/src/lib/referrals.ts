import { randomInt } from 'crypto'
import { supabase } from './supabase'
import { AppError } from './errors'
import { awardPoints, awardBusinessPoints } from './loyalty'
import type { ReferralType } from '../types/shared'

// ─── Code Generation ──────────────────────────────────────────────────────

/**
 * Generate referral codes in the correct format:
 * - User→User:     MAYA-U42
 * - User→Biz:      MAYA-BIZ
 * - Biz→Customer:  FUEGO-C
 * - Biz→Biz:       FUEGO-B
 */
export function generateReferralCode(
  name: string,
  type: 'user_to_user' | 'user_to_biz' | 'biz_to_customer' | 'biz_to_biz',
): string {
  const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5) || 'USER'

  switch (type) {
    case 'user_to_user':
      return `${cleanName}-U${randomInt(10, 99)}`
    case 'user_to_biz':
      return `${cleanName}-BIZ`
    case 'biz_to_customer':
      return `${cleanName}-C`
    case 'biz_to_biz':
      return `${cleanName}-B`
  }
}

// ─── Reward Definitions ───────────────────────────────────────────────────

interface RewardConfig {
  referrerPoints: number
  receiverPoints: number
  referrerSpecial?: string  // e.g. 'free_billing_credit', 'free_month'
  receiverSpecial?: string  // e.g. 'trial_extension_30d', 'free_month'
}

const REWARDS: Record<ReferralType, RewardConfig> = {
  user_to_user: { referrerPoints: 100, receiverPoints: 50 },
  user_to_biz: { referrerPoints: 500, receiverPoints: 0, receiverSpecial: 'trial_extension_30d' },
  biz_to_customer: { referrerPoints: 0, receiverPoints: 75, referrerSpecial: 'free_billing_credit' },
  biz_to_biz: { referrerPoints: 0, receiverPoints: 0, referrerSpecial: 'free_month', receiverSpecial: 'free_month' },
}

// ─── Redeem Referral ──────────────────────────────────────────────────────

export async function redeemReferral(
  code: string,
  redeemerUserId: string,
): Promise<{ type: ReferralType; rewards: RewardConfig }> {
  // 1. Find the referral code
  const { data: referral, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('status', 'pending')
    .is('referee_id', null)
    .single()

  if (error || !referral) {
    throw new AppError(404, 'INVALID_CODE', 'Invalid or already used referral code')
  }

  // 2. Can't redeem your own code
  if (referral.referrer_id === redeemerUserId) {
    throw new AppError(400, 'SELF_REFERRAL', 'You cannot use your own referral code')
  }

  // 3. Check user hasn't already been referred
  const { data: existingRef } = await supabase
    .from('referrals')
    .select('id')
    .eq('referee_id', redeemerUserId)
    .eq('status', 'rewarded')
    .single()

  if (existingRef) {
    throw new AppError(409, 'ALREADY_REFERRED', 'You have already used a referral code')
  }

  const refType = referral.type as ReferralType
  const rewards = REWARDS[refType]

  // 4. Award referrer rewards
  if (rewards.referrerPoints > 0) {
    if (referral.referrer_type === 'user') {
      await awardPoints(referral.referrer_id, rewards.referrerPoints, 'referral_friend', referral.id)
    } else {
      await awardBusinessPoints(referral.referrer_id, rewards.referrerPoints, 'referral')
    }
  }

  // Handle special referrer rewards
  if (rewards.referrerSpecial === 'free_billing_credit') {
    await supabase.from('billing_events').insert({
      business_id: referral.referrer_id,
      visit_intent_id: null,
      type: 'subscription',
      amount_cents: -50, // credit
      stripe_event_id: null,
    })
  } else if (rewards.referrerSpecial === 'free_month') {
    await extendSubscription(referral.referrer_id, 30)
  }

  // 5. Award receiver rewards
  if (rewards.receiverPoints > 0) {
    await awardPoints(redeemerUserId, rewards.receiverPoints, 'referral_friend', referral.id)
  }

  // Handle special receiver rewards
  if (rewards.receiverSpecial === 'trial_extension_30d') {
    // Find the redeemer's business and extend trial
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', redeemerUserId)
      .limit(1)
      .single()

    if (biz) {
      await extendSubscription(biz.id, 30)
    }
  } else if (rewards.receiverSpecial === 'free_month') {
    // For biz_to_biz, redeemer's business gets free month
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', redeemerUserId)
      .limit(1)
      .single()

    if (biz) {
      await extendSubscription(biz.id, 30)
    }
  }

  // 6. Update referral record
  await supabase
    .from('referrals')
    .update({
      referee_id: redeemerUserId,
      referee_type: 'user',
      status: 'rewarded',
      referrer_pts: rewards.referrerPoints,
      referee_pts: rewards.receiverPoints,
      rewarded_at: new Date().toISOString(),
    })
    .eq('id', referral.id)

  return { type: refType, rewards }
}

// ─── Extend Subscription ─────────────────────────────────────────────────

async function extendSubscription(businessId: string, days: number): Promise<void> {
  const { data: biz } = await supabase
    .from('businesses')
    .select('subscription_ends_at')
    .eq('id', businessId)
    .single()

  if (!biz) return

  const currentEnd = biz.subscription_ends_at
    ? new Date(biz.subscription_ends_at)
    : new Date()

  const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()))
  newEnd.setDate(newEnd.getDate() + days)

  await supabase
    .from('businesses')
    .update({ subscription_ends_at: newEnd.toISOString() })
    .eq('id', businessId)
}

// ─── Referral Stats ───────────────────────────────────────────────────────

export interface ReferralStats {
  totalReferrals: number
  rewardedReferrals: number
  pendingReferrals: number
  pointsEarned: number
  conversionRate: number
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  // Try SQL function first
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_referral_stats', {
    p_user_id: userId,
  })

  if (!rpcErr && rpcData && rpcData.length > 0) {
    const r = rpcData[0]
    return {
      totalReferrals: r.total_referrals ?? 0,
      rewardedReferrals: r.rewarded_referrals ?? 0,
      pendingReferrals: r.pending_referrals ?? 0,
      pointsEarned: r.points_earned ?? 0,
      conversionRate: r.conversion_rate ?? 0,
    }
  }

  // Fallback: query directly
  const { data: referrals } = await supabase
    .from('referrals')
    .select('status, referrer_pts')
    .eq('referrer_id', userId)

  if (!referrals || referrals.length === 0) {
    return { totalReferrals: 0, rewardedReferrals: 0, pendingReferrals: 0, pointsEarned: 0, conversionRate: 0 }
  }

  const total = referrals.length
  const rewarded = referrals.filter((r) => r.status === 'rewarded').length
  const pending = referrals.filter((r) => r.status === 'pending').length
  const pointsEarned = referrals.reduce((sum, r) => sum + (r.referrer_pts ?? 0), 0)

  return {
    totalReferrals: total,
    rewardedReferrals: rewarded,
    pendingReferrals: pending,
    pointsEarned,
    conversionRate: total > 0 ? Math.round((rewarded / total) * 100) : 0,
  }
}
