import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validate } from '../lib/validate'
import { AuthenticatedRequest } from '../middleware/auth'
import { executeSpin } from '../lib/spin'

const spinSchema = z.object({
  saleId: z.string().uuid(),
  spinLat: z.number().min(-90).max(90),
  spinLng: z.number().min(-180).max(180),
})

export async function spinRoutes(app: FastifyInstance) {
  // POST /spin — execute a spin (server decides winner before animation)
  app.post('/spin', {
    preHandler: validate(spinSchema),
  }, async (request) => {
    const { userId } = request as AuthenticatedRequest
    const { saleId, spinLat, spinLng } = request.body as z.infer<typeof spinSchema>

    const { result, animationSeed, updatedPrizeCounts } = await executeSpin({
      userId,
      saleId,
      spinLat,
      spinLng,
    })

    return {
      ok: true,
      data: {
        ...result,
        animationSeed,
        updatedPrizeCounts,
      },
    }
  })
}
