import { test, expect } from '@playwright/test'

test('create and complete a todo', async ({ page }) => {
  const title = `e2e todo ${Date.now()}`
  await page.goto('/todos/create')
  await page.getByPlaceholder('What needs doing?').fill(title)
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByRole('cell', { name: title })).toBeVisible()
})
