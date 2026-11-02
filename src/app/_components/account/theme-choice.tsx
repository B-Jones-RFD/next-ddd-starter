'use client'

import { useSyncExternalStore } from 'react'

import {
  getThemeChoice,
  setThemeChoice,
  subscribeTheme,
  type ThemeChoice as Choice,
} from '@/app/_lib/theme/theme'

const CHOICES: readonly { value: Choice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/**
 * The System / Light / Dark choice, kept on this device (ADR 0018). Native
 * radios give arrow-key movement with no custom shortcuts (§10). The server
 * never knows the choice, so it renders System until hydration.
 */
export function ThemeChoice() {
  const choice = useSyncExternalStore(
    subscribeTheme,
    getThemeChoice,
    () => 'system' as const
  )

  return (
    <fieldset className='flex flex-col gap-2'>
      <legend className='mb-2 text-sm font-medium'>Theme</legend>
      {CHOICES.map(({ value, label }) => (
        <label
          key={value}
          className='flex min-h-6 cursor-pointer items-center gap-2 text-sm'
        >
          <input
            type='radio'
            name='theme'
            value={value}
            checked={choice === value}
            onChange={() => setThemeChoice(value)}
            className='size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
          />
          {label}
        </label>
      ))}
    </fieldset>
  )
}
