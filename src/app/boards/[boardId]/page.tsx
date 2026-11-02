import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { AvatarStack } from '@/app/_components/avatar-stack'
import { requireActor } from '@/app/_lib/auth/get-actor'
import { BoardLists } from '@/app/boards/[boardId]/board-lists'
import { getBoard } from '@/modules/boards/api'

export const metadata: Metadata = { title: 'Board' }

export default function BoardPage({ params }: PageProps<'/boards/[boardId]'>) {
  return (
    <Suspense
      fallback={
        <p role='status' className='text-muted-foreground'>
          Loading the board…
        </p>
      }
    >
      <Board params={params} />
    </Suspense>
  )
}

async function Board({
  params,
}: Pick<PageProps<'/boards/[boardId]'>, 'params'>) {
  const { boardId } = await params
  const actor = await requireActor(`/boards/${boardId}`)
  const board = await getBoard({ actorId: actor.userId, boardId })
  // A board the actor can't see is one that doesn't exist, for them (§9).
  if (!board.ok) notFound()

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='flex flex-col gap-3'>
          <h1 className='font-heading text-2xl font-semibold break-words'>
            {board.value.name}
          </h1>
          <AvatarStack members={board.value.members} />
        </div>
        <nav aria-label='Board'>
          <Link
            href={`/boards/${board.value.id}/settings`}
            className='rounded-sm text-sm font-medium text-foreground underline underline-offset-4'
          >
            Board settings
          </Link>
        </nav>
      </div>
      <BoardLists
        boardId={board.value.id}
        lists={board.value.lists}
        formKey={actor.userId}
      />
    </div>
  )
}
