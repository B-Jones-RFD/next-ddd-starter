import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { AvatarStack } from '@/app/_components/avatar-stack'
import { requireActor } from '@/app/_lib/auth/get-actor'
import { CreateBoardDialog } from '@/app/boards/create-board-dialog'
import { listBoards, type BoardSummaryDto } from '@/modules/boards/api'

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
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <p>Welcome, {actor.displayName}.</p>
        {boards.value.length > 0 && (
          // Keyed by user, so a sign-out never leaves a half-typed form behind.
          <CreateBoardDialog key={actor.userId} />
        )}
      </div>
      {boards.value.length === 0 ? (
        <section
          aria-labelledby='no-boards-heading'
          className='flex flex-col items-start gap-4 rounded-xl border border-dashed border-border p-6'
        >
          <h2 id='no-boards-heading' className='font-heading font-semibold'>
            No boards yet
          </h2>
          <p className='text-muted-foreground'>
            Create a board to start organizing work into lists of tasks.
          </p>
          <CreateBoardDialog key={actor.userId} />
        </section>
      ) : (
        <ul className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {boards.value.map((board) => (
            <li key={board.id}>
              <BoardTile board={board} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** One board in the grid: its name links to the board, then its members. */
function BoardTile({ board }: { board: BoardSummaryDto }) {
  return (
    <article className='relative flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring'>
      <h2 className='font-heading text-lg font-semibold break-words'>
        <Link
          href={`/boards/${board.id}`}
          className='outline-none after:absolute after:inset-0 after:rounded-xl hover:underline'
        >
          {board.name}
        </Link>
      </h2>
      <AvatarStack people={board.members} />
    </article>
  )
}
