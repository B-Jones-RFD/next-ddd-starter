import type { UserDto } from '@/modules/identity/application/dto/user.dto'
import type {
  IUserReader,
  SignedIn,
} from '@/modules/identity/application/ports/user-reader.port'
import {
  isSessionActive,
  type TokenHash,
} from '@/modules/identity/domain/session/session'
import { mockSessions } from '@/modules/identity/infrastructure/session-repository.mock'
import { mockUsers } from '@/modules/identity/infrastructure/user-repository.mock'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

/** In-memory twin of `UserReader`, over the identity repositories' stores. */
export class MockUserReader implements IUserReader {
  async findSignedIn(
    tokenHash: TokenHash,
    now: Date
  ): Promise<SignedIn | null> {
    const session = [...mockSessions().values()].find(
      (s) => s.tokenHash === tokenHash
    )
    if (!session || !isSessionActive(session, now)) return null
    const user = mockUsers().get(session.userId)
    if (!user) return null
    return {
      actor: { userId: user.id, displayName: user.displayName },
      sessionId: session.id,
      lastSeenAt: session.lastSeenAt.toISOString(),
    }
  }

  async findByEmail(
    actorId: UserId,
    email: string
  ): Promise<Result<UserDto, ForbiddenError | NotFoundError>> {
    const users = mockUsers()
    if (!users.has(actorId)) return err(new ForbiddenError())
    const user = [...users.values()].find((u) => u.email === email)
    if (!user) return err(new NotFoundError('User', 'by-email'))
    return ok({
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
    })
  }
}
