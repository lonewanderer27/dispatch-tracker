import { test, expect, type Page } from '@playwright/test'

const USER_EDIT_URL = '/users/edit/22222222-2222-2222-2222-222222222222'

async function signInAsSuperAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('superadmin@example.com')
  await page.getByLabel('Password').fill('superadmin-password-123') // local seed only
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByTestId('btn-invoke-edge')).toBeVisible()
}

async function renameUser(page: Page, name: string) {
  await page.goto(USER_EDIT_URL)
  const field = page.getByLabel('Display name')
  await expect(field).not.toHaveValue('')
  await field.fill(name)
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByRole('cell', { name, exact: true })).toBeVisible()
}

test.describe('as a normal user', () => {
  test('the Users menu item is hidden and /users redirects home', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('btn-invoke-edge')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Companies' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
    await page.goto('/users')
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('as a super admin', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('sees Users and can change a display name', async ({ page }) => {
    await signInAsSuperAdmin(page)
    await page.getByRole('link', { name: 'Users' }).click()
    await expect(page.getByRole('cell', { name: 'Local User', exact: true })).toBeVisible()
    try {
      await renameUser(page, 'Local User (edited)')
    } finally {
      await renameUser(page, 'Local User') // leave the seeded user as we found it
    }
  })
})
