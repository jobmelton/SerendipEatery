import { supabase } from './supabase.js'

// ─── Tier Visit Limits ───────────────────────────────────────────────────

interface VisitLimitResult {
  allowed: boolean
  reason: string
  visitsUsed: number
  visitLimit: number
  missedCount: number
}

const TIER_LIMITS: Record<string, { perSale: number | null; perMonth: number | null }> = {
  trial: { perSale: 5, perMonth: null },
  starter: { perSale: null, perMonth: 100 },
  growth: { perSale: null, perMonth: 300 },
  pro: { perSale: null, perMonth: null },
}

export async function checkVisitLimit(
  businessId: string,
  flashSaleId?: string,
): Promise<VisitLimitResult> {
  const { data: biz } = await supabase
    .from('businesses')
    .select('billing_plan, plan, monthly_visit_count')
    .eq('id', businessId)
    .single()

  if (!biz) {
    return { allowed: false, reason: 'Business not found', visitsUsed: 0, visitLimit: 0, missedCount: 0 }
  }

  const plan = biz.billing_plan || biz.plan || 'trial'
  const limits = TIER_LIMITS[plan] || TIER_LIMITS.trial

  // Pro plan: always allowed
  if (plan === 'pro') {
    return { allowed: true, reason: '', visitsUsed: 0, visitLimit: Infinity, missedCount: 0 }
  }

  // Trial: check per-sale limit (5 confirmed visits per sale)
  if (plan === 'trial' && limits.perSale && flashSaleId) {
    const { count } = await supabase
      .from('visit_intents')
      .select('id', { count: 'exact', head: true })
      .eq('sale_id', flashSaleId)
      .eq('state', 'confirmed')

    const visitsUsed = count ?? 0

    const { count: missedCount } = await supabase
      .from('missed_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('flash_sale_id', flashSaleId)

    if (visitsUsed >= limits.perSale) {
      return {
        allowed: false,
        reason: `Trial limit: ${limits.perSale} confirmed visits per sale reached`,
        visitsUsed,
        visitLimit: limits.perSale,
        missedCount: missedCount ?? 0,
      }
    }

    return { allowed: true, reason: '', visitsUsed, visitLimit: limits.perSale, missedCount: missedCount ?? 0 }
  }

  // Starter / Growth: check monthly limit
  if (limits.perMonth) {
    const visitsUsed = biz.monthly_visit_count ?? 0

    const { count: missedCount } = await supabase
      .from('missed_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', getMonthStart())

    if (visitsUsed >= limits.perMonth) {
      return {
        allowed: false,
        reason: `${capitalize(plan)} limit: ${limits.perMonth} confirmed visits/month reached`,
        visitsUsed,
        visitLimit: limits.perMonth,
        missedCount: missedCount ?? 0,
      }
    }

    return { allowed: true, reason: '', visitsUsed, visitLimit: limits.perMonth, missedCount: missedCount ?? 0 }
  }

  return { allowed: true, reason: '', visitsUsed: 0, visitLimit: Infinity, missedCount: 0 }
}

// ─── Trigger Shadow Mode ─────────────────────────────────────────────────

export async function triggerShadowMode(businessId: string, reason: string): Promise<void> {
  await supabase
    .from('businesses')
    .update({
      shadow_mode: true,
      shadow_mode_reason: reason,
      shadow_mode_at: new Date().toISOString(),
    })
    .eq('id', businessId)
}

// ─── Send Limit Notification ─────────────────────────────────────────────

export async function sendLimitNotification(
  businessId: string,
  visitsUsed: number,
  visitLimit: number,
  missedCount: number,
): Promise<void> {
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id, name, billing_plan, plan')
    .eq('id', businessId)
    .single()

  if (!biz) return

  const plan = capitalize(biz.billing_plan || biz.plan || 'trial')

  // In-app notification
  await supabase.from('notifications').insert({
    user_id: biz.owner_id,
    type: 'shadow_mode_activated',
    sale_id: null,
    business_id: businessId,
    title: `Your ${plan} promotion has reached its visit limit`,
    body: `${biz.name} has reached ${visitLimit} confirmed visits. Promotions are now in shadow mode. ${missedCount} potential customers missed. Upgrade to capture all traffic.`,
    sent_at: new Date().toISOString(),
  })
}

// ─── Log Missed Opportunity ──────────────────────────────────────────────

export async function logMissedOpportunity(
  flashSaleId: string,
  businessId: string,
  userId: string | null,
  type: 'notification_blocked' | 'spin_blocked' | 'geofence_entry',
  userTier?: string,
  distanceMeters?: number,
): Promise<void> {
  await supabase.from('missed_opportunities').insert({
    flash_sale_id: flashSaleId,
    business_id: businessId,
    user_id: userId,
    opportunity_type: type,
    would_have_notified: type === 'notification_blocked',
    user_tier: userTier ?? null,
    distance_meters: distanceMeters ?? null,
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getMonthStart(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
