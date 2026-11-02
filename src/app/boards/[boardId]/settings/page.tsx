import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { requireActor } from '@/app/_lib/auth/get-actor'
import {
  ARCHIVE_HEADING_ID,
  ArchiveBoardDialog,
  RestoreBoardForm,
} from '@/app/boards/[boardId]/settings/archive-board'
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

/**
 * The General tab: the board's name, which only the Owner can change, and,
 * for the Owner only, archiving or restoring the board.
 */
async function General({
  params,
}: Pick<PageProps<'/boards/[boardId]/settings'>, 'params'>) {
  const { boardId } = await params
  const actor = await requireActor(`/boards/${boardId}/settings`)
  const board = await getBoard({ actorId: actor.userId, boardId })
  if (!board.ok) notFound()
  const { id, name, role, archived } = board.value

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
        {role === 'owner' && !archived ? (
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
              {archived
                ? 'The board is archived, so it can’t be renamed.'
                : 'Only the board’s Owner can rename it.'}
            </p>
          </>
        )}
      </section>
      {role === 'owner' && (
        <section
          aria-labelledby={ARCHIVE_HEADING_ID}
          className='flex max-w-md flex-col items-start gap-4'
        >
          {/* Focusable only by script: restoring moves focus here. */}
          <h2
            id={ARCHIVE_HEADING_ID}
            tabIndex={-1}
            className='rounded-sm font-heading text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring'
          >
            {archived ? 'Restore' : 'Archive'}
          </h2>
          {archived ? (
            <>
              <p className='text-sm text-muted-foreground'>
                The board is archived. Restoring it brings it back to every
                member’s board grid, with its lists and tasks as they were.
              </p>
              <RestoreBoardForm key={actor.userId} boardId={id} />
            </>
          ) : (
            <>
              <p className='text-sm text-muted-foreground'>
                Archiving hides the board from every member’s board grid and
                makes it read-only. Nothing is deleted.
              </p>
              <ArchiveBoardDialog key={actor.userId} boardId={id} name={name} />
            </>
          )}
        </section>
      )}
    </div>
  )
}
