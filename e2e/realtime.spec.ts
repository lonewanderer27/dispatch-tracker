import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { AUTH_FILE } from './constants'

// Resolves once the server confirms this page's subscription to todos (a Phoenix phx_reply with
// status ok on the todos topic). Without this wait, a write in the other tab can happen before the
// subscription exists, and the change is never delivered.
function subscribedToTodos(page: Page): Promise<void> {
  return new Promise((resolve) => {
    page.on('websocket', (ws) => {
      ws.on('framereceived', ({ payload }) => {
        if (typeof payload !== 'string') return
        if (
          payload.includes('phx_reply') &&
          payload.includes('resources/todos') &&
          payload.includes('"status":"ok"')
        ) {
          resolve()
        }
      })
    })
  })
}

// Two browser contexts, same user: a change in one shows up in the other without a reload.
test('a todo created in one tab appears live in a second tab', async ({ browser }) => {
  const ctxA: BrowserContext = await browser.newContext({ storageState: AUTH_FILE })
  const ctxB: BrowserContext = await browser.newContext({ storageState: AUTH_FILE })
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  const subscribed = subscribedToTodos(pageB)
  await pageB.goto('/todos')
  await subscribed
  await pageA.goto('/todos/create')

  const title = `realtime ${Date.now()}`
  await pageA.getByPlaceholder('What needs doing?').fill(title)
  await pageA.getByRole('button', { name: /save/i }).click()

  await expect(pageB.getByRole('cell', { name: title })).toBeVisible({ timeout: 10_000 })

  await ctxA.close()
  await ctxB.close()
})
