import { describe, expect, it } from 'vitest'

import type { IBoardReader } from '@/modules/boards/application/ports/board-reader.port'
import type { IPeopleProjection } from '@/modules/boards/application/ports/people-projection.port'
import type { Board } from '@/modules/boards/domain/board/board'
import type { BoardName } from '@/modules/boards/domain/board/board-name'
import type { IBoardRepository } from '@/modules/boards/domain/board/board-repository.port'
import { toBoardId } from '@/modules/boards/domain/board/board-id'
import { toTagId, type Tag } from '@/modules/boards/domain/board/tag'
import type { TagName } from '@/modules/boards/domain/board/tag-name'
import { toListId } from '@/modules/boards/domain/list/list-id'
import type { ListName } from '@/modules/boards/domain/list/list-name'
import type { IListRepository } from '@/modules/boards/domain/list/list-repository.port'
import type { TaskDescription } from '@/modules/boards/domain/task/task-description'
import { toTaskId } from '@/modules/boards/domain/task/task-id'
import type { TaskTitle } from '@/modules/boards/domain/task/task-title'
import type { ITaskRepository } from '@/modules/boards/domain/task/task-repository.port'
import { NotFoundError } from '@/shared/kernel/errors/app-error'
import { ForbiddenError } from '@/shared/kernel/errors/domain-error'
import { toUserId } from '@/shared/kernel/user-id'

import { aBoard } from '@tests/fixtures/boards'
import { aList } from '@tests/fixtures/lists'
import { aTask } from '@tests/fixtures/tasks'

type Make = () => {
  reader: IBoardReader
  boards: IBoardRepository
  people: IPeopleProjection
  lists: IListRepository
  tasks: ITaskRepository
}

const ada = toUserId('user-ada')

const TAGS: Tag[] = [
  { id: toTagId('tag-urgent'), name: 'Urgent' as TagName, color: 'red' },
  { id: toTagId('tag-design'), name: 'design' as TagName, color: 'teal' },
  { id: toTagId('tag-later'), name: 'Later' as TagName, color: 'gray' },
]
const ben = toUserId('user-ben')
const cy = toUserId('user-cy')

