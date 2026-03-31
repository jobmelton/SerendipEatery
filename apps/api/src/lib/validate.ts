import { z, ZodSchema } from 'zod'
import { FastifyRequest, FastifyReply } from 'fastify'

export function validate<T extends ZodSchema>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.body = schema.parse(request.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
        return reply.code(400).send({
          ok: false,
          error: message,
          code: 'VALIDATION_ERROR',
        })
      }
      throw err
    }
  }
}

export function validateQuery<T extends ZodSchema>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.query = schema.parse(request.query) as any
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
        return reply.code(400).send({
          ok: false,
          error: message,
          code: 'VALIDATION_ERROR',
        })
      }
      throw err
    }
  }
}
