import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { ArchivedBadge } from '@/app/_components/archived-badge'
import { AvatarStack } from '@/app/_components/avatar-stack'
import { ViewSwitch } from '@/app/_components/view-switch'
import { requireActor } from '@/app/_lib/auth/get-actor'
import { viewFrom, viewPath } from '@/app/_lib/view/view'
import { BoardLists } from '@/app/boards/[boardId]/board-lists'
import { getBoard } from '@/modules/boards/api'

export const metadata: Metadata = { title: 'Board' }

export default function BoardPage({
  params,
  searchParams,
}: PageProps<'/boards/[boardId]'>) {
  return (
    <Suspense
      fallback={
        <p role='status' className='text-muted-foreground'>
          Loading the board…
        </p>
      }
    >
      <Board params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Board({ params, searchParams }: PageProps<'/boards/[boardId]'>) {
  const { boardId } = await params
  const view = viewFrom((await searchParams).view)
  const actor = await requireActor(viewPath(`/boards/${boardId}`, view))
  const board = await getBoard({ actorId: actor.userId, boardId, view })
  // A board the actor can't see is one that doesn't exist, for them (§9).
  if (!board.ok) notFound()
  const { archived, role } = board.value

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <h1 className='font-heading text-2xl font-semibold break-words'>
              {board.value.name}
            </h1>
            {archived && <ArchivedBadge />}
          </div>
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
      {archived && (
        <p className='text-muted-foreground'>
          This board is archived, so it’s read-only.{' '}
          {role === 'owner'
            ? 'You can restore it in Board settings.'
            : 'Its Owner can restore it.'}
        </p>
      )}
      <ViewSwitch
        path={`/boards/${board.value.id}`}
        current={view}
        label='Board view'
      />
      <BoardLists
        boardId={board.value.id}
        lists={board.value.lists}
        formKey={actor.userId}
        mode={archived ? 'read-only' : view}
      />
    </div>
  )
}
