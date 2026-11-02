import { beforeEach, describe, expect, it } from 'vitest'

import { seed, SEED_PASSWORD } from '@/di/seed/seed'
import { getActivity } from '@/modules/audit/api'
import { getBoard, listBoards, listTags } from '@/modules/boards/api'
import { authenticate, signIn } from '@/modules/identity/api'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'

beforeEach(() => {
  resetMockStores()
})

describe('seed', () => {
  it.each(['ada@example.com', 'ben@example.com', 'cy@example.com'])(
    'lets %s sign in with the seed password',
    async (email) => {
      await seed()

      expect((await signIn({ email, password: SEED_PASSWORD })).ok).toBe(true)
    }
  )

  it('gives Ada her board “Launch plan” as its Owner, with Ben as a Member, once however often it runs', async () => {
    await seed()
    await seed()

    const ada = await actorFor('ada@example.com')
    const ben = await actorFor('ben@example.com')
    const launchPlan = {
      id: expect.any(String),
      name: 'Launch plan',
      members: [
        { userId: ada, displayName: 'Ada', role: 'owner' },
        { userId: ben, displayName: 'Ben', role: 'member' },
      ],
    }
    expect(await listBoards({ actorId: ada })).toEqual({
      ok: true,
      value: [launchPlan],
    })
    expect(await listBoards({ actorId: ben })).toEqual({
      ok: true,
      value: [launchPlan],
    })
  })

  it('keeps Cy off every board', async () => {
    await seed()

    const cy = await actorFor('cy@example.com')
    expect(await listBoards({ actorId: cy })).toEqual({ ok: true, value: [] })
  })

  it('gives “Launch plan” three lists in order, once however often it runs', async () => {
    await seed()
    await seed()

    const ada = await actorFor('ada@example.com')
    const boards = await listBoards({ actorId: ada })
    const boardId = boards.ok ? boards.value[0]?.id : undefined
    const board = await getBoard({ actorId: ada, boardId: boardId ?? '' })
    expect(board.ok && board.value.lists.map((list) => list.name)).toEqual([
      'Backlog',
      'In progress',
      'Done',
    ])
  })

  it('fills the three lists with eight tasks in order, once however often it runs', async () => {
    await seed()
    await seed()

    const ada = await actorFor('ada@example.com')
    const boards = await listBoards({ actorId: ada })
    const boardId = boards.ok ? boards.value[0]?.id : undefined
    const board = await getBoard({ actorId: ada, boardId: boardId ?? '' })
    expect(
      board.ok &&
        board.value.lists.map((list) => [
          list.name,
          list.tasks.map((task) => task.title),
        ])
    ).toEqual([
      [
        'Backlog',
        ['Write the press release', 'Plan the launch event', 'Update the FAQ'],
      ],
      [
        'In progress',
        ['Design the landing page', 'Record the demo video', 'Brief support'],
      ],
      ['Done', ['Pick the launch date', 'Set up analytics']],
    ])
  })

  it('defines four tags in distinct Tag colors, attached to several tasks, once however often it runs', async () => {
    await seed()
    await seed()

    const ada = await actorFor('ada@example.com')
    const boards = await listBoards({ actorId: ada })
    const boardId = (boards.ok && boards.value[0]?.id) || ''
    const tags = await listTags({ actorId: ada, boardId })
    const board = await getBoard({ actorId: ada, boardId })
    expect(tags.ok && tags.value.map((tag) => [tag.name, tag.color])).toEqual([
      ['Blocked', 'red'],
      ['Design', 'violet'],
      ['Marketing', 'amber'],
      ['Support', 'teal'],
    ])
    expect(
      board.ok &&
        Object.fromEntries(
          board.value.lists
            .flatMap((list) => list.tasks)
            .filter((task) => task.tags.length > 0)
            .map((task) => [task.title, task.tags.map((tag) => tag.name)])
        )
    ).toEqual({
      'Write the press release': ['Marketing'],
      'Plan the launch event': ['Blocked', 'Marketing'],
      'Update the FAQ': ['Support'],
      'Design the landing page': ['Design', 'Marketing'],
      'Brief support': ['Support'],
    })
  })

  it('assigns several tasks, some to Ben, once however often it runs', async () => {
    await seed()
    await seed()

    const ada = await actorFor('ada@example.com')
    const boards = await listBoards({ actorId: ada })
    const boardId = boards.ok ? boards.value[0]?.id : undefined
    const board = await getBoard({ actorId: ada, boardId: boardId ?? '' })
    const assigned = Object.fromEntries(
      (board.ok ? board.value.lists : [])
        .flatMap((list) => list.tasks)
        .filter((task) => task.assignees.length > 0)
        .map((task) => [
          task.title,
          task.assignees.map((assignee) => assignee.displayName),
        ])
    )
    expect(assigned).toEqual({
      'Write the press release': ['Ada'],
      'Design the landing page': ['Ben'],
      'Record the demo video': ['Ben', 'Ada'],
      'Brief support': ['Ben'],
      'Pick the launch date': ['Ada'],
    })
  })

  it('puts a few comments from Ada and Ben in the tasks’ Activity, once however often it runs', async () => {
    await seed()
    await seed()

    const ada = await actorFor('ada@example.com')
    const boards = await listBoards({ actorId: ada })
    const boardId = boards.ok ? boards.value[0]?.id : undefined
    const board = await getBoard({ actorId: ada, boardId: boardId ?? '' })
    if (!board.ok) throw new Error('read failed')
    const comments: [string, string, string][] = []
    for (const list of board.value.lists) {
      for (const task of list.tasks) {
        const page = await getActivity({ actorId: ada, taskId: task.id })
        if (!page.ok) throw new Error('read failed')
        for (const entry of [...page.value.entries].reverse()) {
          if (entry.action !== 'comment.added') continue
          const author = entry.actorId === ada ? 'Ada' : 'Ben'
          comments.push([task.title, author, entry.details.text])
        }
      }
    }
    expect(comments).toEqual([
      ['Write the press release', 'Ada', 'Draft by Friday, please.'],
      [
        'Write the press release',
        'Ben',
        'On it. I’ll share a first pass on Thursday.',
      ],
      [
        'Design the landing page',
        'Ben',
        'Should the hero use a still from the demo video?',
      ],
      ['Pick the launch date', 'Ada', 'Locked in for the 14th.'],
    ])
  })

  it('archives one list and one task on “Launch plan”, once however often it runs', async () => {
    await seed()
    await seed()

    const ada = await actorFor('ada@example.com')
    const boards = await listBoards({ actorId: ada })
    const boardId = boards.ok ? boards.value[0]?.id : undefined
    const board = await getBoard({
      actorId: ada,
      boardId: boardId ?? '',
      view: 'archived',
    })
    expect(
      board.ok &&
        board.value.lists.map((list) => [
          list.name,
          list.archived,
          list.tasks.map((task) => task.title),
        ])
    ).toEqual([
      ['Backlog', false, ['Print the flyers']],
      ['Someday', true, []],
    ])
  })
})

async function actorFor(email: string) {
  const session = await signIn({ email, password: SEED_PASSWORD })
  if (!session.ok) throw new Error('sign-in failed')
  const actor = await authenticate(session.value.token)
  if (!actor.ok) throw new Error('authenticate failed')
  return actor.value.userId
}
