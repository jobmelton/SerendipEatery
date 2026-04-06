'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Tooltip Component ───────────────────────────────────────────────────

let globalCloseTooltip: (() => void) | null = null

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (show) {
      // Close any other open tooltip
      if (globalCloseTooltip && globalCloseTooltip !== close) globalCloseTooltip()
      globalCloseTooltip = close
    }
    function close() { setShow(false) }
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (show && !target.closest('[data-tooltip]')) setShow(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      if (globalCloseTooltip === close) globalCloseTooltip = null
    }
  }, [show])

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }} data-tooltip>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show) }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '14px', height: '14px', borderRadius: '50%',
          border: '1px solid #b8a898', color: '#b8a898',
          fontSize: '9px', fontWeight: '600', cursor: 'help',
          flexShrink: 0,
        }}
      >?</span>
      {show && (
        <span style={{
          position: 'absolute', bottom: '20px', left: '50%',
          transform: 'translateX(-50%)',
          background: '#1a0e00', border: '1px solid rgba(247,148,29,0.3)',
          color: '#fff8f2', fontSize: '11px', padding: '6px 10px',
          borderRadius: '6px', width: '200px', zIndex: 100,
          lineHeight: '1.4', pointerEvents: 'none',
        }}>
          {text}
          <span style={{
            position: 'absolute', bottom: '-5px', left: '50%',
            width: '8px', height: '8px', background: '#1a0e00',
            border: '1px solid rgba(247,148,29,0.3)',
            borderTop: 'none', borderLeft: 'none',
            transform: 'translateX(-50%) rotate(45deg)',
          }} />
        </span>
      )}
    </span>
  )
}

// ─── Tooltip Map ─────────────────────────────────────────────────────────

const TOOLTIPS: Record<string, string> = {
  // Free plan
  'Full access until your first 100-visit month': 'You get unlimited visits until you prove it works. No credit card needed.',
  'After 100-visit month: 5 visits/month to keep proving ROI': 'Once you hit 100 visits in a month, the following months cap at 5 visits so you can see what you\'re missing.',
  'See who spun and what they won': 'Full funnel data: who got notified, who spun, what prize they won.',
  "See exactly how many customers you're missing": 'After your limit is hit, every customer who would have received a notification is counted and shown in your dashboard.',
  'Full geofence analytics (upgrade to unlock)': 'A 10-meter GPS boundary around your location. Only customers physically inside trigger a confirmed visit.',
  'Time-of-day optimization (upgrade to unlock)': 'See which hours drive the most visits so you can schedule sales at peak times.',

  // Starter plan
  'Up to 100 confirmed visits/month': 'A confirmed visit = customer spun the wheel AND physically walked into your location. Verified by GPS.',
  '$1.50 per confirmed visit · $150 cap': "You'll never pay more than $150 in a month regardless of visits. $1.50 × 100 = $150 maximum.",
  'Priority support': 'Direct access to the SerendipEatery team. Issues resolved within 4 hours during business hours.',

  // Growth plan
  'Up to 300 confirmed visits/month': '300 confirmed visits × $1.00 = $300 maximum per month.',
  '$1.00 per confirmed visit': 'Lower per-visit cost than Starter. Same GPS-verified confirmed visits.',
  '$0.25 per influenced visit': "An influenced visit = customer didn't spin but walked in within 90 minutes of a nearby sale. Softer signal, lower price.",
  '$300/mo billing cap': "Hard cap — you never pay more than $300 regardless of how many customers visit.",
  'Advanced analytics & reports': 'Unlocks time-of-day charts, full geofence heat map, complete tier breakdown, and prize performance data.',

  // Pro plan
  'Unlimited confirmed visits': 'No caps, no shadow mode, no monthly limits. Pay $99/mo and capture every customer.',
  'No shadow mode — ever': 'Your promotions never pause. Notifications always send. No missed opportunities.',
  'Rate locked for 5 years': 'Your $99/mo rate never increases for the entire 5-year commitment period, regardless of future price changes.',
  'No per-visit charges ever': 'Flat $99/mo. No matter how many customers visit, your bill stays the same.',
}

// ─── Plan Data ───────────────────────────────────────────────────────────

