import { test, expect, type Page } from '@playwright/test'

// Local seed only (supabase/seeds/04_cleaning_jobs.sql): hundreds of jobs from Aug to Dec 2026.
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('link', { name: 'Cleaning Jobs' })).toBeVisible()
}

async function openCleaningJobs(page: Page) {
  await page.getByRole('link', { name: 'Cleaning Jobs' }).click()
  await expect(page.getByRole('columnheader', { name: 'Scheduled Date' })).toBeVisible()
  await expect(page.locator('tbody tr.ant-table-row').first()).toBeVisible()
}

// Types into the zone select so the option is rendered (the list has hundreds of zones).
async function chooseZone(page: Page, zone: string) {
  const select = page.getByTestId('time-zone-select')
  // Click the select itself: the selected value sits on top of its search input.
  await select.click()
  await page.keyboard.type(zone)
  // The option text is also repeated in a hidden accessibility list, so target the visible option.
  await page
    .locator(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content',
    )
    .getByText(zone, { exact: true })
    .click()
}

function dataRows(page: Page) {
  return page.locator('tbody tr.ant-table-row')
}

test.describe('Cleaning Jobs', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('lists the jobs with every column, newest first, ten to a page', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    const headers = await page.getByRole('columnheader').allTextContents()
    expect(headers).toEqual([
      'Assignee',
      'Company',
      'Status',
      'Scheduled Date',
      'Client Name',
      'Address',
      'Cleaning Type',
      'Notes',
      'Feedback',
      'Rating',
      'Rate (CAD)',
    ])
    await expect(dataRows(page)).toHaveCount(10)
    // Rates are shown in Canadian dollars.
    await expect(dataRows(page).first().getByText(/^\$\d/)).toBeVisible()
    // Hundreds of jobs: the pager shows more than one page.
    await expect(page.locator('.ant-pagination-item').last()).not.toHaveText('1')
  })

  test('shows Company, Status and Cleaning Type as pills in their seeded colours', async ({
    page,
  }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    // Columns: 0 Assignee, 1 Company, 2 Status, ... 6 Cleaning Type (see the header test).
    // supabase/seeds/02_reference_data.sql gives every seeded row a colour other than the default.
    const rows = await dataRows(page).count()
    for (let i = 0; i < rows; i++) {
      const cells = dataRows(page).nth(i).locator('td')
      await expect(cells.nth(1).locator('.ant-tag')).toHaveClass(/ant-tag-(red|cyan|magenta|blue)/)
      await expect(cells.nth(2).locator('.ant-tag')).toHaveClass(/ant-tag-(blue|cyan|orange|green)/)
      await expect(cells.nth(2).locator('.ant-tag')).toHaveText(
        /^(Booked|Confirmed|In Progress|Done)$/,
      )
      for (const tag of await cells.nth(6).locator('.ant-tag').all()) {
        await expect(tag).not.toHaveClass(/ant-tag-default/)
      }
    }
  })

  test('filters by date range, cleaning type and feedback, and clears them', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    await page.getByText('Last 6 months', { exact: true }).click()
    const filters = page.getByRole('group', { name: 'Active filters' })
    await expect(filters.getByText('Scheduled: Last 6 months')).toBeVisible()

    await page.getByRole('button', { name: 'Filters' }).click()
    const type = page.getByRole('combobox', { name: 'Cleaning type' })
    await type.click()
    await type.fill('Deep')
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .getByText('Deep', { exact: true })
      .click()
    await expect(filters.getByText('Cleaning type: Deep')).toBeVisible()
    // Every row that is left has the Deep tag.
    await expect(dataRows(page).first()).toBeVisible()
    const rows = await dataRows(page).count()
    for (let i = 0; i < rows; i++) {
      await expect(
        dataRows(page)
          .nth(i)
          .locator('.ant-tag', { hasText: /^Deep$/ }),
      ).toBeVisible()
    }

    await page.getByRole('searchbox', { name: 'Search feedback' }).fill('excellent')
    await page.getByRole('searchbox', { name: 'Search feedback' }).press('Enter')
    await expect(filters.getByText(/Feedback: .excellent./)).toBeVisible()

    await filters.getByRole('button', { name: 'Clear all' }).click()
    await expect(filters).toHaveCount(0)
    await expect(dataRows(page)).toHaveCount(10)
  })

  test('shows an empty state when nothing matches and a way back', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    await page.getByRole('searchbox', { name: 'Search feedback' }).fill('zzzz no such feedback')
    await page.getByRole('searchbox', { name: 'Search feedback' }).press('Enter')
    await expect(page.getByText('No jobs match these filters')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(dataRows(page)).toHaveCount(10)
  })

  test('flips the Scheduled Date order on every click', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    const header = page.getByRole('columnheader', { name: 'Scheduled Date' })
    const firstDate = () => dataRows(page).first().locator('td').nth(3)
    await expect(header).toHaveAttribute('aria-sort', 'descending')
    const newest = await firstDate().textContent()

    await header.click()
    await expect(header).toHaveAttribute('aria-sort', 'ascending')
    await expect(firstDate()).not.toHaveText(newest ?? '')

    await header.click()
    await expect(header).toHaveAttribute('aria-sort', 'descending')
    await expect(firstDate()).toHaveText(newest ?? '')
  })

  test('sorts by a column and returns to newest first on the third click', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    const header = page.getByRole('columnheader', { name: 'Client Name' })
    await header.click()
    await expect(header).toHaveAttribute('aria-sort', 'ascending')
    await header.click()
    await expect(header).toHaveAttribute('aria-sort', 'descending')
    await header.click()
    await expect(header).not.toHaveAttribute('aria-sort', /ascending|descending/)
    await expect(page.getByRole('columnheader', { name: 'Scheduled Date' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    // Feedback is not sortable.
    await expect(page.getByRole('columnheader', { name: 'Feedback' })).not.toHaveClass(
      /ant-table-column-has-sorters/,
    )
  })

  test('shows the schedule in the time zone the user chooses and remembers it', async ({
    page,
  }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    const firstDate = () => dataRows(page).first().locator('td').nth(3)
    const select = page.getByTestId('time-zone-select')
    await expect(select).toContainText('America/Edmonton')
    const edmonton = await firstDate().textContent()

    try {
      await chooseZone(page, 'UTC')
      await expect(select).toContainText('UTC')
      await expect(firstDate()).not.toHaveText(edmonton ?? '')

      // The choice is saved on the profile, so it survives a reload.
      await page.reload()
      await expect(page.getByTestId('time-zone-select')).toContainText('UTC')
    } finally {
      // Put the seeded user back to the default so reruns start the same way.
      await chooseZone(page, 'America/Edmonton')
      await expect(page.getByTestId('time-zone-select')).toContainText('America/Edmonton')
    }
  })
})
