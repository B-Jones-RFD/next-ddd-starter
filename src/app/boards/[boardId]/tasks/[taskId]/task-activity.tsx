import Link from 'next/link'

import {
  entrySentence,
  entryWording,
  personName,
  type Names,
} from '@/app/_lib/audit/entry-wording'
import { Time } from '@/app/_components/time'
import { requireActor } from '@/app/_lib/auth/get-actor'
import { taskPath } from '@/app/boards/[boardId]/task-places'
import { getActivity, type ActivityEntryDto } from '@/modules/audit/api'

const HEADING_ID = 'task-activity-heading'

const linkClass =
  'rounded-sm text-sm font-medium text-foreground underline underline-offset-4'

/**
 * The task's Activity, newest first, 50 at a time (ADR 0010). It trails the
 * board by one relay drain, and it isn't a live region (§10).
 */
export async function TaskActivity({
  boardId,
  taskId,
  searchParams,
}: {
  boardId: string
  taskId: string
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const path = taskPath(boardId, taskId)
  const actor = await requireActor(path)
  const { before } = await searchParams
  const cursor = typeof before === 'string' && before ? before : undefined
  const page = await getActivity({
    actorId: actor.userId,
    taskId,
    ...(cursor ? { before: cursor } : {}),
  })

  return (
    <section aria-labelledby={HEADING_ID} className='flex flex-col gap-3'>
      <h2 id={HEADING_ID} className='font-heading text-lg font-semibold'>
        Activity
      </h2>
      {!page.ok ? (
        <p className='text-sm text-muted-foreground'>
          Activity isn’t available.
        </p>
      ) : page.value.entries.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No activity yet.</p>
      ) : (
        <ol className='flex flex-col gap-3'>
          {page.value.entries.map((entry) => (
            <ActivityItem
              key={entry.id}
              entry={entry}
              names={page.value.names}
            />
          ))}
        </ol>
      )}
      {page.ok && (cursor || page.value.olderBefore) ? (
        <nav aria-label='Activity pages' className='flex gap-4'>
          {cursor ? (
            <Link href={path} scroll={false} className={linkClass}>
              Show newest activity
            </Link>
          ) : null}
          {page.value.olderBefore ? (
            <Link
              href={`${path}?before=${encodeURIComponent(page.value.olderBefore)}`}
              scroll={false}
              className={linkClass}
            >
              Show older activity
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  )
}

function ActivityItem({
  entry,
  names,
}: {
  entry: ActivityEntryDto
  names: Names
}) {
  return (
    <li className='flex flex-col gap-1 text-sm'>
      <p>
        <span className='font-medium'>{personName(names, entry.actorId)}</span>{' '}
        {entryWording(entry, names)}
      </p>
      {entry.action === 'task.description-changed' ? (
        <dl className='grid grid-cols-[auto_1fr] gap-x-2 text-muted-foreground'>
          <dt>Before:</dt>
          <dd className='break-words whitespace-pre-line'>
            {entry.details.from || '(empty)'}
          </dd>
          <dt>After:</dt>
          <dd className='break-words whitespace-pre-line'>
            {entry.details.to || '(empty)'}
          </dd>
        </dl>
      ) : null}
      {entry.cause ? (
        <p className='text-muted-foreground'>
          Because {entrySentence(entry.cause, names)}
        </p>
      ) : null}
      <p className='text-muted-foreground'>
        <Time dateTime={entry.occurredAt} />
      </p>
    </li>
  )
}