const plans = [
  {
    name: 'Free',
    price: 'Free',
    period: '',
    description: 'Free until it proves itself.',
    commitment: '',
    features: [
      { text: 'Full access until your first 100-visit month', included: true },
      { text: 'Unlimited flash sales, notifications, and spins', included: true },
      { text: 'See who spun and what they won', included: true },
      { text: 'Full funnel metrics during honeymoon', included: true },
      { text: 'After 100-visit month: 5 visits/month to keep proving ROI', included: true },
      { text: "See exactly how many customers you're missing", included: true },
      { text: 'Full geofence analytics (upgrade to unlock)', included: false },
      { text: 'Time-of-day optimization (upgrade to unlock)', included: false },
    ],
    visitLimit: 'Full access → 5 visits/mo after graduation',
    cta: 'Start Free',
    href: '/sign-up',
    highlight: false,
    badge: null as string | null,
    etfNote: null as string | null,
  },
  {
    name: 'Starter',
    price: '$29',
    period: '/mo',
    description: 'Month to month. Cancel anytime.',
    commitment: 'Month to month · Cancel anytime',
    features: [
      { text: 'Unlimited flash sales', included: true },
      { text: 'Up to 100 confirmed visits/month', included: true },
      { text: '$1.50 per confirmed visit · $150 cap', included: true },
      { text: 'Real-time analytics', included: true },
      { text: 'Customer tier insights', included: true },
      { text: 'Priority support', included: true },
    ],
    visitLimit: 'Up to 100 confirmed visits/month · $150 max',
    cta: 'Get Starter',
    href: '/billing?plan=starter',
    highlight: false,
    badge: null as string | null,
    etfNote: null as string | null,
  },
  {
    name: 'Growth',
    price: '$79',
    period: '/mo',
    description: '1-year commitment. $1.00/visit.',
    commitment: '1-year commitment',
    features: [
      { text: 'Everything in Starter', included: true },
      { text: 'Up to 300 confirmed visits/month', included: true },
      { text: '$1.00 per confirmed visit', included: true },
      { text: '$0.25 per influenced visit', included: true },
      { text: '$300/mo billing cap', included: true },
      { text: 'Advanced analytics & reports', included: true },
      { text: 'Multi-location support', included: true },
    ],
    visitLimit: 'Up to 300 confirmed visits/month · $300 max',
    cta: 'Get Growth',
    href: '/billing?plan=growth',
    highlight: true,
    badge: 'Most Popular',
    etfNote: 'Early termination: remaining months × $79',
  },
  {
    name: 'Pro',
    price: '$99',
    period: '/mo',
    description: '5-year commitment · Rate locked forever',
    commitment: '5-year commitment',
    features: [
      { text: 'Everything in Growth', included: true },
      { text: 'Unlimited confirmed visits', included: true },
      { text: 'Unlimited influenced visits', included: true },
      { text: 'No per-visit charges ever', included: true },
      { text: 'No shadow mode — ever', included: true },
      { text: 'Rate locked for 5 years', included: true },
      { text: 'White-label share cards', included: true },
      { text: 'API access', included: true },
      { text: 'Dedicated account manager', included: true },
    ],
    visitLimit: 'Unlimited confirmed visits · No caps',
    cta: 'Go Pro — $99/mo',
    href: '/billing?plan=pro',
    highlight: false,
    badge: 'Best Value',
    etfNote: 'Early termination: remaining months × $99',
  },
]

// ─── Page ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-night px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-surface">
            Simple, transparent <span className="text-btc">pricing</span>
          </h1>
          <p className="mt-4 text-lg text-surface/60 max-w-2xl mx-auto">
            Start free. Only pay when customers actually show up.
            No hidden fees. Shadow mode activates at limit — upgrade anytime to resume.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? 'bg-gradient-to-b from-btc/20 to-purple/10 border-2 border-btc'
                  : 'bg-[#1a1230] border border-white/10'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-btc text-night text-xs font-bold px-3 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}

              <h2 className="text-xl font-bold text-surface">{plan.name}</h2>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-btc">{plan.price}</span>
                {plan.period && (
                  <span className="text-surface/50 text-sm">{plan.period}</span>
                )}
              </div>

              <p className="mt-2 text-sm text-surface/50">{plan.description}</p>

              {plan.commitment && (
                <p className="mt-1 text-xs text-btc/60">{plan.commitment}</p>
              )}

              {/* Visit limit badge */}
              <div className="mt-3 px-3 py-1.5 rounded-lg text-xs text-surface/60" style={{ background: 'rgba(247,148,29,0.08)' }}>
                {plan.visitLimit}
              </div>

              <ul className="mt-4 space-y-2.5 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature.text} className={`flex items-start gap-2 text-sm ${feature.included ? 'text-surface/80' : 'text-surface/30'}`}>
                    <span className={`mt-0.5 shrink-0 ${feature.included ? 'text-teal' : 'text-red-400/50'}`}>
                      {feature.included ? '✓' : '✗'}
                    </span>
                    <span className="flex items-start flex-wrap">
                      {feature.text}
                      {TOOLTIPS[feature.text] && <Tooltip text={TOOLTIPS[feature.text]} />}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.etfNote && (
                <p className="mt-3 text-xs text-surface/30 border-t border-white/5 pt-3">
                  {plan.etfNote}
                </p>
              )}

              {/* Pro plan: ETF callout */}
              {plan.name === 'Pro' && (
                <div className="mt-3 rounded-lg p-3 text-xs text-surface/40" style={{ background: 'rgba(247,148,29,0.05)', border: '1px solid rgba(247,148,29,0.1)' }}>
                  <p className="font-bold text-surface/60 mb-1">Early Termination Fee</p>
                  <p>If you cancel before 5 years, you owe the remaining balance.</p>
                  <p className="mt-1">Example: Cancel after year 2 = 36 months × $99 = $3,564 due.</p>
                  <p className="mt-1 text-btc/60">Rate locked at $99/mo for the full 5 years — no price increases ever.</p>
                </div>
              )}

              {/* Growth plan: upgrade nudge */}
              {plan.name === 'Growth' && (
                <p className="mt-2 text-xs text-btc/50">
                  Or <Link href="/billing?plan=pro" className="underline hover:text-btc">upgrade to Pro</Link> and lock your rate for 5 years →
                </p>
              )}

              <Link
                href={plan.href}
                className={`mt-4 block text-center py-3 px-4 rounded-xl font-bold text-sm transition ${
                  plan.highlight
                    ? 'bg-btc text-night hover:bg-btc-dark'
                    : 'bg-white/10 text-surface hover:bg-white/20'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-surface/40 text-sm">
            All plans include: Clerk auth, PostGIS geofencing, real-time spin engine, Expo push notifications.
          </p>
          <p className="text-surface/40 text-sm mt-2">
            Billing is web-only. No in-app purchases. No Apple/Google fees.
          </p>
          <Link href="/" className="inline-block mt-6 text-surface/30 text-sm hover:text-surface/50 transition">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
