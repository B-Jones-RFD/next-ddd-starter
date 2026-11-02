import { describe, expect, it } from 'vitest'

import type { AuditEntry } from '@/modules/audit/domain/audit-entry/audit-entry'
import { toUserId } from '@/shared/kernel/user-id'

import { anEntry, receiptFor, type AuditAdapters } from '@tests/fixtures/audit'

/** What every `IActivityReader` adapter must do, arranged through the log. */
export function describeActivityReaderContract(make: () => AuditAdapters) {
  async function given(...entries: AuditEntry[]) {
    const adapters = make()
    for (const entry of entries) {
      await adapters.log.record(entry, [], receiptFor(entry))
    }
    return adapters.reader
  }

  describe('IActivityReader contract', () => {
    it('reads a task’s entries newest first, and no other task’s', async () => {
      const older = anEntry()
      const other = anEntry({ subjectId: 'task-2', taskId: 'task-2' })
      const newer = anEntry()
      const reader = await given(older, other, newer)

      const ids = (
        await reader.forTask('task-1', {
          before: null,
          limit: 50,
          excluding: [],
        })
      ).map((entry) => entry.id)

      expect(ids).toEqual([newer.id, older.id])
    })

    it('pages by id: at most `limit`, older than `before`', async () => {
      const [a, b, c, d] = [anEntry(), anEntry(), anEntry(), anEntry()]
      const reader = await given(a, b, c, d)

      const ids = (
        await reader.forTask('task-1', {
          before: d.id,
          limit: 2,
          excluding: [],
        })
      ).map((entry) => entry.id)

      expect(ids).toEqual([c.id, b.id])
    })

    it('leaves out the actions it is told to', async () => {
      const created = anEntry({
        action: 'task.created',
        details: { listId: 'list-1', title: 'A' },
      })
      const reordered = anEntry({
        action: 'task.reordered',
        details: { listId: 'list-1' },
      })
      const reader = await given(created, reordered)

      const actions = (
        await reader.forTask('task-1', {
          before: null,
          limit: 50,
          excluding: ['task.reordered', 'list.reordered'],
        })
      ).map((entry) => entry.action)

      expect(actions).toEqual(['task.created'])
    })

    it('reads a board’s entries newest first, whatever they are about, with their subject, and no other board’s', async () => {
      const created = anEntry({
        subject: 'board',
        subjectId: 'board-1',
        taskId: null,
        action: 'board.created',
        details: { name: 'Launch plan' },
      })
      const list = anEntry({
        subject: 'list',
        subjectId: 'list-1',
        taskId: null,
        action: 'list.created',
        details: { name: 'Backlog' },
      })
      const other = anEntry({ boardId: 'board-2', taskId: 'task-2' })
      const task = anEntry()
      const reader = await given(created, list, other, task)

      const found = await reader.forBoard('board-1', {
        before: null,
        limit: 50,
        excluding: [],
      })

      expect(
        found.map(({ id, subject, subjectId }) => ({ id, subject, subjectId }))
      ).toEqual([
        { id: task.id, subject: 'task', subjectId: 'task-1' },
        { id: list.id, subject: 'list', subjectId: 'list-1' },
        { id: created.id, subject: 'board', subjectId: 'board-1' },
      ])
    })

    it('pages a board’s entries by id and leaves out the actions it is told to', async () => {
      const [a, b, c] = [anEntry(), anEntry(), anEntry()]
      const reordered = anEntry({
        action: 'task.reordered',
        details: { listId: 'list-1' },
      })
      const d = anEntry()
      const reader = await given(a, b, c, reordered, d)

      const ids = (
        await reader.forBoard('board-1', {
          before: d.id,
          limit: 2,
          excluding: ['task.reordered'],
        })
      ).map((entry) => entry.id)

      expect(ids).toEqual([c.id, b.id])
    })

    it('reads a user’s own entries newest first, and nothing done by or to anyone else', async () => {
      const userEntry = (userId: string) =>
        anEntry({
          actorId: toUserId(userId),
          subject: 'user',
          subjectId: userId,
          boardId: null,
          taskId: null,
          action: 'user.signed-in',
          details: {},
        })
      const [first, ben, second] = [
        userEntry('user-ada'),
        userEntry('user-ben'),
        userEntry('user-ada'),
      ]
      // Ada's board work is about her board, not about her.
      const reader = await given(first, ben, anEntry(), second)

      const found = await reader.forUser('user-ada', {
        before: null,
        limit: 50,
        excluding: [],
      })
      const older = await reader.forUser('user-ada', {
        before: second.id,
        limit: 50,
        excluding: [],
      })

      expect(found.map(({ id, subject }) => ({ id, subject }))).toEqual([
        { id: second.id, subject: 'user' },
        { id: first.id, subject: 'user' },
      ])
      expect(older.map((entry) => entry.id)).toEqual([first.id])
    })

    it('finds the board a task’s entries are about, or null', async () => {
      const reader = await given(anEntry())

      expect(await reader.boardOfTask('task-1')).toBe('board-1')
      expect(await reader.boardOfTask('task-9')).toBeNull()
    })

    it('finds entries by id, skipping unknown ones', async () => {
      const entry = anEntry({ actorId: toUserId('user-ben') })
      const reader = await given(entry, anEntry())

      expect(await reader.byIds([entry.id, 'missing'])).toEqual([
        expect.objectContaining({ id: entry.id, actorId: 'user-ben' }),
      ])
      expect(await reader.byIds([])).toEqual([])
    })

    it('finds current names by id, whatever their kind, skipping unknown ones', async () => {
      const { log, reader } = make()
      const entry = anEntry()
      await log.record(
        entry,
        [
          { kind: 'person', id: 'user-ada', name: 'Ada', aggregateVersion: 1 },
          { kind: 'list', id: 'list-1', name: 'Backlog', aggregateVersion: 1 },
        ],
        receiptFor(entry)
      )

      expect(await reader.names(['user-ada', 'list-1', 'missing'])).toEqual({
        'user-ada': 'Ada',
        'list-1': 'Backlog',
      })
      expect(await reader.names([])).toEqual({})
    })
  })
}
