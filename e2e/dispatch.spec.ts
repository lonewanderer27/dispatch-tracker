import { test, expect, type Page } from '@playwright/test'

// Local seed only (supabase/seeds/). The seed has hundreds of clients, so list checks open the
// clients list with a page size large enough to hold them all.
const ALL_CLIENTS = '/clients?current=1&pageSize=1000'

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('link', { name: 'Clients' })).toBeVisible()
}

// antd marks required fields with a leading "*" in the accessible name, e.g. "* Name".
function textField(page: Page, label: string) {
  return page.getByRole('textbox', { name: new RegExp(`^\\* ?${label}$`) })
}

// The confirmation DeleteButton opens ("Are you sure?" with Cancel and Delete).
async function confirmDelete(page: Page) {
  await page.getByRole('tooltip').getByRole('button', { name: 'Delete', exact: true }).click()
}

async function pickOption(page: Page, field: string, option: string) {
  const combobox = page.getByRole('combobox', { name: field })
  await combobox.click()
  // Lists with many rows (the seed has hundreds of clients) only load ten options, so search first.
  await combobox.fill(option)
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .getByText(option, { exact: true })
    .click()
  await expect(page.locator('.ant-select-selection-item').filter({ hasText: option })).toBeVisible()
}

test.describe('as a normal user', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('sees Clients and Contacts read-only', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')

    await page.getByRole('link', { name: 'Clients' }).click()
    await page.goto(ALL_CLIENTS)
    await expect(page.getByRole('cell', { name: 'Sam Newbie', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /create/i })).toBeDisabled()

    await page.getByRole('link', { name: 'Contacts' }).click()
    await expect(page.getByRole('cell', { name: 'Priya Shah' })).toBeVisible()
    await expect(page.getByRole('button', { name: /create/i })).toBeDisabled()
  })
})

test.describe('as an admin', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('creates, edits and deletes a client and its contacts', async ({ page }) => {
    // A long journey (client and contact: create, edit, delete) on top of a seed with hundreds of
    // clients; CI runs about twice as slow as a laptop, so give it more than the 30 s default.
    test.setTimeout(90_000)
    // Unique per run, so reruns never collide with rows left by an earlier run.
    const stamp = Date.now()
    const client = `E2E Client ${stamp}`
    const edited = `${client} Renamed`
    const last = `Person${stamp}`
    const lastEdited = `Persona${stamp}`
    await signIn(page, 'admin@example.com', 'admin-password-123')

    // Client: create, then rename.
    await page.goto('/clients/create')
    await pickOption(page, 'Company', 'The Tidy Team')
    await textField(page, 'Name').fill(client)
    await page.getByRole('button', { name: /save/i }).click()
    await page.goto(ALL_CLIENTS)
    await expect(page.getByRole('cell', { name: client, exact: true })).toBeVisible()

    await page.getByRole('row', { name: client }).getByRole('button', { name: 'edit' }).click()
    // Wait for the record to load first, or the loaded value overwrites the typed one.
    await expect(textField(page, 'Name')).toHaveValue(client)
    await textField(page, 'Name').fill(edited)
    await page.getByRole('button', { name: /save/i }).click()
    await page.goto(ALL_CLIENTS)
    await expect(page.getByRole('cell', { name: edited, exact: true })).toBeVisible()

    // Contact: create for the client, check the number is kept as entered, then edit it.
    await page.goto('/contacts/create')
    await pickOption(page, 'Client', edited)
    await textField(page, 'First name').fill('Test')
    await textField(page, 'Last name').fill(last)
    await textField(page, 'Contact number').fill('0412 345 678')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByRole('cell', { name: `Test ${last}` })).toBeVisible()
    await expect(
      page
        .getByRole('row', { name: `Test ${last}` })
        .getByRole('cell', { name: '0412 345 678', exact: true }),
    ).toBeVisible()

    await page
      .getByRole('row', { name: `Test ${last}` })
      .getByRole('button', { name: 'edit' })
      .click()
    await expect(textField(page, 'Last name')).toHaveValue(last)
    await textField(page, 'Last name').fill(lastEdited)
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByRole('cell', { name: `Test ${lastEdited}` })).toBeVisible()

    // Delete the contact, then the client.
    await page.goto('/contacts')
    await page
      .getByRole('row', { name: `Test ${lastEdited}` })
      .getByRole('button', { name: 'delete' })
      .click()
    await confirmDelete(page)
    await expect(page.getByRole('cell', { name: `Test ${lastEdited}` })).toHaveCount(0)

    await page.goto(ALL_CLIENTS)
    await page.getByRole('row', { name: edited }).getByRole('button', { name: 'delete' }).click()
    await confirmDelete(page)
    await expect(page.getByRole('cell', { name: edited, exact: true })).toHaveCount(0)
  })
})
