import { describe, expect, it } from 'vitest'

import { placesIn } from '@/app/boards/[boardId]/task-places'

const tasks = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Beta' },
  { id: 'c', title: 'Gamma' },
]

describe('placesIn', () => {
  it('offers the top, after each task and the bottom of another list', () => {
    expect(placesIn(tasks, 'moving')).toEqual([
      { label: '1 (top)', before: 'a', current: false },
      { label: '2 (after “Alpha”)', after: 'a', before: 'b', current: false },
      { label: '3 (after “Beta”)', after: 'b', before: 'c', current: false },
      { label: '4 (bottom)', after: 'c', current: false },
    ])
  })

  it('offers only the top of an empty list', () => {
    expect(placesIn([], 'moving')).toEqual([
      { label: '1 (top)', current: false },
    ])
  })

  it('leaves the task out of its own list and marks where it is now', () => {
    expect(placesIn(tasks, 'b')).toEqual([
      { label: '1 (top)', before: 'a', current: false },
      { label: '2 (after “Alpha”)', after: 'a', before: 'c', current: true },
      { label: '3 (bottom)', after: 'c', current: false },
    ])
  })
})
