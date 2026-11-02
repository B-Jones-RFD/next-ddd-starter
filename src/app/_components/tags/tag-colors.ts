import type { TagDto } from '@/modules/boards/api'

/** One of the eight Tag color names the domain stores. */
export type TagColorName = TagDto['color']

/**
 * Each Tag color's name as the picker shows it, and the token pair it maps
 * to in `globals.css` (§10). Typed by the domain's union, so a new color
 * fails to compile until it has its tokens. Classes are spelled out in full
 * so Tailwind finds them.
 */
export const TAG_COLOR_STYLES = {
  gray: { label: 'Gray', className: 'bg-tag-gray text-tag-gray-foreground' },
  red: { label: 'Red', className: 'bg-tag-red text-tag-red-foreground' },
  orange: {
    label: 'Orange',
    className: 'bg-tag-orange text-tag-orange-foreground',
  },
  amber: {
    label: 'Amber',
    className: 'bg-tag-amber text-tag-amber-foreground',
  },
  green: {
    label: 'Green',
    className: 'bg-tag-green text-tag-green-foreground',
  },
  teal: { label: 'Teal', className: 'bg-tag-teal text-tag-teal-foreground' },
  blue: { label: 'Blue', className: 'bg-tag-blue text-tag-blue-foreground' },
  violet: {
    label: 'Violet',
    className: 'bg-tag-violet text-tag-violet-foreground',
  },
} as const satisfies Record<TagColorName, { label: string; className: string }>

/** The palette in picker order. */
export const TAG_COLOR_NAMES = Object.keys(TAG_COLOR_STYLES) as TagColorName[]

/** `value` if it names a Tag color, else `fallback`: for refilling a picker. */
export function asTagColor(
  value: string | undefined,
  fallback: TagColorName
): TagColorName {
  return TAG_COLOR_NAMES.find((name) => name === value) ?? fallback
}
