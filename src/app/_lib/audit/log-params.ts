/** A route's query, as Next passes it to a page. */
export type Query = Record<string, string | string[] | undefined>

/**
 * Where a view of the Audit log is: which page (`before`, a cursor) and
 * whether it shows reorders. Both live in the URL, so paging and the
 * "show reorders" toggle are plain links that work before hydration.
 */
export type LogParams = {
  before: string | undefined
  includeReorders: boolean
}

/** Reads `?before=…&reorders=1` from a route's query. */
export function readLogParams(query: Query): LogParams {
  const { before, reorders } = query
  return {
    before: typeof before === 'string' && before ? before : undefined,
    includeReorders: reorders === '1',
  }
}

/** `path` with `params` as its query, leaving out the defaults. */
export function logHref(path: string, params: LogParams): string {
  const query = new URLSearchParams()
  if (params.includeReorders) query.set('reorders', '1')
  if (params.before) query.set('before', params.before)
  const search = query.toString()
  return search ? `${path}?${search}` : path
}
