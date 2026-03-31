import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SerendipEatery for Business — Turn slow hours into foot traffic',
  description: 'Run flash sales. Spin wheel deals. Pay only when customers walk in.',
}

export default function BusinessPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">

      <div style={{ position: 'relative', display: 'inline-block', minWidth: '260px', minHeight: '70px', marginBottom: '8px' }}>
        <div style={{ position: 'relative', left: '15px', top: '-33px', lineHeight: 1, whiteSpace: 'nowrap', display: 'inline-block' }}>
          <span style={{ fontFamily: 'Arial Black, Arial', fontWeight: 900, fontSize: '48px', letterSpacing: '-1px', color: '#F7941D' }}>S</span>
          <span style={{ fontFamily: 'Arial Black, Arial', fontWeight: 900, fontSize: '48px', letterSpacing: '-1px', color: '#ffffff' }}>erendip</span>
        </div>
        <div style={{
          position: 'absolute', right: '153px', top: '22px',
          lineHeight: 1, whiteSpace: 'nowrap',
          transform: 'rotate(180deg)', transformOrigin: 'right center',
        }}>
          <span style={{ fontFamily: 'Arial Black, Arial', fontWeight: 900, fontSize: '48px', letterSpacing: '-1px', color: '#F7941D', opacity: 0.42 }}>Eatery</span>
        </div>
      </div>
      <div className="text-xs tracking-widest mb-10 text-center" style={{ color: 'rgba(247,148,29,0.4)' }}>
        FOR BUSINESSES
      </div>

      <div className="max-w-md text-center mb-12">
        <h1 className="text-3xl font-bold mb-4 leading-tight">
          Turn slow hours into<br />
          <span style={{ color: '#F7941D' }}>foot traffic.</span>
        </h1>
        <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Run flash sales. Customers spin a roulette wheel for your prizes.
          Pay only when they physically walk in. Free until we prove it works.
        </p>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-6 mb-8 text-center"
        style={{ background: '#1a0e00', border: '1px solid rgba(247,148,29,0.3)' }}
      >
        <div className="text-3xl font-black mb-1" style={{ color: '#1D9E75' }}>8.4×</div>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Average ROI across active restaurants.<br />
          $1 spent → $8.40 in revenue driven.
        </div>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3 mb-12">
        <a
          href="https://apps.apple.com"
          style={{
            display: 'block', background: '#F7941D', color: '#0f0a1e',
            fontWeight: 'bold', textDecoration: 'none',
            borderRadius: '9999px', padding: '1rem', textAlign: 'center',
          }}
        >
          Download for iPhone — it&apos;s free
        </a>
        <a
          href="https://play.google.com"
          style={{
            display: 'block', border: '0.5px solid rgba(247,148,29,0.4)',
            color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
            borderRadius: '9999px', padding: '1rem', textAlign: 'center',
          }}
        >
          Download for Android
        </a>
        <Link
          href="/"
          style={{ color: 'rgba(247,148,29,0.6)', textAlign: 'center', fontSize: '0.875rem', textDecoration: 'none' }}
        >
          ← I&apos;m a customer, not a business
        </Link>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {[
          { emoji: '🎡', title: 'Spin wheel flash sales', body: 'Set prizes, set odds, go live. Customers spin for discounts and free items. You control every prize.' },
          { emoji: '📍', title: 'Auto check-in — no staff needed', body: 'Customers\' phones detect when they enter your 10m zone. No QR codes, no tablets.' },
          { emoji: '📊', title: 'Pay per real visit', body: 'Free trial tracks everything. Subscribe when we\'ve proven it works for you — not before.' },
        ].map(item => (
          <div
            key={item.title}
            className="flex gap-4 items-start rounded-xl p-4"
            style={{ background: 'rgba(247,148,29,0.06)', border: '0.5px solid rgba(247,148,29,0.15)' }}
          >
            <div className="text-2xl flex-shrink-0">{item.emoji}</div>
            <div>
              <div className="font-bold text-sm text-white mb-1">{item.title}</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>

    </main>
  )
}
