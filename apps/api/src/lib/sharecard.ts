import { createCanvas, CanvasRenderingContext2D } from 'canvas'
import { supabase } from './supabase'
import { AppError } from './errors'

// ─── Brand Constants ──────────────────────────────────────────────────────

const BRAND = {
  orange: '#F7941D',
  night: '#0f0a1e',
  surface: '#fff8f2',
  surfaceDim: '#1a1230',
  success: '#1D9E75',
  accent: '#534AB7',
}

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1080

// ─── Canvas Helpers ───────────────────────────────────────────────────────

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT)
  grad.addColorStop(0, BRAND.night)
  grad.addColorStop(1, '#1a0f30')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // Decorative accent circle
  ctx.beginPath()
  ctx.arc(CARD_WIDTH * 0.85, CARD_HEIGHT * 0.15, 180, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(247, 148, 29, 0.08)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(CARD_WIDTH * 0.15, CARD_HEIGHT * 0.85, 140, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(83, 74, 183, 0.08)'
  ctx.fill()
}

function drawBranding(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BRAND.orange
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText('SerendipEatery', 60, CARD_HEIGHT - 50)

  ctx.fillStyle = 'rgba(255, 248, 242, 0.4)'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('serendip.app', CARD_WIDTH - 60, CARD_HEIGHT - 50)
  ctx.textAlign = 'left'
}

// ─── Upload to Supabase Storage ───────────────────────────────────────────

async function uploadCard(buffer: Buffer, path: string): Promise<string> {
  const { error: uploadErr } = await supabase.storage
    .from('share-cards')
    .upload(path, buffer, {
      contentType: 'image/png',
      upsert: true,
    })

  if (uploadErr) {
    throw new AppError(500, 'UPLOAD_FAILED', `Failed to upload share card: ${uploadErr.message}`)
  }

  const { data } = supabase.storage
    .from('share-cards')
    .getPublicUrl(path)

  return data.publicUrl
}

// ─── Win Card ─────────────────────────────────────────────────────────────

export async function generateWinCard(
  userId: string,
  prizeId: string,
  visitIntentId: string,
): Promise<string> {
  // Fetch data
  const { data: intent } = await supabase
    .from('visit_intents')
    .select('prize_won, prize_code, flash_sales(businesses(name, cuisine))')
    .eq('id', visitIntentId)
    .single()

  if (!intent) throw new AppError(404, 'INTENT_NOT_FOUND', 'Visit intent not found')

  const { data: user } = await supabase
    .from('users')
    .select('display_name, consumer_tier')
    .eq('id', userId)
    .single()

  const bizName = (intent as any).flash_sales?.businesses?.name ?? 'a restaurant'
  const cuisine = (intent as any).flash_sales?.businesses?.cuisine ?? ''
  const prizeName = intent.prize_won ?? 'a prize'
  const displayName = user?.display_name ?? 'Someone'
  const tier = user?.consumer_tier ?? 'explorer'

  // Generate canvas
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')

  drawBackground(ctx)

  // "I WON!" header
  ctx.fillStyle = BRAND.orange
  ctx.font = 'bold 72px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('I WON! 🎉', CARD_WIDTH / 2, 200)

  // Prize name
  ctx.fillStyle = BRAND.surface
  ctx.font = 'bold 56px sans-serif'
  ctx.fillText(prizeName, CARD_WIDTH / 2, 320)

  // Business info
  ctx.fillStyle = 'rgba(255, 248, 242, 0.7)'
  ctx.font = '36px sans-serif'
  ctx.fillText(`at ${bizName}`, CARD_WIDTH / 2, 400)

  if (cuisine) {
    ctx.fillStyle = 'rgba(255, 248, 242, 0.4)'
    ctx.font = '28px sans-serif'
    ctx.fillText(cuisine, CARD_WIDTH / 2, 450)
  }

  // Decorative divider
  ctx.strokeStyle = BRAND.orange
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(CARD_WIDTH * 0.3, 510)
  ctx.lineTo(CARD_WIDTH * 0.7, 510)
  ctx.stroke()

  // User info
  ctx.fillStyle = BRAND.surface
  ctx.font = 'bold 40px sans-serif'
  ctx.fillText(displayName, CARD_WIDTH / 2, 590)

  // Tier badge
  roundedRect(ctx, CARD_WIDTH / 2 - 100, 620, 200, 44, 22)
  ctx.fillStyle = BRAND.accent
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(tier.replace(/_/g, ' ').toUpperCase(), CARD_WIDTH / 2, 649)

  // CTA
  ctx.fillStyle = 'rgba(255, 248, 242, 0.5)'
  ctx.font = '28px sans-serif'
  ctx.fillText('Spin your next meal on SerendipEatery', CARD_WIDTH / 2, 780)

  ctx.textAlign = 'left'
  drawBranding(ctx)

  // Upload
  const buffer = canvas.toBuffer('image/png')
  const path = `wins/${visitIntentId}.png`
  return uploadCard(buffer, path)
}

// ─── Sale Promo Card ──────────────────────────────────────────────────────

export async function generateSaleCard(saleId: string): Promise<string> {
  const { data: sale } = await supabase
    .from('flash_sales')
    .select('*, businesses(name, cuisine, type), prizes(*)')
    .eq('id', saleId)
    .single()

  if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found')

  const bizName = (sale as any).businesses?.name ?? 'Restaurant'
  const cuisine = (sale as any).businesses?.cuisine ?? ''
  const bizType = (sale as any).businesses?.type ?? 'restaurant'
  const prizeCount = sale.prizes?.length ?? 0
  const topPrize = sale.prizes?.[0]?.name ?? 'Amazing deals'
  const spinsLeft = sale.max_spins_total - sale.spins_used

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')

  drawBackground(ctx)

  // "FLASH SALE" header
  ctx.textAlign = 'center'
  ctx.fillStyle = BRAND.orange
  ctx.font = 'bold 48px sans-serif'
  ctx.fillText('⚡ FLASH SALE ⚡', CARD_WIDTH / 2, 180)

  // Business name
  ctx.fillStyle = BRAND.surface
  ctx.font = 'bold 64px sans-serif'
  ctx.fillText(bizName, CARD_WIDTH / 2, 300)

  // Cuisine + type
  ctx.fillStyle = 'rgba(255, 248, 242, 0.6)'
  ctx.font = '32px sans-serif'
  ctx.fillText(`${cuisine} • ${bizType}`, CARD_WIDTH / 2, 360)

  // Top prize highlight
  roundedRect(ctx, 120, 420, CARD_WIDTH - 240, 120, 24)
  ctx.fillStyle = BRAND.surfaceDim
  ctx.fill()

  ctx.fillStyle = BRAND.orange
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText(`Win: ${topPrize}`, CARD_WIDTH / 2, 495)

  // Stats
  ctx.fillStyle = BRAND.surface
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText(`${prizeCount} prizes • ${spinsLeft} spins left`, CARD_WIDTH / 2, 640)

  // Time
  const startsAt = new Date(sale.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const endsAt = new Date(sale.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  ctx.fillStyle = 'rgba(255, 248, 242, 0.5)'
  ctx.font = '28px sans-serif'
  ctx.fillText(`${startsAt} — ${endsAt}`, CARD_WIDTH / 2, 710)

  // CTA
  roundedRect(ctx, CARD_WIDTH / 2 - 200, 780, 400, 64, 32)
  ctx.fillStyle = BRAND.orange
  ctx.fill()
  ctx.fillStyle = BRAND.night
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText('Spin Now on SerendipEatery', CARD_WIDTH / 2, 820)

  ctx.textAlign = 'left'
  drawBranding(ctx)

  const buffer = canvas.toBuffer('image/png')
  const path = `sales/${saleId}.png`
  return uploadCard(buffer, path)
}

// ─── Profile Stats Card ──────────────────────────────────────────────────

export async function generateProfileCard(userId: string): Promise<string> {
  const { data: user } = await supabase
    .from('users')
    .select('display_name, points, consumer_tier, streak_days')
    .eq('id', userId)
    .single()

  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

  const { count: totalVisits } = await supabase
    .from('visit_intents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('state', 'confirmed')

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')

  drawBackground(ctx)

  ctx.textAlign = 'center'

  // Avatar circle
  ctx.beginPath()
  ctx.arc(CARD_WIDTH / 2, 200, 70, 0, Math.PI * 2)
  ctx.fillStyle = BRAND.orange
  ctx.fill()
  ctx.fillStyle = BRAND.night
  ctx.font = 'bold 52px sans-serif'
  ctx.fillText((user.display_name?.[0] ?? 'S').toUpperCase(), CARD_WIDTH / 2, 218)

  // Name
  ctx.fillStyle = BRAND.surface
  ctx.font = 'bold 48px sans-serif'
  ctx.fillText(user.display_name ?? 'Explorer', CARD_WIDTH / 2, 340)

  // Tier badge
  const tierLabel = (user.consumer_tier ?? 'explorer').replace(/_/g, ' ').toUpperCase()
  roundedRect(ctx, CARD_WIDTH / 2 - 120, 365, 240, 44, 22)
  ctx.fillStyle = BRAND.accent
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(tierLabel, CARD_WIDTH / 2, 394)

  // Stats boxes
  const stats = [
    { label: 'Points', value: (user.points ?? 0).toLocaleString() },
    { label: 'Visits', value: String(totalVisits ?? 0) },
    { label: 'Streak', value: `${user.streak_days ?? 0}d` },
  ]

  const boxW = 240
  const boxH = 140
  const gap = 40
  const totalW = stats.length * boxW + (stats.length - 1) * gap
  const startX = (CARD_WIDTH - totalW) / 2

  stats.forEach((stat, i) => {
    const x = startX + i * (boxW + gap)
    const y = 480
    roundedRect(ctx, x, y, boxW, boxH, 20)
    ctx.fillStyle = BRAND.surfaceDim
    ctx.fill()

    ctx.fillStyle = BRAND.orange
    ctx.font = 'bold 44px sans-serif'
    ctx.fillText(stat.value, x + boxW / 2, y + 65)

    ctx.fillStyle = 'rgba(255, 248, 242, 0.5)'
    ctx.font = '24px sans-serif'
    ctx.fillText(stat.label, x + boxW / 2, y + 105)
  })

  // CTA
  ctx.fillStyle = 'rgba(255, 248, 242, 0.5)'
  ctx.font = '28px sans-serif'
  ctx.fillText('Join me on SerendipEatery!', CARD_WIDTH / 2, 750)

  ctx.textAlign = 'left'
  drawBranding(ctx)

  const buffer = canvas.toBuffer('image/png')
  const path = `profiles/${userId}.png`
  return uploadCard(buffer, path)
}
