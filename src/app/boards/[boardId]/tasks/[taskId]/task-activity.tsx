import { EntryBody } from '@/app/_components/audit/entry-body'
import { LogPager, ReordersToggle } from '@/app/_components/audit/log-nav'
import type { Names } from '@/app/_lib/audit/entry-wording'
import { readLogParams } from '@/app/_lib/audit/log-params'
import { requireActor } from '@/app/_lib/auth/get-actor'
import { taskPath } from '@/app/boards/[boardId]/task-places'
import { ActivityEntries } from '@/app/boards/[boardId]/tasks/[taskId]/activity-entries'
import { getActivity, type ActivityEntryDto } from '@/modules/audit/api'

const HEADING_ID = 'task-activity-heading'

/**
 * The task's Activity, newest first, 50 at a time, with reorders behind a
 * toggle (ADR 0010). It trails the board by one relay drain, and it isn't a
 * live region (§10).
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
  const params = readLogParams(await searchParams)
  const page = await getActivity({
    actorId: actor.userId,
    taskId,
    includeReorders: params.includeReorders,
    ...(params.before ? { before: params.before } : {}),
  })

  return (
    <section aria-labelledby={HEADING_ID} className='flex flex-col gap-3'>
      <h2 id={HEADING_ID} className='font-heading text-lg font-semibold'>
        Activity
      </h2>
      {page.ok ? <ReordersToggle path={path} params={params} /> : null}
      {!page.ok ? (
        <p className='text-sm text-muted-foreground'>
          Activity isn’t available.
        </p>
      ) : (
        <ActivityEntries
          key={actor.userId}
          boardId={boardId}
          taskId={taskId}
          authorName={actor.displayName}
          hasEntries={page.value.entries.length > 0}
          commentIds={page.value.entries.flatMap((entry) =>
            entry.action === 'comment.added' ? [entry.details.commentId] : []
          )}
        >
          {page.value.entries.map((entry) => (
            <ActivityItem
              key={entry.id}
              entry={entry}
              names={page.value.names}
            />
          ))}
        </ActivityEntries>
      )}
      {page.ok ? (
        <LogPager
          label='Activity pages'
          noun='activity'
          path={path}
          params={params}
          olderBefore={page.value.olderBefore}
        />
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
      <EntryBody entry={entry} names={names} />
    </li>
  )
}
