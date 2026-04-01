import { supabase } from './supabase.js'
import { AppError } from './errors.js'

// ─── Threshold Definitions ────────────────────────────────────────────────

export interface ThresholdDef {
  key: string
  label: string
  description: string
  target: number
}

export const THRESHOLDS: ThresholdDef[] = [
  {
    key: 'referral_visits',
    label: 'Referral Visits',
    description: '3+ visits from referral links',
    target: 3,
  },
  {
    key: 'biz_referrals',
    label: 'Business Referrals',
    description: '1+ other business referred by you',
    target: 1,
  },
  {
    key: 'total_sales',
    label: 'Completed Sales',
    description: '5+ completed flash sales',
    target: 5,
  },
  {
    key: 'conversion_rate',
    label: 'Conversion Rate',
    description: '20%+ spin-to-visit conversion',
    target: 20,
  },
  {
    key: 'repeat_customers',
    label: 'Repeat Customers',
    description: '3+ customers who visited more than once',
    target: 3,
  },
]

// ─── Evidence Progress ────────────────────────────────────────────────────

export interface ThresholdProgress {
  key: string
  label: string
  description: string
  target: number
  current: number
  met: boolean
  pct: number
}

export interface EvidenceProgress {
  thresholds: ThresholdProgress[]
  thresholdsMet: number
  totalThresholds: number
  allMet: boolean
}

export async function getEvidenceProgress(businessId: string): Promise<EvidenceProgress> {
  // Try SQL function first
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_evidence_progress', {
    p_business_id: businessId,
  })

  if (!rpcErr && rpcData && rpcData.length > 0) {
    const r = rpcData[0]
    const thresholds = THRESHOLDS.map((t) => {
      const current = r[t.key] ?? 0
      return {
        ...t,
        current,
        met: current >= t.target,
        pct: Math.min(Math.round((current / t.target) * 100), 100),
      }
    })
    const met = thresholds.filter((t) => t.met).length
    return { thresholds, thresholdsMet: met, totalThresholds: 5, allMet: met >= 5 }
  }

  // Fallback: calculate from queries
  return calculateEvidenceProgress(businessId)
}

async function calculateEvidenceProgress(businessId: string): Promise<EvidenceProgress> {
  // 1. Referral visits: visits where the user came from a referral
  const { count: referralVisits } = await supabase
    .from('visit_intents')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('state', 'confirmed')
    .not('referral_code', 'is', null)

  // Fallback: count confirmed visits with referral users
  const refVisitsCount = referralVisits ?? 0

  // 2. Business referrals: other businesses referred by this business
  const { count: bizReferrals } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', businessId)
    .eq('referrer_type', 'business')
    .eq('type', 'biz_to_biz')
    .eq('status', 'rewarded')

  // 3. Total completed sales
  const { count: totalSales } = await supabase
    .from('flash_sales')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'ended')

  // 4. Conversion rate (avg spin-to-visit across all sales)
  const { data: salesData } = await supabase
    .from('flash_sales')
    .select('spins_used, max_spins_total')
    .eq('business_id', businessId)
    .eq('status', 'ended')

  const { count: confirmedVisits } = await supabase
    .from('visit_intents')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('state', 'confirmed')

  const totalSpins = salesData?.reduce((sum, s) => sum + (s.spins_used ?? 0), 0) ?? 0
  const conversionRate = totalSpins > 0
    ? Math.round(((confirmedVisits ?? 0) / totalSpins) * 100)
    : 0

  // 5. Repeat customers: users who visited more than once
  const { data: visitCounts } = await supabase
    .from('visit_intents')
    .select('user_id')
    .eq('business_id', businessId)
    .eq('state', 'confirmed')

  const userVisitMap = new Map<string, number>()
  for (const v of visitCounts ?? []) {
    userVisitMap.set(v.user_id, (userVisitMap.get(v.user_id) ?? 0) + 1)
  }
  const repeatCustomers = [...userVisitMap.values()].filter((c) => c > 1).length

  const values: Record<string, number> = {
    referral_visits: refVisitsCount,
    biz_referrals: bizReferrals ?? 0,
    total_sales: totalSales ?? 0,
    conversion_rate: conversionRate,
    repeat_customers: repeatCustomers,
  }

  const thresholds = THRESHOLDS.map((t) => {
    const current = values[t.key] ?? 0
    return {
      ...t,
      current,
      met: current >= t.target,
      pct: Math.min(Math.round((current / t.target) * 100), 100),
    }
  })

  const met = thresholds.filter((t) => t.met).length
  return { thresholds, thresholdsMet: met, totalThresholds: 5, allMet: met >= 5 }
}

// ─── Check & Trigger ──────────────────────────────────────────────────────

export async function checkEvidenceThresholds(businessId: string): Promise<EvidenceProgress> {
  const progress = await getEvidenceProgress(businessId)

  // Update the score in the database
  await supabase
    .from('businesses')
    .update({ trial_evidence_score: progress.thresholdsMet })
    .eq('id', businessId)

  // If all thresholds met and still on trial, trigger paywall
  const { data: biz } = await supabase
    .from('businesses')
    .select('plan, trial_locked')
    .eq('id', businessId)
    .single()

  if (biz && biz.plan === 'trial' && progress.allMet && !biz.trial_locked) {
    await triggerPaywall(businessId)
  }

  return progress
}

// ─── Paywall Trigger ──────────────────────────────────────────────────────

export async function triggerPaywall(businessId: string): Promise<void> {
  // Set trial_locked = true
  await supabase
    .from('businesses')
    .update({ trial_locked: true })
    .eq('id', businessId)

  // Preserve one active sale
  await preserveOneSale(businessId)

  // Send paywall notification (enqueue if worker is available)
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id, name')
    .eq('id', businessId)
    .single()

  if (biz) {
    await supabase.from('notifications').insert({
      user_id: biz.owner_id,
      type: 'paywall_triggered',
      sale_id: null,
      business_id: businessId,
      title: 'Your trial has proven its value!',
      body: `${biz.name} has hit all 5 evidence thresholds. Upgrade to keep all features — one sale stays active.`,
      sent_at: new Date().toISOString(),
    })
  }
}

// ─── Preserve One Sale ────────────────────────────────────────────────────

export async function preserveOneSale(businessId: string): Promise<void> {
  // Get all active sales, keep the most recent one, cancel the rest
  const { data: activeSales } = await supabase
    .from('flash_sales')
    .select('id')
    .eq('business_id', businessId)
    .in('status', ['live', 'scheduled'])
    .order('created_at', { ascending: false })

  if (!activeSales || activeSales.length <= 1) return

  // Keep the first (most recent), cancel the rest
  const toCancel = activeSales.slice(1).map((s) => s.id)

  await supabase
    .from('flash_sales')
    .update({ status: 'cancelled' })
    .in('id', toCancel)
}
