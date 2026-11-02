import type { DisplayName } from '@/modules/identity/domain/user/display-name'
import type { Email } from '@/modules/identity/domain/user/email'
import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'
import type { User } from '@/modules/identity/domain/user/user'
import { toUserId } from '@/shared/kernel/user-id'

let sequence = 0

/** Parsed registration values, for domain tests. */
export function aRegistration(
  overrides: { displayName?: string; email?: string } = {}
) {
  sequence += 1
  return {
    displayName: (overrides.displayName ?? `User ${sequence}`) as DisplayName,
    email: (overrides.email ?? `user${sequence}@example.com`) as Email,
    passwordHash: `mock$hash-${sequence}` as PasswordHash,
  }
}

/** A stored user, for repository contract suites. */
export function aUser(overrides: Partial<User> = {}): User {
  sequence += 1
  return {
    id: toUserId(`user-${sequence}`),
    ...aRegistration(),
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    version: 0,
    ...overrides,
  }
}

/** Sign-up input that passes every rule. */
export function aSignUp(
  overrides: { displayName?: string; email?: string; password?: string } = {}
) {
  sequence += 1
  return {
    displayName: `User ${sequence}`,
    email: `user${sequence}@example.com`,
    password: 'correct horse',
    ...overrides,
  }
}
