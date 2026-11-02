import type { IBoardReader } from '@/modules/boards/application/ports/board-reader.port'
import type { IPeopleProjection } from '@/modules/boards/application/ports/people-projection.port'
import type { IBoardRepository } from '@/modules/boards/domain/board/board-repository.port'
import type { IPasswordHasher } from '@/modules/identity/application/ports/password-hasher.port'
import type { ISignInThrottle } from '@/modules/identity/application/ports/sign-in-throttle.port'
import type { ITokenGenerator } from '@/modules/identity/application/ports/token-generator.port'
import type { ISessionRepository } from '@/modules/identity/domain/session/session-repository.port'
import type { IUserRepository } from '@/modules/identity/domain/user/user-repository.port'
import type { IEventRelay } from '@/shared/kernel/ports/event-relay.port'
import type { IIdGenerator } from '@/shared/kernel/ports/id-generator.port'

/**
 * Maps each injection token to its port type. A token is the port's interface
 * name and must be unique across the repo.
 */
export type Registry = {
  // shared
  IIdGenerator: IIdGenerator
  IEventRelay: IEventRelay
  // identity
  IUserRepository: IUserRepository
  ISessionRepository: ISessionRepository
  IPasswordHasher: IPasswordHasher
  ITokenGenerator: ITokenGenerator
  ISignInThrottle: ISignInThrottle
  // boards
  IPeopleProjection: IPeopleProjection
  IBoardRepository: IBoardRepository
  IBoardReader: IBoardReader
}

export type Token = keyof Registry

export type AdapterMode = 'real' | 'mock'
