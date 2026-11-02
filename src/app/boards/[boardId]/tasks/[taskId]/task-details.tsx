import {
  TaskDescriptionForm,
  TaskTitleForm,
} from '@/app/boards/[boardId]/tasks/[taskId]/task-forms'
import type { TaskDto } from '@/modules/boards/api'

/**
 * The task's body, shared by its dialog and its page, under the heading
 * each gives it: where it sits, then its title and description forms.
 */
export function TaskDetails({
  task,
  formKey,
}: {
  task: TaskDto
  /** Keys the forms, so a sign-out never leaves half-typed text. */
  formKey: string
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
    </div>
  )
}
