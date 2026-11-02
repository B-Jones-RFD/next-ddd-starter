import { describe, expect, it } from 'vitest'

import {
  headingKey,
  listSuccessors,
  taskSuccessors,
} from '@/app/boards/[boardId]/successors'

const lists = [
  { id: 'backlog', tasks: [{ id: 'a' }, { id: 'b' }] },
  { id: 'doing', tasks: [{ id: 'c' }] },
  { id: 'done', tasks: [] },
]

describe('taskSuccessors', () => {
  it('prefers the next task, then the column heading', () => {
    expect(taskSuccessors(lists, 'backlog', 'a')).toEqual([
      'b',
      headingKey('backlog'),
      headingKey('doing'),
    ])
  })

  it('falls back to the column heading for the last task, then the next column’s and the previous column’s', () => {
    expect(taskSuccessors(lists, 'doing', 'c')).toEqual([
      headingKey('doing'),
      headingKey('done'),
      headingKey('backlog'),
    ])
  })
})

describe('listSuccessors', () => {
  it('prefers the list’s own heading, if it stays, then the next list, then the previous one', () => {
    expect(listSuccessors(lists, 'doing')).toEqual([
      headingKey('doing'),
      'done',
      'backlog',
    ])
  })

  it('falls back to the previous list for the last one', () => {
    expect(listSuccessors(lists, 'done')).toEqual([headingKey('done'), 'doing'])
  })
})
