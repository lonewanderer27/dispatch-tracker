import { test, expect } from '@playwright/test'

// Runs against the edge function served locally with EXCHANGE_API_URL pointed at the stub.
test('edge button shows a numeric USD to EUR rate', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('btn-invoke-edge').click()
  const result = page.getByTestId('result-edge')
  await expect(result).toContainText('Rate')
  const text = await result.innerText()
  expect(text).toMatch(/Rate\s*\n?\s*\d+(\.\d+)?/)
})
