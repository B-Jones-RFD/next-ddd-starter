import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getTheme,
  getThemeChoice,
  setThemeChoice,
  subscribeTheme,
} from '@/app/_lib/theme/theme'

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

describe('theme choice', () => {
  it('follows the system when nothing is stored', () => {
    expect(getThemeChoice()).toBe('system')
    expect(html.hasAttribute('data-theme')).toBe(false)
  })

  it('applies and stores an explicit choice', () => {
    setThemeChoice('dark')

    expect(html.getAttribute('data-theme')).toBe('dark')
    expect(getThemeChoice()).toBe('dark')
  })

  it('goes back to the system when System is chosen', () => {
    setThemeChoice('dark')

    setThemeChoice('system')

    expect(html.hasAttribute('data-theme')).toBe(false)
    expect(getThemeChoice()).toBe('system')
  })
})

describe('theme on screen', () => {
  it('follows a live OS change while the choice is System', () => {
    const switchSystemTheme = givenSystemTheme('light')
    const onChange = vi.fn()
    subscribeTheme(onChange)

    switchSystemTheme('dark')

    expect(onChange).toHaveBeenCalledOnce()
    expect(getTheme()).toBe('dark')
  })

  it('ignores the OS while the choice is explicit', () => {
    const switchSystemTheme = givenSystemTheme('light')
    setThemeChoice('light')
    const onChange = vi.fn()
    subscribeTheme(onChange)

    switchSystemTheme('dark')

    expect(onChange).not.toHaveBeenCalled()
    expect(getTheme()).toBe('light')
  })

  it('notifies when the choice changes', () => {
    const onChange = vi.fn()
    subscribeTheme(onChange)

    setThemeChoice('dark')

    expect(onChange).toHaveBeenCalledOnce()
    expect(getTheme()).toBe('dark')
  })

  it('stops notifying once unsubscribed', () => {
    const switchSystemTheme = givenSystemTheme('light')
    const onChange = vi.fn()
    const unsubscribe = subscribeTheme(onChange)

    unsubscribe()
    switchSystemTheme('dark')
    setThemeChoice('dark')

    expect(onChange).not.toHaveBeenCalled()
  })
})
