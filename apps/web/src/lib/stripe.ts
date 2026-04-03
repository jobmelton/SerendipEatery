import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// ─── Stripe Client ────────────────────────────────────────────────────────

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

// ─── Supabase (service role for server-side) ──────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// ─── Plan Config ──────────────────────────────────────────────────────────

export type PlanId = 'starter' | 'growth' | 'pro'

interface PlanConfig {
  name: string
  priceId: string
  monthlyAmount: number
  mode: 'subscription' | 'payment'
  commitmentMonths?: number
}

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER!,
    monthlyAmount: 2900, // $29/mo
    mode: 'subscription',
  },
  growth: {
    name: 'Growth (1-year commitment)',
    priceId: process.env.STRIPE_PRICE_GROWTH!,
    monthlyAmount: 7900, // $79/mo
    mode: 'subscription',
    commitmentMonths: 12,
  },
  pro: {
    name: 'Pro (5-year commitment)',
    priceId: process.env.STRIPE_PRICE_PRO!,
    monthlyAmount: 9900, // $99/mo
    mode: 'subscription',
    commitmentMonths: 60,
  },
}

// ─── Checkout Session ─────────────────────────────────────────────────────

export async function createCheckoutSession(
  businessId: string,
  plan: PlanId,
  customerEmail: string,
  returnUrl: string,
): Promise<string> {
  const planConfig = PLANS[plan]
  if (!planConfig) throw new Error(`Invalid plan: ${plan}`)

  // Check if business already has a Stripe customer
  const { data: biz } = await supabase
    .from('businesses')
    .select('stripe_customer_id')
    .eq('id', businessId)
    .single()

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: planConfig.mode,
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${returnUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}/billing?cancelled=true`,
    customer_email: biz?.stripe_customer_id ? undefined : customerEmail,
    customer: biz?.stripe_customer_id || undefined,
    metadata: {
      business_id: businessId,
      plan,
    },
  }

  if (planConfig.mode === 'subscription') {
    const commitmentMonths = planConfig.commitmentMonths ?? 0
    sessionParams.subscription_data = {
      metadata: {
        business_id: businessId,
        plan,
        commitment_months: String(commitmentMonths),
        commitment_start: new Date().toISOString(),
        plan_type: commitmentMonths > 0 ? `${plan}_committed` : plan,
      },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)
  return session.url!
}

// ─── Customer Portal ──────────────────────────────────────────────────────

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${returnUrl}/billing`,
  })
  return session.url
}

// ─── Sync Subscription to Supabase ────────────────────────────────────────

export async function syncSubscriptionToSupabase(
  subscription: Stripe.Subscription,
): Promise<void> {
  const businessId = subscription.metadata.business_id
  if (!businessId) return

  const plan = subscription.metadata.plan as PlanId | undefined
  const status = subscription.status
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000)

  const commitmentMonths = parseInt(subscription.metadata.commitment_months || '0', 10)

  const updates: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    subscription_ends_at: currentPeriodEnd.toISOString(),
  }

  if (plan && (status === 'active' || status === 'trialing')) {
    updates.plan = plan
    updates.billing_plan = plan
  }

  // Set commitment data on first activation
  if (commitmentMonths > 0 && subscription.metadata.commitment_start) {
    updates.commitment_months = commitmentMonths
    updates.commitment_start_date = subscription.metadata.commitment_start
  }

  if (status === 'canceled' || status === 'unpaid') {
    updates.plan = 'trial'
  }

  await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId)
}

// ─── Webhook Handler ──────────────────────────────────────────────────────

export async function handleWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const businessId = session.metadata?.business_id
      const plan = session.metadata?.plan as PlanId | undefined

      if (businessId && session.customer) {
        // Save Stripe customer ID
        await supabase
          .from('businesses')
          .update({ stripe_customer_id: session.customer as string })
          .eq('id', businessId)
      }

      // For subscriptions, the subscription.updated event will handle the rest
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      await syncSubscriptionToSupabase(subscription)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const businessId = subscription.metadata.business_id
      if (businessId) {
        await supabase
          .from('businesses')
          .update({ plan: 'trial', stripe_subscription_id: null })
          .eq('id', businessId)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = invoice.subscription as string | null
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const businessId = subscription.metadata.business_id
        if (businessId) {
          // Mark as payment failed — don't downgrade immediately
          await supabase
            .from('businesses')
            .update({ payment_status: 'failed' })
            .eq('id', businessId)
        }
      }
      break
    }
  }
}
