'use client'

import { useState } from 'react'
import { UserButton } from '@clerk/nextjs'

const planLabels: Record<string, string> = {
  trial: 'Free Trial',
  starter: 'Starter ($29/mo)',
  growth: 'Growth ($79/mo)',
  pro: 'Pro (5-year)',
}

const planDescriptions: Record<string, string> = {
  trial: 'No time limit. Evidence-based system — upgrade when you see results.',
  starter: '$1.50 per confirmed visit. $150 monthly cap.',
  growth: '$1.00/visit + $0.25/influenced. $300 monthly cap.',
  pro: 'Unlimited visits. Rate locked for 5 years.',
}

interface Props {
  business: any
  monthlyUsage: {
    confirmedVisits: number
    influencedVisits: number
    totalChargeCents: number
  }
  userEmail: string
}

export function BillingClient({ business, monthlyUsage, userEmail }: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  const currentPlan = business?.plan ?? 'trial'
  const isOnTrial = currentPlan === 'trial'

  const handleCheckout = async (plan: string) => {
    if (!business) return
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          plan,
          email: userEmail,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // handle error
    } finally {
      setLoading(null)
    }
  }

  const handlePortal = async () => {
    if (!business?.stripe_customer_id) return
    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: business.stripe_customer_id }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // handle error
    } finally {
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-night px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-surface">Billing</h1>
          <UserButton
            appearance={{ variables: { colorPrimary: '#F7941D' } }}
            afterSignOutUrl="/"
          />
        </header>

        {/* Trial Banner */}
        {isOnTrial && (
          <div className="bg-btc/10 border border-btc/30 rounded-xl p-4 mb-6">
            <p className="text-btc font-bold">You are on the Free Trial</p>
            <p className="text-surface/60 text-sm mt-1">
              No time limit. No credit card required. Upgrade when you see results.
            </p>
          </div>
        )}

        {/* Current Plan */}
        <section className="bg-[#1a1230] rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-surface mb-2">Current Plan</h2>
          <p className="text-2xl font-extrabold text-btc">
            {planLabels[currentPlan] ?? currentPlan}
          </p>
          <p className="text-surface/50 text-sm mt-1">
            {planDescriptions[currentPlan] ?? ''}
          </p>
          {business?.subscription_ends_at && (
            <p className="text-surface/40 text-sm mt-2">
              {currentPlan === 'pro' ? 'Locked until' : 'Renews'}{' '}
              {new Date(business.subscription_ends_at).toLocaleDateString()}
            </p>
          )}
        </section>

        {/* Usage This Month */}
        <section className="bg-[#1a1230] rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-surface mb-4">Usage This Month</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-extrabold text-surface">{monthlyUsage.confirmedVisits}</p>
              <p className="text-surface/50 text-xs">Confirmed Visits</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-surface">{monthlyUsage.influencedVisits}</p>
              <p className="text-surface/50 text-xs">Influenced Visits</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-btc">
                ${(monthlyUsage.totalChargeCents / 100).toFixed(2)}
              </p>
              <p className="text-surface/50 text-xs">Total Charges</p>
            </div>
          </div>
        </section>

        {/* Plan Actions */}
        <section className="bg-[#1a1230] rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-surface mb-4">
            {isOnTrial ? 'Upgrade Your Plan' : 'Change Plan'}
          </h2>
          <div className="space-y-3">
            {currentPlan !== 'starter' && (
              <button
                onClick={() => handleCheckout('starter')}
                disabled={loading === 'starter'}
                className="w-full bg-white/10 hover:bg-white/20 text-surface font-bold py-3 px-4 rounded-xl transition disabled:opacity-50"
              >
                {loading === 'starter' ? 'Loading...' : 'Starter — $29/mo'}
              </button>
            )}
            {currentPlan !== 'growth' && (
              <button
                onClick={() => handleCheckout('growth')}
                disabled={loading === 'growth'}
                className="w-full bg-btc hover:bg-btc-dark text-night font-bold py-3 px-4 rounded-xl transition disabled:opacity-50"
              >
                {loading === 'growth' ? 'Loading...' : 'Growth — $79/mo'}
              </button>
            )}
            {currentPlan !== 'pro' && (
              <button
                onClick={() => handleCheckout('pro')}
                disabled={loading === 'pro'}
                className="w-full bg-purple hover:bg-purple/80 text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50"
              >
                {loading === 'pro' ? 'Loading...' : 'Pro — $5,940 (5-year)'}
              </button>
            )}
          </div>
        </section>

        {/* Stripe Portal */}
        {business?.stripe_customer_id && (
          <section className="bg-[#1a1230] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-surface mb-2">Invoice History</h2>
            <p className="text-surface/50 text-sm mb-4">
              View invoices, update payment method, or cancel your subscription.
            </p>
            <button
              onClick={handlePortal}
              disabled={loading === 'portal'}
              className="bg-white/10 hover:bg-white/20 text-surface font-bold py-3 px-6 rounded-xl transition disabled:opacity-50"
            >
              {loading === 'portal' ? 'Loading...' : 'Open Stripe Portal'}
            </button>
          </section>
        )}
      </div>
    </main>
  )
}
