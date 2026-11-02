import { describe, expect, it } from 'vitest'

import { toTagId } from '@/modules/boards/domain/board/tag'
import { toListId } from '@/modules/boards/domain/list/list-id'
import type { TaskDescription } from '@/modules/boards/domain/task/task-description'
import { toTaskId } from '@/modules/boards/domain/task/task-id'
import type { TaskTitle } from '@/modules/boards/domain/task/task-title'
import type { ITaskRepository } from '@/modules/boards/domain/task/task-repository.port'
import { ConflictError, NotFoundError } from '@/shared/kernel/errors/app-error'
import type { IOutbox } from '@/shared/kernel/ports/outbox.port'
import { toUserId } from '@/shared/kernel/user-id'

import { aTask } from '@tests/fixtures/tasks'

type Make = () => { repository: ITaskRepository; outbox: IOutbox }

const actor = toUserId('user-owner')
const origin = { actorId: actor, causationId: null }

/** What every `ITaskRepository` adapter must do, with boards' outbox. */
export function describeTaskRepositoryContract(make: Make) {
  describe('ITaskRepository contract', () => {
    it('saves a new task at version 1, found by id', async () => {
      const { repository } = make()
      const task = aTask({ version: 0 })

      const saved = await repository.save(task, [], origin)

      expect(saved).toEqual({ ok: true, value: { ...task, version: 1 } })
      expect(await repository.findById(task.id)).toEqual(saved)
    })

    it('returns NotFoundError for an unknown id', async () => {
      const { repository } = make()

      expect(await repository.findById(toTaskId('nowhere'))).toEqual({
        ok: false,
        error: new NotFoundError('Task', 'nowhere'),
      })
    })

    it('rejects a second new task with the same id, writing nothing', async () => {
      const { repository, outbox } = make()
      const task = aTask({ version: 0 })
      await repository.save(task, [], origin)

      const again = await repository.save(
        task,
        [
          {
            type: 'TaskCreated',
            payload: {
              taskId: task.id,
              boardId: task.boardId,
              listId: task.listId,
              title: 'Again',
            },
          },
        ],
        origin
      )

      expect(again).toEqual({
        ok: false,
        error: new ConflictError('Task', task.id),
      })
      expect(await outbox.pending(10)).toEqual([])
    })

    it('rejects a stale version with ConflictError, writing nothing', async () => {
      const { repository, outbox } = make()
      const saved = await repository.save(aTask({ version: 0 }), [], origin)
      if (!saved.ok) throw new Error('setup failed')
      await repository.save({ ...saved.value, position: 'k' }, [], origin)

      const stale = await repository.save(
        { ...saved.value, position: 'a' },
        [
          {
            type: 'TaskReordered',
            payload: {
              taskId: saved.value.id,
              boardId: saved.value.boardId,
              listId: saved.value.listId,
            },
          },
        ],
        origin
      )

      expect(stale).toEqual({
        ok: false,
        error: new ConflictError('Task', saved.value.id),
      })
      expect(await outbox.pending(10)).toEqual([])
      const found = await repository.findById(saved.value.id)
      expect(found.ok && found.value).toMatchObject({
        position: 'k',
        version: 2,
      })
    })

    it('saves changed fields', async () => {
      const { repository } = make()
      const saved = await repository.save(aTask({ version: 0 }), [], origin)
      if (!saved.ok) throw new Error('setup failed')
      const changed = {
        ...saved.value,
        listId: toListId('list-elsewhere'),
        title: 'Renamed' as TaskTitle,
        description: 'Line one\nLine two' as TaskDescription,
        position: 'Vk',
        archived: true,
      }

      const result = await repository.save(changed, [], origin)

      expect(result).toEqual({ ok: true, value: { ...changed, version: 2 } })
      expect(await repository.findById(changed.id)).toEqual(result)
    })

    it('finds a list’s last task by position then id, archived ones included', async () => {
      const { repository } = make()
      const listId = toListId('list-last')
      for (const task of [
        aTask({ id: toTaskId('task-b'), listId, position: 'k' }),
        aTask({ id: toTaskId('task-a'), listId, position: 'k' }),
        aTask({ listId, position: 'x', archived: true }),
        aTask({ listId: toListId('list-other'), position: 'z' }),
      ]) {
        await repository.save({ ...task, version: 0 }, [], origin)
      }

      expect(await repository.findLastInList(listId)).toMatchObject({
        listId,
        position: 'x',
        archived: true,
      })
    })

    it('breaks a tie in position by id', async () => {
      const { repository } = make()
      const listId = toListId('list-tie')
      await repository.save(
        aTask({ id: toTaskId('task-z'), listId, version: 0 }),
        [],
        origin
      )
      await repository.save(
        aTask({ id: toTaskId('task-y'), listId, version: 0 }),
        [],
        origin
      )

      expect(await repository.findLastInList(listId)).toMatchObject({
        id: 'task-z',
      })
    })

    it('finds no last task in a list with none', async () => {
      const { repository } = make()

      expect(await repository.findLastInList(toListId('empty'))).toBeNull()
    })

    it('saves a task’s tags in the order they were attached, and their changes', async () => {
      const { repository } = make()
      const urgent = toTagId('tag-urgent')
      const design = toTagId('tag-design')
      const saved = await repository.save(
        aTask({ version: 0, tagIds: [urgent, design] }),
        [],
        origin
      )
      if (!saved.ok) throw new Error('setup failed')
      expect(await repository.findById(saved.value.id)).toEqual(saved)

      const changed = { ...saved.value, tagIds: [design] }
      const result = await repository.save(changed, [], origin)

      expect(result).toEqual({ ok: true, value: { ...changed, version: 2 } })
      expect(await repository.findById(changed.id)).toEqual(result)
    })

    it('finds every task carrying a tag, archived ones included, by id', async () => {
      const { repository } = make()
      const urgent = toTagId('tag-urgent')
      for (const task of [
        aTask({ id: toTaskId('task-b'), tagIds: [urgent] }),
        aTask({ id: toTaskId('task-a'), tagIds: [toTagId('x'), urgent] }),
        aTask({ id: toTaskId('task-c'), tagIds: [urgent], archived: true }),
        aTask({ id: toTaskId('task-d'), tagIds: [toTagId('x')] }),
      ]) {
        await repository.save({ ...task, version: 0 }, [], origin)
      }

      const tagged = await repository.findTaggedWith(urgent)

      expect(tagged.map((task) => task.id)).toEqual([
        'task-a',
        'task-b',
        'task-c',
      ])
      expect(tagged[0]).toMatchObject({ tagIds: ['x', urgent], version: 1 })
    })

    it('publishes tagging events with their payloads', async () => {
      const { repository, outbox } = make()
      const task = aTask({ version: 0 })
      const payload = {
        taskId: task.id,
        boardId: task.boardId,
        tagId: toTagId('tag-1'),
      }
      await repository.save(
        task,
        [
          { type: 'TaskTagged', payload },
          { type: 'TaskUntagged', payload },
        ],
        origin
      )

      const rows = await outbox.pending(20)
      expect(
        rows
          .filter((row) => row.scope === 'integration')
          .map((row) => [row.envelope.type, row.envelope.payload])
      ).toEqual([
        ['boards.TaskTagged', payload],
        ['boards.TaskUntagged', payload],
      ])
    })

    it('writes each event as a domain row and publishes its translation', async () => {
      const { repository, outbox } = make()
      const task = aTask({ version: 0, title: 'Draft' as TaskTitle })
      const ids = { taskId: task.id, boardId: task.boardId }
      const saved = await repository.save(
        task,
        [
          {
            type: 'TaskCreated',
            payload: { ...ids, listId: task.listId, title: 'Draft' },
          },
          { type: 'TaskRenamed', payload: { ...ids, from: 'a', to: 'b' } },
          {
            type: 'TaskDescriptionChanged',
            payload: { ...ids, from: '', to: 'c' },
          },
          {
            type: 'TaskMoved',
            payload: {
              ...ids,
              fromListId: task.listId,
              toListId: toListId('list-to'),
            },
          },
          {
            type: 'TaskReordered',
            payload: { ...ids, listId: task.listId },
          },
        ],
        origin
      )
      if (!saved.ok) throw new Error('setup failed')

      const rows = await outbox.pending(20)
      expect(rows.map((row) => [row.scope, row.envelope.type])).toEqual([
        ['domain', 'TaskCreated'],
        ['domain', 'TaskRenamed'],
        ['domain', 'TaskDescriptionChanged'],
        ['domain', 'TaskMoved'],
        ['domain', 'TaskReordered'],
        ['integration', 'boards.TaskCreated'],
        ['integration', 'boards.TaskRenamed'],
        ['integration', 'boards.TaskDescriptionChanged'],
        ['integration', 'boards.TaskMoved'],
        ['integration', 'boards.TaskReordered'],
      ])
      expect(rows.slice(5).map((row) => row.envelope)).toMatchObject([
        {
          version: 1,
          aggregateId: task.id,
          aggregateVersion: 1,
          actorId: actor,
          causationId: null,
          payload: { ...ids, listId: task.listId, title: 'Draft' },
        },
        { payload: { ...ids, from: 'a', to: 'b' } },
        { payload: { ...ids, from: '', to: 'c' } },
        {
          payload: { ...ids, fromListId: task.listId, toListId: 'list-to' },
        },
        { payload: { ...ids, listId: task.listId } },
      ])
    })
  })
}
