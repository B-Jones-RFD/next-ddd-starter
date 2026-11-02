'use client'

import { useLayoutEffect } from 'react'

import { applyThemeChoice, getThemeChoice } from '@/app/_lib/theme/theme'

/**
 * Re-applies the stored theme choice after hydration. The inline script has
 * already set it before paint, but React's dev Strict Mode remount resets
 * `<html>` to its JSX attributes. In production this is a no-op.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyThemeChoice(getThemeChoice())
  }, [])
  return null
}
