import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Time } from '@/app/_components/time'

const zone = process.env.TZ

beforeEach(() => {
  // Node re-reads the zone whenever TZ is assigned.
  process.env.TZ = 'America/New_York'
})

afterEach(() => {
  process.env.TZ = zone
})

describe('Time', () => {
  it('shows the time in the viewer’s time zone, keeping the instant in dateTime', () => {
    render(<Time dateTime='2026-03-01T15:04:00.000Z' />)

    const time = screen.getByText('1 Mar 2026, 10:04')
    expect(time.tagName).toBe('TIME')
    expect(time.getAttribute('datetime')).toBe('2026-03-01T15:04:00.000Z')
  })

  it('renders on the server in UTC, saying so, since it can’t know the zone', () => {
    expect(renderToString(<Time dateTime='2026-03-01T15:04:00.000Z' />)).toBe(
      '<time dateTime="2026-03-01T15:04:00.000Z">1 Mar 2026, 15:04 UTC</time>'
    )
  })
})
