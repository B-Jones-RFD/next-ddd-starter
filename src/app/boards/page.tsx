import type { Metadata } from 'next'
import { Suspense } from 'react'

import { requireActor } from '@/app/_lib/auth/get-actor'
import { listBoards } from '@/modules/boards/api'

export const metadata: Metadata = { title: 'Your boards' }

export default function BoardsPage() {
  return (
    <div className='flex flex-col gap-6'>
      <h1 className='font-heading text-2xl font-semibold'>Your boards</h1>
      <Suspense
        fallback={
          <p role='status' className='text-muted-foreground'>
            Loading your boards…
          </p>
        }
      >
        <Boards />
      </Suspense>
    </div>
  )
}

async function Boards() {
  const actor = await requireActor('/boards')
  const boards = await listBoards({ actorId: actor.userId })
  // The actor id comes from a valid session, so this is a bug if it happens.
  if (!boards.ok) throw boards.error

  return (
    <>
      <p>Welcome, {actor.displayName}.</p>
      {boards.value.length === 0 ? (
        <p className='text-muted-foreground'>No boards yet</p>
      ) : (
        <ul className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {boards.value.map((board) => (
            <li key={board.id}>{board.name}</li>
          ))}
        </ul>
      )}
    </>
  )
}
