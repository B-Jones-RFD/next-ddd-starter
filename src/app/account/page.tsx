import type { Metadata } from 'next'
import { Suspense } from 'react'

import { requireActor } from '@/app/_lib/auth/get-actor'
import {
  DisplayNameForm,
  PasswordForm,
  SignOutEverywhereForm,
} from '@/app/account/account-forms'

export const metadata: Metadata = { title: 'Your account' }

export default function AccountPage() {
  return (
    <div className='mx-auto flex w-full max-w-md flex-col gap-8'>
      <h1 className='font-heading text-2xl font-semibold'>Your account</h1>
      <Suspense
        fallback={
          <p role='status' className='text-muted-foreground'>
            Loading your account…
          </p>
        }
      >
        <AccountSections />
      </Suspense>
    </div>
  )
}

async function AccountSections() {
  const actor = await requireActor('/account')

  return (
    <>
      <section
        aria-labelledby='display-name-heading'
        className='flex flex-col gap-4'
      >
        <h2
          id='display-name-heading'
          className='font-heading text-lg font-semibold'
        >
          Display name
        </h2>
        {/* Keyed by the saved name, so a rename refills the input. */}
        <DisplayNameForm
          key={`${actor.userId}:${actor.displayName}`}
          displayName={actor.displayName}
        />
      </section>
      <section
        aria-labelledby='password-heading'
        className='flex flex-col gap-4'
      >
        <h2
          id='password-heading'
          className='font-heading text-lg font-semibold'
        >
          Password
        </h2>
        <p className='text-sm text-muted-foreground'>
          Changing your password signs you out on every other browser.
        </p>
        <PasswordForm key={actor.userId} />
      </section>
      <section
        aria-labelledby='sessions-heading'
        className='flex flex-col gap-4'
      >
        <h2
          id='sessions-heading'
          className='font-heading text-lg font-semibold'
        >
          Sessions
        </h2>
        <p className='text-sm text-muted-foreground'>
          Sign out on every browser, this one included.
        </p>
        <SignOutEverywhereForm key={actor.userId} />
      </section>
    </>
  )
}
