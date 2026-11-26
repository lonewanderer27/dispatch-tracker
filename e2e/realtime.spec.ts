import { test, expect, type BrowserContext } from '@playwright/test'
import { AUTH_FILE } from './constants'

// Two browser contexts, same user: a change in one shows up in the other without a reload.
test('a todo created in one tab appears live in a second tab', async ({ browser }) => {
  const ctxA: BrowserContext = await browser.newContext({ storageState: AUTH_FILE })
  const ctxB: BrowserContext = await browser.newContext({ storageState: AUTH_FILE })
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  await pageB.goto('/todos')
  await pageA.goto('/todos/create')

  const title = `realtime ${Date.now()}`
  await pageA.getByPlaceholder('What needs doing?').fill(title)
  await pageA.getByRole('button', { name: /save/i }).click()

  await expect(pageB.getByRole('cell', { name: title })).toBeVisible({ timeout: 10_000 })

  await ctxA.close()
  await ctxB.close()
})
