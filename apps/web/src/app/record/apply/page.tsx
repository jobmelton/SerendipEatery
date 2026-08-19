'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type FormState = {
  organisationName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  contactRole: string
  country: string
  city: string
  address: string
  proposedTitle: string
  witness1Name: string
  witness1Email: string
  witness1Role: string
  witness2Name: string
  witness2Email: string
  witness2Role: string
  livestreamUrl: string
  extraNotes: string
}

const EMPTY: FormState = {
  organisationName: 'SerendipEatery',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactRole: 'Record attempt organiser',
  country: 'United States',
  city: '',
  address: '',
  proposedTitle: 'Largest online asynchronous rock-paper-scissors tournament',
  witness1Name: '',
  witness1Email: '',
  witness1Role: '',
  witness2Name: '',
  witness2Email: '',
  witness2Role: '',
  livestreamUrl: '',
  extraNotes: '',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-surface/50 text-xs font-bold block mb-1">{label}</span>
      {children}
    </label>
  )
}

const inputCls = 'w-full rounded-xl px-4 py-3 text-surface focus:outline-none'
const inputStyle = { background: '#1a1230', border: '1px solid rgba(247,148,29,0.2)' } as const

export default function GuinnessApplyPage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [threshold, setThreshold] = useState(50000)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/record/application`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok || !json.data) return
        setThreshold(json.data.defaults?.autoStartThreshold ?? 50000)
        const a = json.data.application
        if (!a) return
        setForm({
          organisationName: a.organisation_name || EMPTY.organisationName,
          contactName: a.contact_name || '',
          contactEmail: a.contact_email || '',
          contactPhone: a.contact_phone || '',
          contactRole: a.contact_role || EMPTY.contactRole,
          country: a.country || EMPTY.country,
          city: a.city || '',
          address: a.address || '',
          proposedTitle: a.proposed_title || EMPTY.proposedTitle,
          witness1Name: a.witness1_name || '',
          witness1Email: a.witness1_email || '',
          witness1Role: a.witness1_role || '',
          witness2Name: a.witness2_name || '',
          witness2Email: a.witness2_email || '',
          witness2Role: a.witness2_role || '',
          livestreamUrl: a.livestream_url || '',
          extraNotes: a.extra_notes || '',
        })
      })
      .catch(() => {})
  }, [])

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`${API_URL}/record/application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.ok) {
        setError(json.error || 'Save failed — you must be signed in as admin.')
        return
      }
      setSaved(true)
    } catch {
      setError('Could not save.')
    } finally {
      setSaving(false)
    }
  }

  function copyPacket() {
    const text = `GUINNESS WORLD RECORDS APPLICATION
Organisation: ${form.organisationName}
Contact: ${form.contactName} · ${form.contactRole}
Email: ${form.contactEmail}  Phone: ${form.contactPhone}
Location: ${form.city ? form.city + ', ' : ''}${form.country}
Address: ${form.address}

Proposed title: ${form.proposedTitle}
Related title: Largest Rock, Paper, Scissors tournament (10,033 — Tianjin Joy City, 24 December 2019)

The attempt is a single global asynchronous single-elimination tournament in the SerendipEatery app.
Registration stays open until ${threshold.toLocaleString()} phone-verified players. At that threshold the system automatically freezes the roster, generates the bracket, and texts every live player.
Matches are first to two winning throws. Sealed simultaneous locks. 48-hour deadline. Auto-forfeit.

Witness 1: ${form.witness1Name} (${form.witness1Role}) ${form.witness1Email}
Witness 2: ${form.witness2Name} (${form.witness2Role}) ${form.witness2Email}
Livestream: ${form.livestreamUrl}

Notes:
${form.extraNotes}

Please issue guidelines on: new-title vs existing in-person title; 48h deadlines and auto-forfeit; byes; no-show counting; identity standard; digital steward ratio; video for a multi-week async attempt.`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-night px-6 pt-12 pb-20">
      <Link href="/record" className="fixed top-4 left-4 z-40 text-sm" style={{ color: '#b8a898' }}>← Record</Link>

      <div className="max-w-2xl mx-auto print:max-w-none">
        <p className="text-btc font-bold text-xs tracking-widest mb-2">GUINNESS WORLD RECORDS</p>
        <h1 className="text-3xl font-black text-surface mb-2">Official application form</h1>
        <p className="text-surface/50 text-sm mb-8 leading-relaxed">
          Fill the blanks, save, then copy the packet into the Guinness organisation application.
          Attach the PDF in <code className="text-btc">docs/guinness/</code> plus Rules, Evidence, and Witness plan.
          The official tournament starts by itself at {threshold.toLocaleString()} verified signups — do not press start.
        </p>

        <section className="mb-8 rounded-2xl p-5" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}>
          <h2 className="text-surface font-black mb-4">1. Applicant</h2>
          <Field label="Organisation"><input className={inputCls} style={inputStyle} value={form.organisationName} onChange={set('organisationName')} /></Field>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Contact name"><input className={inputCls} style={inputStyle} value={form.contactName} onChange={set('contactName')} /></Field>
            <Field label="Role"><input className={inputCls} style={inputStyle} value={form.contactRole} onChange={set('contactRole')} /></Field>
            <Field label="Email"><input className={inputCls} style={inputStyle} type="email" value={form.contactEmail} onChange={set('contactEmail')} /></Field>
            <Field label="Phone"><input className={inputCls} style={inputStyle} value={form.contactPhone} onChange={set('contactPhone')} /></Field>
            <Field label="City"><input className={inputCls} style={inputStyle} value={form.city} onChange={set('city')} /></Field>
            <Field label="Country"><input className={inputCls} style={inputStyle} value={form.country} onChange={set('country')} /></Field>
          </div>
          <Field label="Postal address"><input className={inputCls} style={inputStyle} value={form.address} onChange={set('address')} /></Field>
        </section>

        <section className="mb-8 rounded-2xl p-5" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}>
          <h2 className="text-surface font-black mb-4">2. Proposed record</h2>
          <Field label="Proposed title"><input className={inputCls} style={inputStyle} value={form.proposedTitle} onChange={set('proposedTitle')} /></Field>
          <p className="text-surface/50 text-sm leading-relaxed">
            Related existing title: Largest Rock, Paper, Scissors tournament — 10,033 people,
            Tianjin Joy City, China, 24 December 2019. We are applying for a <b className="text-surface">new title</b> because that record is in-person.
            Measurement: unique phone-verified people in one single-elimination tournament who locked a throw or received a documented bye.
            Auto-start threshold: <b className="text-btc">{threshold.toLocaleString()}</b> verified players. First to two. 48-hour match clock. SMS when you are up.
          </p>
        </section>

        <section className="mb-8 rounded-2xl p-5" style={{ background: '#1a1230', border: '1px solid rgba(247,148,29,0.15)' }}>
          <h2 className="text-surface font-black mb-4">3. Independent witnesses</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Witness 1 name"><input className={inputCls} style={inputStyle} value={form.witness1Name} onChange={set('witness1Name')} /></Field>
            <Field label="Email"><input className={inputCls} style={inputStyle} value={form.witness1Email} onChange={set('witness1Email')} /></Field>
            <Field label="Role (journalist, CPA…)"><input className={inputCls} style={inputStyle} value={form.witness1Role} onChange={set('witness1Role')} /></Field>
            <Field label="Witness 2 name"><input className={inputCls} style={inputStyle} value={form.witness2Name} onChange={set('witness2Name')} /></Field>
            <Field label="Email"><input className={inputCls} style={inputStyle} value={form.witness2Email} onChange={set('witness2Email')} /></Field>
            <Field label="Role"><input className={inputCls} style={inputStyle} value={form.witness2Role} onChange={set('witness2Role')} /></Field>
          </div>
          <Field label="Public livestream URL"><input className={inputCls} style={inputStyle} value={form.livestreamUrl} onChange={set('livestreamUrl')} /></Field>
          <Field label="Notes for Records Management">
            <textarea className={inputCls} style={inputStyle} rows={4} value={form.extraNotes} onChange={set('extraNotes')} />
          </Field>
        </section>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {saved && <p className="text-teal-400 text-sm mb-3">Saved.</p>}

        <div className="flex flex-wrap gap-3 print:hidden">
          <button onClick={save} disabled={saving} className="bg-btc text-night font-bold px-5 py-3 rounded-xl disabled:opacity-50">
            {saving ? 'Saving…' : 'Save form'}
          </button>
          <button onClick={copyPacket} className="border font-bold px-5 py-3 rounded-xl text-surface" style={{ borderColor: 'rgba(247,148,29,0.4)' }}>
            {copied ? 'Copied' : 'Copy packet for Guinness'}
          </button>
          <button onClick={() => window.print()} className="border font-bold px-5 py-3 rounded-xl text-surface" style={{ borderColor: 'rgba(247,148,29,0.4)' }}>
            Print
          </button>
        </div>
      </div>
    </main>
  )
}
