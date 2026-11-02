import { EntryBody } from '@/app/_components/audit/entry-body'
import type { Names } from '@/app/_lib/audit/entry-wording'
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
            <EntryBody entry={entry} names={names} />
          </li>
        )
      })}
    </ol>
  )
}
