'use client'

import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { cn } from 'cn'

// The app's menu, on Base UI's primitive (§10). The primitive gives arrow
// keys, Enter/Space and Escape, and returns focus to the trigger on close.
// Under reduced motion it only fades.

const Menu = MenuPrimitive.Root
const MenuTrigger = MenuPrimitive.Trigger

function MenuContent({
  className,
  children,
  ...props
}: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={4} align='end' className='z-50'>
        <MenuPrimitive.Popup
          className={cn(
            'flex min-w-44 flex-col rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none',
            'origin-(--transform-origin) transition-[opacity,scale] duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-95 motion-safe:data-starting-style:scale-95',
            className
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex min-h-8 w-full cursor-default items-center gap-2 rounded-md px-2 text-left text-sm outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        className
      )}
      {...props}
    />
  )
}

function MenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      className={cn('my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

export { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger }
