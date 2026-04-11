'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function CertificatePage() {
  const { participantId } = useParams<{ participantId: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!participantId) return
    fetch(`${API_URL}/record/certificate/${participantId}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setData(json.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [participantId])

  if (loading) {
    return <main className="min-h-screen bg-night flex items-center justify-center">
      <p className="text-surface/40 animate-pulse">Loading certificate...</p>
    </main>
  }

  if (!data) {
    return <main className="min-h-screen bg-night flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-red-400 text-xl font-bold mb-4">Certificate not found</p>
        <Link href="/" className="text-btc hover:underline">Home</Link>
      </div>
    </main>
  }

  const { participant, attempt, participantNumber, totalParticipants } = data
  const date = attempt?.target_date
    ? new Date(attempt.target_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Date TBD'

  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-10 pb-16">
      <Link href="/" className="fixed top-4 left-4 z-40" style={{ color: '#b8a898', fontSize: '0.9rem' }}>← Home</Link>

      {/* Certificate */}
      <div id="certificate" className="w-full max-w-lg mx-auto rounded-2xl p-8 md:p-12 text-center"
        style={{
          background: 'linear-gradient(145deg, #1a1230 0%, #0f0a1e 100%)',
          border: '3px solid #F7941D',
          boxShadow: '0 0 40px rgba(247,148,29,0.15)',
        }}>
        {/* Gold border decoration */}
        <div className="rounded-xl p-6 md:p-8" style={{ border: '1px solid rgba(255,215,0,0.3)' }}>
          <p className="text-btc font-bold text-sm tracking-[0.3em] mb-1">SERENDIPEATERY</p>
          <div className="h-px bg-gradient-to-r from-transparent via-btc to-transparent my-4" />

          <p className="text-surface/50 text-xs tracking-widest mb-6">OFFICIAL PARTICIPANT CERTIFICATE</p>

          <p className="text-surface/40 text-sm mb-2">This certifies that</p>

          <p className="text-surface font-black text-3xl md:text-4xl mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            {participant.participant_name}
          </p>

          <p className="text-surface/50 text-sm mb-1">officially participated in the</p>
          <p className="text-surface/50 text-sm mb-1">World Record Attempt for</p>
          <p className="text-btc font-bold text-lg mb-4">{attempt?.record_name || 'Largest Online RPS Tournament'}</p>

          <div className="h-px bg-gradient-to-r from-transparent via-surface/10 to-transparent my-4" />

          <div className="flex items-center justify-center gap-6 mb-4">
            <div>
              <p className="text-surface/30 text-[10px] tracking-wider">DATE</p>
              <p className="text-surface text-sm font-bold">{date}</p>
            </div>
            <div className="w-px h-8 bg-surface/10" />
            <div>
              <p className="text-surface/30 text-[10px] tracking-wider">PARTICIPANTS</p>
              <p className="text-surface text-sm font-bold">{totalParticipants.toLocaleString()}</p>
            </div>
            <div className="w-px h-8 bg-surface/10" />
            <div>
              <p className="text-surface/30 text-[10px] tracking-wider">PARTICIPANT</p>
              <p className="text-btc text-sm font-bold">#{participantNumber}</p>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-surface/10 to-transparent my-4" />

          <p className="text-btc/50 text-sm italic mb-2">"Fate has good taste."</p>
          <p className="text-surface/20 text-xs">serendipeatery.com</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button onClick={() => window.print()}
          className="bg-btc text-night font-bold px-6 py-2.5 rounded-xl text-sm">
          Print / Save PDF
        </button>
        <button onClick={async () => {
          const text = `I officially participated in the ${attempt?.record_name} with SerendipEatery! Participant #${participantNumber} of ${totalParticipants.toLocaleString()}`
          if (navigator.share) {
            try { await navigator.share({ title: 'My World Record Certificate', text, url: window.location.href }) } catch {}
          } else {
            navigator.clipboard.writeText(`${text}\n\n${window.location.href}`)
          }
        }} className="border border-surface/20 text-surface/60 font-bold px-6 py-2.5 rounded-xl text-sm">
          Share
        </button>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          main { padding: 0 !important; min-height: auto !important; }
          .fixed, button, a[href="/"] { display: none !important; }
          #certificate { border-color: #F7941D !important; box-shadow: none !important; }
        }
      `}</style>
    </main>
  )
}
