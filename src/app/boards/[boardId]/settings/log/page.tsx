import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { LogEntries } from '@/app/_components/audit/log-entries'
import { LogPager, ReordersToggle } from '@/app/_components/audit/log-nav'
import { readLogParams } from '@/app/_lib/audit/log-params'
import { requireActor } from '@/app/_lib/auth/get-actor'
import { SettingsTabs } from '@/app/boards/[boardId]/settings/settings-tabs'
import { getBoardLog } from '@/modules/audit/api'
import { getBoard } from '@/modules/boards/api'

export const metadata: Metadata = { title: 'Board log' }

type Props = PageProps<'/boards/[boardId]/settings/log'>

export default function BoardLogPage({ params, searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <p role='status' className='text-muted-foreground'>
          Loading the Board log…
        </p>
      }
    >
      <BoardLog params={params} searchParams={searchParams} />
    </Suspense>
  )
}

/**
 * The Board log tab: everything that happened on the board, newest first,
 * 50 at a time. Only the Owner can read it; for anyone else it doesn't
 * exist (§9). It trails the board by one relay drain.
 */
async function BoardLog({ params, searchParams }: Props) {
  const { boardId } = await params
  const path = `/boards/${boardId}/settings/log`
  const actor = await requireActor(path)
  const board = await getBoard({ actorId: actor.userId, boardId })
  if (!board.ok || board.value.role !== 'owner') notFound()
  const { id, name, role } = board.value
  const logParams = readLogParams(await searchParams)
  const page = await getBoardLog({
    actorId: actor.userId,
    boardId: id,
    includeReorders: logParams.includeReorders,
    ...(logParams.before ? { before: logParams.before } : {}),
  })
  // Ownership passed on between the two reads.
  if (!page.ok) notFound()

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
      <SettingsTabs boardId={id} current='log' role={role} />
      <section
        aria-labelledby='board-log-heading'
        className='flex max-w-2xl flex-col gap-4'
      >
        <h2
          id='board-log-heading'
          className='font-heading text-lg font-semibold'
        >
          Board log
        </h2>
        <p className='text-sm text-muted-foreground'>
          Every change to this board, its members, lists and tasks, newest
          first. Only you, as its Owner, can see it.
        </p>
        <ReordersToggle path={path} params={logParams} />
        <LogEntries
          entries={page.value.entries}
          names={page.value.names}
          empty='Nothing has happened on this board yet.'
        />
        <LogPager
          label='Board log pages'
          noun='entries'
          path={path}
          params={logParams}
          olderBefore={page.value.olderBefore}
        />
      </section>
    </div>
  )
}
