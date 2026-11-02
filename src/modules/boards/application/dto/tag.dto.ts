import type { TagColor } from '@/modules/boards/domain/board/tag-color'

/** A tag as pages show it: always its name, decorated by its Tag color. */
export type TagDto = {
  id: string
  name: string
  color: TagColor
}
