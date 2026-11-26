import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: /global\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 5173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
