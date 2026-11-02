import { createHash, randomBytes } from 'node:crypto'

import type { ITokenGenerator } from '@/modules/identity/application/ports/token-generator.port'
import type { TokenHash } from '@/modules/identity/domain/session/session'

/** Hex SHA-256 of a token: the only form of it that is stored. */
export function sha256(token: string): TokenHash {
  return createHash('sha256').update(token).digest('hex') as TokenHash
}

/** 256-bit random tokens, base64url (ADR 0009). */
export class TokenGenerator implements ITokenGenerator {
  generate(): { token: string; hash: TokenHash } {
    const token = randomBytes(32).toString('base64url')
    return { token, hash: sha256(token) }
  }

  hash(token: string): TokenHash {
    return sha256(token)
  }
}
