import { test as setup, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { AUTH_FILE } from './constants'

const USER_EMAIL = 'user@example.com'
const USER_PASSWORD = 'user-password-123' // local seed only, see supabase/seeds/01_users.sql

setup('log in as seeded user and save storage state', async ({ page }) => {
  mkdirSync('e2e/.auth', { recursive: true })
  await page.goto('/login')
  await page.getByLabel('Email').fill(USER_EMAIL)
  await page.getByLabel('Password').fill(USER_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByTestId('btn-call-rpc')).toBeVisible()
  await page.context().storageState({ path: AUTH_FILE })
})
