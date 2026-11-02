import { describe, expect, it } from 'vitest'

import type { ITokenGenerator } from '@/modules/identity/application/ports/token-generator.port'

/** What every `ITokenGenerator` adapter must do. */
export function describeTokenGeneratorContract(make: () => ITokenGenerator) {
  describe('ITokenGenerator contract', () => {
    it('mints a different token every time', () => {
      const tokens = make()

      const minted = new Set(
        Array.from({ length: 20 }, () => tokens.generate().token)
      )

      expect(minted.size).toBe(20)
    })

    it('stores a hash that is not the token, and hashes a presented token to it', () => {
      const tokens = make()

      const { token, hash } = tokens.generate()

      expect(hash).not.toBe(token)
      expect(tokens.hash(token)).toBe(hash)
      expect(tokens.hash(`${token}x`)).not.toBe(hash)
    })
  })
}
