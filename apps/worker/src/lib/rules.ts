import { redis } from './redis.js'

// ─── Constants ────────────────────────────────────────────────────────────

const DEDUP_TTL_S = 24 * 60 * 60           // 24 hours
const DAILY_CAP = 3                          // max notifications per user per day
const QUIET_START_HOUR = 22                  // 10pm
const QUIET_END_HOUR = 8                     // 8am
const MIN_GAP_MS = 30 * 60 * 1000           // 30 minutes between notifications

// ─── Redis Key Helpers ────────────────────────────────────────────────────

function dedupKey(userId: string, notifType: string, saleId: string): string {
  return `notif:dedup:${userId}:${notifType}:${saleId}`
}

function dailyCountKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return `notif:daily:${userId}:${today}`
}

function lastSentKey(userId: string): string {
  return `notif:last:${userId}`
}

// ─── Rules Engine ─────────────────────────────────────────────────────────

export interface RuleCheckInput {
  userId: string
  notifType: string
  saleId: string
  pushToken: string | null
  userTimezoneOffset?: number // minutes offset from UTC (e.g. -300 for EST)
}

export interface RuleCheckResult {
  allowed: boolean
  reason: string | null
}

/**
 * Before sending any notification, check all rules:
 * 1. Valid Expo push token exists
 * 2. Dedup — don't send same notification type+sale twice in 24h
 * 3. Daily cap — max 3 per user per day
 * 4. Quiet hours — no notifications 10pm–8am user local time
 * 5. Minimum gap — at least 30min between any two notifications
 */
export async function checkRules(input: RuleCheckInput): Promise<RuleCheckResult> {
  const { userId, notifType, saleId, pushToken, userTimezoneOffset } = input

  // 1. Valid push token
  if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
    return { allowed: false, reason: 'NO_PUSH_TOKEN' }
  }

  // 2. Dedup check (24h TTL)
  const dKey = dedupKey(userId, notifType, saleId)
  const exists = await redis.exists(dKey)
  if (exists) {
    return { allowed: false, reason: 'DUPLICATE' }
  }

  // 3. Daily cap
  const dcKey = dailyCountKey(userId)
  const dailyCount = await redis.get(dcKey)
  if (dailyCount && Number(dailyCount) >= DAILY_CAP) {
    return { allowed: false, reason: 'DAILY_CAP_REACHED' }
  }

  // 4. Quiet hours
  const now = new Date()
  const offsetMin = userTimezoneOffset ?? 0
  const userHour = (now.getUTCHours() + Math.floor(offsetMin / 60) + 24) % 24
  if (userHour >= QUIET_START_HOUR || userHour < QUIET_END_HOUR) {
    return { allowed: false, reason: 'QUIET_HOURS' }
  }

  // 5. Minimum gap (30min)
  const lsKey = lastSentKey(userId)
  const lastSent = await redis.get(lsKey)
  if (lastSent) {
    const elapsed = now.getTime() - Number(lastSent)
    if (elapsed < MIN_GAP_MS) {
      return { allowed: false, reason: 'TOO_FREQUENT' }
    }
  }

  return { allowed: true, reason: null }
}

/**
 * Record that a notification was sent — updates dedup, daily count, and last sent.
 */
export async function recordSent(
  userId: string,
  notifType: string,
  saleId: string,
): Promise<void> {
  const pipeline = redis.pipeline()

  // Dedup: mark this combo as sent for 24h
  pipeline.set(dedupKey(userId, notifType, saleId), '1', 'EX', DEDUP_TTL_S)

  // Daily count: increment with TTL until end of day
  const dcKey = dailyCountKey(userId)
  pipeline.incr(dcKey)
  pipeline.expire(dcKey, DEDUP_TTL_S) // expires in 24h at most

  // Last sent timestamp
  pipeline.set(lastSentKey(userId), String(Date.now()), 'EX', DEDUP_TTL_S)

  await pipeline.exec()
}
