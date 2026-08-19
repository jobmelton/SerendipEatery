import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validate } from '../lib/validate.js'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/adminAuth.js'
import { toE164 } from '../lib/sms.js'
import {
  appendEvent,
  generateRecordBracket,
  getCurrentAttempt,
  maybeAutoStartOfficial,
  sendOtp,
  startRecordMatch,
  syncRecordMatch,
  tickRecordMatches,
  verifyChain,
  verifyOtp,
} from '../lib/record-engine.js'

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  consentGiven: z.boolean(),
  smsConsent: z.boolean(),
  ageConfirmed: z.boolean(),
  guestId: z.string().optional(),
  userId: z.string().optional(),
})

const otpSendSchema = z.object({
  phone: z.string().min(7).max(20),
})

const otpVerifySchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().min(4).max(8),
})

function publicAttempt(attempt: any, registrationCount: number) {
  return {
    id: attempt.id,
    record_name: attempt.record_name,
    target_date: attempt.target_date,
    target_participants: attempt.target_participants,
    status: attempt.status,
    rules_version: attempt.rules_version,
    match_deadline_hours: attempt.match_deadline_hours,
    min_age: attempt.min_age,
    registration_opens_at: attempt.registration_opens_at,
    registration_closes_at: attempt.registration_closes_at,
    current_round: attempt.current_round,
    verified_count: attempt.verified_count,
    official_count: attempt.official_count,
    auto_start_threshold: attempt.auto_start_threshold ?? attempt.target_participants ?? 50000,
    auto_start_enabled: attempt.auto_start_enabled !== false,
    registrationCount,
  }
}

function lockState(attempt: any | null, participant: any | null) {
  // App lock only engages once registration is open. `upcoming` is planning, not the event.
  if (!attempt || !['registration', 'frozen', 'active'].includes(attempt.status)) {
    return { unlocked: true, lockReason: 'attempt_over' as const, showUnlockCta: false }
  }
  if (!participant) {
    return { unlocked: false, lockReason: 'not_registered' as const, showUnlockCta: false }
  }
  if (participant.app_unlocked || ['eliminated', 'champion', 'withdrawn', 'forfeited'].includes(participant.status)) {
    return {
      unlocked: true,
      lockReason: participant.status === 'champion' ? 'champion' as const : 'eliminated' as const,
      showUnlockCta: !participant.unlock_cta_seen_at,
    }
  }
  if (attempt.status === 'registration' || attempt.status === 'frozen') {
    return { unlocked: false, lockReason: 'waiting' as const, showUnlockCta: false }
  }
  return { unlocked: false, lockReason: 'alive' as const, showUnlockCta: false }
}

