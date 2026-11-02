import type {
  BoardMemberDto,
  BoardSummaryDto,
} from '@/modules/boards/application/dto/board-summary.dto'
import type { BoardDto } from '@/modules/boards/application/dto/board.dto'
import type { TagDto } from '@/modules/boards/application/dto/tag.dto'
import type {
  AssigneeDto,
  TaskDto,
} from '@/modules/boards/application/dto/task.dto'
import type { IBoardReader } from '@/modules/boards/application/ports/board-reader.port'
import type { Board } from '@/modules/boards/domain/board/board'
import type { Tag } from '@/modules/boards/domain/board/tag'
import type { Task } from '@/modules/boards/domain/task/task'
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

function assigneesOf(task: Task): AssigneeDto[] {
  const { people } = mockPeople()
  return task.assignees.map((userId) => ({
    userId,
    displayName: people.get(userId)?.person.displayName ?? null,
  }))
}

const byNameThenId = (a: Board, b: Board) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1

/** The board's tags by name ignoring case, then id, as `TagDto`s. */
function tagsOf(board: Board, only?: readonly string[]): TagDto[] {
  const key = (tag: Tag) => tag.name.toLowerCase()
  return board.tags
    .filter((tag) => !only || only.includes(tag.id))
    .toSorted((a, b) =>
      key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.id < b.id ? -1 : 1
    )
    .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }))
}

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
      lists: [...mockLists().values()]
        .filter((list) => list.boardId === board.id && !list.archived)
        .sort(byPositionThenId)
        .map((list) => ({
          id: list.id,
          name: list.name,
          tasks: [...mockTasks().values()]
            .filter((task) => task.listId === list.id && !task.archived)
            .sort(byPositionThenId)
            .map((task) => ({
              id: task.id,
              title: task.title,
              tags: tagsOf(board, task.tagIds),
              assignees: assigneesOf(task),
            })),
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
      tags: tagsOf(board, task.tagIds),
      assignees: assigneesOf(task),
    })
  }

  async tagsForMember(
    boardId: string,
    userId: UserId
  ): Promise<Result<TagDto[], NotFoundError | ForbiddenError>> {
    const board = mockBoards().get(boardId)
    if (!board) return err(new NotFoundError('Board', boardId))
    if (!board.members.some((m) => m.userId === userId)) {
      return err(new ForbiddenError())
    }
    return ok(tagsOf(board))
  }

  async roleOf(
    boardId: string,
    userId: UserId
  ): Promise<'owner' | 'member' | null> {
    const board = mockBoards().get(boardId)
    return board?.members.find((m) => m.userId === userId)?.role ?? null
  }
}
