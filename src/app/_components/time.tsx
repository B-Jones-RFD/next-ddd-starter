'use client'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useSyncExternalStore } from 'react'

dayjs.extend(utc)

const FORMAT = 'D MMM YYYY, HH:mm'

// The time zone never changes under a rendered page, so nothing to subscribe to.
function subscribe(): () => void {
  return () => {}
}

/**
 * A timestamp in the viewer's local time zone, inside `<time dateTime>`
 * (§10). The server can't know that zone, so it renders the time in UTC,
 * saying so, and the browser swaps in local time once it hydrates.
 */
export function Time({ dateTime }: { dateTime: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => dayjs(dateTime).format(FORMAT),
    () => `${dayjs.utc(dateTime).format(FORMAT)} UTC`
  )
  return <time dateTime={dateTime}>{text}</time>
}
