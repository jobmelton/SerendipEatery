'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STEPS = [
  {
    icon: '📍',
    title: 'Find a flash sale near you',
    subtitle: 'Discover deals at restaurants and food trucks within walking distance.',
  },
  {
    icon: '🎰',
    title: 'Hold to spin, release to launch',
    subtitle: 'The longer you hold, the harder you spin. Win prizes instantly.',
  },
  {
    icon: '🎒',
    title: 'Win deals, fill your wallet',
    subtitle: 'Every win goes to your wallet. Use them anytime before they expire.',
  },
  {
    icon: '✌️',
    title: 'Battle strangers nearby',
    subtitle: 'Rock paper scissors for real prizes. Your next friend is 10 feet away.',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('onboarded') === 'true') {
      router.replace('/consumer')
    }
  }, [router])

  const finish = () => {
    localStorage.setItem('onboarded', 'true')
    router.push('/consumer')
  }

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1)
    else finish()
  }

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      {/* Skip */}
      <div className="absolute top-6 right-6">
        <button onClick={finish} className="text-surface/30 text-sm hover:text-surface/50 transition">
          Skip
        </button>
      </div>

      {/* Step content */}
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6">{STEPS[step].icon}</div>
        <h1 className="text-2xl md:text-3xl font-black text-surface mb-3">
          {STEPS[step].title}
        </h1>
        <p className="text-surface/50 text-base mb-10">
          {STEPS[step].subtitle}
        </p>
      </div>

      {/* Next / Get Started */}
      <button
        onClick={next}
        className="bg-btc text-night font-bold text-lg px-10 py-4 rounded-full hover:bg-btc-dark transition"
      >
        {step === STEPS.length - 1 ? 'Get Started' : 'Next'}
      </button>

      {/* Progress dots */}
      <div className="flex gap-2 mt-8">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className="w-2.5 h-2.5 rounded-full transition-all"
            style={{
              background: i === step ? '#F7941D' : 'rgba(255,248,242,0.15)',
              transform: i === step ? 'scale(1.3)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </main>
  )
}
