import { Time } from '@/app/_components/time'
import {
  entrySentence,
  entryWording,
  personName,
  type Names,
} from '@/app/_lib/audit/entry-wording'
import type { ActivityEntryDto, LogEntryDto } from '@/modules/audit/api'

/**
 * What one Audit entry says, wherever it is listed (Activity, the Board log,
 * the User log): who did what, a comment's text or a description's before
 * and after, what caused it, and when.
 */
export function EntryBody({
  entry,
  names,
}: {
  entry: ActivityEntryDto | LogEntryDto
  names: Names
}) {
  return (
    <>
      <p className='break-words'>
        <span className='font-medium'>{personName(names, entry.actorId)}</span>{' '}
        {entryWording(entry, names)}
      </p>
      {entry.action === 'comment.added' ? (
        <p className='break-words whitespace-pre-line'>{entry.details.text}</p>
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
    </>
  )
}
