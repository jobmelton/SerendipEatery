import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {/* ─── Spinning Roulette Wheel ─────────────────────────────────── */}
      <div className="relative w-72 h-72 md:w-96 md:h-96 mb-10">
        <div className="wheel-spin absolute inset-0 rounded-full" style={{
          background: `conic-gradient(
            #F7941D 0deg 45deg,
            #1a1230 45deg 90deg,
            #F7941D 90deg 135deg,
            #1a1230 135deg 180deg,
            #F7941D 180deg 225deg,
            #1a1230 225deg 270deg,
            #F7941D 270deg 315deg,
            #1a1230 315deg 360deg
          )`,
          boxShadow: '0 0 60px rgba(247,148,29,0.25), inset 0 0 30px rgba(0,0,0,0.4)',
          border: '4px solid rgba(247,148,29,0.5)',
        }} />
        {/* Center hub */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-night flex items-center justify-center z-10"
            style={{ border: '3px solid #F7941D', boxShadow: '0 0 20px rgba(247,148,29,0.3)' }}>
            <span className="font-display text-xl md:text-2xl font-black text-btc">S</span>
          </div>
        </div>
        {/* Pointer triangle */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <div style={{
            width: 0, height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderTop: '20px solid #F7941D',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
          }} />
        </div>
      </div>

      {/* ─── Logo ────────────────────────────────────────────────────── */}
      <div className="flex items-baseline gap-0.5 mb-3">
        <span className="font-display text-3xl md:text-4xl font-black text-btc">S</span>
        <span className="font-display text-3xl md:text-4xl font-black text-surface">erendip</span>
        <span className="font-display text-3xl md:text-4xl font-black text-btc/40">Eatery</span>
      </div>

      {/* ─── Tagline ─────────────────────────────────────────────────── */}
      <p className="text-lg md:text-xl font-bold tracking-wider text-surface/50 mb-14">
        Spin. Win. Eat.
      </p>

      {/* ─── Buttons ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
        <Link
          href="/consumer"
          className="w-full sm:w-auto flex-1 bg-btc text-night font-bold text-lg px-8 py-4 rounded-full text-center hover:bg-btc-dark transition"
        >
          I want deals
        </Link>
        <Link
          href="/business"
          className="w-full sm:w-auto flex-1 border-2 border-surface/20 text-surface/70 font-bold text-lg px-8 py-4 rounded-full text-center hover:border-surface/40 hover:text-surface transition"
        >
          I have a business
        </Link>
      </div>

      {/* ─── App Download ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mt-8">
        <Link
          href="/coming-soon-app"
          className="border border-surface/20 text-surface/50 text-sm px-5 py-2 rounded-full hover:border-surface/40 hover:text-surface/70 transition"
        >
          Download for iOS
        </Link>
        <Link
          href="/coming-soon-app"
          className="border border-surface/20 text-surface/50 text-sm px-5 py-2 rounded-full hover:border-surface/40 hover:text-surface/70 transition"
        >
          Download for Android
        </Link>
      </div>

      {/* ─── Wheel Spin Animation ────────────────────────────────────── */}
      <style>{`
        @keyframes wheelSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .wheel-spin {
          animation: wheelSpin 8s linear infinite;
        }
      `}</style>
    </main>
  )
}
