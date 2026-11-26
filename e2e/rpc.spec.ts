import { test, expect } from '@playwright/test'

test('RPC button shows counts and a progress bar', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('btn-call-rpc').click()
  const result = page.getByTestId('result-rpc')
  await expect(result).toContainText('Total')
  await expect(result).toContainText('%')
})
