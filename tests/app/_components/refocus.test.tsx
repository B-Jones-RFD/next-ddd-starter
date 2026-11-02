import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RefocusScope, useRefocus } from '@/app/_components/refocus'

let cancels: Record<string, () => void> = {}

/** An item whose ⋯ button asks for focus on `target` once the order changes. */
function Item({ id, target }: { id: string; target?: string }) {
  const { ref, refocus } = useRefocus(id)
  return (
    <button
      ref={ref}
      type='button'
      onClick={() => {
        cancels[id] = refocus(target)
      }}
    >
      Actions for {id}
    </button>
  )
}

function Items({
  order,
  targets = {},
}: {
  order: string[]
  targets?: Record<string, string>
}) {
  return (
    <RefocusScope order={order}>
      {order.map((id) => (
        <Item key={id} id={id} target={targets[id]} />
      ))}
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
