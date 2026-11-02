// Tells the relay that rows were appended, so a save kicks a drain (§6). The
// target lives on globalThis, so an append in any bundle reaches the relay
// started from instrumentation.

const globals = globalThis as { __outboxSignal?: EventTarget }

function target(): EventTarget {
  globals.__outboxSignal ??= new EventTarget()
  return globals.__outboxSignal
}

/** Signals after the current synchronous work, so after the caller's COMMIT. */
export function signalOutboxAppended(): void {
  setImmediate(() => target().dispatchEvent(new Event('appended')))
}

/** Calls `listener` after every append. Returns an unsubscribe function. */
export function onOutboxAppended(listener: () => void): () => void {
  target().addEventListener('appended', listener)
  return () => target().removeEventListener('appended', listener)
}
