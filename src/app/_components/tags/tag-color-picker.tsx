import { FieldError } from '@/app/_components/form/field'
import { TagBadge } from '@/app/_components/tags/tag-badge'
import {
  TAG_COLOR_NAMES,
  TAG_COLOR_STYLES,
  type TagColorName,
} from '@/app/_components/tags/tag-colors'

/**
 * The Tag color picker: one radio per color, each shown as a swatch with its
 * name, so it is chosen by name (§10). `id` keeps two pickers on one page
 * apart.
 */
export function TagColorPicker({
  id,
  defaultValue = 'gray',
  error,
}: {
  id: string
  defaultValue?: TagColorName
  error?: string
}) {
  const errorId = `${id}-error`
  return (
    <fieldset
      className='flex flex-col gap-2'
      aria-describedby={error ? errorId : undefined}
    >
      <legend className='mb-2 text-sm leading-none font-medium'>
        Tag color
      </legend>
      <div className='flex flex-wrap gap-x-4 gap-y-2'>
        {TAG_COLOR_NAMES.map((color) => (
          <label key={color} className='flex items-center gap-2'>
            <input
              type='radio'
              name='color'
              value={color}
              defaultChecked={color === defaultValue}
              className='size-6 accent-primary'
            />
            <TagBadge
              tag={{ name: TAG_COLOR_STYLES[color].label, color }}
              className='text-sm'
            />
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  )
}
