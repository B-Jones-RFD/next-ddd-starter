import type { ITokenGenerator } from '@/modules/identity/application/ports/token-generator.port'
import type { TokenHash } from '@/modules/identity/domain/session/session'
import { sha256 } from '@/modules/identity/infrastructure/token-generator'
import { mockStore } from '@/shared/infrastructure/mock-stores'

/** Predictable tokens (`token-1`, `token-2`, …), hashed like the real ones. */
export class MockTokenGenerator implements ITokenGenerator {
  generate(): { token: string; hash: TokenHash } {
    const store = mockStore('identity.tokens', () => ({ counter: 0 }))
    store.counter += 1
    const token = `token-${store.counter}`
    return { token, hash: sha256(token) }
  }

  hash(token: string): TokenHash {
    return sha256(token)
  }
}
