import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type { List } from '@/modules/boards/domain/list/list'
import { toListId } from '@/modules/boards/domain/list/list-id'
import type { ListName } from '@/modules/boards/domain/list/list-name'

let sequence = 0

/**
 * A saved, active list on `board-lists` at position `V`, for domain tests
 * and repository contract suites.
 */
export function aList(overrides: Partial<List> = {}): List {
  sequence += 1
  return {
    id: toListId(`list-${sequence}`),
    boardId: toBoardId('board-lists'),
    name: `List ${sequence}` as ListName,
    position: 'V',
    archived: false,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    version: 1,
    ...overrides,
  }
}
