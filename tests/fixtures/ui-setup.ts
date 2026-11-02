import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so React Testing Library can't register its
// own cleanup. Unmount every render between tests here instead.
afterEach(() => {
  cleanup()
})
