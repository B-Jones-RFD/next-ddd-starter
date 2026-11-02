import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const baseURL = `http://localhost:${PORT}`

// E2E runs the production build in real mode on a fresh SQLite file (§11), so
// no run sees another run's data and no spec depends on the seed.
const databasePath = join(tmpdir(), `next-ddd-starter-e2e-${Date.now()}.db`)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run db:migrate && npx next build && npx next start --port ${PORT}`,
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { DATABASE_PATH: databasePath },
  },
})
