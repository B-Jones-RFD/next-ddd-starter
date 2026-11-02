'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cn } from 'cn'
import { XIcon } from 'lucide-react'

// The app's dialog, on Base UI's primitive (§10). The primitive moves focus
// in on open and back to the trigger on close, and traps it while open.
// Under reduced motion it only fades.

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogContent({
  className,
  children,
  closeLabel = 'Close',
  ...props
}: DialogPrimitive.Popup.Props & { closeLabel?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className='fixed inset-0 z-50 bg-background/80 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0' />
      <DialogPrimitive.Popup
        data-slot='dialog-content'
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-lg outline-none',
          'transition-[opacity,scale] duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-95 motion-safe:data-starting-style:scale-95',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className='absolute top-4 right-4 flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring'
        >
          <XIcon aria-hidden className='size-4' />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn('pr-8 font-heading text-lg font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
}
