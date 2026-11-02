import type { Password } from '@/modules/identity/domain/user/password'
import type { PasswordHash } from '@/modules/identity/domain/user/password-hash'

/** Hashes and checks passwords. Throws `InfrastructureError` on an outage. */
export interface IPasswordHasher {
  /** A salted hash; hashing the same password twice gives different hashes. */
  hash(password: Password): Promise<PasswordHash>
  /** Whether `password` is the one `hash` was made from. */
  verify(password: Password, hash: PasswordHash): Promise<boolean>
}
