'use client'

import { Popover } from '@base-ui/react/popover'
import Link from 'next/link'
import { useActionState } from 'react'

import { ThemeChoice } from '@/app/_components/account/theme-choice'
import { FormAlert } from '@/app/_components/form/form-alert'
import { SubmitButton } from '@/app/_components/form/submit-button'
import { IDLE } from '@/app/_lib/actions/action-state'
import { signOutAction } from '@/app/actions'

/**
 * The signed-in user's avatar, opening their account menu: the theme
 * choice, account settings and sign-out (§10). The trigger is named for the
 * user, and the avatar itself is decoration.
 */
export function AccountMenu({ displayName }: { displayName: string }) {
  const [state, signOut] = useActionState(signOutAction, IDLE)
  const initial = displayName.trim().charAt(0).toUpperCase() || '?'

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Account menu for ${displayName}`}
        className='flex size-9 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      >
        <span aria-hidden>{initial}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align='end'>
          <Popover.Popup className='flex w-64 flex-col gap-4 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none'>
            <Popover.Title className='truncate font-heading font-semibold'>
              {displayName}
            </Popover.Title>
            <ThemeChoice />
            <Link
              href='/account'
              className='rounded-sm text-sm font-medium text-foreground underline underline-offset-4'
            >
              Account settings
            </Link>
            <form action={signOut} className='flex flex-col gap-2'>
              <FormAlert
                error={state.status === 'error' ? state.error : undefined}
              />
              <SubmitButton className='w-full'>Sign out</SubmitButton>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
