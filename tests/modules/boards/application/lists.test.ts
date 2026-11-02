import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getInjection } from '@/di/container'
import {
  ConflictError,
  createBoard,
  createList,
  ForbiddenError,
  getBoard,
  moveList,
  NotFoundError,
  renameList,
  ValidationError,
} from '@/modules/boards/api'
import { toListId } from '@/modules/boards/domain/list/list-id'
import { resetMockStores } from '@/shared/infrastructure/mock-stores'
import type { UserId } from '@/shared/kernel/user-id'

import { givenUser } from '@tests/fixtures/users'

let ada: UserId
let boardId: string

beforeEach(async () => {
  resetMockStores()
  ada = await givenUser('Ada')
  const created = await createBoard({ actorId: ada, name: 'Launch plan' })
  if (!created.ok) throw new Error('setup failed')
  boardId = created.value.boardId
})

/** Creates lists on Ada's board, in order, and returns their ids. */
async function givenLists(...names: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const name of names) {
    const created = await createList({ actorId: ada, boardId, name })
    if (!created.ok) throw new Error('setup failed')
    ids.push(created.value.listId)
  }
  return ids
}

async function listNames(id = boardId) {
  const board = await getBoard({ actorId: ada, boardId: id })
  return board.ok ? board.value.lists.map((list) => list.name) : undefined
}

describe('createList', () => {
  it('adds a list to the end of the board', async () => {
    await givenLists('Backlog', 'Doing')

    const result = await createList({ actorId: ada, boardId, name: ' Done ' })

    expect(result).toEqual({ ok: true, value: { listId: expect.any(String) } })
    const board = await getBoard({ actorId: ada, boardId })
    expect(board.ok && board.value.lists).toEqual([
      { id: expect.any(String), name: 'Backlog' },
      { id: expect.any(String), name: 'Doing' },
      { id: result.ok && result.value.listId, name: 'Done' },
    ])
  })

  it('returns ValidationError for an invalid name, creating nothing', async () => {
    const result = await createList({ actorId: ada, boardId, name: ' ' })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBeInstanceOf(ValidationError)
    expect(!result.ok && (result.error as ValidationError).fields).toEqual({
      name: 'required',
    })
    expect(await listNames()).toEqual([])
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const cy = await givenUser('Cy')

    const result = await createList({ actorId: cy, boardId, name: 'Mine' })

    expect(result).toEqual({ ok: false, error: new ForbiddenError() })
    expect(await listNames()).toEqual([])
  })

  it('returns NotFoundError for a board that doesn’t exist', async () => {
    expect(
      await createList({ actorId: ada, boardId: 'nowhere', name: 'Backlog' })
    ).toEqual({ ok: false, error: new NotFoundError('Board', 'nowhere') })
  })
})

describe('renameList', () => {
  it('lets a Board member rename a list', async () => {
    const [backlog = ''] = await givenLists('Backlog')

    const result = await renameList({
      actorId: ada,
      listId: backlog,
      name: ' Ideas ',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await listNames()).toEqual(['Ideas'])
  })

  it('returns ValidationError for a name that’s too long, changing nothing', async () => {
    const [backlog = ''] = await givenLists('Backlog')

    const result = await renameList({
      actorId: ada,
      listId: backlog,
      name: 'x'.repeat(61),
    })

    expect(!result.ok && (result.error as ValidationError).fields).toEqual({
      name: 'too-long',
    })
    expect(await listNames()).toEqual(['Backlog'])
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const [backlog = ''] = await givenLists('Backlog')
    const cy = await givenUser('Cy')

    expect(
      await renameList({ actorId: cy, listId: backlog, name: 'Mine' })
    ).toEqual({ ok: false, error: new ForbiddenError() })
    expect(await listNames()).toEqual(['Backlog'])
  })

  it('returns NotFoundError for a list that doesn’t exist', async () => {
    expect(
      await renameList({ actorId: ada, listId: 'nowhere', name: 'Ideas' })
    ).toEqual({ ok: false, error: new NotFoundError('List', 'nowhere') })
  })

  it('returns ConflictError when the list changed since it was loaded, keeping the other change', async () => {
    const [backlog = ''] = await givenLists('Backlog')
    const lists = await getInjection('IListRepository')
    const findById = lists.findById.bind(lists)
    // Another rename lands between this rename's load and its save.
    vi.spyOn(lists, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await renameList({ actorId: ada, listId: backlog, name: 'Theirs' })
      return stale
    })

    const result = await renameList({
      actorId: ada,
      listId: backlog,
      name: 'Mine',
    })

    expect(result).toEqual({
      ok: false,
      error: new ConflictError('List', backlog),
    })
    expect(await listNames()).toEqual(['Theirs'])
  })
})

