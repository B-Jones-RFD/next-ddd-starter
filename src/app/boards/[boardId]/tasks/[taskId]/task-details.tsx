import { Suspense } from 'react'

import {
  TaskDescriptionForm,
  TaskTitleForm,
} from '@/app/boards/[boardId]/tasks/[taskId]/task-forms'
import { TaskTags } from '@/app/boards/[boardId]/tasks/[taskId]/task-tags'
import type { TaskDto } from '@/modules/boards/api'
import type { ActorDto } from '@/modules/identity/api'

/**
 * The task's body, shared by its dialog and its page, under the heading
 * each gives it: where it sits, then its title and description forms, then
 * its sections, each in its own `<Suspense>`.
 */
export function TaskDetails({
  task,
  formKey,
  actorId,
}: {
  task: TaskDto
  /** Keys the forms, so a sign-out never leaves half-typed text. */
  formKey: string
  /** The reader, for the sections that read on their own. */
  actorId: ActorDto['userId']
}) {
  return (
    <div className='flex flex-col gap-6'>
      <p className='text-sm text-muted-foreground'>
        {task.boardName} · in {task.listName}
      </p>
      <TaskTitleForm
        key={`${formKey}-title`}
        boardId={task.boardId}
        task={task}
      />
      <TaskDescriptionForm
        key={`${formKey}-description`}
        boardId={task.boardId}
        task={task}
      />
      <Suspense
        fallback={
          <p role='status' className='text-sm text-muted-foreground'>
            Loading tags…
          </p>
        }
      >
        <TaskTags actorId={actorId} task={task} />
      </Suspense>
    </div>
  )
}
