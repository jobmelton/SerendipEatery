import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SerendipEatery for Business',
  description: 'Run flash sales. Pay per visit.',
}

export default function BusinessPage() {
  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="flex items-baseline gap-0.5 mb-8">
        <span className="font-display text-3xl md:text-4xl font-black text-btc">S</span>
        <span className="font-display text-3xl md:text-4xl font-black text-surface">erendip</span>
        <span className="font-display text-3xl md:text-4xl font-black text-btc/40">Eatery</span>
      </div>

      {/* Headline */}
      <h1 className="text-4xl md:text-5xl font-black text-center leading-tight mb-4">
        <span className="text-surface">Run flash sales.</span>
        <br />
        <span className="text-btc">Pay per visit.</span>
      </h1>

      {/* CTA */}
      <Link
        href="/sign-up"
        className="mt-10 bg-btc text-night font-bold text-xl px-12 py-5 rounded-full hover:bg-btc-dark transition"
      >
        Start Free
      </Link>

      {/* Back link */}
      <Link
        href="/"
        className="mt-8 text-surface/30 text-sm hover:text-surface/50 transition"
      >
        Back to home
      </Link>
    </main>
  )
}
