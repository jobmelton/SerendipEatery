'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getGuestId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('se_guest_id')
  if (!id) { id = `guest_${crypto.randomUUID()}`; localStorage.setItem('se_guest_id', id) }
  return id
}

interface Attempt {
  id: string
  record_name: string
  target_date: string | null
  target_participants: number
  status: string
  registrationCount: number
}

export default function RecordPage() {
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [agreeDate, setAgreeDate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [participantNumber, setParticipantNumber] = useState(0)
  const [participantId, setParticipantId] = useState('')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    fetch(`${API_URL}/record/current`)
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.data) {
          setAttempt(json.data)
          setCount(json.data.registrationCount)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Countdown timer
  useEffect(() => {
    if (!attempt?.target_date) return
    const target = new Date(attempt.target_date).getTime()
    const tick = () => {
      const now = Date.now()
      const diff = Math.max(0, target - now)
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [attempt?.target_date])

  // Live count refresh
  useEffect(() => {
    const iv = setInterval(() => {
      fetch(`${API_URL}/record/count`)
        .then(r => r.json())
        .then(json => { if (json.ok) setCount(json.data.count) })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !consent) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/record/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          consentGiven: consent,
          guestId: getGuestId(),
        }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error || 'Registration failed'); return }
      setRegistered(true)
      setParticipantNumber(json.data.participantNumber)
      setParticipantId(json.data.participant.id)
      setCount(prev => prev + 1)
    } catch {
      setError('Connection failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const targetDate = attempt?.target_date ? new Date(attempt.target_date) : null
  const dateStr = targetDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const timeStr = targetDate?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const progress = attempt ? Math.min(100, (count / attempt.target_participants) * 100) : 0

  if (loading) {
    return (
      <main className="min-h-screen bg-night flex items-center justify-center">
        <p className="text-surface/40 animate-pulse">Loading...</p>
      </main>
    )
  }

  if (!attempt) {
    return (
      <main className="min-h-screen bg-night flex flex-col items-center justify-center px-6">
        <p className="text-5xl mb-4">🏅</p>
        <h1 className="text-2xl font-black text-surface mb-2">No Active Record Attempt</h1>
        <p className="text-surface/40 text-sm mb-6">Check back soon — something big is coming.</p>
        <Link href="/" className="text-btc font-bold hover:underline">Home</Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-night flex flex-col items-center px-6 pt-10 pb-16">
      <Link href="/" className="fixed top-4 left-4 z-40" style={{ color: '#b8a898', fontSize: '0.9rem' }}>← Home</Link>

      {/* Hero */}
      <p className="text-6xl mb-4">🏅</p>
      <p className="text-btc font-bold text-sm tracking-widest mb-1">GUINNESS WORLD RECORD ATTEMPT</p>
      <h1 className="text-3xl md:text-4xl font-black text-surface text-center mb-2">{attempt.record_name}</h1>
      <p className="text-surface/40 text-sm text-center mb-6">
        {dateStr}{timeStr ? ` at ${timeStr}` : ''}
      </p>

      {/* Countdown */}
      {attempt.status === 'upcoming' && targetDate && (
        <div className="flex gap-3 mb-8">
          {[
            { val: countdown.days, label: 'DAYS' },
            { val: countdown.hours, label: 'HRS' },
            { val: countdown.minutes, label: 'MIN' },
            { val: countdown.seconds, label: 'SEC' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl px-4 py-3 text-center min-w-[70px]" style={{ background: '#1a1230' }}>
              <p className="text-btc font-black text-2xl">{String(item.val).padStart(2, '0')}</p>
              <p className="text-surface/30 text-[10px] font-bold">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Counter + Progress */}
      <div className="w-full max-w-sm mb-8">
        <div className="text-center mb-3">
          <p className="text-btc font-black text-5xl">{count.toLocaleString()}</p>
          <p className="text-surface/40 text-sm">registered participants</p>
        </div>
        <div className="relative h-4 rounded-full overflow-hidden mb-1" style={{ background: '#1a1230' }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #F7941D, #FFD700)' }} />
        </div>
        <p className="text-surface/30 text-xs text-right">Target: {attempt.target_participants.toLocaleString()}</p>
      </div>

      {/* Registration / Success */}
      {!registered ? (
        <div className="w-full max-w-sm">
          <div className="rounded-2xl p-6" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}>
            <h2 className="text-lg font-bold text-surface mb-4">Register to Participate</h2>

            <div className="space-y-3 mb-4">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name (for official record)"
                className="w-full rounded-xl px-4 py-3 text-surface focus:outline-none"
                style={{ background: '#0f0a1e', border: '1px solid rgba(247,148,29,0.15)' }} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email (for certificate)"
                className="w-full rounded-xl px-4 py-3 text-surface focus:outline-none"
                style={{ background: '#0f0a1e', border: '1px solid rgba(247,148,29,0.15)' }} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Phone (optional — SMS reminder)"
                className="w-full rounded-xl px-4 py-3 text-surface focus:outline-none"
                style={{ background: '#0f0a1e', border: '1px solid rgba(247,148,29,0.15)' }} />
            </div>

            <div className="space-y-2 mb-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 accent-btc" />
                <span className="text-surface/60 text-xs">I consent to being listed as an official participant in this Guinness World Record attempt</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreeDate} onChange={(e) => setAgreeDate(e.target.checked)}
                  className="mt-1 accent-btc" />
                <span className="text-surface/60 text-xs">I agree to participate in the tournament on {dateStr || 'the scheduled date'}</span>
              </label>
            </div>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            <button onClick={handleRegister} disabled={submitting || !name.trim() || !email.trim() || !consent}
              className="w-full bg-btc text-night font-bold py-3 rounded-xl hover:bg-btc-dark transition disabled:opacity-50">
              {submitting ? 'Registering...' : '🏅 Register for the Record'}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm text-center">
          <div className="rounded-2xl p-6 mb-6" style={{ background: '#1a0e00', border: '2px solid #F7941D' }}>
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-surface font-bold text-lg mb-1">You're registered!</p>
            <p className="text-btc font-black text-3xl mb-1">Participant #{participantNumber}</p>
            <p className="text-surface/40 text-sm">See you on {dateStr}</p>
          </div>

          {/* Share */}
          <button onClick={async () => {
            const text = `I'm attempting a Guinness World Record with SerendipEatery on ${dateStr}. Join me!`
            const url = typeof window !== 'undefined' ? `${window.location.origin}/record` : ''
            if (navigator.share) {
              try { await navigator.share({ title: 'Guinness World Record Attempt', text, url }) } catch {}
            } else {
              navigator.clipboard.writeText(`${text}\n\n${url}`)
            }
          }} className="w-full bg-btc text-night font-bold py-3 rounded-xl mb-3">
            Share with Friends
          </button>

          {/* Calendar links */}
          {targetDate && (
            <div className="flex gap-2 justify-center mb-4">
              <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(attempt.record_name)}&dates=${targetDate.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z/${new Date(targetDate.getTime() + 7200000).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z&details=${encodeURIComponent('Join at serendipeatery.com/record')}`}
                target="_blank" rel="noopener" className="text-surface/40 text-xs hover:text-surface/60">
                + Google Calendar
              </a>
              <span className="text-surface/20">·</span>
              <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${attempt.record_name}\nDTSTART:${targetDate.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z\nDTEND:${new Date(targetDate.getTime() + 7200000).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z\nDESCRIPTION:Join at serendipeatery.com/record\nEND:VEVENT\nEND:VCALENDAR`)}`}
                download="record-attempt.ics" className="text-surface/40 text-xs hover:text-surface/60">
                + Apple / Outlook
              </a>
            </div>
          )}

          {/* Certificate link */}
          <Link href={`/record/certificate/${participantId}`}
            className="text-btc text-sm font-bold hover:underline">
            View your certificate →
          </Link>
        </div>
      )}
    </main>
  )
}
