import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  error: FastifyError | AppError,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      ok: false,
      error: error.message,
      code: error.code,
    })
  }

  // Zod validation errors (from our validate middleware)
  if (error.statusCode === 400 && error.code === 'VALIDATION_ERROR') {
    return reply.code(400).send({
      ok: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
    })
  }

  // Fastify built-in validation errors
  if (error.validation) {
    return reply.code(400).send({
      ok: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
    })
  }

  // Unexpected errors
  reply.log.error(error)
  return reply.code(500).send({
    ok: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  })
}
