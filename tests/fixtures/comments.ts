import { toBoardId } from '@/modules/boards/domain/board/board-id'
import type { Comment } from '@/modules/boards/domain/comment/comment'
import { toCommentId } from '@/modules/boards/domain/comment/comment-id'
import type { CommentText } from '@/modules/boards/domain/comment/comment-text'
import { toTaskId } from '@/modules/boards/domain/task/task-id'
import { toUserId } from '@/shared/kernel/user-id'

let sequence = 0

/**
 * A saved comment by `user-ben` on `task-comments` of `board-comments`, for
 * repository contract suites.
 */
export function aComment(overrides: Partial<Comment> = {}): Comment {
  sequence += 1
  return {
    id: toCommentId(`comment-${sequence}`),
    taskId: toTaskId('task-comments'),
    boardId: toBoardId('board-comments'),
    authorId: toUserId('user-ben'),
    text: `Comment ${sequence}` as CommentText,
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    version: 1,
    ...overrides,
  }
}
