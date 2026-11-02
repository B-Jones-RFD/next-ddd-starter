import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Two projects (§11 Testing): `unit` runs domain, application, contract and
// edge-mapper tests in node, and `ui` runs Client Components in jsdom.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        // Server code runs here, so `server-only` is an empty module (ADR 0012).
        resolve: {
          alias: {
            'server-only': fileURLToPath(
              new URL('./tests/fixtures/server-only.ts', import.meta.url)
            ),
          },
        },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/e2e/**'],
          setupFiles: ['tests/fixtures/unit-setup.ts'],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['tests/**/*.test.tsx'],
          exclude: ['tests/e2e/**'],
          setupFiles: ['tests/fixtures/ui-setup.ts'],
        },
      },
    ],
  },
})
