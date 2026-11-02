import { RefocusScope } from '@/app/_components/refocus'
import { AddListForm } from '@/app/boards/[boardId]/add-list-form'
import { JumpStrip } from '@/app/boards/[boardId]/jump-strip'
import { ListHeader } from '@/app/boards/[boardId]/list-header'
import { listHeadingId, movesFor } from '@/app/boards/[boardId]/list-places'
import type { ListDto } from '@/modules/boards/api'

// A column is the full width of a phone, snapping as it swipes, and a fixed
// width from `sm` up, where the columns sit side by side.
const COLUMN = 'w-[calc(100vw-2rem)] shrink-0 snap-start sm:w-72'

/**
 * The board's lists as columns, in board order, then the form that adds
 * one. Tab order follows the DOM, column by column (§10).
 */
export function BoardLists({
  boardId,
  lists,
  formKey,
}: {
  boardId: string
  lists: ListDto[]
  /** Keys the add form, so a sign-out never leaves a half-typed name. */
  formKey: string
}) {
  const ids = lists.map((list) => list.id)

  return (
    <RefocusScope order={ids}>
      <div className='flex flex-col gap-3'>
        {lists.length > 0 && <JumpStrip lists={lists} />}
        <div className='-mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-4 overflow-x-auto px-4 pb-4 sm:snap-none'>
          {lists.map((list, index) => (
            <section
              key={list.id}
              aria-labelledby={listHeadingId(list.id)}
              className={`${COLUMN} flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground`}
            >
              <ListHeader
                boardId={boardId}
                list={list}
                moves={movesFor(ids, index)}
              />
            </section>
          ))}
          <div
            className={`${COLUMN} flex flex-col gap-3 rounded-xl border border-dashed border-border p-3`}
          >
            {lists.length === 0 && (
              <p>No lists yet. Add one to start organizing tasks.</p>
            )}
            <AddListForm key={formKey} boardId={boardId} />
          </div>
        </div>
      </div>
    </RefocusScope>
  )
}
