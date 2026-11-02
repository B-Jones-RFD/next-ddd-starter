'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState, type ReactNode } from 'react'

import { Dialog, DialogContent, DialogTitle } from '@/app/_components/ui/dialog'
import { taskLinkId, taskPath } from '@/app/boards/[boardId]/task-places'

/**
 * The task as a dialog over the board (§10): centered from `sm` up and
 * full-screen below. It focuses the task's title heading on open, and on
 * close returns focus to the task's link on the board, then goes back to
 * the board's URL. Whether it is open follows the URL, so a preserved
 * (hidden) copy never reopens stale.
 */
export function TaskDialog({
  boardId,
  taskId,
  title,
  children,
}: {
  boardId: string
  taskId: string
  title: string
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const heading = useRef<HTMLHeadingElement | null>(null)
  const [closing, setClosing] = useState(false)
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setClosing(false)
  }
  const open = pathname === taskPath(boardId, taskId) && !closing

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setClosing(true)
      }}
      onOpenChangeComplete={(next) => {
        if (!next && closing) router.back()
      }}
    >
      <DialogContent
        initialFocus={heading}
        finalFocus={() => document.getElementById(taskLinkId(taskId))}
        closeLabel='Close task'
        className='overflow-y-auto max-sm:inset-0 max-sm:h-full max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 sm:max-h-[90vh] sm:max-w-2xl'
      >
        {/* Focusable only by script: the dialog moves focus here on open. */}
        <DialogTitle
          ref={heading}
          tabIndex={-1}
          className='rounded-sm text-xl break-words outline-none focus-visible:ring-3 focus-visible:ring-ring'
        >
          {title}
        </DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}
