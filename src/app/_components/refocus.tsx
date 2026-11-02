'use client'

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefCallback,
} from 'react'

// The one refocus hook (§10). When an action moves or removes the focused
// element, its trigger asks for focus on the logical successor (after a ⋯-menu
// reorder, the moved item's own ⋯ in its new place). The request waits for
// the render in which the scope's order changes, which is when the refreshed
// page arrives, and then focuses the successor once.

type Pending = { targetId: string; signature: string }

type Scope = {
  register(id: string, element: HTMLElement | null): void
  request(targetId: string): () => void
}

const RefocusContext = createContext<Scope | null>(null)

/** Tracks one ordered collection, such as a board's lists, by their ids. */
export function RefocusScope({
  order,
  children,
}: {
  order: readonly string[]
  children: ReactNode
}) {
  const signature = order.join('\n')
  const elements = useRef(new Map<string, HTMLElement>())
  const pending = useRef<Pending | null>(null)
  const current = useRef(signature)

  useLayoutEffect(() => {
    current.current = signature
    const request = pending.current
    if (!request || request.signature === signature) return
    pending.current = null
    elements.current.get(request.targetId)?.focus()
  }, [signature])

  const scope = useMemo<Scope>(
    () => ({
      register(id, element) {
        if (element) elements.current.set(id, element)
        else elements.current.delete(id)
      },
      request(targetId) {
        const request = { targetId, signature: current.current }
        pending.current = request
        return () => {
          if (pending.current === request) pending.current = null
        }
      },
    }),
    []
  )

  return <RefocusContext value={scope}>{children}</RefocusContext>
}

/**
 * For the element that should get focus back for item `id`: attach `ref` to
 * it, and call `refocus()` when an action starts that will move the item (or
 * `refocus(successorId)` when it will disappear). Call the returned function
 * if the action fails, so a later change of order doesn't take focus.
 */
export function useRefocus(id: string): {
  ref: RefCallback<HTMLElement>
  refocus: (targetId?: string) => () => void
} {
  const scope = useContext(RefocusContext)
  if (!scope) throw new Error('useRefocus needs a RefocusScope')

  const ref = useCallback<RefCallback<HTMLElement>>(
    (element) => {
      scope.register(id, element)
      return () => scope.register(id, null)
    },
    [scope, id]
  )
  const refocus = useCallback(
    (targetId: string = id) => scope.request(targetId),
    [scope, id]
  )
  return { ref, refocus }
}
