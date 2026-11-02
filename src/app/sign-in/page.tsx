import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { safeNextPath } from '@/app/_lib/auth/next-path'
import { SignInForm } from '@/app/sign-in/sign-in-form'

export const metadata: Metadata = { title: 'Sign in' }

// Never redirects a visitor away, even with a cookie: a stale one would
// loop (§9). Signing in here replaces whatever session the browser held.
export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <div className='mx-auto flex w-full max-w-sm flex-col gap-6'>
      <h1 className='font-heading text-2xl font-semibold'>Sign in</h1>
      {/* No form in the fallback: one filled in there would lose `next`. */}
      <Suspense
        fallback={
          <p role='status' className='text-muted-foreground'>
            Loading…
          </p>
        }
      >
        <SignInFormFor searchParams={searchParams} />
      </Suspense>
      <p className='text-sm text-muted-foreground'>
        New here?{' '}
        <Link
          href='/sign-up'
          className='rounded-sm font-medium text-foreground underline underline-offset-4'
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}

async function SignInFormFor({
  searchParams,
}: Pick<PageProps<'/sign-in'>, 'searchParams'>) {
  const { next } = await searchParams
  return (
    <SignInForm next={safeNextPath(typeof next === 'string' ? next : null)} />
  )
}
