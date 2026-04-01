import '@fastify/jwt'
import 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    adminOnly:    (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    adminStrict:  (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }

  interface FastifyRequest {
    user: JWTPayload
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
    user:    JWTPayload
  }
}

export interface JWTPayload {
  id:   string
  role: 'USER' | 'ADMIN' | 'EDITOR' | 'INVESTOR'
  iat?: number
  exp?: number
}
