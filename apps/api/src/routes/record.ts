import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validate } from '../lib/validate.js'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  consentGiven: z.boolean(),
  guestId: z.string().optional(),
  userId: z.string().optional(),
})

export async function recordRoutes(app: FastifyInstance) {
  // ─── Get active/upcoming record attempt ───────────────────────────
  app.get('/record/current', async () => {
    const { data: attempt } = await supabase
      .from('record_attempts')
      .select('*')
      .in('status', ['upcoming', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!attempt) return { ok: true, data: null }

    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attempt.id)

    return { ok: true, data: { ...attempt, registrationCount: count ?? 0 } }
  })

  // ─── Register for record attempt ──────────────────────────────────
  app.post('/record/register', {
    preHandler: validate(registerSchema),
  }, async (request) => {
    const { name, email, phone, consentGiven, guestId, userId } = request.body as z.infer<typeof registerSchema>

    if (!consentGiven) {
      throw new AppError(400, 'NO_CONSENT', 'You must consent to participate')
    }

    // Get current attempt
    const { data: attempt } = await supabase
      .from('record_attempts')
      .select('id, status')
      .in('status', ['upcoming', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!attempt) throw new AppError(404, 'NO_ATTEMPT', 'No active record attempt')

    // Check not already registered
    const { data: existing } = await supabase
      .from('record_participants')
      .select('id')
      .eq('attempt_id', attempt.id)
      .eq('email', email)
      .single()

    if (existing) throw new AppError(400, 'ALREADY_REGISTERED', 'This email is already registered')

    const ipAddress = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || request.ip || null
    const userAgent = request.headers['user-agent'] || null

    const { data: participant, error } = await supabase
      .from('record_participants')
      .insert({
        attempt_id: attempt.id,
        user_id: userId || null,
        guest_id: guestId || null,
        participant_name: name,
        email,
        phone: phone || null,
        consent_given: true,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (error) throw error

    // Get participant number
    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attempt.id)
      .lte('joined_at', participant.joined_at)

    return { ok: true, data: { participant, participantNumber: count ?? 1 } }
  })

  // ─── Get registration count ───────────────────────────────────────
  app.get('/record/count', async () => {
    const { data: attempt } = await supabase
      .from('record_attempts')
      .select('id')
      .in('status', ['upcoming', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!attempt) return { ok: true, data: { count: 0 } }

    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attempt.id)

    return { ok: true, data: { count: count ?? 0 } }
  })

  // ─── Log evidence snapshot ────────────────────────────────────────
  app.post('/record/evidence', async (request) => {
    const body = request.body as { attemptId: string; evidenceType: string; data: any }

    if (!body.attemptId || !body.evidenceType) {
      throw new AppError(400, 'MISSING', 'attemptId and evidenceType required')
    }

    await supabase.from('record_evidence').insert({
      attempt_id: body.attemptId,
      evidence_type: body.evidenceType,
      data: body.data,
    })

    return { ok: true }
  })

  // ─── Get participant certificate data ─────────────────────────────
  app.get('/record/certificate/:participantId', async (request) => {
    const { participantId } = request.params as { participantId: string }

    const { data: participant } = await supabase
      .from('record_participants')
      .select('*, record_attempts(*)')
      .eq('id', participantId)
      .single()

    if (!participant) throw new AppError(404, 'NOT_FOUND', 'Participant not found')

    // Get participant number
    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', participant.attempt_id)
      .lte('joined_at', participant.joined_at)

    // Get total count
    const { count: totalCount } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', participant.attempt_id)

    return {
      ok: true,
      data: {
        participant,
        attempt: participant.record_attempts,
        participantNumber: count ?? 1,
        totalParticipants: totalCount ?? 0,
      },
    }
  })

  // ─── Send certificates (admin trigger) ────────────────────────────
  app.post('/record/send-certificates', async (request) => {
    const body = request.body as { attemptId: string }
    if (!body.attemptId) throw new AppError(400, 'MISSING', 'attemptId required')

    const { data: participants } = await supabase
      .from('record_participants')
      .select('id, email, participant_name')
      .eq('attempt_id', body.attemptId)
      .eq('certificate_sent', false)

    // Mark as sent (actual email sending would be handled by worker/external service)
    for (const p of participants ?? []) {
      await supabase.from('record_participants')
        .update({ certificate_sent: true })
        .eq('id', p.id)
    }

    return { ok: true, data: { sent: participants?.length ?? 0 } }
  })

  // ─── Export evidence (admin) ──────────────────────────────────────
  app.get('/record/evidence/:attemptId', async (request) => {
    const { attemptId } = request.params as { attemptId: string }

    const { data: evidence } = await supabase
      .from('record_evidence')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('recorded_at')

    const { data: participants } = await supabase
      .from('record_participants')
      .select('id, participant_name, email, joined_at, ip_address, user_agent')
      .eq('attempt_id', attemptId)
      .order('joined_at')

    return { ok: true, data: { evidence: evidence ?? [], participants: participants ?? [] } }
  })
}
