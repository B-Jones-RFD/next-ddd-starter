import type { View } from '@/modules/boards/api'

export type { View }

/**
 * The view a page's `?view=` asks for: `archived`, or else the default
 * `active`, so a stray value shows the usual page rather than an error.
 */
export function viewFrom(value: string | string[] | undefined): View {
  return value === 'archived' ? 'archived' : 'active'
}

/** The URL of `path` in `view`: the Active view has no query. */
export function viewPath(path: string, view: View): string {
  return view === 'archived' ? `${path}?view=archived` : path
}
