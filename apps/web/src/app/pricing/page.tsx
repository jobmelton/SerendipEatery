import Link from 'next/link'

const plans = [
  {
    name: 'Trial',
    price: 'Free',
    period: '',
    description: 'No time limit. No credit card needed.',
    features: [
      'Up to 10 flash sales',
      '5 confirmed visit credits',
      'Basic analytics',
      'Evidence-based trial system',
      'Upgrade when you see results',
    ],
    cta: 'Start Free Trial',
    href: '/sign-up',
    highlight: false,
    badge: null,
  },
  {
    name: 'Starter',
    price: '$29',
    period: '/mo',
    description: '$1.50 per confirmed visit. $150 monthly cap.',
    features: [
      'Unlimited flash sales',
      'Real-time analytics',
      'Customer tier insights',
      '$1.50 per confirmed visit',
      '$150/mo billing cap',
      'Priority support',
    ],
    cta: 'Get Starter',
    href: '/billing?plan=starter',
    highlight: false,
    badge: null,
  },
  {
    name: 'Growth',
    price: '$79',
    period: '/mo',
    description: '$1.00/visit + $0.25/influenced. $300 cap.',
    features: [
      'Everything in Starter',
      '$1.00 per confirmed visit',
      '$0.25 per influenced visit',
      '$300/mo billing cap',
      'Advanced analytics & reports',
      'Multi-location support',
      'Custom prize templates',
    ],
    cta: 'Get Growth',
    href: '/billing?plan=growth',
    highlight: true,
    badge: 'Most Popular',
  },
  {
    name: 'Pro',
    price: '$99',
    period: '/mo equivalent',
    description: '5-year upfront: $5,940. Rate locked forever.',
    features: [
      'Everything in Growth',
      'Unlimited confirmed visits',
      'Unlimited influenced visits',
      'No per-visit charges ever',
      'Rate locked for 5 years',
      'White-label share cards',
      'API access',
      'Dedicated account manager',
    ],
    cta: 'Go Pro — $5,940',
    href: '/billing?plan=pro',
    highlight: false,
    badge: 'Best Value',
  },
]

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
            No hidden fees. No long-term contracts (except Pro).
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

              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-surface/80">
                    <span className="text-teal mt-0.5">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-6 block text-center py-3 px-4 rounded-xl font-bold text-sm transition ${
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
        </div>
      </div>
    </main>
  )
}
