import { describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/shared/kernel/errors/domain-error'

type Outcome = { ok: true; value: unknown } | { ok: false; error: unknown }

function isDenied(outcome: Outcome): boolean {
  if (!outcome.ok) return outcome.error instanceof ForbiddenError
  const { value } = outcome
  return value === null || (Array.isArray(value) && value.length === 0)
}

/**
 * The membership proof for one context (§11). Every function `api` exports
 * must be listed as a command or given a query case. Each case calls its
 * query as a non-member and must get `ForbiddenError`, an empty list or null.
 * A query exported without a case fails the test.
 */
export function describeMembershipProof(
  context: string,
  api: Record<string, unknown>,
  proof: {
    commands: readonly string[]
    queries: Record<string, () => Promise<Outcome>>
    /** Queries that take no actor, with why. */
    exempt?: Record<string, string>
  }
) {
  describe(`${context} membership proof`, () => {
    it('has a case for every exported query', () => {
      const exported = Object.entries(api)
        .filter(([, value]) => typeof value === 'function')
        // Error classes are exported too; use cases aren't classes.
        .filter(([, value]) => !/^class\s/.test(String(value)))
        .map(([name]) => name)
        .sort()
      const covered = [
        ...proof.commands,
        ...Object.keys(proof.queries),
        ...Object.keys(proof.exempt ?? {}),
      ].sort()

      expect(covered).toEqual(exported)
    })

    for (const [name, call] of Object.entries(proof.queries)) {
      it(`${name} shows a non-member nothing`, async () => {
        expect(isDenied(await call())).toBe(true)
      })
    }
  })
}
