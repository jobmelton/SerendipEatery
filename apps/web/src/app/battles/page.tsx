'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { NavBar } from '@/components/NavBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function BattlesPage() {
  const { user } = useUser()
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  const createChallenge = async () => {
    setCreating(true)
    try {
      // Generate a UUID client-side for the battle
      const battleId = crypto.randomUUID()
      const url = `${window.location.origin}/battle/${battleId}`

      // Create pending battle record via API
      await fetch(`${API_URL}/battles/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defenderId: 'open_challenge',
          battleId,
        }),
      }).catch(() => {
        // API may not support open challenges yet — URL still works for guest play
      })

      setChallengeUrl(url)
    } catch {
      // Fallback: still generate the URL for guest play
      const id = crypto.randomUUID()
      setChallengeUrl(`${window.location.origin}/battle/${id}`)
    }
    setCreating(false)
  }

  const shareChallenge = async () => {
    if (!challengeUrl) return
    const shareData = {
      title: 'SerendipEatery Battle',
      text: "I challenge you to Rock Paper Scissors — winner takes my deals 👊",
      url: challengeUrl,
    }
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {})
    } else {
      await navigator.clipboard.writeText(challengeUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyUrl = () => {
    if (!challengeUrl) return
    navigator.clipboard.writeText(challengeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <NavBar variant="consumer" />
      <main className="min-h-screen bg-night px-6 py-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-surface mb-2">Battles</h1>
          <p className="text-surface/40 text-sm mb-8">Challenge anyone nearby to rock paper scissors</p>

          {!challengeUrl ? (
            <button
              onClick={createChallenge}
              disabled={creating}
              className="w-full bg-btc text-night font-bold text-lg py-5 rounded-2xl hover:bg-btc-dark transition disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Challenge Anyone Nearby'}
            </button>
          ) : (
            <div className="space-y-6">
              {/* QR Code area */}
              <div
                className="rounded-2xl p-8 flex flex-col items-center"
                style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.1)' }}
              >
                <p className="text-surface/50 text-sm mb-4">Scan or share this link</p>
                {/* Simple QR placeholder using SVG grid */}
                <div className="w-48 h-48 bg-white rounded-xl p-3 mb-4 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" width="160" height="160">
                    {/* QR-like pattern — real QR would need a library */}
                    {Array.from({ length: 10 }, (_, row) =>
                      Array.from({ length: 10 }, (_, col) => {
                        const filled = (row + col) % 3 === 0 || (row * col) % 7 < 3
                        return filled ? (
                          <rect key={`${row}-${col}`} x={col * 10} y={row * 10} width="9" height="9" fill="#1a0e00" rx="1" />
                        ) : null
                      })
                    )}
                    {/* Corner markers */}
                    <rect x="0" y="0" width="28" height="28" fill="none" stroke="#1a0e00" strokeWidth="3" rx="3" />
                    <rect x="7" y="7" width="14" height="14" fill="#1a0e00" rx="2" />
                    <rect x="72" y="0" width="28" height="28" fill="none" stroke="#1a0e00" strokeWidth="3" rx="3" />
                    <rect x="79" y="7" width="14" height="14" fill="#1a0e00" rx="2" />
                    <rect x="0" y="72" width="28" height="28" fill="none" stroke="#1a0e00" strokeWidth="3" rx="3" />
                    <rect x="7" y="79" width="14" height="14" fill="#1a0e00" rx="2" />
                  </svg>
                </div>

                {/* URL */}
                <div className="w-full bg-night rounded-xl px-4 py-3 text-center">
                  <p className="text-btc text-sm font-mono break-all">{challengeUrl}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={shareChallenge}
                  className="flex-1 bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition"
                >
                  Share Challenge
                </button>
                <button
                  onClick={copyUrl}
                  className="px-6 py-3 rounded-xl font-bold text-sm border border-surface/20 text-surface/60 hover:text-surface transition"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Share text */}
              <p className="text-surface/30 text-xs text-center">
                Works with AirDrop, Nearby Share, or any messaging app
              </p>

              {/* New challenge */}
              <button
                onClick={() => { setChallengeUrl(null); setCopied(false) }}
                className="w-full text-surface/40 text-sm hover:text-surface/60 transition text-center"
              >
                Create new challenge
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
