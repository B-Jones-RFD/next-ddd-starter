import type {
  BoardMemberDto,
  BoardSummaryDto,
} from '@/modules/boards/application/dto/board-summary.dto'
import type { BoardDto } from '@/modules/boards/application/dto/board.dto'
import type { TaskDto } from '@/modules/boards/application/dto/task.dto'
import type {
  IBoardReader,
  View,
} from '@/modules/boards/application/ports/board-reader.port'
import type { Board } from '@/modules/boards/domain/board/board'
import type { List } from '@/modules/boards/domain/list/list'
import { mockBoards } from '@/modules/boards/infrastructure/board-repository.mock'
import {
  byPositionThenId,
  mockLists,
} from '@/modules/boards/infrastructure/list-repository.mock'
import { mockTasks } from '@/modules/boards/infrastructure/task-repository.mock'
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
  async listForMember(userId: UserId, view: View): Promise<BoardSummaryDto[]> {
    return [...mockBoards().values()]
      .filter((board) => board.members.some((m) => m.userId === userId))
      .filter((board) => board.archived === (view === 'archived'))
      .sort(byNameThenId)
      .map((board) => ({
        id: board.id,
        name: board.name,
        members: membersOf(board),
      }))
  }

  async getForMember(
    boardId: string,
    userId: UserId,
    view: View
  ): Promise<Result<BoardDto, NotFoundError | ForbiddenError>> {
    const board = mockBoards().get(boardId)
    if (!board) return err(new NotFoundError('Board', boardId))
    const me = board.members.find((m) => m.userId === userId)
    if (!me) return err(new ForbiddenError())
    const archived = view === 'archived'
    const tasks = [...mockTasks().values()]
      .filter((task) => task.boardId === board.id && task.archived === archived)
      .sort(byPositionThenId)
    // The Archived view also shows an active list holding archived tasks.
    const shown = (list: List) =>
      list.archived === archived ||
      (archived && tasks.some((task) => task.listId === list.id))
    return ok({
      id: board.id,
      name: board.name,
      archived: board.archived,
      role: me.role,
      members: membersOf(board),
      lists: [...mockLists().values()]
        .filter((list) => list.boardId === board.id && shown(list))
        .sort(byPositionThenId)
        .map((list) => ({
          id: list.id,
          name: list.name,
          archived: list.archived,
          tasks: tasks
            .filter((task) => task.listId === list.id)
            .map((task) => ({ id: task.id, title: task.title })),
        })),
    })
  }

  async getTaskForMember(
    taskId: string,
    userId: UserId
  ): Promise<Result<TaskDto, NotFoundError | ForbiddenError>> {
    const task = mockTasks().get(taskId)
    const board = task && mockBoards().get(task.boardId)
    const list = task && mockLists().get(task.listId)
    if (!task || !board || !list) return err(new NotFoundError('Task', taskId))
    if (!board.members.some((m) => m.userId === userId)) {
      return err(new ForbiddenError())
    }
    return ok({
      id: task.id,
      title: task.title,
      description: task.description,
      archived: task.archived,
      boardId: board.id,
      boardName: board.name,
      listId: list.id,
      listName: list.name,
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
