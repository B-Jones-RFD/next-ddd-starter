import Link from 'next/link'

import { viewPath, type View } from '@/app/_lib/view/view'

const VIEWS = [
  { view: 'active', label: 'Active' },
  { view: 'archived', label: 'Archived' },
] as const satisfies readonly { view: View; label: string }[]

/**
 * The Active/Archived switch: two links that set `?view=` on `path`, so it
 * works before hydration and the URL says which view is open. The current
 * one is marked with `aria-current` and its weight, not color alone.
 */
export function ViewSwitch({
  path,
  current,
  label,
}: {
  path: string
  current: View
  /** Names the switch, such as "Board view". */
  label: string
}) {
  return (
    <nav aria-label={label}>
      <ul className='inline-flex gap-1 rounded-lg border border-border p-1'>
        {VIEWS.map(({ view, label: text }) => (
          <li key={view}>
            <Link
              href={viewPath(path, view)}
              aria-current={view === current ? 'page' : undefined}
              className='inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:font-semibold aria-[current=page]:text-foreground'
            >
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
