import { RefocusScope } from '@/app/_components/refocus'
import { AddListForm } from '@/app/boards/[boardId]/add-list-form'
import { AddTaskForm } from '@/app/boards/[boardId]/add-task-form'
import { JumpStrip } from '@/app/boards/[boardId]/jump-strip'
import { ListHeader } from '@/app/boards/[boardId]/list-header'
import {
  listHeadingId,
  movesFor,
  type BoardMode,
} from '@/app/boards/[boardId]/list-places'
import {
  listSuccessors,
  taskSuccessors,
} from '@/app/boards/[boardId]/successors'
import { TaskCard } from '@/app/boards/[boardId]/task-card'
import type { ListDto } from '@/modules/boards/api'

// A column is the full width of a phone, snapping as it swipes, and a fixed
// width from `sm` up, where the columns sit side by side.
const COLUMN = 'w-[calc(100vw-2rem)] shrink-0 snap-start sm:w-72'

/**
 * The board's lists as columns, in board order, then the form that adds
 * one. Each column holds its tasks, then the form that adds a task. Tab
 * order follows the DOM, column by column (§10). The Archived view shows
 * the archived lists and tasks, which can only be restored, and an
 * archived board is read-only.
 */
export function BoardLists({
  boardId,
  lists,
  formKey,
  mode,
}: {
  boardId: string
  lists: ListDto[]
  /** Keys the add form, so a sign-out never leaves a half-typed name. */
  formKey: string
  mode: BoardMode
}) {
  const ids = lists.map((list) => list.id)
  // Lists and tasks share one scope: a moved task's ⋯ gets focus back when
  // its list's order changes, or when it lands in another list. A list's
  // state is part of it, so restoring a list that stays in view counts.
  const order = lists.flatMap((list) => [
    list.archived ? `${list.id}:archived` : list.id,
    ...list.tasks.map((task) => task.id),
  ])

  return (
    <RefocusScope order={order}>
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
                mode={mode}
                moves={movesFor(ids, index)}
                successors={listSuccessors(lists, list.id)}
              />
              {list.tasks.length > 0 && (
                <ol className='flex flex-col gap-2'>
                  {list.tasks.map((task, position) => (
                    <TaskCard
                      key={task.id}
                      boardId={boardId}
                      listId={list.id}
                      task={task}
                      moves={movesFor(
                        list.tasks.map((t) => t.id),
                        position
                      )}
                      lists={lists}
                      mode={mode}
                      successors={taskSuccessors(lists, list.id, task.id)}
                    />
                  ))}
                </ol>
              )}
              {mode === 'active' && (
                <AddTaskForm key={formKey} boardId={boardId} listId={list.id} />
              )}
            </section>
          ))}
          {mode === 'active' && (
            <div
              className={`${COLUMN} flex flex-col gap-3 rounded-xl border border-dashed border-border p-3`}
            >
              {lists.length === 0 && (
                <p>No lists yet. Add one to start organizing tasks.</p>
              )}
              <AddListForm key={formKey} boardId={boardId} />
            </div>
          )}
          {mode !== 'active' && lists.length === 0 && (
            <p className='text-muted-foreground'>
              {mode === 'archived'
                ? 'Nothing on this board is archived.'
                : 'This board has no lists.'}
            </p>
          )}
        </div>
      </div>
    </RefocusScope>
  )
}
