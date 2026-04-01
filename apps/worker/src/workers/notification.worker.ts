import { Worker, Job } from 'bullmq'
import { redis } from '../lib/redis.js'
import { supabase } from '../lib/supabase.js'
import { sendPush } from '../lib/push.js'
import { checkRules, recordSent } from '../lib/rules.js'
import type { NotificationJobData } from '../queues/notification.queue.js'

// ─── Message Templates ────────────────────────────────────────────────────

function buildMessage(data: NotificationJobData): { title: string; body: string } {
  const p = data.payload

  switch (data.type) {
    case 'sale_live':
      return {
        title: `${p.businessName ?? 'A restaurant'} just launched a flash sale!`,
        body: `${p.prizeCount ?? ''} prizes available. Spin now before they're gone!`,
      }

    case 'ending_soon':
      return {
        title: `Sale ending in 15 minutes!`,
        body: `${p.businessName ?? 'A nearby sale'} — ${p.spinsLeft ?? 'a few'} spins left. Don't miss out!`,
      }

    case 'you_won':
      return {
        title: `You won ${p.prizeName ?? 'a prize'}!`,
        body: `Show code ${p.prizeCode ?? ''} at ${p.businessName ?? 'the restaurant'}. You have 60 min to arrive.`,
      }

    case 'winner_reminder':
      return {
        title: `Don't forget your prize!`,
        body: `You have 30 minutes left to claim ${p.prizeName ?? 'your prize'} at ${p.businessName ?? 'the restaurant'}.`,
      }

    case 'visit_confirmed':
      return {
        title: `Visit confirmed!`,
        body: `+${p.pointsEarned ?? 50} points earned at ${p.businessName ?? 'the restaurant'}. Keep exploring!`,
      }

    case 'truck_moved':
      return {
        title: `${p.businessName ?? 'A food truck'} moved!`,
        body: `New location updated. Check the app for the latest spot.`,
      }

    case 'new_sale_nearby':
      return {
        title: `New sale near you!`,
        body: `${p.businessName ?? 'A restaurant'} just posted a flash sale ${p.distance ?? 'nearby'}. Spin for prizes!`,
      }

    default:
      return {
        title: 'SerendipEatery',
        body: 'You have a new notification.',
      }
  }
}

// ─── Worker Processor ─────────────────────────────────────────────────────

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const data = job.data
  const { userId, type, saleId } = data

  console.log(`[notif] Processing ${type} for user ${userId}, sale ${saleId}`)

  // 1. Fetch user's push token and timezone
  const { data: user, error } = await supabase
    .from('users')
    .select('id, expo_push_token, timezone_offset')
    .eq('id', userId)
    .single()

  if (error || !user) {
    console.log(`[notif] User ${userId} not found, skipping`)
    return
  }

  // 2. Run rules engine
  const ruleResult = await checkRules({
    userId,
    notifType: type,
    saleId,
    pushToken: user.expo_push_token,
    userTimezoneOffset: user.timezone_offset ?? 0,
  })

  if (!ruleResult.allowed) {
    console.log(`[notif] Blocked: ${ruleResult.reason} for ${userId}/${type}`)
    return
  }

  // 3. Build message
  const { title, body } = buildMessage(data)

  // 4. Send push
  const sent = await sendPush({
    token: user.expo_push_token,
    title,
    body,
    data: {
      type,
      saleId,
      businessId: data.businessId,
    },
  })

  if (!sent) {
    console.log(`[notif] Push failed for ${userId}/${type}`)
    throw new Error(`Push delivery failed for ${userId}`)
  }

  // 5. Record sent (dedup, daily count, last sent)
  await recordSent(userId, type, saleId)

  // 6. Log to notifications table
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    sale_id: saleId,
    business_id: data.businessId,
    title,
    body,
    sent_at: new Date().toISOString(),
  })

  console.log(`[notif] Sent ${type} to ${userId}`)
}

// ─── Create Worker ────────────────────────────────────────────────────────

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    'notifications',
    processNotification,
    {
      connection: redis,
      concurrency: 10,
      limiter: {
        max: 50,
        duration: 1000, // 50 jobs per second
      },
    },
  )

  worker.on('completed', (job) => {
    console.log(`[notif] Job ${job.id} completed (${job.name})`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[notif] Job ${job?.id} failed (${job?.name}):`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[notif] Worker error:', err)
  })

  return worker
}
