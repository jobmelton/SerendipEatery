import { Metadata } from 'next'
import Link from 'next/link'

interface Props {
  params: { code: string }
}

// Dynamic OG image per referral - shows who referred you
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = params.code.toUpperCase()
  return {
    title: `Join SerendipEatery with ${code}`,
    description: 'Your friend found a flash deal. Download the app and get 50 bonus points.',
    openGraph: {
      title: `Join SerendipEatery with ${code}`,
      description: 'Spin the wheel. Win free food. Walk in.',
      images: [{ url: `/api/og/referral?code=${code}`, width: 1200, height: 630 }],
    },
  }
}

export default function JoinPage({ params }: Props) {
  const code = params.code.toUpperCase()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">

      <div className="font-display font-black text-4xl mb-2" style={{ color: '#F7941D' }}>
        SerendipEatery
      </div>
      <p className="text-xs tracking-widest mb-10" style={{ color: 'rgba(247,148,29,0.4)' }}>
        YOUR FRIEND FOUND A DEAL
      </p>

      <div
        className="rounded-2xl px-8 py-6 mb-8 w-full max-w-xs"
        style={{ background: '#1a0e00', border: '1px dashed rgba(247,148,29,0.4)' }}
      >
        <div className="text-xs mb-2" style={{ color: 'rgba(247,148,29,0.5)' }}>YOUR REFERRAL CODE</div>
        <div className="text-3xl font-black tracking-widest mb-2" style={{ color: '#F7941D' }}>
          {code}
        </div>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
          50 bonus points waiting for you
        </div>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3 mb-8">
        {/* iOS deep link - opens App Store or app */}
        <a
          href={`serendipeatery://join?code=${code}`}
          onClick={e => {
            // Fallback to App Store if app not installed
            setTimeout(() => {
              window.location.href = `https://apps.apple.com/app/serendipeatery/id0000000000`
            }, 1500)
          }}
          style={{
            display: 'block',
            background: '#F7941D',
            color: '#0f0a1e',
            fontWeight: 'bold',
            textDecoration: 'none',
            borderRadius: '9999px',
            padding: '1rem',
            fontSize: '1rem',
          }}
        >
          Download the app — use {code}
        </a>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Code auto-applies when you sign up
        </p>
      </div>

      <div className="w-full max-w-xs rounded-xl p-4" style={{ background: 'rgba(247,148,29,0.08)', border: '0.5px solid rgba(247,148,29,0.2)' }}>
        <div className="text-xs font-bold mb-3" style={{ color: 'rgba(247,148,29,0.6)' }}>WHY SERENDIPEATERY?</div>
        <div className="flex flex-col gap-2 text-left">
          {[
            '🎡 Spin the roulette wheel for real prizes',
            '📍 Auto check-in when you walk in',
            '🏆 Earn loyalty points on every visit',
            '🔔 Flash deals near you, right now',
          ].map((item, i) => (
            <div key={i} className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{item}</div>
          ))}
        </div>
      </div>

    </main>
  )
}
