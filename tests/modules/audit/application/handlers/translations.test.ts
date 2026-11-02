import { readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { AUDIT_HANDLERS } from '@/modules/audit/application/handlers/audit-handlers'
import { translate } from '@/modules/audit/application/handlers/translations'
import { toUserId } from '@/shared/kernel/user-id'

import { anEnvelope } from '@tests/fixtures/envelopes'

const ada = toUserId('user-ada')
const at = '2026-03-01T10:00:00.000Z'

/** An envelope of `type` from Ada, at version `aggregateVersion`. */
function event(
  type: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  aggregateVersion = 3
) {
  return anEnvelope({
    id: `event-${type}`,
    type,
    occurredAt: at,
    aggregateId,
    aggregateVersion,
    actorId: ada,
    payload,
  })
}

/** The fields every entry takes from its envelope. */
function meta(type: string) {
  return {
    id: `event-${type}`,
    occurredAt: new Date(at),
    actorId: ada,
    causationId: null,
  }
}

describe('translating identity events', () => {
  it('records a registration as a user entry, and the person’s name', () => {
    const type = 'identity.UserRegistered'
    expect(
      translate(
        event(type, 'user-ada', { userId: 'user-ada', displayName: 'Ada' }, 1)
      )
    ).toEqual({
      entry: {
        ...meta(type),
        subject: 'user',
        subjectId: 'user-ada',
        boardId: null,
        taskId: null,
        action: 'user.registered',
        details: { displayName: 'Ada' },
      },
      names: [
        { kind: 'person', id: 'user-ada', name: 'Ada', aggregateVersion: 1 },
      ],
    })
  })

  it('records a rename with from and to, and the new name', () => {
    const type = 'identity.UserRenamed'
    expect(
      translate(
        event(type, 'user-ada', {
          userId: 'user-ada',
          from: 'Ada',
          to: 'Ada L.',
        })
      )
    ).toEqual({
      entry: {
        ...meta(type),
        subject: 'user',
        subjectId: 'user-ada',
        boardId: null,
        taskId: null,
        action: 'user.renamed',
        details: { from: 'Ada', to: 'Ada L.' },
      },
      names: [
        { kind: 'person', id: 'user-ada', name: 'Ada L.', aggregateVersion: 3 },
      ],
    })
  })

  it.each([
    [
      'identity.UserPasswordChanged',
      { userId: 'user-ada' },
      'user.password-changed',
      {},
    ],
    ['identity.UserSignedIn', { userId: 'user-ada' }, 'user.signed-in', {}],
    [
      'identity.UserSignedOut',
      { userId: 'user-ada', everywhere: true },
      'user.signed-out',
      { everywhere: true },
    ],
  ])('records %s as %s', (type, payload, action, details) => {
    expect(translate(event(type, 'user-ada', payload))).toEqual({
      entry: {
        ...meta(type),
        subject: 'user',
        subjectId: 'user-ada',
        boardId: null,
        taskId: null,
        action,
        details,
      },
      names: [],
    })
  })
})

describe('translating board events', () => {
  it('records a new board, and its name', () => {
    const type = 'boards.BoardCreated'
    expect(
      translate(
        event(type, 'board-1', { boardId: 'board-1', name: 'Launch plan' }, 1)
      )
    ).toEqual({
      entry: {
        ...meta(type),
        subject: 'board',
        subjectId: 'board-1',
        boardId: 'board-1',
        taskId: null,
        action: 'board.created',
        details: { name: 'Launch plan' },
      },
      names: [
        {
          kind: 'board',
          id: 'board-1',
          name: 'Launch plan',
          aggregateVersion: 1,
        },
      ],
    })
  })

  it('records a board rename with from and to, and the new name', () => {
    const type = 'boards.BoardRenamed'
    expect(
      translate(
        event(type, 'board-1', { boardId: 'board-1', from: 'A', to: 'B' })
      )
    ).toEqual({
      entry: {
        ...meta(type),
        subject: 'board',
        subjectId: 'board-1',
        boardId: 'board-1',
        taskId: null,
        action: 'board.renamed',
        details: { from: 'A', to: 'B' },
      },
      names: [{ kind: 'board', id: 'board-1', name: 'B', aggregateVersion: 3 }],
    })
  })

  it.each([
    ['boards.MemberAdded', 'member.added'],
    ['boards.MemberRemoved', 'member.removed'],
    ['boards.MemberLeft', 'member.left'],
  ])('records %s as %s, naming the user', (type, action) => {
    expect(
      translate(
        event(type, 'board-1', { boardId: 'board-1', userId: 'user-ben' })
      )
    ).toEqual({
      entry: {
        ...meta(type),
        subject: 'board',
        subjectId: 'board-1',
        boardId: 'board-1',
        taskId: null,
        action,
        details: { userId: 'user-ben' },
      },
      names: [],
    })
  })

  it('records an ownership transfer from one user to another', () => {
    const type = 'boards.OwnershipTransferred'
    const payload = {
      boardId: 'board-1',
      fromUserId: 'user-ada',
      toUserId: 'user-ben',
    }
    expect(translate(event(type, 'board-1', payload))).toEqual({
      entry: {
        ...meta(type),
        subject: 'board',
        subjectId: 'board-1',
        boardId: 'board-1',
        taskId: null,
        action: 'ownership.transferred',
        details: { fromUserId: 'user-ada', toUserId: 'user-ben' },
      },
      names: [],
    })
  })

  it.each([
    ['boards.BoardArchived', 'board.archived'],
    ['boards.BoardRestored', 'board.restored'],
  ])('records %s as %s', (type, action) => {
    expect(translate(event(type, 'board-1', { boardId: 'board-1' }))).toEqual({
      entry: {
        ...meta(type),
        subject: 'board',
        subjectId: 'board-1',
        boardId: 'board-1',
        taskId: null,
        action,
        details: {},
      },
      names: [],
    })
  })
})

describe('translating list events', () => {
  it('records a new list, and its name', () => {
    const type = 'boards.ListCreated'
    expect(
      translate(
        event(
          type,
          'list-1',
          { listId: 'list-1', boardId: 'board-1', name: 'Backlog' },
          1
        )
      )
    ).toEqual({
      entry: {
        ...meta(type),
        subject: 'list',
        subjectId: 'list-1',
        boardId: 'board-1',
        taskId: null,
        action: 'list.created',
        details: { name: 'Backlog' },
      },
      names: [
        { kind: 'list', id: 'list-1', name: 'Backlog', aggregateVersion: 1 },
      ],
    })
  })

  it('records a list rename with from and to, and the new name', () => {
    const type = 'boards.ListRenamed'
    const payload = {
      listId: 'list-1',
      boardId: 'board-1',
      from: 'Todo',
      to: 'Backlog',
    }
    expect(translate(event(type, 'list-1', payload))).toEqual({
      entry: {
        ...meta(type),
        subject: 'list',
        subjectId: 'list-1',
        boardId: 'board-1',
        taskId: null,
        action: 'list.renamed',
        details: { from: 'Todo', to: 'Backlog' },
      },
      names: [
        { kind: 'list', id: 'list-1', name: 'Backlog', aggregateVersion: 3 },
      ],
    })
  })

  it('records a list reorder with no from or to', () => {
    const type = 'boards.ListReordered'
    expect(
      translate(event(type, 'list-1', { listId: 'list-1', boardId: 'board-1' }))
    ).toEqual({
      entry: {
        ...meta(type),
        subject: 'list',
        subjectId: 'list-1',
        boardId: 'board-1',
        taskId: null,
        action: 'list.reordered',
        details: {},
      },
      names: [],
    })
  })

  it.each([
    ['boards.ListArchived', 'list.archived'],
    ['boards.ListRestored', 'list.restored'],
  ])('records %s as %s', (type, action) => {
    expect(
      translate(event(type, 'list-1', { listId: 'list-1', boardId: 'board-1' }))
    ).toEqual({
      entry: {
        ...meta(type),
        subject: 'list',
        subjectId: 'list-1',
        boardId: 'board-1',
        taskId: null,
        action,
        details: {},
      },
      names: [],
    })
  })
})

describe('translating task events', () => {
  const task = { taskId: 'task-1', boardId: 'board-1' }
  const onTask = {
    subject: 'task',
    subjectId: 'task-1',
    boardId: 'board-1',
    taskId: 'task-1',
  }

  it('records a new task in its list, and its title', () => {
    const type = 'boards.TaskCreated'
    expect(
      translate(
        event(type, 'task-1', { ...task, listId: 'list-1', title: 'Brief' }, 1)
      )
    ).toEqual({
      entry: {
        ...meta(type),
        ...onTask,
        action: 'task.created',
        details: { listId: 'list-1', title: 'Brief' },
      },
      names: [
        { kind: 'task', id: 'task-1', name: 'Brief', aggregateVersion: 1 },
      ],
    })
  })

  it('records a task rename with from and to, and the new title', () => {
    const type = 'boards.TaskRenamed'
    expect(
      translate(event(type, 'task-1', { ...task, from: 'A', to: 'B' }))
    ).toEqual({
      entry: {
        ...meta(type),
        ...onTask,
        action: 'task.renamed',
        details: { from: 'A', to: 'B' },
      },
      names: [{ kind: 'task', id: 'task-1', name: 'B', aggregateVersion: 3 }],
    })
  })

  it('records a description change with from and to', () => {
    const type = 'boards.TaskDescriptionChanged'
    expect(
      translate(event(type, 'task-1', { ...task, from: '', to: 'Notes' }))
    ).toEqual({
      entry: {
        ...meta(type),
        ...onTask,
        action: 'task.description-changed',
        details: { from: '', to: 'Notes' },
      },
      names: [],
    })
  })

  it('records a move between lists', () => {
    const type = 'boards.TaskMoved'
    const payload = { ...task, fromListId: 'list-1', toListId: 'list-2' }
    expect(translate(event(type, 'task-1', payload))).toEqual({
      entry: {
        ...meta(type),
        ...onTask,
        action: 'task.moved',
        details: { fromListId: 'list-1', toListId: 'list-2' },
      },
      names: [],
    })
  })

  it('records a reorder within its list', () => {
    const type = 'boards.TaskReordered'
    expect(
      translate(event(type, 'task-1', { ...task, listId: 'list-1' }))
    ).toEqual({
      entry: {
        ...meta(type),
        ...onTask,
        action: 'task.reordered',
        details: { listId: 'list-1' },
      },
      names: [],
    })
  })

  it.each([
    ['boards.TaskAssigned', 'task.assigned'],
    ['boards.TaskUnassigned', 'task.unassigned'],
  ] as const)('records %s with the assignee', (type, action) => {
    expect(
      translate(event(type, 'task-1', { ...task, userId: 'user-ben' }))
    ).toEqual({
      entry: {
        ...meta(type),
        ...onTask,
        action,
        details: { userId: 'user-ben' },
      },
      names: [],
    })
  })

  it.each([
    ['boards.TaskArchived', 'task.archived'],
    ['boards.TaskRestored', 'task.restored'],
  ])('records %s as %s, in its list', (type, action) => {
    expect(
      translate(event(type, 'task-1', { ...task, listId: 'list-1' }))
    ).toEqual({
      entry: {
        ...meta(type),
        ...onTask,
        action,
        details: { listId: 'list-1' },
      },
      names: [],
    })
  })
})

describe('translating tag events', () => {
  const onBoard = {
    subject: 'board',
    subjectId: 'board-1',
    boardId: 'board-1',
    taskId: null,
  }
  const tag = { boardId: 'board-1', tagId: 'tag-1' }

  it('records a new tag on its board, and its name', () => {
    const type = 'boards.TagCreated'
    expect(
      translate(
        event(type, 'board-1', { ...tag, name: 'Urgent', color: 'red' })
      )
    ).toEqual({
      entry: {
        ...meta(type),
        ...onBoard,
        action: 'tag.created',
        details: { tagId: 'tag-1', name: 'Urgent', color: 'red' },
      },
      names: [
        { kind: 'tag', id: 'tag-1', name: 'Urgent', aggregateVersion: 3 },
      ],
    })
  })

  it('records a tag rename with from and to, and the new name', () => {
    const type = 'boards.TagRenamed'
    expect(
      translate(event(type, 'board-1', { ...tag, from: 'A', to: 'B' }))
    ).toEqual({
      entry: {
        ...meta(type),
        ...onBoard,
        action: 'tag.renamed',
        details: { tagId: 'tag-1', from: 'A', to: 'B' },
      },
      names: [{ kind: 'tag', id: 'tag-1', name: 'B', aggregateVersion: 3 }],
    })
  })

  it('records a recolor with from and to', () => {
    const type = 'boards.TagRecolored'
    expect(
      translate(event(type, 'board-1', { ...tag, from: 'red', to: 'blue' }))
    ).toEqual({
      entry: {
        ...meta(type),
        ...onBoard,
        action: 'tag.recolored',
        details: { tagId: 'tag-1', from: 'red', to: 'blue' },
      },
      names: [],
    })
  })

  it('records a deleted tag with the name it had', () => {
    const type = 'boards.TagDeleted'
    expect(
      translate(event(type, 'board-1', { ...tag, name: 'Urgent' }))
    ).toEqual({
      entry: {
        ...meta(type),
        ...onBoard,
        action: 'tag.deleted',
        details: { tagId: 'tag-1', name: 'Urgent' },
      },
      names: [],
    })
  })

  it.each([
    ['boards.TaskTagged', 'task.tagged'],
    ['boards.TaskUntagged', 'task.untagged'],
  ])('records %s on the task', (type, action) => {
    expect(
      translate(
        event(type, 'task-1', {
          taskId: 'task-1',
          boardId: 'board-1',
          tagId: 'tag-1',
        })
      )
    ).toEqual({
      entry: {
        ...meta(type),
        subject: 'task',
        subjectId: 'task-1',
        boardId: 'board-1',
        taskId: 'task-1',
        action,
        details: { tagId: 'tag-1' },
      },
      names: [],
    })
  })
})

describe('translating comment events', () => {
  it('records a comment on its task, with its text', () => {
    const type = 'boards.CommentAdded'
    const payload = {
      commentId: 'comment-1',
      taskId: 'task-1',
      boardId: 'board-1',
      text: 'Can we keep it to one page?',
    }
    expect(translate(event(type, 'comment-1', payload, 1))).toEqual({
      entry: {
        ...meta(type),
        subject: 'task',
        subjectId: 'task-1',
        boardId: 'board-1',
        taskId: 'task-1',
        action: 'comment.added',
        details: {
          commentId: 'comment-1',
          text: 'Can we keep it to one page?',
        },
      },
      names: [],
    })
  })
})

describe('translating any event', () => {
  it('keeps the causing event’s id on a Consequence', () => {
    const envelope = {
      ...event('boards.MemberLeft', 'board-1', {
        boardId: 'board-1',
        userId: 'user-ben',
      }),
      causationId: 'event-cause',
    }

    expect(translate(envelope).entry.causationId).toBe('event-cause')
  })
})

describe('the audit handlers', () => {
  it('register one handler per event contract, named audit.record<EventName>', () => {
    expect(
      AUDIT_HANDLERS.map(({ name, eventType, version }) => [
        name,
        eventType,
        version,
      ])
    ).toContainEqual(['audit.recordTaskMoved', 'boards.TaskMoved', 1])
    expect(new Set(AUDIT_HANDLERS.map((handler) => handler.name)).size).toBe(
      AUDIT_HANDLERS.length
    )
  })

  // Every v1 event identity and boards publish becomes an entry (§6). A
  // slice that adds a contract file fails here until audit translates it.
  it.each(['identity', 'boards'])(
    'cover every v1 contract %s publishes',
    (context) => {
      const contracts = readdirSync(
        `src/modules/${context}/application/contracts`
      )
        .filter((file) => file.endsWith('.v1.ts'))
        .map((file) =>
          file
            .replace('.v1.ts', '')
            .split('-')
            .map((word) => word[0]?.toUpperCase() + word.slice(1))
            .join('')
        )

      const handled = AUDIT_HANDLERS.map(({ name, eventType, version }) => [
        name,
        eventType,
        version,
      ])
      for (const contract of contracts) {
        expect(handled).toContainEqual([
          `audit.record${contract}`,
          `${context}.${contract}`,
          1,
        ])
      }
    }
  )
})
