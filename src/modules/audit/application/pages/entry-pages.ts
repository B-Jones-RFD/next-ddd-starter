import type {
  AuditEntryDto,
  SubjectEntryDto,
} from '@/modules/audit/application/dto/activity.dto'
import type {
  EntryPage,
  IActivityReader,
} from '@/modules/audit/application/ports/activity-reader.port'
import {
  namedIds,
  REORDER_ACTIONS,
} from '@/modules/audit/domain/audit-entry/audit-entry'

/** Entries per page in every view of the Audit log (ADR 0010). */
export const PAGE_SIZE = 50

/**
 * The page request for a view: one more than a page, so the view can tell
 * whether an older page exists, with reorders left out unless asked for.
 */
export function pageRequest(input: {
  before?: string | undefined
  includeReorders?: boolean | undefined
}): EntryPage {
  return {
    before: input.before ?? null,
    limit: PAGE_SIZE + 1,
    excluding: input.includeReorders ? [] : REORDER_ACTIONS,
  }
}

/**
 * Turns what the reader found for `pageRequest` into a page: at most 50
 * entries, each with the entry that caused it, the current names they name
 * (plus any `extraNames(entry)`), and the cursor for the next, older page.
 */
export async function toPage<E extends AuditEntryDto>(
  reader: IActivityReader,
  found: readonly E[],
  extraNames: (entry: E) => readonly string[] = () => []
): Promise<{
  entries: (E & { cause: AuditEntryDto | null })[]
  names: Record<string, string>
  olderBefore: string | null
}> {
  const entries = found.slice(0, PAGE_SIZE)
  const causeIds = entries.flatMap((entry) =>
    entry.causationId ? [entry.causationId] : []
  )
  const causes = new Map(
    (await reader.byIds(causeIds)).map((cause) => [cause.id, cause])
  )
  const ids = new Set([
    ...[...entries, ...causes.values()].flatMap((entry) => namedIds(entry)),
    ...entries.flatMap(extraNames),
  ])

  return {
    entries: entries.map((entry) => ({
      ...entry,
      cause: (entry.causationId && causes.get(entry.causationId)) || null,
    })),
    names: await reader.names([...ids]),
    olderBefore:
      found.length > PAGE_SIZE
        ? (entries[entries.length - 1]?.id ?? null)
        : null,
  }
}

/** The list or task a Board log entry is about, whose name the view shows. */
export function subjectName(entry: SubjectEntryDto): readonly string[] {
  return entry.subject === 'list' || entry.subject === 'task'
    ? [entry.subjectId]
    : []
}
