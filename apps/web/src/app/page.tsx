import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-night">
      {/* ─── Nav ──────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-baseline gap-0.5">
          <span className="font-display text-xl font-black text-btc">S</span>
          <span className="font-display text-xl font-black text-surface">erendip</span>
          <span className="font-display text-xl font-black text-btc/40">Eatery</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-surface/60 text-sm hover:text-surface transition">
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="bg-btc text-night text-sm font-bold px-4 py-2 rounded-full hover:bg-btc-dark transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-24 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black leading-tight">
          <span className="text-surface">Spin the wheel.</span>
          <br />
          <span className="text-btc">Win a deal.</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-surface/60 max-w-2xl mx-auto">
          Flash sales at food trucks and restaurants near you.
          Spin the roulette wheel, win real prizes, walk in and eat.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="bg-btc text-night font-bold px-8 py-4 rounded-full text-lg hover:bg-btc-dark transition"
          >
            I&apos;m a Food Lover
          </Link>
          <Link
            href="/business"
            className="border border-btc/30 text-surface/70 font-medium px-8 py-4 rounded-full text-lg hover:border-btc/60 hover:text-surface transition"
          >
            I Own a Business
          </Link>
        </div>
      </section>

      {/* ─── How It Works (Consumers) ─────────────────────────────────── */}
      <section className="px-6 py-20 bg-[#1a1230]/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-surface mb-4">
            How it works for food lovers
          </h2>
          <p className="text-center text-surface/50 mb-12">
            Four steps. Real prizes. Real food.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '1',
                icon: '📍',
                title: 'See a sale',
                body: 'A restaurant or food truck near you launches a flash sale.',
              },
              {
                step: '2',
                icon: '🎰',
                title: 'Spin the wheel',
                body: 'Every spin wins. Discounts, free items, or special deals.',
              },
              {
                step: '3',
                icon: '🏆',
                title: 'Win a prize',
                body: 'Get your prize code. Higher loyalty tiers = better odds.',
              },
              {
                step: '4',
                icon: '🍔',
                title: 'Check in and eat',
                body: '60 minutes to arrive. Auto check-in via 10m geofence.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-4xl mb-3">{item.icon}</div>
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-btc/20 text-btc text-xs font-bold mb-2">
                  {item.step}
                </div>
                <h3 className="text-base font-bold text-surface mb-1">{item.title}</h3>
                <p className="text-surface/50 text-sm">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ────────────────────────────────────────────────── */}
      <section className="px-6 py-12 bg-btc/5 border-y border-btc/10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '8.4x', label: 'Avg business ROI' },
            { value: '60s', label: 'To spin & win' },
            { value: '10m', label: 'Geofence radius' },
            { value: '$0', label: 'To start' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-black text-btc">{stat.value}</div>
              <div className="text-surface/40 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works (Businesses) ─────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-btc/60 text-xs font-bold tracking-widest uppercase">For Restaurants & Food Trucks</span>
            <h2 className="text-3xl font-bold text-surface mt-2">
              How it works for businesses
            </h2>
            <p className="text-surface/50 mt-3 max-w-xl mx-auto">
              Turn slow hours into foot traffic. Free trial with no time limit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[
              {
                step: '1',
                icon: '🎡',
                title: 'Create a flash sale',
                body: 'Set your prizes, set the odds, pick a duration, and go live. Takes 60 seconds.',
              },
              {
                step: '2',
                icon: '🎰',
                title: 'Customers spin',
                body: 'Nearby customers see your sale, spin the wheel, and win your prizes. You control every outcome.',
              },
              {
                step: '3',
                icon: '💰',
                title: 'Pay per verified visit',
                body: 'Only charged when a customer physically walks in, confirmed by 10m geofence. No visit = no charge.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-4xl mb-3">{item.icon}</div>
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-btc/20 text-btc text-xs font-bold mb-2">
                  {item.step}
                </div>
                <h3 className="text-base font-bold text-surface mb-1">{item.title}</h3>
                <p className="text-surface/50 text-sm">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/pricing"
              className="bg-btc text-night font-bold px-8 py-4 rounded-full text-lg hover:bg-btc-dark transition inline-block"
            >
              See Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Loyalty Tiers ────────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-[#1a1230]/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-surface mb-4">
            Level up your food game
          </h2>
          <p className="text-surface/50 mb-10">
            Every spin earns points. Higher tiers unlock better odds on the wheel.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { tier: 'Explorer', pts: '0', color: 'bg-white/10' },
              { tier: 'Regular', pts: '500', color: 'bg-white/10' },
              { tier: 'Local Legend', pts: '1.5K', color: 'bg-btc/20' },
              { tier: 'Foodie Royale', pts: '4K', color: 'bg-btc/20' },
              { tier: 'Tastemaker', pts: '10K', color: 'bg-purple/30' },
              { tier: 'Influencer', pts: '25K', color: 'bg-purple/30' },
              { tier: 'Food Legend', pts: '60K', color: 'bg-teal/30' },
              { tier: 'Icon', pts: '150K', color: 'bg-teal/30' },
            ].map((t) => (
              <div
                key={t.tier}
                className={`${t.color} rounded-full px-4 py-2 text-sm`}
              >
                <span className="text-surface font-bold">{t.tier}</span>
                <span className="text-surface/40 ml-1">{t.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 text-center">
        <h2 className="text-4xl font-black text-surface mb-4">
          Your next meal is a spin away
        </h2>
        <p className="text-surface/50 mb-8 max-w-md mx-auto">
          Join SerendipEatery and start winning deals at restaurants near you. Always free for consumers.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="bg-btc text-night font-bold px-8 py-4 rounded-full text-lg hover:bg-btc-dark transition"
          >
            Sign Up Free
          </Link>
          <Link
            href="/pricing"
            className="text-btc font-medium text-lg hover:text-btc-light transition"
          >
            Business? See plans →
          </Link>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="px-6 py-8 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-baseline gap-0.5">
            <span className="font-display text-sm font-black text-btc">S</span>
            <span className="font-display text-sm font-black text-surface/60">erendip</span>
            <span className="font-display text-sm font-black text-btc/30">Eatery</span>
          </div>
          <div className="flex gap-6 text-surface/30 text-sm">
            <Link href="/pricing" className="hover:text-surface/60 transition">Pricing</Link>
            <Link href="/sign-in" className="hover:text-surface/60 transition">Sign In</Link>
            <Link href="/sign-up" className="hover:text-surface/60 transition">Sign Up</Link>
          </div>
          <div className="text-surface/20 text-xs">
            &copy; 2026 SerendipEatery. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  )
}
