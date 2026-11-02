import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RefocusScope, useRefocus } from '@/app/_components/refocus'

let cancels: Record<string, () => void> = {}

/** An item whose ⋯ button asks for focus on `targets` once the order changes. */
function Item({ id, targets = [] }: { id: string; targets?: string[] }) {
  const { ref, refocus } = useRefocus(id)
  return (
    <button
      ref={ref}
      type='button'
      onClick={() => {
        cancels[id] = refocus(...targets)
      }}
    >
      Actions for {id}
    </button>
  )
}

/** A column heading that can take focus by script, keyed `heading`. */
function Heading() {
  const { ref } = useRefocus('heading')
  return (
    <h2 ref={ref} tabIndex={-1}>
      Column
    </h2>
  )
}

function Items({
  order,
  targets = {},
}: {
  order: string[]
  targets?: Record<string, string | string[]>
}) {
  return (
    <RefocusScope order={order}>
      <Heading />
      {order.map((id) => {
        const target = targets[id]
        return (
          <Item
            key={id}
            id={id}
            targets={typeof target === 'string' ? [target] : target}
          />
        )
      })}
      <input aria-label='Elsewhere' />
    </RefocusScope>
  )
}

const button = (id: string) =>
  screen.getByRole('button', { name: `Actions for ${id}` })
const elsewhere = () => screen.getByRole('textbox', { name: 'Elsewhere' })

/** Asks for a refocus from `id`'s button, then loses focus, as a reorder does. */
function requestFrom(id: string) {
  button(id).focus()
  fireEvent.click(button(id))
  elsewhere().focus()
}

describe('useRefocus', () => {
  it('focuses the moved item’s button in its new place once the order changes', () => {
    cancels = {}
    const { rerender } = render(<Items order={['a', 'b', 'c']} />)
    requestFrom('c')

    rerender(<Items order={['c', 'a', 'b']} />)

    expect(document.activeElement).toBe(button('c'))
  })

  it('waits while the order is unchanged', () => {
    cancels = {}
    const { rerender } = render(<Items order={['a', 'b']} />)
    requestFrom('b')

    rerender(<Items order={['a', 'b']} />)
    expect(document.activeElement).toBe(elsewhere())

    rerender(<Items order={['b', 'a']} />)
    expect(document.activeElement).toBe(button('b'))
  })

  it('focuses another item when asked to, as after a removal', () => {
    cancels = {}
    const { rerender } = render(
      <Items order={['a', 'b', 'c']} targets={{ b: 'c' }} />
    )
    requestFrom('b')

    rerender(<Items order={['a', 'c']} />)

    expect(document.activeElement).toBe(button('c'))
  })

  it('focuses the first successor still there, as after archiving the last item', () => {
    cancels = {}
    const { rerender } = render(
      <Items order={['a', 'b']} targets={{ b: ['c', 'heading'] }} />
    )
    requestFrom('b')

    rerender(<Items order={['a']} />)

    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Column' })
    )
  })

  it('does nothing once cancelled, as after a failed move', () => {
    cancels = {}
    const { rerender } = render(<Items order={['a', 'b']} />)
    requestFrom('b')

    cancels.b?.()
    rerender(<Items order={['b', 'a']} />)

    expect(document.activeElement).toBe(elsewhere())
  })

  it('moves focus only once, not on later changes of order', () => {
    cancels = {}
    const { rerender } = render(<Items order={['a', 'b']} />)
    requestFrom('b')
    rerender(<Items order={['b', 'a']} />)

    elsewhere().focus()
    rerender(<Items order={['a', 'b']} />)

    expect(document.activeElement).toBe(elsewhere())
  })
})
