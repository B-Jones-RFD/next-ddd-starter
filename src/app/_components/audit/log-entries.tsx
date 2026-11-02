import { Time } from '@/app/_components/time'
import {
  entrySentence,
  entryWording,
  personName,
  type Names,
} from '@/app/_lib/audit/entry-wording'
import type { LogEntryDto } from '@/modules/audit/api'

/** What a Board log entry is about, when that's a list or a task. */
function subjectLine(entry: LogEntryDto, names: Names): string | null {
  const name = names[entry.subjectId]
  switch (entry.subject) {
    case 'list':
      return name ? `List “${name}”` : 'A list'
    case 'task':
      return name ? `Task “${name}”` : 'A task'
    case 'board':
    case 'user':
      return null
  }
}

/**
 * The entries of a Board log or User log page, newest first, each naming
 * who did what, to which list or task, what caused it and when. It isn't a
 * live region (§10).
 */
export function LogEntries({
  entries,
  names,
  empty,
}: {
  entries: readonly LogEntryDto[]
  names: Names
  /** What to say when the page is empty. */
  empty: string
}) {
  if (entries.length === 0) {
    return <p className='text-sm text-muted-foreground'>{empty}</p>
  }
  return (
    <ol className='flex flex-col divide-y divide-border rounded-xl border border-border'>
      {entries.map((entry) => {
        const subject = subjectLine(entry, names)
        return (
          <li key={entry.id} className='flex flex-col gap-1 p-3 text-sm'>
            {subject ? (
              <p className='font-medium break-words text-muted-foreground'>
                {subject}
              </p>
            ) : null}
            <p className='break-words'>
              <span className='font-medium'>
                {personName(names, entry.actorId)}
              </span>{' '}
              {entryWording(entry, names)}
            </p>
            {entry.action === 'comment.added' ? (
              <p className='break-words whitespace-pre-line'>
                {entry.details.text}
              </p>
            ) : null}
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
              <p className='break-words text-muted-foreground'>
                Because {entrySentence(entry.cause, names)}
              </p>
            ) : null}
            <p className='text-muted-foreground'>
              <Time dateTime={entry.occurredAt} />
            </p>
          </li>
        )
      })}
    </ol>
  )
}
