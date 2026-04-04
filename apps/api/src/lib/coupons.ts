import { supabase } from './supabase.js'
import { AppError } from './errors.js'

// ─── Award Coupon ────────────────────────────────────────────────────────

export async function awardCoupon(
  userId: string,
  prizeId: string,
  flashSaleId: string,
): Promise<any> {
  // Get prize details
  const { data: prize } = await supabase
    .from('prizes')
    .select('*, flash_sales!inner(ends_at, business_id, businesses(name))')
    .eq('id', prizeId)
    .single()

  if (!prize) throw new AppError(404, 'PRIZE_NOT_FOUND', 'Prize not found')

  const couponType = prize.coupon_type || 'flash'
  const bizName = (prize as any).flash_sales?.businesses?.name ?? ''
  const saleEndsAt = (prize as any).flash_sales?.ends_at
  const businessId = (prize as any).flash_sales?.business_id

  let autoDeleteAt: string | null = null
  let isLootable = true
  let isTradeable = true

  if (couponType === 'flash') {
    autoDeleteAt = saleEndsAt ?? new Date(Date.now() + 3600000).toISOString()
    isLootable = false
    isTradeable = false
  } else if (couponType === 'long_term') {
    const oneYear = new Date()
    oneYear.setFullYear(oneYear.getFullYear() + 1)
    autoDeleteAt = oneYear.toISOString()
    isLootable = true
    isTradeable = true
  } else if (couponType === 'high_value') {
    autoDeleteAt = null // never auto-deletes
    isLootable = true
    isTradeable = true
  }

  const couponCode = `${couponType.toUpperCase().slice(0, 2)}-${businessId?.slice(0, 4).toUpperCase() ?? 'XXXX'}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const { data: wallet, error } = await supabase
    .from('wallets')
    .insert({
      user_id: userId,
      prize_name: prize.label || prize.name,
      business_name: bizName,
      business_id: businessId,
      coupon_code: couponCode,
      coupon_type: couponType,
      expires_at: autoDeleteAt,
      auto_delete_at: autoDeleteAt,
      redeem_window_minutes: prize.redeem_window_minutes ?? 15,
      is_lootable: isLootable,
      is_tradeable: isTradeable,
      is_redeemed: false,
      original_owner_id: userId,
      current_owner_id: userId,
    })
    .select()
    .single()

  if (error) throw error
  return wallet
}

// ─── Start Redemption (high_value only) ──────────────────────────────────

export async function startRedeem(userId: string, walletId: string) {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('id', walletId)
    .eq('current_owner_id', userId)
    .single()

  if (!wallet) throw new AppError(404, 'NOT_FOUND', 'Coupon not found')
  if (wallet.is_redeemed) throw new AppError(400, 'ALREADY_REDEEMED', 'Already redeemed')
  if (wallet.coupon_type !== 'high_value') throw new AppError(400, 'NOT_HIGH_VALUE', 'Only high-value coupons need redemption windows')

  // Check daily cap
  if (wallet.business_id) {
    const { data: prize } = await supabase
      .from('prizes')
      .select('daily_redemption_cap, daily_redemptions_today')
      .eq('name', wallet.prize_name)
      .eq('sale_id', wallet.business_id)
      .single()

    if (prize?.daily_redemption_cap && (prize.daily_redemptions_today ?? 0) >= prize.daily_redemption_cap) {
      throw new AppError(429, 'DAILY_CAP', 'Daily redemption limit reached for this prize')
    }
  }

  const windowMinutes = wallet.redeem_window_minutes || 15
  const now = new Date()
  const expiresAt = new Date(now.getTime() + windowMinutes * 60 * 1000)

  await supabase
    .from('wallets')
    .update({
      redeem_started_at: now.toISOString(),
      redeem_expires_at: expiresAt.toISOString(),
    })
    .eq('id', walletId)

  return {
    walletId,
    prizeName: wallet.prize_name,
    businessName: wallet.business_name,
    windowMinutes,
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

// ─── Confirm Redemption ──────────────────────────────────────────────────

export async function confirmRedeem(userId: string, walletId: string) {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('id', walletId)
    .eq('current_owner_id', userId)
    .single()

  if (!wallet) throw new AppError(404, 'NOT_FOUND', 'Coupon not found')
  if (wallet.is_redeemed) throw new AppError(400, 'ALREADY_REDEEMED', 'Already redeemed')

  if (wallet.coupon_type === 'high_value') {
    if (!wallet.redeem_expires_at || new Date(wallet.redeem_expires_at) < new Date()) {
      throw new AppError(410, 'WINDOW_EXPIRED', 'Redemption window has expired')
    }
  }

  const now = new Date().toISOString()
  await supabase
    .from('wallets')
    .update({ is_redeemed: true, redeemed_at: now })
    .eq('id', walletId)

  // Increment daily redemptions on prize if applicable
  if (wallet.business_id) {
    try {
      const { data: prizes } = await supabase
        .from('prizes')
        .select('id, daily_redemptions_today')
        .eq('name', wallet.prize_name)
        .limit(1)

      if (prizes?.length) {
        await supabase
          .from('prizes')
          .update({ daily_redemptions_today: (prizes[0].daily_redemptions_today ?? 0) + 1 })
          .eq('id', prizes[0].id)
      }
    } catch {}
  }

  return { redeemed: true, redeemedAt: now }
}

// ─── Cancel Redemption Window ────────────────────────────────────────────

export async function cancelRedeem(userId: string, walletId: string) {
  await supabase
    .from('wallets')
    .update({ redeem_started_at: null, redeem_expires_at: null })
    .eq('id', walletId)
    .eq('current_owner_id', userId)
    .eq('is_redeemed', false)

  return { cancelled: true }
}

// ─── Delete Expired Flash Coupons ────────────────────────────────────────

export async function deleteExpiredFlashCoupons(): Promise<number> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('wallets')
    .delete()
    .eq('coupon_type', 'flash')
    .eq('is_redeemed', false)
    .lt('auto_delete_at', now)
    .or(`loot_protected_until.is.null,loot_protected_until.lt.${now}`)
    .select('id')

  if (error) {
    console.error('[coupons] deleteExpiredFlashCoupons error:', error.message)
    return 0
  }

  const count = data?.length ?? 0
  if (count > 0) console.log(`[coupons] Deleted ${count} expired flash coupons`)
  return count
}

// ─── Protect Loot During Battle ──────────────────────────────────────────

export async function protectLootDuringBattle(userId: string): Promise<void> {
  const protectUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  await supabase
    .from('wallets')
    .update({ loot_protected_until: protectUntil })
    .eq('current_owner_id', userId)
    .eq('is_lootable', true)
    .eq('is_redeemed', false)
}
