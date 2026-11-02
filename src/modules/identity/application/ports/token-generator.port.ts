import type { TokenHash } from '@/modules/identity/domain/session/session'

/** Mints session cookie tokens and hashes them for storage (ADR 0009). */
export interface ITokenGenerator {
  /** A fresh opaque token and the hash to store in its place. */
  generate(): { token: string; hash: TokenHash }
  /** The hash of a presented token, to look its session up by. */
  hash(token: string): TokenHash
}
