import { test as setup, expect } from '@playwright/test'

import { HomePage } from '#page-objects/home.page.js'
import { SIGNED_IN_STATE, signInThroughB2C } from '#support/sign-in.js'

// Runs before the journey tests: signs the test user in through B2C once and saves the browser's cookies, which each
// test starts from (playwright.config.js). The cookie banner isn't answered here, so the tests still see it.
setup('sign in through Azure AD B2C', async ({ page, baseURL }) => {
  // B2C's sign-in page and its redirects allow up to 60s each.
  setup.setTimeout(180_000)

  await page.goto('/', { timeout: 60_000 })
  await signInThroughB2C(page, baseURL)

  await expect(new HomePage(page).pageHeading).toHaveText('Home')

  await page.context().storageState({ path: SIGNED_IN_STATE })
})
