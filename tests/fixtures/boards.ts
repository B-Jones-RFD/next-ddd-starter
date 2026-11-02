import type {
  Board,
  Membership,
  Role,
} from '@/modules/boards/domain/board/board'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type { BoardName } from '@/modules/boards/domain/board/board-name'
import { toUserId } from '@/shared/kernel/user-id'

let sequence = 0

/**
 * A saved board, for domain tests and repository contract suites. Its one
 * Owner is `user-owner` unless `members` says otherwise.
 */
export function aBoard(overrides: Partial<Board> = {}): Board {
  sequence += 1
  return {
    id: toBoardId(`board-${sequence}`),
    name: `Board ${sequence}` as BoardName,
    members: [{ userId: toUserId('user-owner'), role: 'owner' }],
    tags: [],
    archived: false,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    version: 1,
    ...overrides,
  }
}

/** A Board member's Membership on an active board, for domain tests. */
export function asMember(role: Role = 'member'): Membership {
  return { role, boardArchived: false }
}

/** Someone who isn't a Board member, on an active board. */
export const asOutsider: Membership = {
  role: undefined,
  boardArchived: false,
}

/** A Board member's Membership on an archived board. */
export const onArchivedBoard: Membership = {
  role: 'owner',
  boardArchived: true,
}
