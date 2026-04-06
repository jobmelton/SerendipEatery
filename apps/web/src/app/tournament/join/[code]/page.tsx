'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('se_guest_name') || ''
}

interface TournamentInfo {
  id: string
  name: string
  host_name: string
  format: string
  max_players: number
  status: string
}

export default function JoinTournamentPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [tournament, setTournament] = useState<TournamentInfo | null>(null)
  const [playerCount, setPlayerCount] = useState(0)
  const [playerName, setPlayerName] = useState(getGuestName())
  const [joining, setJoining] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    fetch(`${API_URL}/tournaments/code/${code}`)
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setTournament(json.data.tournament)
          setPlayerCount(json.data.players?.length ?? 0)

          // Already joined? Go to tournament
          const myId = getGuestId()
          const alreadyIn = json.data.players?.some((p: any) => p.player_id === myId)
          if (alreadyIn) {
            router.replace(`/tournament/${json.data.tournament.id}`)
            return
          }

          // Already started? Still go to tournament view
          if (json.data.tournament.status !== 'lobby') {
            router.replace(`/tournament/${json.data.tournament.id}`)
            return
          }
        } else {
          setError(json.error || 'Tournament not found')
        }
        setLoading(false)
      })
      .catch(() => { setError('Failed to connect'); setLoading(false) })
  }, [code, router])

  async function handleJoin() {
    if (!playerName.trim()) return

    localStorage.setItem('se_guest_name', playerName.trim())
    setJoining(true)

    try {
      const res = await fetch(`${API_URL}/tournaments/${tournament!.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: getGuestId(), playerName: playerName.trim() }),
      })
      const json = await res.json()
      if (json.ok) {
        router.push(`/tournament/${tournament!.id}`)
      } else {
        setError(json.error || 'Failed to join')
      }
    } catch {
      setError('Connection failed')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-night flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🏆</div>
          <p className="text-surface/40">Finding tournament...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-night flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 text-xl font-bold mb-4">{error}</p>
          <Link href="/tournament" className="text-btc hover:underline">Create your own tournament</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-5xl mb-4">🏆</p>
        <h1 className="text-2xl font-black text-surface mb-1">{tournament?.name}</h1>
        <p className="text-surface/40 text-sm mb-1">
          Hosted by <span className="text-btc font-bold">{tournament?.host_name}</span>
        </p>
        <p className="text-surface/30 text-xs mb-6">
          {tournament?.format === 'double_elimination' ? 'Double Elimination' : 'Single Elimination'} · {playerCount}/{tournament?.max_players} players
        </p>

        {/* Name input */}
        <div className="mb-4">
          <label className="text-surface/50 text-xs font-bold block mb-1 text-left">What should we call you?</label>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 30))}
            placeholder="Enter your name"
            maxLength={30}
            autoFocus
            className="w-full rounded-xl px-4 py-3 text-surface font-bold text-center text-lg focus:outline-none"
            style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJoin() }}
          />
        </div>

        <button
          onClick={handleJoin}
          disabled={joining || !playerName.trim()}
          className="w-full bg-btc text-night font-bold text-lg py-4 rounded-full hover:bg-btc-dark transition disabled:opacity-50 mb-3"
        >
          {joining ? 'Joining...' : 'Join Tournament'}
        </button>

        <p className="text-surface/20 text-xs">No account needed. Just your name and your fate.</p>
      </div>
    </main>
  )
}
