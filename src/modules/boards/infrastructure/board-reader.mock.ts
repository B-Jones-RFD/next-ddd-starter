import type {
  BoardMemberDto,
  BoardSummaryDto,
} from '@/modules/boards/application/dto/board-summary.dto'
import type { BoardDto } from '@/modules/boards/application/dto/board.dto'
import type { IBoardReader } from '@/modules/boards/application/ports/board-reader.port'
import type { Board } from '@/modules/boards/domain/board/board'
import { mockBoards } from '@/modules/boards/infrastructure/board-repository.mock'
import { mockPeople } from '@/modules/boards/infrastructure/people-projection.mock'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { err, ok, type Result } from '@/shared/kernel/result'
import type { UserId } from '@/shared/kernel/user-id'

function membersOf(board: Board): BoardMemberDto[] {
  const { people } = mockPeople()
  const ownerFirst = [
    ...board.members.filter((m) => m.role === 'owner'),
    ...board.members.filter((m) => m.role !== 'owner'),
  ]
  return ownerFirst.map((member) => ({
    userId: member.userId,
    displayName: people.get(member.userId)?.person.displayName ?? null,
    role: member.role,
  }))
}

const byNameThenId = (a: Board, b: Board) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1

/** In-memory twin of `BoardReader`, over the mock boards and people stores. */
export class MockBoardReader implements IBoardReader {
  async listForMember(userId: UserId): Promise<BoardSummaryDto[]> {
    return [...mockBoards().values()]
      .filter((board) => board.members.some((m) => m.userId === userId))
      .sort(byNameThenId)
      .map((board) => ({
        id: board.id,
        name: board.name,
        members: membersOf(board),
      }))
  }

  async getForMember(
    boardId: string,
    userId: UserId
  ): Promise<Result<BoardDto, NotFoundError | ForbiddenError>> {
    const board = mockBoards().get(boardId)
    if (!board) return err(new NotFoundError('Board', boardId))
    const me = board.members.find((m) => m.userId === userId)
    if (!me) return err(new ForbiddenError())
    return ok({
      id: board.id,
      name: board.name,
      archived: board.archived,
      role: me.role,
      members: membersOf(board),
    })
  }

  async roleOf(
    boardId: string,
    userId: UserId
  ): Promise<'owner' | 'member' | null> {
    const board = mockBoards().get(boardId)
    return board?.members.find((m) => m.userId === userId)?.role ?? null
  }
}
