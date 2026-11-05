import { test, expect } from '@playwright/test'

import { HomePage } from '#page-objects/home.page.js'

test.describe('waste-submit-reg-packaging-fe is up', () => {
  test('the health check responds', async ({ request }) => {
    const response = await request.get('/health')

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ message: 'success' })
  })

  test('the home page loads', { tag: '@compat' }, async ({ page }) => {
    const homePage = new HomePage(page)

    await homePage.open()

    await expect(page).toHaveTitle(/^Home \|/)
    await expect(homePage.pageHeading).toHaveText('Home')
  })
})
