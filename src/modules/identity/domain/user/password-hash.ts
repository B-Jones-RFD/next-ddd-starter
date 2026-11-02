import type { Brand } from '@/shared/kernel/brand'
import { ValidationError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'

/**
 * A stored password hash, prefixed with its algorithm and parameters
 * (`scrypt$N$r$p$salt$hash`), so stronger parameters can rehash it later.
 */
export type PasswordHash = Brand<string, 'PasswordHash'>

const SHAPE = /^[a-z0-9]+\$\S+$/

export function parsePasswordHash(
  raw: string
): Result<PasswordHash, ValidationError> {
  if (!SHAPE.test(raw)) {
    return err(new ValidationError({ passwordHash: 'invalid' }))
  }
  return ok(raw as PasswordHash)
}
