import { FastifyInstance } from 'fastify'
import { AppError } from '../lib/errors.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { getWinCardData, getSaleCardData, getProfileCardData } from '../lib/sharecard.js'

export async function shareRoutes(app: FastifyInstance) {
  // GET /share/win/:visitIntentId — win share card data
  app.get('/share/win/:visitIntentId', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { visitIntentId } = request.params as { visitIntentId: string }

    const card = await getWinCardData(userId, visitIntentId)
    return { ok: true, data: card }
  })

  // GET /share/sale/:saleId — sale promo card data
  app.get('/share/sale/:saleId', async (request) => {
    const { saleId } = request.params as { saleId: string }

    const card = await getSaleCardData(saleId)
    return { ok: true, data: card }
  })

  // GET /share/profile/:userId — user stats card data
  app.get('/share/profile/:userId', async (request) => {
    const { userId: requesterId } = (request as AuthenticatedRequest).auth
    const { userId } = request.params as { userId: string }

    if (requesterId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only generate your own profile card')
    }

    const card = await getProfileCardData(userId)
    return { ok: true, data: card }
  })
}
