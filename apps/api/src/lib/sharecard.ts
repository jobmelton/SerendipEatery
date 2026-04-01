import { supabase } from './supabase.js'
import { AppError } from './errors.js'

// ─── Brand Constants ──────────────────────────────────────────────────────

const BRAND = {
  orange: '#F7941D',
  night: '#0f0a1e',
  surface: '#fff8f2',
  surfaceDim: '#1a1230',
  success: '#1D9E75',
  accent: '#534AB7',
}

// ─── Win Card Data ───────────────────────────────────────────────────────

export async function getWinCardData(userId: string, visitIntentId: string) {
  const { data: intent } = await supabase
    .from('visit_intents')
    .select('prize_won, prize_code, flash_sales(businesses(name, cuisine))')
    .eq('id', visitIntentId)
    .single()

  if (!intent) throw new AppError(404, 'INTENT_NOT_FOUND', 'Visit intent not found')

  const { data: user } = await supabase
    .from('users')
    .select('display_name, consumer_tier')
    .eq('id', userId)
    .single()

  return {
    type: 'win' as const,
    prizeName: intent.prize_won ?? 'a prize',
    businessName: (intent as any).flash_sales?.businesses?.name ?? 'a restaurant',
    cuisine: (intent as any).flash_sales?.businesses?.cuisine ?? '',
    displayName: user?.display_name ?? 'Someone',
    tier: user?.consumer_tier ?? 'explorer',
    brand: BRAND,
  }
}

// ─── Sale Card Data ──────────────────────────────────────────────────────

export async function getSaleCardData(saleId: string) {
  const { data: sale } = await supabase
    .from('flash_sales')
    .select('*, businesses(name, cuisine, type), prizes(*)')
    .eq('id', saleId)
    .single()

  if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found')

  return {
    type: 'sale' as const,
    businessName: (sale as any).businesses?.name ?? 'Restaurant',
    cuisine: (sale as any).businesses?.cuisine ?? '',
    businessType: (sale as any).businesses?.type ?? 'restaurant',
    prizeCount: sale.prizes?.length ?? 0,
    topPrize: sale.prizes?.[0]?.name ?? 'Amazing deals',
    spinsLeft: sale.max_spins_total - sale.spins_used,
    startsAt: sale.starts_at,
    endsAt: sale.ends_at,
    brand: BRAND,
  }
}

// ─── Profile Card Data ──────────────────────────────────────────────────

export async function getProfileCardData(userId: string) {
  const { data: user } = await supabase
    .from('users')
    .select('display_name, points, consumer_tier, streak_days')
    .eq('id', userId)
    .single()

  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

  const { count: totalVisits } = await supabase
    .from('visit_intents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('state', 'confirmed')

  return {
    type: 'profile' as const,
    displayName: user.display_name ?? 'Explorer',
    points: user.points ?? 0,
    tier: user.consumer_tier ?? 'explorer',
    streakDays: user.streak_days ?? 0,
    totalVisits: totalVisits ?? 0,
    brand: BRAND,
  }
}
