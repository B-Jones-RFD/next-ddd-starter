import { vi } from 'vitest'

type SystemTheme = 'light' | 'dark'

/**
 * jsdom has no `matchMedia`. This installs one whose
 * `(prefers-color-scheme: dark)` query follows `theme`, and returns a
 * function that switches the OS theme and fires `change` like a browser does.
 */
export function givenSystemTheme(theme: SystemTheme) {
  let current = theme
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const isDarkQuery = (query: string) =>
    query.replace(/\s/g, '') === '(prefers-color-scheme:dark)'

  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => {
    const list = {
      media: query,
      get matches() {
        return isDarkQuery(query) && current === 'dark'
      },
      onchange: null,
      addEventListener: (_: string, listener: never) => listeners.add(listener),
      removeEventListener: (_: string, listener: never) =>
        listeners.delete(listener),
      addListener: (listener: never) => listeners.add(listener),
      removeListener: (listener: never) => listeners.delete(listener),
      dispatchEvent: () => true,
    }
    return list as unknown as MediaQueryList
  })

  return function switchSystemTheme(next: SystemTheme) {
    current = next
    const event = { matches: next === 'dark' } as MediaQueryListEvent
    for (const listener of [...listeners]) listener(event)
  }
}
