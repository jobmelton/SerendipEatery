import { supabase } from './supabase.js'

// ─── Tier Visit Limits ───────────────────────────────────────────────────

export interface VisitLimitResult {
  allowed: boolean
  reason: string
  visitsUsed: number
  visitLimit: number
  missedCount: number
}

const PAID_TIER_LIMITS: Record<string, { perMonth: number | null }> = {
  starter: { perMonth: 100 },
  growth: { perMonth: 300 },
  pro: { perMonth: null },
}

// ─── Main Entry Point ────────────────────────────────────────────────────

export async function checkVisitLimit(
  businessId: string,
  flashSaleId?: string,
): Promise<VisitLimitResult> {
  const { data: biz } = await supabase
    .from('businesses')
    .select('billing_plan, plan, monthly_visit_count, free_tier_graduated, free_tier_visits_this_month, peak_monthly_visits, shadow_mode')
    .eq('id', businessId)
    .single()

  if (!biz) {
    return { allowed: false, reason: 'Business not found', visitsUsed: 0, visitLimit: 0, missedCount: 0 }
  }

  const plan = biz.billing_plan || biz.plan || 'trial'

  // Paid plans: use paid tier limits
  if (plan !== 'trial') {
    return checkPaidPlanLimit(businessId, plan, biz.monthly_visit_count ?? 0)
  }

  // ─── Free tier logic ───────────────────────────────────────────────
  const visitsThisMonth = biz.free_tier_visits_this_month ?? 0

  if (!biz.free_tier_graduated) {
    // Phase 1 — Honeymoon: full functionality, track visits
    // Increment visit count
    const newCount = visitsThisMonth + 1
    await supabase
      .from('businesses')
      .update({ free_tier_visits_this_month: newCount })
      .eq('id', businessId)

    // Check if this month crossed 100 — flag for graduation next month
    if (newCount >= 100 && (biz.peak_monthly_visits ?? 0) < 100) {
      await supabase
        .from('businesses')
        .update({ peak_monthly_visits: newCount })
        .eq('id', businessId)
      await sendGraduationCongrats(businessId)
    }

    return { allowed: true, reason: '', visitsUsed: newCount, visitLimit: Infinity, missedCount: 0 }
  }

  // Phase 3+: graduated — apply 5 visit monthly cap
  if (visitsThisMonth >= 5) {
    // Get missed count
    const { count: missedCount } = await supabase
      .from('missed_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', getMonthStart())

    // First time hitting limit this month — trigger shadow mode
    if (!biz.shadow_mode) {
      await triggerShadowMode(businessId, 'Free tier: 5 confirmed visits/month reached (graduated)')
      await sendLimitNotification(businessId, visitsThisMonth, 5, missedCount ?? 0)
    }

    return {
      allowed: false,
      reason: 'Free tier monthly limit: 5 confirmed visits reached',
      visitsUsed: visitsThisMonth,
      visitLimit: 5,
      missedCount: missedCount ?? 0,
    }
  }

  // Under limit — allow and increment
  const newCount = visitsThisMonth + 1
  await supabase
    .from('businesses')
    .update({ free_tier_visits_this_month: newCount })
    .eq('id', businessId)

  return { allowed: true, reason: '', visitsUsed: newCount, visitLimit: 5, missedCount: 0 }
}

// ─── Paid Plan Limit Check ───────────────────────────────────────────────

async function checkPaidPlanLimit(
  businessId: string,
  plan: string,
  monthlyVisitCount: number,
): Promise<VisitLimitResult> {
  const limits = PAID_TIER_LIMITS[plan]

  // Pro plan: always allowed
  if (!limits || limits.perMonth === null) {
    return { allowed: true, reason: '', visitsUsed: 0, visitLimit: Infinity, missedCount: 0 }
  }

  const visitsUsed = monthlyVisitCount

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

// ─── Graduation Congrats ─────────────────────────────────────────────────

export async function sendGraduationCongrats(businessId: string): Promise<void> {
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id, name')
    .eq('id', businessId)
    .single()

  if (!biz) return

  await supabase.from('notifications').insert({
    user_id: biz.owner_id,
    type: 'free_tier_graduation',
    sale_id: null,
    business_id: businessId,
    title: 'SerendipEatery is working for you!',
    body: `Congratulations! ${biz.name} hit 100 confirmed visits this month. Starting next month, your free tier will cap at 5 visits/month so you can see how many customers you're missing. Upgrade to keep all your traffic flowing.`,
    sent_at: new Date().toISOString(),
  })
}

// ─── Monthly Reminder for Graduated Free Tier ────────────────────────────

export async function sendMonthlyMissedReminder(businessId: string, missedLastMonth: number): Promise<void> {
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id, name')
    .eq('id', businessId)
    .single()

  if (!biz) return

  await supabase.from('notifications').insert({
    user_id: biz.owner_id,
    type: 'monthly_missed_reminder',
    sale_id: null,
    business_id: businessId,
    title: `You had ${missedLastMonth} missed opportunities last month`,
    body: `${biz.name} missed ${missedLastMonth} potential customers last month on the free tier. Upgrade to capture all your traffic.`,
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
