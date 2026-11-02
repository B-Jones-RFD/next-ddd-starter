import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeSync } from '@/app/_components/theme-sync'
import { THEME_STORAGE_KEY } from '@/app/_lib/theme/theme'

import { givenSystemTheme } from '@tests/fixtures/system-theme'

const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  html.removeAttribute('data-theme')
  givenSystemTheme('light')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ThemeSync', () => {
  it('re-applies the stored choice when React has reset <html>', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(<ThemeSync />)

    expect(html.getAttribute('data-theme')).toBe('dark')
  })
})
