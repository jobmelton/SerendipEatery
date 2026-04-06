'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'

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
  if (typeof window === 'undefined') return 'Player'
  return localStorage.getItem('se_guest_name') || 'Player'
}

interface TournamentData {
  id: string
  host_id: string
  host_name: string
  name: string
  join_code: string
  format: string
  status: string
  max_players: number
  current_round: number
  winner_id: string | null
  winner_name: string | null
  created_at: string
}

interface PlayerData {
  id: string
  player_id: string
  player_name: string
  seed: number
  is_eliminated: boolean
  is_in_losers: boolean
  wins: number
  losses: number
}

interface MatchData {
  id: string
  tournament_id: string
  round: number
  match_index: number
  bracket_type: string
  player1_id: string | null
  player1_name: string | null
  player2_id: string | null
  player2_name: string | null
  battle_id: string | null
  winner_id: string | null
  loser_id: string | null
  status: string
}

type Phase = 'loading' | 'lobby' | 'bracket' | 'completed' | 'error'

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [tournament, setTournament] = useState<TournamentData | null>(null)
  const [players, setPlayers] = useState<PlayerData[]>([])
  const [matches, setMatches] = useState<MatchData[]>([])
  const [myId] = useState(getGuestId())
  const [errorMsg, setErrorMsg] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [showQrFull, setShowQrFull] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const wakeLockRef = useRef<any>(null)

  const isHost = tournament?.host_id === myId
  const isPlayer = players.some(p => p.player_id === myId)
  const joinUrl = typeof window !== 'undefined' && tournament
    ? `${window.location.origin}/tournament/join/${tournament.join_code}`
    : ''

  // ─── Fetch tournament data ────────────────────────────────────────
  const fetchTournament = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/tournaments/${id}`)
      const json = await res.json()
      if (!json.ok) {
        setErrorMsg(json.error || 'Tournament not found')
        setPhase('error')
        return
      }
      setTournament(json.data.tournament)
      setPlayers(json.data.players)
      setMatches(json.data.matches)

      if (json.data.tournament.status === 'lobby') setPhase('lobby')
      else if (json.data.tournament.status === 'active') setPhase('bracket')
      else if (json.data.tournament.status === 'completed') {
        setPhase('completed')
        setConfetti(true)
      }
      else if (json.data.tournament.status === 'cancelled') {
        setErrorMsg('Tournament was cancelled')
        setPhase('error')
      }
    } catch {
      setErrorMsg('Failed to connect')
      setPhase('error')
    }
  }, [id])

  useEffect(() => { if (id) fetchTournament() }, [id, fetchTournament])

  // ─── QR Code ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!joinUrl) return
    QRCode.toDataURL(joinUrl, {
      width: 220,
      color: { dark: '#F7941D', light: '#0f0a1e' },
      margin: 1,
    }).then(setQrDataUrl).catch(() => {})
  }, [joinUrl])

  // ─── Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`tournament:${id}`)
      .on('broadcast', { event: 'player_joined' }, () => fetchTournament())
      .on('broadcast', { event: 'tournament_started' }, () => fetchTournament())
      .on('broadcast', { event: 'match_started' }, () => fetchTournament())
      .on('broadcast', { event: 'match_completed' }, () => fetchTournament())
      .on('broadcast', { event: 'tournament_completed' }, (payload: any) => {
        fetchTournament()
        setConfetti(true)
      })
      .on('broadcast', { event: 'player_eliminated' }, () => fetchTournament())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${id}`,
      }, () => fetchTournament())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${id}`,
      }, () => fetchTournament())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tournament_players',
        filter: `tournament_id=eq.${id}`,
      }, () => fetchTournament())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, fetchTournament])

  // ─── Actions ──────────────────────────────────────────────────────
  async function handleStart() {
    await fetch(`${API_URL}/tournaments/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId: myId }),
    })
    fetchTournament()
  }

  async function handleStartMatch(matchId: string) {
    const res = await fetch(`${API_URL}/tournaments/matches/${matchId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: myId }),
    })
    const json = await res.json()
    if (json.ok && json.data.battleId) {
      router.push(`/battle/${json.data.battleId}?tournament=${id}&matchId=${matchId}`)
    }
  }

  // ─── My current match ────────────────────────────────────────────
  const myMatch = matches.find(
    m => (m.player1_id === myId || m.player2_id === myId) && (m.status === 'ready' || m.status === 'active')
  )
  const myPlayer = players.find(p => p.player_id === myId)
  const amEliminated = myPlayer?.is_eliminated ?? false

  // ─── Full screen QR ──────────────────────────────────────────────
  async function showFullQr() {
    setShowQrFull(true)
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      }
    } catch {}
  }

  function hideFullQr() {
    setShowQrFull(false)
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null }
  }

  // ─── Bracket rendering ───────────────────────────────────────────
  const winnersMatches = matches.filter(m => m.bracket_type === 'winners')
  const losersMatches = matches.filter(m => m.bracket_type === 'losers')
  const grandFinal = matches.find(m => m.bracket_type === 'grand_final')
  const maxRound = winnersMatches.reduce((max, m) => Math.max(max, m.round), 0)

  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-4 pt-8 pb-16 relative">
      <button onClick={() => router.push('/')} className="fixed top-4 left-4 z-40" style={{ color: '#a09080', fontSize: '0.9rem' }}>
        ← Home
      </button>

      {/* Full screen QR */}
      {showQrFull && (
        <div className="fixed inset-0 z-[9999] bg-night flex flex-col items-center justify-center px-6">
          <button onClick={hideFullQr} className="absolute top-4 right-4 text-surface/30 text-sm hover:text-surface/50">Close</button>
          <p className="text-surface font-bold text-2xl mb-2">🏆 {tournament?.name}</p>
          <p className="text-btc font-black text-4xl mb-6 tracking-widest">{tournament?.join_code}</p>
          {qrDataUrl && (
            <img src={qrDataUrl} alt="QR" width={280} height={280} className="rounded-xl mb-6"
              style={{ border: '3px solid rgba(247,148,29,0.3)' }} />
          )}
          <p className="text-surface/40 text-sm mb-6">Scan to join the tournament</p>
          <div className="flex gap-3">
            <button onClick={async () => {
              if (navigator.share) {
                try { await navigator.share({ title: tournament?.name, text: `Join my RPS tournament!`, url: joinUrl }) } catch {}
              } else {
                navigator.clipboard.writeText(joinUrl)
                setCopied(true); setTimeout(() => setCopied(false), 2000)
              }
            }} className="bg-btc text-night font-bold px-5 py-2.5 rounded-xl text-sm">AirDrop / Share</button>
            <button onClick={() => { navigator.clipboard.writeText(tournament?.join_code ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="border border-surface/20 text-surface/60 font-bold px-5 py-2.5 rounded-xl text-sm">
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <a href={`sms:?body=${encodeURIComponent(`Join my RPS tournament!\n\nCode: ${tournament?.join_code}\n\n${joinUrl}`)}`}
              className="border border-surface/20 text-surface/60 font-bold px-5 py-2.5 rounded-xl text-sm">Text</a>
          </div>
        </div>
      )}

      {/* Confetti */}
      {confetti && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {Array.from({ length: 60 }).map((_, i) => (
            <div key={i} className="absolute animate-[confettiFall_3s_ease-in_forwards]" style={{
              left: `${Math.random() * 100}%`,
              top: '-10px',
              width: 8 + Math.random() * 8,
              height: 8 + Math.random() * 8,
              background: ['#FF1493', '#32CD32', '#FFD700', '#4169E1', '#FF4500', '#00CED1'][i % 6],
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDelay: `${Math.random() * 2}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }} />
          ))}
        </div>
      )}

      {/* ─── LOADING ─── */}
      {phase === 'loading' && (
        <div className="text-center mt-20">
          <div className="text-4xl mb-4 animate-pulse">🏆</div>
          <p className="text-surface/40">Loading tournament...</p>
        </div>
      )}

      {/* ─── ERROR ─── */}
      {phase === 'error' && (
        <div className="text-center mt-20">
          <p className="text-red-400 text-xl font-bold mb-4">{errorMsg}</p>
          <Link href="/" className="text-btc hover:underline">← Home</Link>
        </div>
      )}

      {/* ─── LOBBY ─── */}
      {phase === 'lobby' && tournament && (
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <p className="text-4xl mb-2">🏆</p>
            <h1 className="text-2xl font-black text-surface">{tournament.name}</h1>
            <p className="text-surface/40 text-sm">
              {tournament.format === 'double_elimination' ? 'Double Elimination' : 'Single Elimination'} · Max {tournament.max_players}
            </p>
          </div>

          {/* Join code */}
          <div className="text-center mb-6 rounded-2xl p-5" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}>
            <p className="text-surface/40 text-xs mb-1">JOIN CODE</p>
            <p className="text-btc font-black text-4xl tracking-[0.3em] mb-3">{tournament.join_code}</p>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR" width={160} height={160} className="mx-auto rounded-xl mb-3 cursor-pointer"
                style={{ border: '2px solid rgba(247,148,29,0.2)' }} onClick={showFullQr} />
            )}
            <div className="flex gap-2 justify-center">
              <button onClick={showFullQr} className="text-btc text-xs font-bold hover:underline">Show Full QR</button>
              <span className="text-surface/20">·</span>
              <button onClick={() => { navigator.clipboard.writeText(tournament.join_code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="text-btc text-xs font-bold hover:underline">{copied ? 'Copied!' : 'Copy Code'}</button>
              <span className="text-surface/20">·</span>
              <button onClick={async () => {
                if (navigator.share) {
                  try { await navigator.share({ title: tournament.name, text: `Join my RPS tournament! Code: ${tournament.join_code}`, url: joinUrl }) } catch {}
                } else { navigator.clipboard.writeText(joinUrl) }
              }} className="text-btc text-xs font-bold hover:underline">Share</button>
            </div>
          </div>

          {/* Players list */}
          <div className="mb-6">
            <p className="text-surface/50 text-xs font-bold mb-2">PLAYERS ({players.length}/{tournament.max_players})</p>
            <div className="space-y-2">
              {players.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: '#1a1230', border: p.player_id === myId ? '1px solid #F7941D' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-surface font-bold text-sm">{p.player_name}</span>
                    {p.player_id === tournament.host_id && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-btc/20 text-btc">HOST</span>
                    )}
                    {p.player_id === myId && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal/20 text-teal">YOU</span>
                    )}
                  </div>
                  <span className="text-surface/30 text-xs">#{p.seed}</span>
                </div>
              ))}
            </div>
            {players.length === 0 && (
              <p className="text-surface/30 text-sm text-center py-4">Waiting for players...</p>
            )}
          </div>

          {/* Waiting animation */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-surface/30 text-sm">Waiting for players</span>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-btc rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
              <span className="w-1.5 h-1.5 bg-btc rounded-full animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
              <span className="w-1.5 h-1.5 bg-btc rounded-full animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
            </span>
          </div>

          {/* Start button (host only) */}
          {isHost && players.length >= 2 && (
            <button onClick={handleStart} className="w-full bg-btc text-night font-bold text-lg py-4 rounded-full hover:bg-btc-dark transition mb-3">
              🏆 Start Tournament ({players.length} players)
            </button>
          )}

          {isHost && players.length < 2 && (
            <p className="text-surface/30 text-sm text-center">Need at least 2 players to start</p>
          )}
        </div>
      )}

      {/* ─── BRACKET ─── */}
      {(phase === 'bracket' || phase === 'completed') && tournament && (
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-black text-surface">{tournament.name}</h1>
            <p className="text-surface/40 text-xs">
              {tournament.format === 'double_elimination' ? 'Double Elimination' : 'Single Elimination'} · {players.length} players
            </p>
          </div>

          {/* My match card */}
          {phase === 'bracket' && myMatch && !amEliminated && (
            <div className="mb-6 rounded-2xl p-5 text-center mx-auto max-w-sm"
              style={{ background: '#1a0e00', border: '2px solid #F7941D', animation: 'pulse 2s ease-in-out infinite' }}>
              <p className="text-btc font-bold text-sm mb-1">YOUR MATCH</p>
              <p className="text-surface font-bold text-lg mb-1">
                {myMatch.player1_name ?? 'TBD'} vs {myMatch.player2_name ?? 'TBD'}
              </p>
              <p className="text-surface/40 text-xs mb-3">Round {myMatch.round} · {myMatch.bracket_type === 'winners' ? 'Winners' : myMatch.bracket_type === 'losers' ? 'Losers' : 'Grand Final'}</p>
              {myMatch.status === 'ready' && (
                <button onClick={() => handleStartMatch(myMatch.id)}
                  className="bg-btc text-night font-bold px-8 py-3 rounded-full hover:bg-btc-dark transition">
                  Start Match
                </button>
              )}
              {myMatch.status === 'active' && myMatch.battle_id && (
                <Link href={`/battle/${myMatch.battle_id}?tournament=${id}&matchId=${myMatch.id}`}
                  className="inline-block bg-btc text-night font-bold px-8 py-3 rounded-full hover:bg-btc-dark transition">
                  Go to Battle
                </Link>
              )}
            </div>
          )}

          {phase === 'bracket' && !myMatch && isPlayer && !amEliminated && (
            <div className="mb-6 rounded-xl p-4 text-center mx-auto max-w-sm" style={{ background: '#1a1230' }}>
              <p className="text-surface/50 text-sm">Waiting for your opponent to finish their match...</p>
            </div>
          )}

          {amEliminated && phase === 'bracket' && (
            <div className="mb-6 rounded-xl p-4 text-center mx-auto max-w-sm" style={{ background: '#1a1230', border: '1px solid rgba(229,62,62,0.2)' }}>
              <p className="text-red-400 font-bold text-sm">
                {tournament.format === 'double_elimination' && myPlayer?.is_in_losers
                  ? "You're in the losers bracket — fight back!"
                  : "You've been eliminated. Watch the bracket."}
              </p>
            </div>
          )}

          {/* Tournament completed */}
          {phase === 'completed' && tournament.winner_name && (
            <div className="mb-8 text-center">
              <p className="text-6xl mb-2">👑</p>
              <p className="text-btc font-black text-sm tracking-widest mb-1">FATE'S CHAMPION</p>
              <p className="text-surface font-black text-4xl mb-2">{tournament.winner_name}</p>
              {tournament.winner_id === myId && (
                <p className="text-teal font-bold text-lg animate-pulse">That's you! 🎉</p>
              )}
              <div className="flex gap-3 justify-center mt-4">
                <Link href="/tournament" className="bg-btc text-night font-bold px-6 py-2.5 rounded-full text-sm">Play Again</Link>
                <button onClick={async () => {
                  const text = `${tournament.winner_name} won "${tournament.name}" on SerendipEatery! 🏆`
                  if (navigator.share) navigator.share({ title: 'Tournament Result', text, url: typeof window !== 'undefined' ? window.location.href : '' }).catch(() => {})
                  else navigator.clipboard.writeText(text)
                }} className="border border-surface/20 text-surface/60 font-bold px-6 py-2.5 rounded-full text-sm">Share Result</button>
              </div>
            </div>
          )}

          {/* Winners Bracket */}
          <div className="mb-8">
            <p className="text-surface/50 text-xs font-bold mb-3 tracking-wider">
              {tournament.format === 'double_elimination' ? 'WINNERS BRACKET' : 'BRACKET'}
            </p>
            <div className="overflow-x-auto">
              <div className="flex gap-6 min-w-max pb-4">
                {Array.from({ length: maxRound }, (_, r) => r + 1).map((round) => {
                  const roundMatches = winnersMatches.filter(m => m.round === round).sort((a, b) => a.match_index - b.match_index)
                  return (
                    <div key={round} className="flex flex-col gap-3 min-w-[180px]">
                      <p className="text-surface/30 text-xs font-bold text-center mb-1">
                        {round === maxRound ? 'FINAL' : round === maxRound - 1 ? 'SEMIS' : `ROUND ${round}`}
                      </p>
                      {roundMatches.map((match) => (
                        <MatchCard key={match.id} match={match} myId={myId} onStart={() => handleStartMatch(match.id)} />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Losers Bracket */}
          {tournament.format === 'double_elimination' && losersMatches.length > 0 && (
            <div className="mb-8">
              <p className="text-surface/50 text-xs font-bold mb-3 tracking-wider">LOSERS BRACKET</p>
              <div className="overflow-x-auto">
                <div className="flex gap-6 min-w-max pb-4">
                  {Array.from(new Set(losersMatches.map(m => m.round))).sort((a, b) => a - b).map((round) => {
                    const roundMatches = losersMatches.filter(m => m.round === round).sort((a, b) => a.match_index - b.match_index)
                    return (
                      <div key={round} className="flex flex-col gap-3 min-w-[180px]">
                        <p className="text-surface/30 text-xs font-bold text-center mb-1">ROUND {round}</p>
                        {roundMatches.map((match) => (
                          <MatchCard key={match.id} match={match} myId={myId} onStart={() => handleStartMatch(match.id)} />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Grand Final */}
          {grandFinal && (
            <div className="mb-8">
              <p className="text-surface/50 text-xs font-bold mb-3 tracking-wider">GRAND FINAL</p>
              <div className="max-w-[200px] mx-auto">
                <MatchCard match={grandFinal} myId={myId} onStart={() => handleStartMatch(grandFinal.id)} />
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </main>
  )
}

// ─── Match Card Component ───────────────────────────────────────────
function MatchCard({ match, myId, onStart }: { match: MatchData; myId: string; onStart: () => void }) {
  const isMyMatch = match.player1_id === myId || match.player2_id === myId
  const isBye = match.status === 'bye'

  return (
    <div className="rounded-xl p-3" style={{
      background: '#1a1230',
      border: isMyMatch && match.status === 'ready' ? '2px solid #F7941D'
        : match.status === 'completed' ? '1px solid rgba(29,158,117,0.3)'
        : '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Player 1 */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-bold truncate max-w-[120px] ${
          match.winner_id === match.player1_id ? 'text-teal' : match.loser_id === match.player1_id ? 'text-red-400/50' : 'text-surface/70'
        }`}>
          {match.winner_id === match.player1_id && '🏆 '}
          {match.player1_id === myId && '→ '}
          {match.player1_name ?? (isBye ? '—' : 'TBD')}
        </span>
      </div>

      <div className="h-px bg-white/5 my-1" />

      {/* Player 2 */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold truncate max-w-[120px] ${
          match.winner_id === match.player2_id ? 'text-teal' : match.loser_id === match.player2_id ? 'text-red-400/50' : 'text-surface/70'
        }`}>
          {match.winner_id === match.player2_id && '🏆 '}
          {match.player2_id === myId && '→ '}
          {match.player2_name ?? (isBye ? '—' : 'TBD')}
        </span>
      </div>

      {/* Status / action */}
      {match.status === 'ready' && isMyMatch && (
        <button onClick={onStart}
          className="w-full mt-2 bg-btc text-night font-bold py-1.5 rounded-lg text-xs hover:bg-btc-dark transition">
          Start Match
        </button>
      )}
      {match.status === 'active' && (
        <p className="text-btc text-[10px] font-bold text-center mt-1 animate-pulse">IN PROGRESS</p>
      )}
      {match.status === 'completed' && (
        <p className="text-teal/50 text-[10px] font-bold text-center mt-1">COMPLETED</p>
      )}
      {isBye && (
        <p className="text-surface/20 text-[10px] font-bold text-center mt-1">BYE</p>
      )}
    </div>
  )
}
