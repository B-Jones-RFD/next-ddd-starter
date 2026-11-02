import Link from 'next/link'

import { requireActor } from '@/app/_lib/auth/get-actor'
import { tagsHeadingId, taskPath } from '@/app/boards/[boardId]/task-places'
import {
  TagTaskForm,
  TaskTagChip,
} from '@/app/boards/[boardId]/tasks/[taskId]/task-tag-forms'
import { listTags, type TagDto, type TaskDto } from '@/modules/boards/api'

/**
 * The task's Tags section: its tags, each with a remove button, and a
 * picker of the board's other tags. Reads the board's tags itself, inside
 * its own `<Suspense>`.
 */
export async function TaskTags({ task }: { task: TaskDto }) {
  const actor = await requireActor(taskPath(task.boardId, task.id))
  const tags = await listTags({ actorId: actor.userId, boardId: task.boardId })
  // The task's own read just passed, so the board's tags are readable too,
  // unless access changed in between: then show the task's tags only.
  const board: TagDto[] = tags.ok ? tags.value : []
  const attached = new Set(task.tags.map((tag) => tag.id))
  const available = board.filter((tag) => !attached.has(tag.id))

  return (
    <section
      aria-labelledby={tagsHeadingId(task.id)}
      className='flex flex-col gap-3'
    >
      <h2
        id={tagsHeadingId(task.id)}
        tabIndex={-1}
        className='font-heading text-lg font-semibold outline-none'
      >
        Tags
      </h2>
      {task.tags.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No tags yet.</p>
      ) : (
        <ul className='flex flex-wrap gap-2'>
          {task.tags.map((tag) => (
            <TaskTagChip
              key={tag.id}
              boardId={task.boardId}
              taskId={task.id}
              tag={tag}
            />
          ))}
        </ul>
      )}
      {available.length > 0 ? (
        <TagTaskForm
          key={task.tags.map((tag) => tag.id).join()}
          boardId={task.boardId}
          taskId={task.id}
          available={available}
        />
      ) : (
        board.length === 0 && (
          <p className='text-sm text-muted-foreground'>
            This board has no tags.{' '}
            <Link
              href={`/boards/${task.boardId}/settings/tags`}
              className='rounded-sm font-medium text-foreground underline underline-offset-4'
            >
              Manage tags
            </Link>
          </p>
        )
      )}
    </section>
  )
}
