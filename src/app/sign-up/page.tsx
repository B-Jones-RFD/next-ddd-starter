import type { Metadata } from 'next'

import { SignUpForm } from '@/app/sign-up/sign-up-form'

export const metadata: Metadata = { title: 'Create your account' }

export default function SignUpPage() {
  return (
    <div className='mx-auto flex w-full max-w-sm flex-col gap-6'>
      <h1 className='font-heading text-2xl font-semibold'>
        Create your account
      </h1>
      <SignUpForm />
    </div>
  )
}
