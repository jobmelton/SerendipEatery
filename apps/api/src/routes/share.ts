import { FastifyInstance } from 'fastify'
import { AppError } from '../lib/errors'
import { AuthenticatedRequest } from '../middleware/auth'
import { generateWinCard, generateSaleCard, generateProfileCard } from '../lib/sharecard'

export async function shareRoutes(app: FastifyInstance) {
  // GET /share/win/:visitIntentId — generate win share card
  app.get('/share/win/:visitIntentId', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { visitIntentId } = request.params as { visitIntentId: string }

    const url = await generateWinCard(userId, '', visitIntentId)
    return { ok: true, data: { imageUrl: url } }
  })

  // GET /share/sale/:saleId — generate sale promo card
  app.get('/share/sale/:saleId', async (request) => {
    const { saleId } = request.params as { saleId: string }

    const url = await generateSaleCard(saleId)
    return { ok: true, data: { imageUrl: url } }
  })

  // GET /share/profile/:userId — generate user stats card
  app.get('/share/profile/:userId', async (request) => {
    const { userId: requesterId } = (request as AuthenticatedRequest).auth
    const { userId } = request.params as { userId: string }

    // Users can only generate their own profile card
    if (requesterId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only generate your own profile card')
    }

    const url = await generateProfileCard(userId)
    return { ok: true, data: { imageUrl: url } }
  })
}
