// Where to go after signing in (§9). The `next` search param is untrusted,
// so only a path on this origin is followed, and anything else lands on
// `/boards`. Shared by pages, actions and `proxy.ts`.

const FALLBACK = '/boards'
const BASE = 'http://same-origin.invalid'

/** `next` if it is a path on this origin, otherwise `/boards`. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return FALLBACK
  if (next.includes('\\')) return FALLBACK
  let url: URL
  try {
    url = new URL(next, BASE)
  } catch {
    return FALLBACK
  }
  if (url.origin !== BASE) return FALLBACK
  return `${url.pathname}${url.search}${url.hash}`
}

/** The sign-in page, returning to `path` afterwards. */
export function signInPath(path: string): string {
  return `/sign-in?next=${encodeURIComponent(path)}`
}
