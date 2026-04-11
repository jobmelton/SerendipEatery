'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getGuestId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('se_guest_id')
  if (!id) {
    id = `guest_${crypto.randomUUID()}`
    localStorage.setItem('se_guest_id', id)
  }
  return id
}

function getGuestName(): string {
  if (typeof window === 'undefined') return 'Host'
  return localStorage.getItem('se_guest_name') || ''
}

export default function CreateTournamentPage() {
  const router = useRouter()
  const [name, setName] = useState('RPS Tournament')
  const [format, setFormat] = useState<'single_elimination' | 'double_elimination'>('single_elimination')
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [hostName, setHostName] = useState(getGuestName())
  const [creating, setCreating] = useState(false)
  const [needsName, setNeedsName] = useState(!getGuestName())
  const [error, setError] = useState('')
  const [recordBanner, setRecordBanner] = useState<{ status: string; record_name: string; target_date: string | null; registrationCount: number } | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/record/current`)
      .then(r => r.json())
      .then(json => { if (json.ok && json.data) setRecordBanner(json.data) })
      .catch(() => {})
  }, [])

  async function handleCreate() {
    if (!hostName.trim()) {
      setNeedsName(true)
      return
    }

    // Save name
    localStorage.setItem('se_guest_name', hostName.trim())

    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/tournaments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: getGuestId(),
          hostName: hostName.trim(),
          name: name.trim() || 'RPS Tournament',
          format,
          maxPlayers,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error ${res.status}`)
      }
      const json = await res.json()
      if (json.ok) {
        window.location.href = `/tournament/${json.data.id}`
      } else {
        setError(json.error || 'Failed to create tournament')
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-12 pb-16">
      <button onClick={() => router.push('/')} className="fixed top-4 left-4 z-40" style={{ color: '#b8a898', fontSize: '0.9rem' }}>
        ← Home
      </button>

      {/* Guinness banner */}
      {recordBanner && (recordBanner.status === 'upcoming' || recordBanner.status === 'active') && (
        <Link href="/record" className="w-full max-w-sm mb-6 block">
          <div className="rounded-2xl px-4 py-4 text-center" style={{ background: '#1a0e00', border: '2px solid #FFD700' }}>
            <p className="text-sm font-bold" style={{ color: '#FFD700' }}>🏅 GUINNESS WORLD RECORD ATTEMPT</p>
            <p className="text-surface/60 text-xs mt-1">{recordBanner.record_name}</p>
            <p className="text-surface/40 text-xs">Target: {(10000).toLocaleString()} players · {recordBanner.registrationCount.toLocaleString()} registered</p>
            {recordBanner.target_date && (
              <p className="text-surface/30 text-[10px] mt-1">
                {new Date(recordBanner.target_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            <p className="text-btc text-xs font-bold mt-2">Register to Participate →</p>
          </div>
        </Link>
      )}

      <div className="text-4xl mb-4">🏆</div>
      <h1 className="text-3xl font-black text-surface mb-2">Create Tournament</h1>
      <p className="text-surface/40 text-sm mb-8">Rock Paper Scissors. Winner takes glory.</p>

      <div className="w-full max-w-sm space-y-5">
        {/* Host name */}
        <div>
          <label className="text-surface/50 text-xs font-bold block mb-1">Your Name</label>
          <input
            value={hostName}
            onChange={(e) => { setHostName(e.target.value.slice(0, 30)); setNeedsName(false) }}
            placeholder="What should we call you?"
            maxLength={30}
            className="w-full rounded-xl px-4 py-3 text-surface font-bold focus:outline-none"
            style={{ background: '#1a1230', border: needsName ? '2px solid #E53E3E' : '1px solid rgba(247,148,29,0.15)' }}
          />
          {needsName && <p className="text-red-400 text-xs mt-1">Enter your name first</p>}
        </div>

        {/* Tournament name */}
        <div>
          <label className="text-surface/50 text-xs font-bold block mb-1">Tournament Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 50))}
            maxLength={50}
            className="w-full rounded-xl px-4 py-3 text-surface focus:outline-none"
            style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}
          />
        </div>

        {/* Format */}
        <div>
          <label className="text-surface/50 text-xs font-bold block mb-2">Format</label>
          <div className="flex gap-3">
            <button
              onClick={() => setFormat('single_elimination')}
              className="flex-1 rounded-xl py-3 font-bold text-sm transition"
              style={{
                background: format === 'single_elimination' ? '#F7941D' : '#1a1230',
                color: format === 'single_elimination' ? '#0f0a1e' : 'rgba(255,248,242,0.5)',
                border: format === 'single_elimination' ? 'none' : '1px solid rgba(247,148,29,0.15)',
              }}
            >
              Single Elim
            </button>
            <button
              onClick={() => setFormat('double_elimination')}
              className="flex-1 rounded-xl py-3 font-bold text-sm transition"
              style={{
                background: format === 'double_elimination' ? '#F7941D' : '#1a1230',
                color: format === 'double_elimination' ? '#0f0a1e' : 'rgba(255,248,242,0.5)',
                border: format === 'double_elimination' ? 'none' : '1px solid rgba(247,148,29,0.15)',
              }}
            >
              Double Elim
            </button>
          </div>
          <p className="text-surface/30 text-xs mt-1">
            {format === 'single_elimination' ? 'Lose once, you\'re out.' : 'Lose twice to be eliminated. Losers bracket gets a second chance.'}
          </p>
        </div>

        {/* Max players */}
        <div>
          <label className="text-surface/50 text-xs font-bold block mb-2">Max Players</label>
          <div className="flex gap-2">
            {[4, 8, 16, 32].map((n) => (
              <button
                key={n}
                onClick={() => setMaxPlayers(n)}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm transition"
                style={{
                  background: maxPlayers === n ? '#F7941D' : '#1a1230',
                  color: maxPlayers === n ? '#0f0a1e' : 'rgba(255,248,242,0.5)',
                  border: maxPlayers === n ? 'none' : '1px solid rgba(247,148,29,0.15)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Create button */}
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full bg-btc text-night font-bold text-lg py-4 rounded-full hover:bg-btc-dark transition disabled:opacity-50"
        >
          {creating ? 'Creating...' : '🏆 Create Tournament'}
        </button>

        {/* Join existing */}
        <div className="text-center pt-2">
          <p className="text-surface/30 text-xs mb-2">Have a join code?</p>
          <button
            onClick={() => {
              const code = prompt('Enter tournament code:')
              if (code) router.push(`/tournament/join/${code.toUpperCase().trim()}`)
            }}
            className="text-btc text-sm font-bold hover:underline"
          >
            Join Existing Tournament
          </button>
        </div>
      </div>
    </main>
  )
}
