'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/NavBar'

const planLabels: Record<string, string> = {
  trial: 'Free Trial',
  starter: 'Starter ($29/mo)',
  growth: 'Growth ($79/mo)',
  pro: 'Pro ($99/mo)',
}

const planDescriptions: Record<string, string> = {
  trial: 'No time limit. Evidence-based system — upgrade when you see results.',
  starter: 'Month to month · Cancel anytime · $1.50 per confirmed visit · $150 cap.',
  growth: '1-year commitment · $1.00/visit + $0.25/influenced · $300 cap.',
  pro: '5-year commitment · Unlimited visits · Rate locked forever.',
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
  const commitmentMonths = business?.commitment_months ?? 0
  const commitmentStart = business?.commitment_start_date ? new Date(business.commitment_start_date) : null

  // Calculate commitment progress
  let monthsElapsed = 0
  let monthsRemaining = 0
  let etf = 0
  let commitmentEndDate: Date | null = null

  if (commitmentStart && commitmentMonths > 0) {
    monthsElapsed = Math.max(0, Math.floor((Date.now() - commitmentStart.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
    monthsRemaining = Math.max(0, commitmentMonths - monthsElapsed)
    const rate = currentPlan === 'pro' ? 99 : currentPlan === 'growth' ? 79 : 0
    etf = monthsRemaining * rate
    commitmentEndDate = new Date(commitmentStart)
    commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths)
  }

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
    <>
    <NavBar variant="business" />
    <main className="min-h-screen bg-night px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-surface mb-8">Billing</h1>

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
              Next bill: {new Date(business.subscription_ends_at).toLocaleDateString()}
            </p>
          )}
        </section>

        {/* Commitment Status (Growth/Pro) */}
        {commitmentMonths > 0 && commitmentStart && (
          <section className="bg-[#1a1230] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-surface mb-3">Commitment Status</h2>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-surface/40 mb-1">
                <span>Month {monthsElapsed} of {commitmentMonths}</span>
                <span>{monthsRemaining} months remaining</span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-btc transition-all" style={{ width: `${Math.min((monthsElapsed / commitmentMonths) * 100, 100)}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-surface/40 text-xs">ETF if cancelled today</p>
                <p className="text-red-400 font-bold text-lg">${etf.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-surface/40 text-xs">
                  {currentPlan === 'pro' ? 'Rate locked through' : 'Converts to month-to-month'}
                </p>
                <p className="text-surface font-bold">
                  {commitmentEndDate?.toLocaleDateString()}
                </p>
              </div>
            </div>

            {currentPlan === 'pro' && (
              <p className="text-btc/60 text-xs mt-3">
                Rate locked at $99/mo through {commitmentEndDate?.toLocaleDateString()} — no price increases ever.
              </p>
            )}

            {currentPlan === 'growth' && monthsRemaining > 0 && (
              <p className="text-btc/60 text-xs mt-3">
                After commitment: converts to month-to-month at $79/mo. Cancel anytime with 30 days notice.
              </p>
            )}

            {currentPlan === 'starter' && (
              <p className="text-surface/40 text-xs mt-3">
                Month to month — no commitment. Cancel anytime.
              </p>
            )}
          </section>
        )}

        {/* Starter: no commitment note */}
        {currentPlan === 'starter' && commitmentMonths === 0 && (
          <section className="bg-[#1a1230] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-surface mb-2">Subscription</h2>
            <p className="text-surface/50 text-sm">Month to month — no commitment. Cancel anytime, no fee.</p>
            {business?.subscription_ends_at && (
              <p className="text-surface/40 text-sm mt-2">Next bill: {new Date(business.subscription_ends_at).toLocaleDateString()}</p>
            )}
          </section>
        )}

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
                {loading === 'starter' ? 'Loading...' : 'Starter — $29/mo (month to month)'}
              </button>
            )}
            {currentPlan !== 'growth' && (
              <button
                onClick={() => handleCheckout('growth')}
                disabled={loading === 'growth'}
                className="w-full bg-btc hover:bg-btc-dark text-night font-bold py-3 px-4 rounded-xl transition disabled:opacity-50"
              >
                {loading === 'growth' ? 'Loading...' : 'Growth — $79/mo (1-year commitment)'}
              </button>
            )}
            {currentPlan !== 'pro' && (
              <button
                onClick={() => handleCheckout('pro')}
                disabled={loading === 'pro'}
                className="w-full bg-purple hover:bg-purple/80 text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50"
              >
                {loading === 'pro' ? 'Loading...' : 'Pro — $99/mo (5-year commitment)'}
              </button>
            )}
          </div>
        </section>

        {/* Stripe Portal */}
        {business?.stripe_customer_id && (
          <section className="bg-[#1a1230] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-surface mb-2">Invoice History</h2>
            <p className="text-surface/50 text-sm mb-4">
              View invoices, update payment method, or manage your subscription.
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
    </>
  )
}
