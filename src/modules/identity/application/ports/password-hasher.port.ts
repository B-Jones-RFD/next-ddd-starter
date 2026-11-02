import type { Password } from '@/modules/identity/domain/user/password'
import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'

// #region port
/** Hashes and checks passwords. Throws `InfrastructureError` on an outage. */
export interface IPasswordHasher {
  /** A salted hash; hashing the same password twice gives different hashes. */
  hash(password: Password): Promise<PasswordHash>
  /** Whether `password` is the one `hash` was made from. */
  verify(password: Password, hash: PasswordHash): Promise<boolean>
  /**
   * Whether `hash` was made with another algorithm or older parameters, so a
   * sign-in that verified it should store a fresh hash (ADR 0009).
   */
  needsRehash(hash: PasswordHash): boolean
}
// #endregion port
