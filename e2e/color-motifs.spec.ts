import { test, expect, type Page } from '@playwright/test'

// Local seed only (supabase/seeds/02_reference_data.sql): the Deep cleaning type is purple.
const TYPE = 'Deep'
const SEEDED_LABEL = 'Purple'
const SEEDED_CLASS = /ant-tag-purple/

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('link', { name: 'Cleaning types' })).toBeVisible()
}

// The visible dropdown (antd keeps closed ones in the page, hidden).
function openDropdown(page: Page) {
  return page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
}

// Opens the cleaning type's Edit page, picks a colour by its label and saves.
async function setTypeColor(page: Page, name: string, label: string) {
  await page.goto('/cleaning-types')
  await page.getByRole('row', { name }).getByRole('button', { name: 'edit' }).click()
  // Wait for the record to load first, or the loaded value overwrites the picked one.
  await expect(page.getByRole('textbox', { name: /Name$/ })).toHaveValue(name)
  // Click the select itself: the chosen pill sits on top of its input.
  await page.locator('.ant-form-item', { hasText: 'Color' }).locator('.ant-select').click()
  await openDropdown(page)
    .locator('.ant-select-item-option')
    .getByText(label, { exact: true })
    .click()
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()
}

function typePill(page: Page, name: string) {
  return page.getByRole('row', { name }).locator('.ant-tag', { hasText: name })
}

test.describe('Color motifs', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a User sees the colour but cannot edit a cleaning type', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await page.goto('/cleaning-types')
    await expect(typePill(page, TYPE)).toHaveClass(SEEDED_CLASS)
    await expect(
      page.getByRole('row', { name: TYPE }).getByRole('button', { name: 'edit' }),
    ).toBeDisabled()
  })

  test('an Admin changes a cleaning type colour and the jobs list shows it', async ({ page }) => {
    test.setTimeout(60_000)
    await signIn(page, 'admin@example.com', 'admin-password-123')
    await page.goto('/cleaning-types')
    await expect(typePill(page, TYPE)).toHaveClass(SEEDED_CLASS)

    try {
      await setTypeColor(page, TYPE, 'Red')
      await expect(typePill(page, TYPE)).toHaveClass(/ant-tag-red/)

      // The Cleaning Jobs list, filtered to Deep jobs: every Deep pill is red now.
      await page.getByRole('link', { name: 'Cleaning Jobs' }).click()
      await expect(page.locator('tbody tr.ant-table-row').first()).toBeVisible()
      await page.getByRole('button', { name: 'Filters' }).click()
      const type = page.getByRole('combobox', { name: 'Cleaning type' })
      await type.click()
      await type.fill(TYPE)
      await openDropdown(page).getByText(TYPE, { exact: true }).click()
      await expect(
        page.getByRole('group', { name: 'Active filters' }).getByText(`Cleaning type: ${TYPE}`),
      ).toBeVisible()
      const pills = page.locator('tbody tr.ant-table-row .ant-tag', { hasText: /^Deep$/ })
      await expect(pills.first()).toBeVisible()
      for (const pill of await pills.all()) await expect(pill).toHaveClass(/ant-tag-red/)
    } finally {
      // Put the seeded colour back so reruns start the same way.
      await setTypeColor(page, TYPE, SEEDED_LABEL)
      await expect(typePill(page, TYPE)).toHaveClass(SEEDED_CLASS)
    }
  })
})