describe('moveList', () => {
  let backlog = ''
  let doing = ''
  let done = ''

  beforeEach(async () => {
    ;[backlog = '', doing = '', done = ''] = await givenLists(
      'Backlog',
      'Doing',
      'Done'
    )
  })

  it('moves a list right, between its new neighbours', async () => {
    const result = await moveList({
      actorId: ada,
      listId: backlog,
      after: doing,
      before: done,
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await listNames()).toEqual(['Doing', 'Backlog', 'Done'])
  })

  it('moves a list left, between its new neighbours', async () => {
    await moveList({
      actorId: ada,
      listId: done,
      after: backlog,
      before: doing,
    })

    expect(await listNames()).toEqual(['Backlog', 'Done', 'Doing'])
  })

  it('moves a list first', async () => {
    await moveList({ actorId: ada, listId: done, before: backlog })

    expect(await listNames()).toEqual(['Done', 'Backlog', 'Doing'])
  })

  it('moves a list last', async () => {
    await moveList({ actorId: ada, listId: backlog, after: done })

    expect(await listNames()).toEqual(['Doing', 'Done', 'Backlog'])
  })

  it('lets two people move different lists from the same page without conflict', async () => {
    const lists = await getInjection('IListRepository')
    const findById = lists.findById.bind(lists)
    // Someone moves Doing last while this move of Done is loading. Only
    // Doing's row changes, so this move still saves.
    vi.spyOn(lists, 'findById').mockImplementationOnce(async (id) => {
      const loaded = await findById(id)
      await moveList({ actorId: ada, listId: doing, after: done })
      return loaded
    })

    const result = await moveList({
      actorId: ada,
      listId: done,
      before: backlog,
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await listNames()).toEqual(['Done', 'Backlog', 'Doing'])
  })

  it('returns ConflictError when the list moved since it was loaded, keeping the other move', async () => {
    const lists = await getInjection('IListRepository')
    const findById = lists.findById.bind(lists)
    vi.spyOn(lists, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id)
      await moveList({ actorId: ada, listId: backlog, after: done })
      return stale
    })

    const result = await moveList({
      actorId: ada,
      listId: backlog,
      before: doing,
    })

    expect(result).toEqual({
      ok: false,
      error: new ConflictError('List', backlog),
    })
    expect(await listNames()).toEqual(['Doing', 'Done', 'Backlog'])
  })

  it('returns ConflictError for neighbours out of order, as from a stale page', async () => {
    const result = await moveList({
      actorId: ada,
      listId: backlog,
      after: done,
      before: doing,
    })

    expect(result).toEqual({
      ok: false,
      error: new ConflictError('List', backlog),
    })
    expect(await listNames()).toEqual(['Backlog', 'Doing', 'Done'])
  })

  it('returns NotFoundError for a neighbour that doesn’t exist', async () => {
    expect(
      await moveList({ actorId: ada, listId: backlog, after: 'nowhere' })
    ).toEqual({ ok: false, error: new NotFoundError('List', 'nowhere') })
  })

  it('returns NotFoundError for a neighbour on another board', async () => {
    const other = await createBoard({ actorId: ada, name: 'Other' })
    if (!other.ok) throw new Error('setup failed')
    const elsewhere = await createList({
      actorId: ada,
      boardId: other.value.boardId,
      name: 'Elsewhere',
    })
    if (!elsewhere.ok) throw new Error('setup failed')

    expect(
      await moveList({
        actorId: ada,
        listId: backlog,
        after: elsewhere.value.listId,
      })
    ).toEqual({
      ok: false,
      error: new NotFoundError('List', elsewhere.value.listId),
    })
  })

  it('returns ForbiddenError for a user who isn’t a Board member', async () => {
    const cy = await givenUser('Cy')

    expect(
      await moveList({ actorId: cy, listId: backlog, after: done })
    ).toEqual({ ok: false, error: new ForbiddenError() })
    expect(await listNames()).toEqual(['Backlog', 'Doing', 'Done'])
  })

  it('returns NotFoundError for a list that doesn’t exist', async () => {
    expect(
      await moveList({ actorId: ada, listId: 'nowhere', after: done })
    ).toEqual({
      ok: false,
      error: new NotFoundError('List', toListId('nowhere')),
    })
  })
})
