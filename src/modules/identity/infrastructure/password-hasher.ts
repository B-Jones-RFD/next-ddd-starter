import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto'

import type { IPasswordHasher } from '@/modules/identity/application/ports/password-hasher.port'
import type { Password } from '@/modules/identity/domain/user/password'
import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'
import { ExternalServiceError } from '@/shared/kernel/errors/infrastructure-error'

const PORT = 'IPasswordHasher'

type Params = { N: number; r: number; p: number }

/** N=2¹⁷, r=8, p=1, a 16-byte salt and a 32-byte key (ADR 0009). */
const PARAMS: Params = { N: 2 ** 17, r: 8, p: 1 }
const SALT_BYTES = 16
const KEY_BYTES = 32

// #region derive
function derive(
  password: string,
  salt: Buffer,
  params: Params
): Promise<Buffer> {
  const options: ScryptOptions = {
    ...params,
    // scrypt needs 128 · N · r bytes, above Node's 32 MiB default at N=2¹⁷.
    maxmem: 256 * params.N * params.r,
  }
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, options, (error, key) => {
      if (error) {
        reject(
          new ExternalServiceError(PORT, { retryable: false, cause: error })
        )
      } else {
        resolve(key)
      }
    })
  })
}
// #endregion derive

/**
 * scrypt hashes stored as `scrypt$N$r$p$salt$hash` (base64url). It hashes
 * with `params`, the app's (ADR 0009) unless an older or newer setting is
 * given, and verifies a hash with the parameters stored in it.
 */
export class PasswordHasher implements IPasswordHasher {
  constructor(private readonly params: Params = PARAMS) {}

  async hash(password: Password): Promise<PasswordHash> {
    const salt = randomBytes(SALT_BYTES)
    const key = await derive(password, salt, this.params)
    return [
      'scrypt',
      this.params.N,
      this.params.r,
      this.params.p,
      salt.toString('base64url'),
      key.toString('base64url'),
    ].join('$') as PasswordHash
  }

  async verify(password: Password, hash: PasswordHash): Promise<boolean> {
    const [algorithm, n, r, p, salt, expected] = hash.split('$')
    if (algorithm !== 'scrypt' || !salt || !expected) return false
    const key = await derive(password, Buffer.from(salt, 'base64url'), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    })
    const stored = Buffer.from(expected, 'base64url')
    return stored.length === key.length && timingSafeEqual(stored, key)
  }

  /** Another algorithm, or any parameter weaker than the ones it hashes with. */
  needsRehash(hash: PasswordHash): boolean {
    const [algorithm, n, r, p] = hash.split('$')
    // A missing or garbled number compares false, so `!(… >= …)` catches it.
    return (
      algorithm !== 'scrypt' ||
      !(Number(n) >= this.params.N) ||
      !(Number(r) >= this.params.r) ||
      !(Number(p) >= this.params.p)
    )
  }
}
