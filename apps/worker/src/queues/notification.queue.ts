import { Queue } from 'bullmq'
import { redis } from '../lib/redis'
import type { NotifType } from '@serendipeatery/shared'

// ─── Job Data Shape ───────────────────────────────────────────────────────

export interface NotificationJobData {
  type: NotifType
  userId: string
  saleId: string
  businessId: string
  payload: Record<string, string | number>
  scheduleAt?: string // ISO string for delayed jobs
}

// ─── Queue ────────────────────────────────────────────────────────────────

export const notificationQueue = new Queue<NotificationJobData>('notifications', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
})

/**
 * Enqueue a notification job. If scheduleAt is provided, the job is delayed.
 */
export async function enqueueNotification(data: NotificationJobData): Promise<string> {
  const opts: Record<string, unknown> = {}

  if (data.scheduleAt) {
    const delay = new Date(data.scheduleAt).getTime() - Date.now()
    if (delay > 0) opts.delay = delay
  }

  const job = await notificationQueue.add(data.type, data, opts)
  return job.id ?? ''
}

/**
 * Enqueue notifications for multiple users (e.g. sale_live broadcast).
 */
export async function enqueueBulk(
  type: NotifType,
  userIds: string[],
  saleId: string,
  businessId: string,
  payload: Record<string, string | number> = {},
): Promise<number> {
  const jobs = userIds.map((userId) => ({
    name: type,
    data: { type, userId, saleId, businessId, payload },
  }))

  await notificationQueue.addBulk(jobs)
  return jobs.length
}
