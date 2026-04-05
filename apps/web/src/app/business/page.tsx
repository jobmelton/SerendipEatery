import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SerendipEatery for Business',
  description: 'Fill your slow hours. Pay nothing until it works.',
}

const steps = [
  { num: '1', title: 'Set up a flash sale in 2 minutes', subtitle: '' },
  { num: '2', title: 'See exactly where you lose customers', subtitle: '' },
  { num: '3', title: 'Pay only when it would be stupid not to.', subtitle: '' },
]

export default function BusinessPage() {
  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="flex items-baseline gap-0.5 mb-16">
        <span className="font-display text-3xl md:text-4xl font-black text-btc">S</span>
        <span className="font-display text-3xl md:text-4xl font-black text-surface">erendip</span>
        <span className="font-display text-3xl md:text-4xl font-black" style={{
          display: 'inline-block', transform: 'rotate(180deg)',
          background: 'linear-gradient(to left, #F7941D 0%, #F7941D 40%, transparent 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>Eatery</span>
      </div>

      {/* Hero */}
      <h1 className="text-5xl md:text-7xl font-black text-surface text-center leading-tight mb-4">
        Fill your <span className="text-btc">slow hours.</span>
      </h1>
      <p className="text-xl md:text-2xl text-surface/50 text-center mb-16">
        Pay nothing until it works.
      </p>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 max-w-4xl w-full mb-12">
        {steps.map((step) => (
          <div key={step.num} className="text-center">
            <div className="text-7xl md:text-8xl font-black text-btc/20 mb-3 font-display leading-none">
              {step.num}
            </div>
            <h2 className="text-xl font-bold text-surface mb-1">{step.title}</h2>
          </div>
        ))}
      </div>

      {/* Value prop */}
      <p className="text-surface/50 text-center text-lg max-w-xl mb-12">
        No commissions. No contracts. Just customers.
      </p>

      {/* CTAs */}
      <Link
        href="/business/onboarding"
        className="bg-btc text-night font-bold text-xl px-12 py-5 rounded-full hover:bg-btc-dark transition"
      >
        Start Free
      </Link>

      <p className="mt-4 text-surface/30 text-sm">Zero commission. Ever.</p>

      <Link
        href="/"
        className="mt-8 text-surface/30 text-sm hover:text-surface/50 transition"
      >
        Back to home
      </Link>
    </main>
  )
}
