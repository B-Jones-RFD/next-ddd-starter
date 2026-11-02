// The theme choice (ADR 0018). It lives in this device's `localStorage` and is
// never read on the server. `themeScript` applies it before first paint, and
// the functions below read and change it in the browser.

/** What the user picked. `system` follows the OS. */
export type ThemeChoice = 'system' | 'light' | 'dark'

/** The theme on screen once `system` is resolved. */
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

/**
 * Runs in `<head>` before first paint. It sets `data-theme` only for an
 * explicit Light or Dark, and leaves System to `prefers-color-scheme` in CSS,
 * so the system theme works without JS.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`

function isExplicit(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

export function getThemeChoice(): ThemeChoice {
  const stored = readStored()
  return isExplicit(stored) ? stored : 'system'
}

/** Sets `data-theme` on `<html>` for the given choice. */
export function applyThemeChoice(choice: ThemeChoice): void {
  const html = document.documentElement
  if (isExplicit(choice)) html.setAttribute('data-theme', choice)
  else html.removeAttribute('data-theme')
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Storage can be unavailable (private mode). The choice still applies.
  }
  applyThemeChoice(choice)
  for (const listener of [...listeners]) listener()
}

/** The theme on screen: the explicit choice, or the OS theme for System. */
export function getTheme(): Theme {
  const choice = getThemeChoice()
  if (isExplicit(choice)) return choice
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Calls `onChange` whenever the theme on screen may have changed: a new
 * choice, or an OS switch while the choice is System. Shaped for
 * `useSyncExternalStore`. Returns the unsubscribe function.
 */
export function subscribeTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY)
  const onSystemChange = () => {
    if (getThemeChoice() === 'system') onChange()
  }
  listeners.add(onChange)
  media.addEventListener('change', onSystemChange)
  return () => {
    listeners.delete(onChange)
    media.removeEventListener('change', onSystemChange)
  }
}