/** What every `IBoardReader` adapter must do, over boards' own stores. */
export function describeBoardReaderContract(make: Make) {
  async function given(boards: IBoardRepository, board: Board) {
    const saved = await boards.save({ ...board, version: 0 }, [], {
      actorId: ada,
      causationId: null,
    })
    if (!saved.ok) throw new Error('setup failed')
    return saved.value
  }

  async function knownAs(
    people: IPeopleProjection,
    userId: typeof ada,
    name: string
  ) {
    await people.record({ userId, displayName: name }, 1, {
      eventId: `registered-${userId}`,
      handler: 'boards.recordUserRegistered',
    })
  }

  describe('IBoardReader contract', () => {
    it('lists only the boards the user is a Board member of, by name, with members Owner first', async () => {
      const { reader, boards, people } = make()
      await knownAs(people, ada, 'Ada')
      await knownAs(people, ben, 'Ben')
      const zeta = await given(
        boards,
        aBoard({
          name: 'Zeta' as BoardName,
          members: [
            { userId: ben, role: 'member' },
            { userId: ada, role: 'owner' },
          ],
        })
      )
      const alpha = await given(
        boards,
        aBoard({
          name: 'Alpha' as BoardName,
          members: [{ userId: ben, role: 'owner' }],
        })
      )
      await given(boards, aBoard({ members: [{ userId: cy, role: 'owner' }] }))

      expect(await reader.listForMember(ben)).toEqual([
        {
          id: alpha.id,
          name: 'Alpha',
          members: [{ userId: ben, displayName: 'Ben', role: 'owner' }],
        },
        {
          id: zeta.id,
          name: 'Zeta',
          members: [
            { userId: ada, displayName: 'Ada', role: 'owner' },
            { userId: ben, displayName: 'Ben', role: 'member' },
          ],
        },
      ])
    })

    it('lists nothing for a user on no board', async () => {
      const { reader, boards } = make()
      await given(boards, aBoard({ members: [{ userId: ada, role: 'owner' }] }))

      expect(await reader.listForMember(cy)).toEqual([])
    })

    it('gives a null display name for a member boards hasn’t heard of yet', async () => {
      const { reader, boards } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }] })
      )

      const listed = await reader.listForMember(ada)

      expect(listed).toEqual([
        {
          id: board.id,
          name: board.name,
          members: [{ userId: ada, displayName: null, role: 'owner' }],
        },
      ])
    })

    it('gets a board for a Board member, with their role', async () => {
      const { reader, boards, people } = make()
      await knownAs(people, ada, 'Ada')
      await knownAs(people, ben, 'Ben')
      const board = await given(
        boards,
        aBoard({
          name: 'Launch plan' as BoardName,
          members: [
            { userId: ada, role: 'owner' },
            { userId: ben, role: 'member' },
          ],
        })
      )

      expect(await reader.getForMember(board.id, ben)).toEqual({
        ok: true,
        value: {
          id: board.id,
          name: 'Launch plan',
          archived: false,
          role: 'member',
          members: [
            { userId: ada, displayName: 'Ada', role: 'owner' },
            { userId: ben, displayName: 'Ben', role: 'member' },
          ],
          lists: [],
        },
      })
    })

    it('gets a board with its active lists by position, then id', async () => {
      const { reader, boards, lists } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }] })
      )
      const on = (list: Parameters<typeof aList>[0]) =>
        lists.save(aList({ boardId: board.id, version: 0, ...list }), [], {
          actorId: ada,
          causationId: null,
        })
      await on({ name: 'Done' as ListName, position: 'l' })
      await on({ name: 'Archived' as ListName, position: 'G', archived: true })
      await on({
        id: toListId('list-b'),
        name: 'Doing' as ListName,
        position: 'V',
      })
      await on({
        id: toListId('list-a'),
        name: 'Backlog' as ListName,
        position: 'V',
      })
      await on({ boardId: toBoardId('board-elsewhere'), position: 'A' })

      const found = await reader.getForMember(board.id, ada)

      expect(found.ok && found.value.lists).toEqual([
        { id: 'list-a', name: 'Backlog', tasks: [] },
        { id: 'list-b', name: 'Doing', tasks: [] },
        { id: expect.any(String), name: 'Done', tasks: [] },
      ])
    })

    it('gives each list its active tasks by position, then id', async () => {
      const { reader, boards, lists, tasks } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }] })
      )
      const origin = { actorId: ada, causationId: null }
      const backlog = aList({ boardId: board.id, position: 'F', version: 0 })
      const done = aList({ boardId: board.id, position: 'V', version: 0 })
      await lists.save(backlog, [], origin)
      await lists.save(done, [], origin)
      const on = (task: Parameters<typeof aTask>[0]) =>
        tasks.save(
          aTask({ boardId: board.id, listId: backlog.id, version: 0, ...task }),
          [],
          origin
        )
      await on({ title: 'Third' as TaskTitle, position: 'k' })
      await on({ title: 'Gone' as TaskTitle, position: 'A', archived: true })
      await on({
        id: toTaskId('task-b'),
        title: 'Second' as TaskTitle,
        position: 'V',
        assignees: [ada],
      })
      await on({
        id: toTaskId('task-a'),
        title: 'First' as TaskTitle,
        position: 'V',
      })
      await on({ listId: done.id, title: 'Shipped' as TaskTitle })

      const found = await reader.getForMember(board.id, ada)

      expect(found.ok && found.value.lists).toEqual([
        {
          id: backlog.id,
          name: backlog.name,
          tasks: [
            { id: 'task-a', title: 'First', tags: [], assignees: [] },
            {
              id: 'task-b',
              title: 'Second',
              tags: [],
              assignees: [{ userId: ada, displayName: null }],
            },
            { id: expect.any(String), title: 'Third', tags: [], assignees: [] },
          ],
        },
        {
          id: done.id,
          name: done.name,
          tasks: [
            {
              id: expect.any(String),
              title: 'Shipped',
              tags: [],
              assignees: [],
            },
          ],
        },
      ])
    })

    it('gets a task for a Board member, with its board, list and assignees by name in the order assigned', async () => {
      const { reader, boards, lists, tasks, people } = make()
      await knownAs(people, ada, 'Ada')
      const board = await given(
        boards,
        aBoard({
          name: 'Launch plan' as BoardName,
          members: [{ userId: ada, role: 'owner' }],
        })
      )
      const origin = { actorId: ada, causationId: null }
      const list = aList({
        boardId: board.id,
        name: 'Backlog' as ListName,
        version: 0,
      })
      await lists.save(list, [], origin)
      const task = aTask({
        boardId: board.id,
        listId: list.id,
        title: 'Write the brief' as TaskTitle,
        description: 'One page.' as TaskDescription,
        assignees: [ben, ada],
        version: 0,
      })
      await tasks.save(task, [], origin)

      expect(await reader.getTaskForMember(task.id, ada)).toEqual({
        ok: true,
        value: {
          id: task.id,
          title: 'Write the brief',
          description: 'One page.',
          archived: false,
          boardId: board.id,
          boardName: 'Launch plan',
          listId: list.id,
          listName: 'Backlog',
          tags: [],
          assignees: [
            { userId: ben, displayName: null },
            { userId: ada, displayName: 'Ada' },
          ],
        },
      })
    })

    it('lists a board’s tags by name, ignoring case, for a Board member', async () => {
      const { reader, boards } = make()
      const board = await given(
        boards,
        aBoard({
          members: [
            { userId: ada, role: 'owner' },
            { userId: ben, role: 'member' },
          ],
          tags: TAGS,
        })
      )
      await given(
        boards,
        aBoard({
          tags: [
            { id: toTagId('x'), name: 'Elsewhere' as TagName, color: 'red' },
          ],
        })
      )

      expect(await reader.tagsForMember(board.id, ben)).toEqual({
        ok: true,
        value: [
          { id: 'tag-design', name: 'design', color: 'teal' },
          { id: 'tag-later', name: 'Later', color: 'gray' },
          { id: 'tag-urgent', name: 'Urgent', color: 'red' },
        ],
      })
    })

    it('returns ForbiddenError for the tags of a board the user isn’t a Board member of', async () => {
      const { reader, boards } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }], tags: TAGS })
      )

      expect(await reader.tagsForMember(board.id, cy)).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
      expect(await reader.tagsForMember('nowhere', ada)).toEqual({
        ok: false,
        error: new NotFoundError('Board', 'nowhere'),
      })
    })

    it('gives each task its tags by name, on the board and on its own', async () => {
      const { reader, boards, lists, tasks } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }], tags: TAGS })
      )
      const origin = { actorId: ada, causationId: null }
      const list = aList({ boardId: board.id, version: 0 })
      await lists.save(list, [], origin)
      const task = aTask({
        boardId: board.id,
        listId: list.id,
        tagIds: [toTagId('tag-urgent'), toTagId('tag-design')],
        version: 0,
      })
      await tasks.save(task, [], origin)
      const expected = [
        { id: 'tag-design', name: 'design', color: 'teal' },
        { id: 'tag-urgent', name: 'Urgent', color: 'red' },
      ]

      const found = await reader.getForMember(board.id, ada)
      const one = await reader.getTaskForMember(task.id, ada)

      expect(found.ok && found.value.lists[0]?.tasks[0]?.tags).toEqual(expected)
      expect(one.ok && one.value.tags).toEqual(expected)
    })

    it('leaves out a tag deleted from the board before its tasks lose it', async () => {
      const { reader, boards, lists, tasks } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }], tags: TAGS })
      )
      const origin = { actorId: ada, causationId: null }
      const list = aList({ boardId: board.id, version: 0 })
      await lists.save(list, [], origin)
      const task = aTask({
        boardId: board.id,
        listId: list.id,
        tagIds: [toTagId('tag-urgent'), toTagId('tag-design')],
        version: 0,
      })
      await tasks.save(task, [], origin)
      await boards.save(
        { ...board, tags: TAGS.filter((tag) => tag.id !== 'tag-urgent') },
        [],
        origin
      )

      const one = await reader.getTaskForMember(task.id, ada)

      expect(one.ok && one.value.tags).toEqual([
        { id: 'tag-design', name: 'design', color: 'teal' },
      ])
    })

    it('returns ForbiddenError for a task on a board the user isn’t a Board member of', async () => {
      const { reader, boards, lists, tasks } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }] })
      )
      const origin = { actorId: ada, causationId: null }
      const list = aList({ boardId: board.id, version: 0 })
      await lists.save(list, [], origin)
      const task = aTask({ boardId: board.id, listId: list.id, version: 0 })
      await tasks.save(task, [], origin)

      expect(await reader.getTaskForMember(task.id, cy)).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })

    it('returns NotFoundError for a task that doesn’t exist', async () => {
      const { reader } = make()

      expect(await reader.getTaskForMember('nowhere', ada)).toEqual({
        ok: false,
        error: new NotFoundError('Task', 'nowhere'),
      })
    })

    it('returns ForbiddenError for a user who isn’t a Board member', async () => {
      const { reader, boards } = make()
      const board = await given(
        boards,
        aBoard({ members: [{ userId: ada, role: 'owner' }] })
      )

      expect(await reader.getForMember(board.id, cy)).toEqual({
        ok: false,
        error: new ForbiddenError(),
      })
    })

    it('returns NotFoundError for a board that doesn’t exist', async () => {
      const { reader } = make()

      expect(await reader.getForMember('nowhere', ada)).toEqual({
        ok: false,
        error: new NotFoundError('Board', 'nowhere'),
      })
    })

    it('gives each user’s role on a board, and null for anyone else', async () => {
      const { reader, boards } = make()
      const board = await given(
        boards,
        aBoard({
          members: [
            { userId: ada, role: 'owner' },
            { userId: ben, role: 'member' },
          ],
        })
      )

      expect(await reader.roleOf(board.id, ada)).toBe('owner')
      expect(await reader.roleOf(board.id, ben)).toBe('member')
      expect(await reader.roleOf(board.id, cy)).toBeNull()
      expect(await reader.roleOf('nowhere', ada)).toBeNull()
    })
  })
}