async function findParticipant(attemptId: string, userId: string) {
  const { data } = await supabase
    .from('record_participants')
    .select('*')
    .eq('attempt_id', attemptId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function recordRoutes(app: FastifyInstance) {
  // ─── Public: current attempt ──────────────────────────────────────
  app.get('/record/current', async () => {
    const attempt = await getCurrentAttempt()
    if (!attempt) return { ok: true, data: null }

    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attempt.id)
      .not('phone_verified_at', 'is', null)

    return { ok: true, data: publicAttempt(attempt, count ?? 0) }
  })

  app.get('/record/count', async () => {
    const attempt = await getCurrentAttempt()
    if (!attempt) return { ok: true, data: { count: 0, officialCount: 0 } }

    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attempt.id)
      .not('phone_verified_at', 'is', null)

    const { count: official } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attempt.id)
      .eq('official_participant', true)

    return { ok: true, data: { count: count ?? 0, officialCount: official ?? 0 } }
  })

  // ─── Register ─────────────────────────────────────────────────────
  app.post('/record/register', {
    preHandler: validate(registerSchema),
  }, async (request) => {
    const body = request.body as z.infer<typeof registerSchema>

    if (!body.consentGiven) throw new AppError(400, 'NO_CONSENT', 'You must consent to be listed on the official roster')
    if (!body.smsConsent) throw new AppError(400, 'NO_SMS', 'SMS consent is required so we can tell you when you are up')
    if (!body.ageConfirmed) throw new AppError(400, 'NO_AGE', 'Confirm you meet the minimum age')

    const phone = toE164(body.phone)
    if (!phone) throw new AppError(400, 'BAD_PHONE', 'Enter a valid mobile number')

    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    if (!['upcoming', 'registration'].includes(attempt.status)) {
      throw new AppError(400, 'CLOSED', 'Registration is closed')
    }
    if (attempt.registration_opens_at && Date.now() < new Date(attempt.registration_opens_at).getTime()) {
      throw new AppError(400, 'NOT_OPEN', 'Registration is not open yet')
    }
    if (attempt.registration_closes_at && Date.now() > new Date(attempt.registration_closes_at).getTime()) {
      throw new AppError(400, 'CLOSED', 'Registration is closed')
    }

    if (body.userId) {
      const existingUser = await findParticipant(attempt.id, body.userId)
      if (existingUser) {
        return { ok: true, data: { participant: existingUser, alreadyRegistered: true } }
      }
    }

    const { data: existingPhone } = await supabase
      .from('record_participants')
      .select('id')
      .eq('attempt_id', attempt.id)
      .eq('phone_e164', phone)
      .maybeSingle()
    if (existingPhone) throw new AppError(400, 'PHONE_TAKEN', 'This phone is already registered')

    const { data: existingEmail } = await supabase
      .from('record_participants')
      .select('id')
      .eq('attempt_id', attempt.id)
      .eq('email', body.email)
      .maybeSingle()
    if (existingEmail) throw new AppError(400, 'ALREADY_REGISTERED', 'This email is already registered')

    const ipAddress = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || request.ip || null
    const userAgent = request.headers['user-agent'] || null

    const { data: participant, error } = await supabase
      .from('record_participants')
      .insert({
        attempt_id: attempt.id,
        user_id: body.userId || null,
        guest_id: body.guestId || null,
        participant_name: body.name,
        legal_name: body.name,
        email: body.email,
        phone,
        phone_e164: phone,
        consent_given: true,
        sms_consent: true,
        sms_consent_at: new Date().toISOString(),
        age_confirmed: true,
        status: 'registered',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (error) throw error

    await appendEvent(attempt.id, 'participant_registered', {
      participantId: participant.id,
      name: body.name,
    })

    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attempt.id)
      .lte('joined_at', participant.joined_at)

    return { ok: true, data: { participant, participantNumber: count ?? 1 } }
  })

  app.post('/record/otp/send', {
    preHandler: validate(otpSendSchema),
  }, async (request) => {
    const { phone } = request.body as z.infer<typeof otpSendSchema>
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    const result = await sendOtp(attempt.id, phone)
    return { ok: true, data: result }
  })

  app.post('/record/otp/verify', {
    preHandler: validate(otpVerifySchema),
  }, async (request) => {
    const { phone, code } = request.body as z.infer<typeof otpVerifySchema>
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    const header = request.headers.authorization
    let userId: string | undefined
    if (header?.startsWith('Bearer ')) {
      try {
        const { verifyToken } = await import('@clerk/backend')
        const payload = await verifyToken(header.replace('Bearer ', '').trim(), {
          secretKey: process.env.CLERK_SECRET_KEY!,
        })
        userId = payload.sub
      } catch { /* optional */ }
    }
    const participant = await verifyOtp(attempt.id, phone, code, userId)
    return { ok: true, data: { participant } }
  })

  // ─── Signed-in player ─────────────────────────────────────────────
  app.get('/record/gate', { preHandler: requireAuth }, async (request) => {
    const userId = (request as AuthenticatedRequest).auth.userId
    const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean)
    if (adminIds.includes(userId)) {
      return { ok: true, data: { attempt: null, participant: null, currentMatch: null, unlocked: true, lockReason: 'admin', showUnlockCta: false } }
    }
    const attempt = await getCurrentAttempt()
    if (!attempt) {
      return { ok: true, data: { attempt: null, participant: null, currentMatch: null, unlocked: true, lockReason: 'no_attempt', showUnlockCta: false } }
    }
    const participant = await findParticipant(attempt.id, userId)
    const lock = lockState(attempt, participant)

    let currentMatch = null
    if (participant?.current_match_id) {
      const { data } = await supabase
        .from('record_matches')
        .select('id, round, match_index, player1_id, player2_id, player1_name, player2_name, status, deadline_at, battle_id')
        .eq('id', participant.current_match_id)
        .maybeSingle()
      currentMatch = data
    }

    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attempt.id)
      .not('phone_verified_at', 'is', null)

    return {
      ok: true,
      data: {
        attempt: publicAttempt(attempt, count ?? 0),
        participant,
        currentMatch,
        ...lock,
      },
    }
  })

  app.post('/record/link', { preHandler: requireAuth }, async (request) => {
    const userId = (request as AuthenticatedRequest).auth.userId
    const body = request.body as { email?: string; phone?: string }
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')

    const already = await findParticipant(attempt.id, userId)
    if (already) return { ok: true, data: already }

    let query = supabase.from('record_participants').select('*').eq('attempt_id', attempt.id).is('user_id', null)
    if (body.phone) {
      const e164 = toE164(body.phone)
      if (e164) query = query.eq('phone_e164', e164)
    } else if (body.email) {
      query = query.eq('email', body.email)
    } else {
      throw new AppError(400, 'MISSING', 'email or phone required')
    }
    const { data: row } = await query.maybeSingle()
    if (!row) throw new AppError(404, 'NOT_FOUND', 'No matching registration to link')

    await supabase.from('record_participants').update({ user_id: userId }).eq('id', row.id)
    return { ok: true, data: { ...row, user_id: userId } }
  })

  app.post('/record/me/match/start', { preHandler: requireAuth }, async (request) => {
    const userId = (request as AuthenticatedRequest).auth.userId
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    const participant = await findParticipant(attempt.id, userId)
    if (!participant) throw new AppError(404, 'NOT_REGISTERED', 'Register first')
    if (!participant.phone_verified_at) throw new AppError(400, 'UNVERIFIED', 'Verify your phone first')
    if (!participant.current_match_id) throw new AppError(400, 'NO_MATCH', 'No live match')

    const result = await startRecordMatch(participant.current_match_id, participant.id)
    return { ok: true, data: result }
  })

  app.post('/record/me/match/sync', { preHandler: requireAuth }, async (request) => {
    const userId = (request as AuthenticatedRequest).auth.userId
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    const participant = await findParticipant(attempt.id, userId)
    if (!participant?.current_match_id) return { ok: true, data: { completed: false } }
    const result = await syncRecordMatch(participant.current_match_id)
    return { ok: true, data: result }
  })

  app.post('/record/unlock-seen', { preHandler: requireAuth }, async (request) => {
    const userId = (request as AuthenticatedRequest).auth.userId
    const attempt = await getCurrentAttempt()
    if (!attempt) return { ok: true }
    const participant = await findParticipant(attempt.id, userId)
    if (participant) {
      await supabase.from('record_participants').update({
        unlock_cta_seen_at: new Date().toISOString(),
      }).eq('id', participant.id)
    }
    return { ok: true }
  })

  // ─── Public live bracket (no PII) ─────────────────────────────────
  app.get('/record/bracket', async () => {
    const attempt = await getCurrentAttempt()
    if (!attempt) return { ok: true, data: { matches: [] } }
    const { data: matches } = await supabase
      .from('record_matches')
      .select('id, round, match_index, player1_name, player2_name, status, winner_id, deadline_at')
      .eq('attempt_id', attempt.id)
      .order('round')
      .order('match_index')
      .limit(2000)
    return { ok: true, data: { matches: matches ?? [], currentRound: attempt.current_round } }
  })

  // ─── Certificate (redacted) ───────────────────────────────────────
  app.get('/record/certificate/:participantId', async (request) => {
    const { participantId } = request.params as { participantId: string }
    const { data: participant } = await supabase
      .from('record_participants')
      .select('id, participant_name, legal_name, joined_at, status, official_participant, attempt_id, record_attempts(record_name, status, official_count, target_date)')
      .eq('id', participantId)
      .single()

    if (!participant) throw new AppError(404, 'NOT_FOUND', 'Participant not found')

    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', participant.attempt_id)
      .lte('joined_at', participant.joined_at)

    const { count: totalCount } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', participant.attempt_id)
      .not('phone_verified_at', 'is', null)

    return {
      ok: true,
      data: {
        participant: {
          id: participant.id,
          participant_name: participant.legal_name || participant.participant_name,
          joined_at: participant.joined_at,
          status: participant.status,
          official_participant: participant.official_participant,
        },
        attempt: participant.record_attempts,
        participantNumber: count ?? 1,
        totalParticipants: totalCount ?? 0,
      },
    }
  })

  // ─── Admin ────────────────────────────────────────────────────────
  app.post('/record/admin/generate-bracket', {
    preHandler: [requireAuth, requireAdmin],
  }, async () => {
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    const result = await generateRecordBracket(attempt.id)
    return { ok: true, data: result }
  })

  app.post('/record/admin/tick', {
    preHandler: [requireAuth, requireAdmin],
  }, async () => {
    const result = await tickRecordMatches()
    return { ok: true, data: result }
  })

  app.post('/record/admin/open-registration', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request) => {
    const body = request.body as { opensAt?: string; closesAt?: string }
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    await supabase.from('record_attempts').update({
      status: 'registration',
      registration_opens_at: body.opensAt ?? new Date().toISOString(),
      registration_closes_at: body.closesAt ?? null,
    }).eq('id', attempt.id)
    await appendEvent(attempt.id, 'registration_opened', { opensAt: body.opensAt ?? 'now' })
    return { ok: true }
  })

  app.get('/record/admin/export/roster', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request) => {
    const redacted = (request.query as { redacted?: string }).redacted === '1'
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')

    const { data } = await supabase
      .from('record_participants')
      .select('id, legal_name, participant_name, email, phone_e164, phone_verified_at, age_confirmed, sms_consent_at, ip_address, user_agent, joined_at, seed, status, official_participant, first_throw_at, eliminated_round')
      .eq('attempt_id', attempt.id)
      .order('joined_at')

    const rows = (data ?? []).map((p) => redacted ? {
      ...p,
      email: p.email ? '[redacted]' : null,
      phone_e164: p.phone_e164 ? '[redacted]' : null,
      ip_address: null,
      user_agent: null,
    } : p)

    return { ok: true, data: { attemptId: attempt.id, participants: rows } }
  })

  app.get('/record/admin/export/matches', {
    preHandler: [requireAuth, requireAdmin],
  }, async () => {
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    const { data } = await supabase
      .from('record_matches')
      .select('*')
      .eq('attempt_id', attempt.id)
      .order('round')
      .order('match_index')
    return { ok: true, data: { matches: data ?? [] } }
  })

  app.get('/record/admin/export/chain', {
    preHandler: [requireAuth, requireAdmin],
  }, async () => {
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    const { data } = await supabase
      .from('record_event_log')
      .select('seq, event_type, payload, prev_hash, hash, created_at')
      .eq('attempt_id', attempt.id)
      .order('seq')
    const verification = await verifyChain(attempt.id)
    return { ok: true, data: { events: data ?? [], verification } }
  })

  app.get('/record/admin/export/sms', {
    preHandler: [requireAuth, requireAdmin],
  }, async () => {
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')
    const { data } = await supabase
      .from('record_sms_log')
      .select('id, to_e164, template, status, provider_id, sent_at, error')
      .eq('attempt_id', attempt.id)
      .order('sent_at')
    return { ok: true, data: { messages: data ?? [] } }
  })

  app.post('/record/admin/auto-start', {
    preHandler: [requireAuth, requireAdmin],
  }, async () => {
    const result = await maybeAutoStartOfficial()
    return { ok: true, data: result }
  })

  const applicationSchema = z.object({
    organisationName: z.string().min(1).max(120).optional(),
    contactName: z.string().max(120).optional(),
    contactEmail: z.string().email().optional().or(z.literal('')),
    contactPhone: z.string().max(30).optional(),
    contactRole: z.string().max(80).optional(),
    country: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    address: z.string().max(240).optional(),
    proposedTitle: z.string().max(200).optional(),
    witness1Name: z.string().max(120).optional(),
    witness1Email: z.string().email().optional().or(z.literal('')),
    witness1Role: z.string().max(80).optional(),
    witness2Name: z.string().max(120).optional(),
    witness2Email: z.string().email().optional().or(z.literal('')),
    witness2Role: z.string().max(80).optional(),
    livestreamUrl: z.string().max(300).optional(),
    extraNotes: z.string().max(4000).optional(),
  })

  app.get('/record/application', async () => {
    const attempt = await getCurrentAttempt()
    if (!attempt) return { ok: true, data: null }
    const { data } = await supabase
      .from('record_application')
      .select('*')
      .eq('attempt_id', attempt.id)
      .maybeSingle()
    return {
      ok: true,
      data: {
        attempt: publicAttempt(attempt, 0),
        application: data,
        defaults: {
          organisationName: 'SerendipEatery',
          proposedTitle: 'Largest online asynchronous rock-paper-scissors tournament',
          relatedTitle: 'Largest Rock, Paper, Scissors tournament (10,033 — Tianjin Joy City, 2019)',
          autoStartThreshold: attempt.auto_start_threshold ?? 50000,
          matchDeadlineHours: attempt.match_deadline_hours ?? 48,
          rulesVersion: attempt.rules_version ?? 'rps-async-v1',
        },
      },
    }
  })

  app.post('/record/application', {
    preHandler: [requireAuth, requireAdmin, validate(applicationSchema)],
  }, async (request) => {
    const body = request.body as z.infer<typeof applicationSchema>
    const attempt = await getCurrentAttempt()
    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')

    const row = {
      attempt_id: attempt.id,
      organisation_name: body.organisationName || 'SerendipEatery',
      contact_name: body.contactName || null,
      contact_email: body.contactEmail || null,
      contact_phone: body.contactPhone || null,
      contact_role: body.contactRole || 'Record attempt organiser',
      country: body.country || 'United States',
      city: body.city || null,
      address: body.address || null,
      proposed_title: body.proposedTitle || 'Largest online asynchronous rock-paper-scissors tournament',
      witness1_name: body.witness1Name || null,
      witness1_email: body.witness1Email || null,
      witness1_role: body.witness1Role || null,
      witness2_name: body.witness2Name || null,
      witness2_email: body.witness2Email || null,
      witness2_role: body.witness2Role || null,
      livestream_url: body.livestreamUrl || null,
      extra_notes: body.extraNotes || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('record_application')
      .upsert(row, { onConflict: 'attempt_id' })
      .select()
      .single()
    if (error) throw error
    return { ok: true, data }
  })

  // Kept for the existing web certificate-send button, now admin-only
  app.post('/record/send-certificates', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request) => {
    const body = request.body as { attemptId: string }
    if (!body.attemptId) throw new AppError(400, 'MISSING', 'attemptId required')
    const { data: participants } = await supabase
      .from('record_participants')
      .select('id')
      .eq('attempt_id', body.attemptId)
      .eq('certificate_sent', false)
    for (const p of participants ?? []) {
      await supabase.from('record_participants').update({ certificate_sent: true }).eq('id', p.id)
    }
    return { ok: true, data: { sent: participants?.length ?? 0 } }
  })
}
