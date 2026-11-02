import type { Board } from '@/modules/boards/domain/board/board'
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
    archived: false,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    version: 1,
    ...overrides,
  }
}
