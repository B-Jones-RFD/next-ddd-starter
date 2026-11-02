import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeChoice } from '@/app/_components/account/theme-choice'
import { setThemeChoice, THEME_STORAGE_KEY } from '@/app/_lib/theme/theme'

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

describe('ThemeChoice', () => {
  it('offers System, Light and Dark, with System checked by default', () => {
    render(<ThemeChoice />)

    expect(screen.getByRole('group', { name: 'Theme' })).toBeTruthy()
    expect(
      screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))
    ).toEqual(['system', 'light', 'dark'])
    expect(
      (screen.getByRole('radio', { name: 'System' }) as HTMLInputElement)
        .checked
    ).toBe(true)
  })

  it('shows the stored choice as checked', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(<ThemeChoice />)

    expect(
      (screen.getByRole('radio', { name: 'Dark' }) as HTMLInputElement).checked
    ).toBe(true)
  })

  it('applies and stores a choice on this device', () => {
    render(<ThemeChoice />)

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(html.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(
      (screen.getByRole('radio', { name: 'Dark' }) as HTMLInputElement).checked
    ).toBe(true)
  })

  it('follows a choice made elsewhere on the page', () => {
    render(<ThemeChoice />)

    act(() => setThemeChoice('light'))

    expect(
      (screen.getByRole('radio', { name: 'Light' }) as HTMLInputElement).checked
    ).toBe(true)
  })
})
