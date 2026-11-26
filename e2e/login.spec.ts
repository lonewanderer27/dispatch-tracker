import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('unauthenticated visitor is redirected to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})
