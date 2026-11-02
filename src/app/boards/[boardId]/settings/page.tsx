import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { requireActor } from '@/app/_lib/auth/get-actor'
import { RenameBoardForm } from '@/app/boards/[boardId]/settings/rename-board-form'
import { SettingsTabs } from '@/app/boards/[boardId]/settings/settings-tabs'
import { getBoard } from '@/modules/boards/api'

export const metadata: Metadata = { title: 'Board settings' }

export default function BoardSettingsPage({
  params,
}: PageProps<'/boards/[boardId]/settings'>) {
  return (
    <Suspense
      fallback={
        <p role='status' className='text-muted-foreground'>
          Loading board settings…
        </p>
      }
    >
      <General params={params} />
    </Suspense>
  )
}

/** The General tab: the board's name, which only the Owner can change. */
async function General({
  params,
}: Pick<PageProps<'/boards/[boardId]/settings'>, 'params'>) {
  const { boardId } = await params
  const actor = await requireActor(`/boards/${boardId}/settings`)
  const board = await getBoard({ actorId: actor.userId, boardId })
  if (!board.ok) notFound()
  const { id, name, role } = board.value

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <Link
          href={`/boards/${id}`}
          className='self-start rounded-sm text-sm font-medium text-foreground underline underline-offset-4'
        >
          Back to {name}
        </Link>
        <h1 className='font-heading text-2xl font-semibold'>Board settings</h1>
      </div>
      <SettingsTabs boardId={id} current='general' role={role} />
      <section
        aria-labelledby='board-name-heading'
        className='flex max-w-md flex-col gap-4'
      >
        <h2
          id='board-name-heading'
          className='font-heading text-lg font-semibold'
        >
          Name
        </h2>
        {role === 'owner' ? (
          // Keyed by the saved name, so a rename refills the input.
          <RenameBoardForm
            key={`${actor.userId}:${name}`}
            boardId={id}
            name={name}
          />
        ) : (
          <>
            <p className='break-words'>{name}</p>
            <p className='text-sm text-muted-foreground'>
              Only the board’s Owner can rename it.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
