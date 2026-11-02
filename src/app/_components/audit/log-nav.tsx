import Link from 'next/link'

import { logHref, type LogParams } from '@/app/_lib/audit/log-params'

const linkClass =
  'rounded-sm text-sm font-medium text-foreground underline underline-offset-4'

/**
 * The "show reorders" toggle for Activity and the Board log: a link that
 * flips `?reorders=1` and starts again from the newest page.
 */
export function ReordersToggle({
  path,
  params,
}: {
  path: string
  params: LogParams
}) {
  return (
    <Link
      href={logHref(path, {
        before: undefined,
        includeReorders: !params.includeReorders,
      })}
      scroll={false}
      className={`self-start ${linkClass}`}
    >
      {params.includeReorders ? 'Hide reorders' : 'Show reorders'}
    </Link>
  )
}

/** Links to the newest page and to the next, older one, where they exist. */
export function LogPager({
  label,
  noun,
  path,
  params,
  olderBefore,
}: {
  /** The navigation landmark's name, such as "Activity pages". */
  label: string
  /** What the pages hold, such as "activity" or "entries". */
  noun: string
  path: string
  params: LogParams
  olderBefore: string | null
}) {
  if (!params.before && !olderBefore) return null
  return (
    <nav aria-label={label} className='flex gap-4'>
      {params.before ? (
        <Link
          href={logHref(path, { ...params, before: undefined })}
          scroll={false}
          className={linkClass}
        >
          Show newest {noun}
        </Link>
      ) : null}
      {olderBefore ? (
        <Link
          href={logHref(path, { ...params, before: olderBefore })}
          scroll={false}
          className={linkClass}
        >
          Show older {noun}
        </Link>
      ) : null}
    </nav>
  )
}
