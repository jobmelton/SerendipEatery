import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Press — SerendipEatery',
  description: 'Media inquiries and press kit for SerendipEatery.',
}

export default function PressPage() {
  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-12 pb-16">
      <div className="w-full max-w-lg">
        <Link href="/" className="text-sm mb-8 inline-block" style={{ color: '#b8a898' }}>← Home</Link>

        <h1 className="text-3xl font-black text-surface mb-6">Press</h1>

        <div className="space-y-6 text-surface/80 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-surface mb-2">What is SerendipEatery?</h2>
            <p>
              SerendipEatery is a flash-sale platform where restaurants and food trucks
              launch time-limited deals. Consumers spin a roulette wheel to win prizes,
              then walk to the restaurant within 60 minutes. The platform confirms visits
              via geofencing and charges businesses only for verified foot traffic.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-surface mb-2">World Record Attempt</h2>
            <p>
              SerendipEatery is attempting the Guinness World Record for the Largest Online
              Rock Paper Scissors Tournament. Our target is 10,000 simultaneous participants
              in a single-elimination bracket, all playing in real time.
            </p>
            <p className="mt-2">
              <Link href="/record" className="text-btc font-bold hover:underline">
                Learn more and register →
              </Link>
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-surface mb-2">Media Contact</h2>
            <p>For media inquiries, interviews, or press kit requests:</p>
            <p className="mt-2">
              <a href="mailto:press@serendipeatery.com" className="text-btc font-bold hover:underline">
                press@serendipeatery.com
              </a>
            </p>
          </div>

          <div className="rounded-xl p-4" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}>
            <p className="text-surface/50 text-xs mb-2">QUICK FACTS</p>
            <ul className="space-y-1 text-surface/60 text-sm">
              <li>Platform: Flash-sale deals for restaurants and food trucks</li>
              <li>Revenue model: Pay-per-verified-visit (businesses pay only when it works)</li>
              <li>Consumer experience: Spin-to-win prizes, walk to restaurant, claim deal</li>
              <li>Tech: Geofenced visit confirmation, real-time RPS battles, traveling badges</li>
              <li>Record attempt: 10,000-player simultaneous RPS tournament</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
