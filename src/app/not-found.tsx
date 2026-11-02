import Link from 'next/link'

export default function NotFound() {
  return (
    <div className='flex flex-col items-start gap-4'>
      <h1 className='font-heading text-2xl font-semibold'>Page not found</h1>
      <p className='text-muted-foreground'>
        This page doesn’t exist, or you don’t have access to it.
      </p>
      <Link
        href='/'
        className='rounded-sm font-medium text-foreground underline underline-offset-4'
      >
        Go to the home page
      </Link>
    </div>
  )
}
