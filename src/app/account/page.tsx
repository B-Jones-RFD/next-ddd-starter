import type { Metadata } from 'next'
import { Suspense } from 'react'

import { LogEntries } from '@/app/_components/audit/log-entries'
import { LogPager } from '@/app/_components/audit/log-nav'
import { readLogParams } from '@/app/_lib/audit/log-params'
import { requireActor } from '@/app/_lib/auth/get-actor'
import {
  DisplayNameForm,
  PasswordForm,
  SignOutEverywhereForm,
} from '@/app/account/account-forms'
import { getUserLog } from '@/modules/audit/api'

export const metadata: Metadata = { title: 'Your account' }

// #region account-page
export default function AccountPage({ searchParams }: PageProps<'/account'>) {
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
      <Suspense
        fallback={
          <p className='text-muted-foreground'>Loading your User log…</p>
        }
      >
        <UserLog searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function AccountSections() {
  const actor = await requireActor('/account')
  // #endregion account-page

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

/**
 * The viewer's User log: their own sign-ins, sign-outs and account
 * changes, newest first, 50 at a time. It trails a change by one relay
 * drain.
 */
async function UserLog({
  searchParams,
}: Pick<PageProps<'/account'>, 'searchParams'>) {
  const path = '/account'
  const actor = await requireActor(path)
  const params = readLogParams(await searchParams)
  const page = await getUserLog({
    actorId: actor.userId,
    ...(params.before ? { before: params.before } : {}),
  })

  return (
    <section aria-labelledby='user-log-heading' className='flex flex-col gap-4'>
      <h2 id='user-log-heading' className='font-heading text-lg font-semibold'>
        User log
      </h2>
      <p className='text-sm text-muted-foreground'>
        Your sign-ins, sign-outs and account changes, newest first. Only you can
        see them.
      </p>
      {page.ok ? (
        <>
          <LogEntries
            entries={page.value.entries}
            names={page.value.names}
            empty='Nothing recorded yet.'
          />
          <LogPager
            label='User log pages'
            noun='entries'
            path={path}
            params={params}
            olderBefore={page.value.olderBefore}
          />
        </>
      ) : (
        <p className='text-sm text-muted-foreground'>
          Your User log isn’t available.
        </p>
      )}
    </section>
  )
}
