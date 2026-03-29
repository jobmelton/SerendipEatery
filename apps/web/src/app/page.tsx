import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">

      {/* Logo */}
      <div className="mb-10 text-center">
        <div style={{ position: 'relative', display: 'inline-block', minWidth: '300px', minHeight: '80px' }}>
          {/* Serendip */}
          <div style={{
            position: 'relative',
            left: '15px',
            top: '-33px',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            display: 'inline-block',
          }}>
            <span style={{ fontFamily: 'Arial Black, Arial', fontWeight: 900, fontSize: '48px', letterSpacing: '-1px', color: '#F7941D' }}>S</span>
            <span style={{ fontFamily: 'Arial Black, Arial', fontWeight: 900, fontSize: '48px', letterSpacing: '-1px', color: '#ffffff' }}>erendip</span>
          </div>
          {/* Eatery — rotated 180°, positioned per slider values */}
          <div style={{
            position: 'absolute',
            right: '153px',
            top: '22px',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            transform: 'rotate(180deg)',
            transformOrigin: 'right center',
          }}>
            <span style={{ fontFamily: 'Arial Black, Arial', fontWeight: 900, fontSize: '48px', letterSpacing: '-1px', color: '#F7941D', opacity: 0.42 }}>Eatery</span>
          </div>
        </div>
        <p className="text-xs tracking-widest mt-2" style={{ color: 'rgba(247,148,29,0.4)' }}>
          SPIN YOUR NEXT MEAL
        </p>
      </div>

      {/* Hero */}
      <div className="max-w-md text-center mb-12">
        <h1 className="text-3xl font-bold mb-4 leading-tight">
          Flash deals at food trucks<br />
          <span style={{ color: '#F7941D' }}>near you, right now.</span>
        </h1>
        <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Spin the roulette wheel. Win free food, percent-off deals, free items.
          Walk in — your phone auto-checks you in. No QR codes. No staff awkwardness.
        </p>
      </div>

      {/* Cuisine icons */}
      <div className="flex gap-3 mb-12">
        {['🌮', '🍜', '🍕', '🍔', '🍛', '🥙'].map((icon, i) => (
          <div
            key={i}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'rgba(247,148,29,0.12)', border: '0.5px solid rgba(247,148,29,0.25)' }}
          >
            {icon}
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="w-full max-w-xs flex flex-col gap-3 mb-16">
        <a
          href="https://apps.apple.com"
          className="btn-primary text-center py-4 text-base rounded-full"
          style={{ background: '#F7941D', color: '#0f0a1e', fontWeight: 'bold', textDecoration: 'none', display: 'block', textAlign: 'center', borderRadius: '9999px', padding: '1rem' }}
        >
          Download for iPhone
        </a>
        <a
          href="https://play.google.com"
          className="btn-ghost text-center py-4 text-base rounded-full"
          style={{ border: '0.5px solid rgba(247,148,29,0.4)', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'block', textAlign: 'center', borderRadius: '9999px', padding: '1rem' }}
        >
          Download for Android
        </a>
        <Link
          href="/business"
          style={{ color: 'rgba(247,148,29,0.6)', textAlign: 'center', fontSize: '0.875rem', textDecoration: 'none', marginTop: '4px' }}
        >
          Own a food truck or restaurant? →
        </Link>
      </div>

      {/* How it works */}
      <div className="w-full max-w-sm">
        <p className="text-xs font-bold tracking-widest text-center mb-6"
          style={{ color: 'rgba(247,148,29,0.4)' }}>
          HOW IT WORKS
        </p>
        <div className="flex flex-col gap-4">
          {[
            { step: '1', title: 'Get notified', body: 'Push alert when a restaurant near you goes live with a deal.' },
            { step: '2', title: 'Spin the wheel', body: 'Drag and release to launch the ball. It lands on your prize.' },
            { step: '3', title: 'Walk over', body: 'Get directions from the win screen. Code waits for 60 minutes.' },
            { step: '4', title: 'Auto check-in', body: 'Within 10m, your phone confirms the visit. Show the code.' },
          ].map(item => (
            <div key={item.step} className="flex gap-4 items-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: '#F7941D', color: '#0f0a1e' }}
              >
                {item.step}
              </div>
              <div>
                <div className="font-bold text-sm text-white mb-0.5">{item.title}</div>
                <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 text-center" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
        <p className="mb-2">© {new Date().getFullYear()} SerendipEatery · Built for hungry people</p>
        <div className="flex gap-4 justify-center">
          <Link href="/privacy" style={{ color: 'rgba(247,148,29,0.4)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ color: 'rgba(247,148,29,0.4)', textDecoration: 'none' }}>Terms</Link>
          <Link href="/admin" style={{ color: 'rgba(247,148,29,0.4)', textDecoration: 'none' }}>Admin</Link>
        </div>
      </footer>

    </main>
  )
}
