import { createHash, randomBytes } from 'node:crypto'

import type { IPasswordHasher } from '@/modules/identity/application/ports/password-hasher.port'
import type { Password } from '@/modules/identity/domain/user/password'
import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'

function digest(salt: string, password: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('base64url')
}

/**
 * A cheap salted SHA-256, so tests and seeded users sign in instantly. Never
 * used outside mock mode.
 */
export class MockPasswordHasher implements IPasswordHasher {
  async hash(password: Password): Promise<PasswordHash> {
    const salt = randomBytes(8).toString('base64url')
    return `mock$${salt}$${digest(salt, password)}` as PasswordHash
  }

  async verify(password: Password, hash: PasswordHash): Promise<boolean> {
    const [algorithm, salt, expected] = hash.split('$')
    if (algorithm !== 'mock' || salt === undefined) return false
    return digest(salt, password) === expected
  }
}
