/**
 * The board's segment, with its `@modal` slot: a task link followed from the
 * board opens the task as a dialog over it (an intercepted route), while a
 * direct load opens the task's own page (§10).
 */
export default function BoardLayout({
  children,
  modal,
}: LayoutProps<'/boards/[boardId]'>) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
