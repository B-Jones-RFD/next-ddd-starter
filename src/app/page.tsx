import Link from 'next/link'

export default function Home() {
  return (
    <div className='flex flex-col items-start gap-4'>
      <h1 className='font-heading text-2xl font-semibold'>Task Board</h1>
      <p className='text-muted-foreground'>
        Organize work as tasks on shared boards.
      </p>
      <div className='flex gap-6'>
        <Link
          href='/sign-up'
          className='rounded-sm font-medium text-foreground underline underline-offset-4'
        >
          Create an account
        </Link>
        <Link
          href='/sign-in'
          className='rounded-sm font-medium text-foreground underline underline-offset-4'
        >
          Sign in
        </Link>
      </div>
    </div>
  )
}
