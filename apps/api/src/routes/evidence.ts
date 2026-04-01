import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { getEvidenceProgress, checkEvidenceThresholds } from '../lib/evidence.js'
import { checkPaywallStatus } from '../lib/paywall.js'

export async function evidenceRoutes(app: FastifyInstance) {
  // GET /evidence/progress — business's evidence progress
  app.get('/evidence/progress', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .single()

    if (!biz) throw new AppError(404, 'BIZ_NOT_FOUND', 'No business found')

    // Check thresholds (this also updates the DB score and may trigger paywall)
    const progress = await checkEvidenceThresholds(biz.id)

    return { ok: true, data: progress }
  })

  // GET /evidence/paywall-status — current paywall state
  app.get('/evidence/paywall-status', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .single()

    if (!biz) throw new AppError(404, 'BIZ_NOT_FOUND', 'No business found')

    const status = await checkPaywallStatus(biz.id)

    return { ok: true, data: status }
  })
}
