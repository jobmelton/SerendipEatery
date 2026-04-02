'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ComingSoonAppPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      <div className="flex items-baseline gap-0.5 mb-8">
        <span className="font-display text-3xl md:text-4xl font-black text-btc">S</span>
        <span className="font-display text-3xl md:text-4xl font-black text-surface">erendip</span>
        <span className="font-display text-3xl md:text-4xl font-black text-btc/40">Eatery</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-black text-surface text-center mb-3">
        The app is coming soon
      </h1>
      <p className="text-surface/50 text-center text-lg mb-10 max-w-md">
        Be the first to know when we launch.
      </p>

      {status === 'success' ? (
        <div className="text-teal font-bold text-lg">You're on the list!</div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="flex-1 bg-[#1a1230] text-surface border border-white/10 rounded-full px-5 py-3 text-sm placeholder:text-surface/30 focus:outline-none focus:border-btc transition"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="bg-btc text-night font-bold px-6 py-3 rounded-full text-sm hover:bg-btc-dark transition disabled:opacity-50"
          >
            {status === 'loading' ? 'Saving...' : 'Notify Me'}
          </button>
        </form>
      )}

      {status === 'error' && (
        <p className="text-red-400 text-sm mt-3">Something went wrong. Try again.</p>
      )}

      <Link href="/" className="mt-10 text-surface/30 text-sm hover:text-surface/50 transition">
        Back to home
      </Link>
    </main>
  )
}
