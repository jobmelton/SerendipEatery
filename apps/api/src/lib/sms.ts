import { supabase } from './supabase.js'

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_FROM_NUMBER,
  )
}

export function toE164(phone: string): string | null {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (trimmed.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`
  return null
}

export async function sendSms(opts: {
  to: string
  body: string
  template: string
  attemptId?: string | null
  participantId?: string | null
}): Promise<{ status: string; providerId: string | null }> {
  const to = toE164(opts.to) ?? opts.to
  let status = 'logged'
  let providerId: string | null = null
  let error: string | null = null

  if (isSmsConfigured()) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!
      const token = process.env.TWILIO_AUTH_TOKEN!
      const from = process.env.TWILIO_FROM_NUMBER!
      const auth = Buffer.from(`${sid}:${token}`).toString('base64')
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: opts.body }).toString(),
      })
      const json = await res.json() as { sid?: string; message?: string; status?: string }
      if (!res.ok) {
        status = 'failed'
        error = json.message ?? `Twilio HTTP ${res.status}`
      } else {
        status = json.status ?? 'sent'
        providerId = json.sid ?? null
      }
    } catch (err) {
      status = 'failed'
      error = err instanceof Error ? err.message : 'sms send failed'
    }
  }

  await supabase.from('record_sms_log').insert({
    attempt_id: opts.attemptId ?? null,
    participant_id: opts.participantId ?? null,
    to_e164: to,
    template: opts.template,
    body: opts.body,
    provider_id: providerId,
    status,
    error,
  })

  if (status === 'logged') {
    console.log(`[sms] ${opts.template} → ${to}: ${opts.body}`)
  }

  return { status, providerId }
}
