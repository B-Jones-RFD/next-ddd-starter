import { describe, expect, it } from 'vitest'

import { namedIds } from '@/modules/audit/domain/audit-entry/audit-entry'

describe('namedIds', () => {
  it('names the actor and the people in the details, once each', () => {
    expect(
      namedIds({
        actorId: 'user-ada',
        details: { fromUserId: 'user-ada', toUserId: 'user-ben' },
      })
    ).toEqual(['user-ada', 'user-ben'])
  })

  it('names the lists a move is between', () => {
    expect(
      namedIds({
        actorId: 'user-ada',
        details: { fromListId: 'list-1', toListId: 'list-2' },
      })
    ).toEqual(['user-ada', 'list-1', 'list-2'])
  })

  it('names no values that aren’t ids', () => {
    expect(
      namedIds({ actorId: 'user-ada', details: { from: 'A', to: 'B' } })
    ).toEqual(['user-ada'])
  })
})
