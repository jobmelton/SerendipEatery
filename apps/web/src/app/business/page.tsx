import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SerendipEatery for Business',
  description: 'Run flash sales. Pay per visit.',
}

const steps = [
  { num: '1', title: 'Set up a flash sale', subtitle: '2 minutes' },
  { num: '2', title: 'Monitor results in real time', subtitle: '' },
  { num: '3', title: 'Monitor ROI', subtitle: 'Free until it pays for itself' },
]

export default function BusinessPage() {
  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="flex items-baseline gap-0.5 mb-16">
        <span className="font-display text-3xl md:text-4xl font-black text-btc">S</span>
        <span className="font-display text-3xl md:text-4xl font-black text-surface">erendip</span>
        <span className="font-display text-3xl md:text-4xl font-black text-btc/40">Eatery</span>
      </div>

      {/* Headline */}
      <h1 className="text-5xl md:text-7xl font-black text-surface text-center leading-tight mb-16">
        Easy as <span className="text-btc">1, 2, 3</span>
      </h1>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 max-w-4xl w-full mb-12">
        {steps.map((step) => (
          <div key={step.num} className="text-center">
            <div className="text-7xl md:text-8xl font-black text-btc/20 mb-3 font-display leading-none">
              {step.num}
            </div>
            <h2 className="text-xl font-bold text-surface mb-1">{step.title}</h2>
            {step.subtitle && (
              <p className="text-surface/40 text-sm">{step.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {/* Tagline */}
      <p className="text-surface/50 text-center text-lg max-w-xl mb-4">
        Run flash sales. Monitor response rates. Pay when it proves itself.
      </p>
      <p className="text-btc/60 text-center text-sm max-w-md mb-12">
        Your customers meet each other. They come back together.
      </p>

      {/* CTAs */}
      <Link
        href="/business/setup"
        className="bg-btc text-night font-bold text-xl px-12 py-5 rounded-full hover:bg-btc-dark transition"
      >
        Set Up a Flash Sale
      </Link>

      <Link
        href="/business/setup"
        className="mt-4 text-btc/70 text-sm font-medium hover:text-btc transition"
      >
        See How It Works
      </Link>

      <Link
        href="/"
        className="mt-6 text-surface/30 text-sm hover:text-surface/50 transition"
      >
        Back to home
      </Link>
    </main>
  )
}
