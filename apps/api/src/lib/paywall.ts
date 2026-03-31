import { supabase } from './supabase'
import { getEvidenceProgress } from './evidence'

// ─── Paywall States ───────────────────────────────────────────────────────

export type PaywallStatus =
  | 'free'           // 0 thresholds met, no prompts
  | 'soft_prompt_1'  // ~1/3 evidence (2+ thresholds met)
  | 'soft_prompt_2'  // ~2/3 evidence (3+ thresholds met)
  | 'soft_prompt_3'  // nearly complete (4 thresholds met)
  | 'locked'         // all 5 met, hard lockdown

export interface PaywallState {
  status: PaywallStatus
  thresholdsMet: number
  totalThresholds: number
  isLocked: boolean
  canCreateSale: boolean
  message: string | null
}

const SOFT_MESSAGES: Record<string, string> = {
  soft_prompt_1: "You're seeing real results! Consider upgrading to unlock unlimited sales and features.",
  soft_prompt_2: "Your flash sales are working — upgrade now to keep the momentum going.",
  soft_prompt_3: "Almost there! One more threshold and your trial features will be limited. Upgrade to keep everything.",
}

// ─── Check Paywall Status ─────────────────────────────────────────────────

export async function checkPaywallStatus(businessId: string): Promise<PaywallState> {
  // Check if business is on a paid plan
  const { data: biz } = await supabase
    .from('businesses')
    .select('plan, trial_locked')
    .eq('id', businessId)
    .single()

  if (!biz) {
    return {
      status: 'free',
      thresholdsMet: 0,
      totalThresholds: 5,
      isLocked: false,
      canCreateSale: true,
      message: null,
    }
  }

  // Paid plans are never paywalled
  if (biz.plan !== 'trial') {
    return {
      status: 'free',
      thresholdsMet: 0,
      totalThresholds: 5,
      isLocked: false,
      canCreateSale: true,
      message: null,
    }
  }

  // Hard lockdown check
  if (biz.trial_locked) {
    return {
      status: 'locked',
      thresholdsMet: 5,
      totalThresholds: 5,
      isLocked: true,
      canCreateSale: false,
      message: "Your trial has proven SerendipEatery works for your business! Upgrade to continue creating sales. Your most recent sale stays active.",
    }
  }

  // Get evidence progress for soft prompts
  const progress = await getEvidenceProgress(businessId)
  const met = progress.thresholdsMet

  if (met >= 4) {
    return {
      status: 'soft_prompt_3',
      thresholdsMet: met,
      totalThresholds: 5,
      isLocked: false,
      canCreateSale: true,
      message: SOFT_MESSAGES.soft_prompt_3,
    }
  }

  if (met >= 3) {
    return {
      status: 'soft_prompt_2',
      thresholdsMet: met,
      totalThresholds: 5,
      isLocked: false,
      canCreateSale: true,
      message: SOFT_MESSAGES.soft_prompt_2,
    }
  }

  if (met >= 2) {
    return {
      status: 'soft_prompt_1',
      thresholdsMet: met,
      totalThresholds: 5,
      isLocked: false,
      canCreateSale: true,
      message: SOFT_MESSAGES.soft_prompt_1,
    }
  }

  return {
    status: 'free',
    thresholdsMet: met,
    totalThresholds: 5,
    isLocked: false,
    canCreateSale: true,
    message: null,
  }
}
