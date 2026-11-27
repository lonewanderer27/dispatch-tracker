import { expect, test } from '@playwright/test'

// Local only: supabase/config.jsonc has enable_confirmations = false, so a sign-up gets a session at once.
// The user it creates stays until `pnpm db:reset`.
test.use({ storageState: { cookies: [], origins: [] } })

test('someone who signs up has no role and sees only the notice', async ({ page }) => {
  const email = `signup-${String(Date.now())}@example.com`
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('a-long-password-123')
  await page.getByRole('button', { name: /sign up|register/i }).click()

  await expect(page.getByText('Your account has no access yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  // No page content: neither the dashboard buttons nor any list.
  await expect(page.getByTestId('btn-call-rpc')).toHaveCount(0)
})
