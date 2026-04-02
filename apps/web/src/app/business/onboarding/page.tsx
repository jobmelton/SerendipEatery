'use client'

import { useState } from 'react'
import Link from 'next/link'

const steps = [
  {
    title: 'Create Sale',
    description: 'Name your flash sale, set a duration, and pick a radius.',
    icon: (
      <svg viewBox="0 0 200 140" className="w-full h-full">
        <rect x="20" y="15" width="160" height="110" rx="12" fill="#1a1230" stroke="#F7941D" strokeWidth="2" opacity="0.6" />
        <rect x="40" y="35" width="120" height="14" rx="4" fill="#F7941D" opacity="0.3" />
        <rect x="40" y="58" width="80" height="10" rx="3" fill="#fff8f2" opacity="0.15" />
        <rect x="40" y="78" width="100" height="10" rx="3" fill="#fff8f2" opacity="0.15" />
        <rect x="55" y="100" width="90" height="20" rx="10" fill="#F7941D" />
        <text x="100" y="114" textAnchor="middle" fill="#1a0e00" fontSize="10" fontWeight="bold">Create Sale</text>
      </svg>
    ),
  },
  {
    title: 'Set Prizes',
    description: 'Add prizes to the wheel — discounts, free items, or combos.',
    icon: (
      <svg viewBox="0 0 200 140" className="w-full h-full">
        <circle cx="100" cy="70" r="50" fill="none" stroke="#F7941D" strokeWidth="2" opacity="0.4" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <line
            key={angle}
            x1="100"
            y1="70"
            x2={100 + 50 * Math.cos((angle * Math.PI) / 180)}
            y2={70 + 50 * Math.sin((angle * Math.PI) / 180)}
            stroke="#F7941D"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M100,70 L${100 + 50 * Math.cos((i * 90 * Math.PI) / 180)},${70 + 50 * Math.sin((i * 90 * Math.PI) / 180)} A50,50 0 0 1 ${100 + 50 * Math.cos(((i * 90 + 90) * Math.PI) / 180)},${70 + 50 * Math.sin(((i * 90 + 90) * Math.PI) / 180)} Z`}
            fill={i % 2 === 0 ? '#F7941D' : '#1a0e00'}
            opacity={i % 2 === 0 ? 0.25 : 0.5}
          />
        ))}
        <circle cx="100" cy="70" r="12" fill="#1a0e00" stroke="#F7941D" strokeWidth="2" />
        <text x="100" y="74" textAnchor="middle" fill="#F7941D" fontSize="12" fontWeight="900">S</text>
      </svg>
    ),
  },
  {
    title: 'Go Live',
    description: 'Your sale appears on the map for nearby consumers instantly.',
    icon: (
      <svg viewBox="0 0 200 140" className="w-full h-full">
        <circle cx="100" cy="65" r="40" fill="#F7941D" opacity="0.08" />
        <circle cx="100" cy="65" r="25" fill="#F7941D" opacity="0.12" />
        <circle cx="100" cy="65" r="10" fill="#F7941D" opacity="0.3" />
        <circle cx="100" cy="65" r="4" fill="#F7941D" />
        {/* Pulse rings */}
        <circle cx="100" cy="65" r="40" fill="none" stroke="#F7941D" strokeWidth="1" opacity="0.2" />
        <circle cx="100" cy="65" r="55" fill="none" stroke="#F7941D" strokeWidth="1" opacity="0.1" />
        <text x="100" y="120" textAnchor="middle" fill="#1D9E75" fontSize="11" fontWeight="bold">LIVE</text>
      </svg>
    ),
  },
  {
    title: 'Watch Results',
    description: 'See spins, visits, and revenue update in real time.',
    icon: (
      <svg viewBox="0 0 200 140" className="w-full h-full">
        {/* Bar chart */}
        <rect x="35" y="90" width="20" height="30" rx="3" fill="#F7941D" opacity="0.3" />
        <rect x="65" y="70" width="20" height="50" rx="3" fill="#F7941D" opacity="0.5" />
        <rect x="95" y="50" width="20" height="70" rx="3" fill="#F7941D" opacity="0.7" />
        <rect x="125" y="30" width="20" height="90" rx="3" fill="#F7941D" />
        <rect x="155" y="40" width="20" height="80" rx="3" fill="#1D9E75" opacity="0.8" />
        {/* Upward arrow */}
        <line x1="45" y1="25" x2="165" y2="25" stroke="#fff8f2" strokeWidth="0" />
        <polyline points="150,20 165,10 165,30" fill="#1D9E75" opacity="0.6" />
      </svg>
    ),
  },
]

export default function OnboardingPage() {
  const [current, setCurrent] = useState(0)

  return (
    <main className="min-h-screen bg-night flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto w-full">
        <div className="flex items-baseline gap-0.5">
          <span className="font-display text-xl font-black text-btc">S</span>
          <span className="font-display text-xl font-black text-surface">erendip</span>
          <span className="font-display text-xl font-black text-btc/40">Eatery</span>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-surface/40 hover:text-surface transition"
        >
          Skip to Dashboard
        </Link>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-2xl mx-auto w-full">
        {/* Step visual */}
        <div className="w-64 h-44 mb-8">
          {steps[current].icon}
        </div>

        {/* Step info */}
        <h2 className="text-3xl font-black text-surface mb-3 text-center">
          {steps[current].title}
        </h2>
        <p className="text-surface/50 text-center text-lg mb-10 max-w-md">
          {steps[current].description}
        </p>

        {/* Navigation */}
        <div className="flex gap-4">
          {current > 0 && (
            <button
              onClick={() => setCurrent(current - 1)}
              className="px-6 py-3 rounded-full text-sm font-bold text-surface/50 border border-surface/10 hover:border-surface/30 transition"
            >
              Back
            </button>
          )}
          {current < steps.length - 1 ? (
            <button
              onClick={() => setCurrent(current + 1)}
              className="px-8 py-3 rounded-full text-sm font-bold bg-btc text-night hover:bg-btc-dark transition"
            >
              Next
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="px-8 py-3 rounded-full text-sm font-bold bg-btc text-night hover:bg-btc-dark transition"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pb-8">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className="w-2.5 h-2.5 rounded-full transition-all"
            style={{
              background: i === current ? '#F7941D' : 'rgba(255,248,242,0.15)',
              transform: i === current ? 'scale(1.3)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </main>
  )
}
