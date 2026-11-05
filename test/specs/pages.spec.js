import { test, expect } from '@playwright/test'

import { CookieBanner } from '#components/cookie-banner.js'
import { AboutPage } from '#page-objects/about.page.js'
import { CookiesPage } from '#page-objects/cookies.page.js'
import { Page } from '#page-objects/page.js'

// Every page and form a user can reach on the frontend, beyond the home page (home.spec.js). Besides checking each
// works, they're what the security scan sees: ZAP only scans the pages the tests visit, and npm run test:security
// leaves out the @accessibility tests. A new page needs a test here too.
test.describe('the pages a user can reach', () => {
  test('the about page loads', async ({ page }) => {
    const aboutPage = new AboutPage(page)

    await aboutPage.open()

    await expect(aboutPage.pageHeading).toContainText('About')
  })

  test('the cookies page loads', async ({ page }) => {
    const cookiesPage = new CookiesPage(page)

    await cookiesPage.open()

    await expect(cookiesPage.pageHeading).toHaveText('Cookies')
  })

  test('saving cookie settings on the cookies page', async ({ page }) => {
    const cookiesPage = new CookiesPage(page)

    await cookiesPage.open()
    await cookiesPage.saveAnalytics('Yes')

    await expect(cookiesPage.successBanner).toBeVisible()
    await expect(cookiesPage.analyticsOption('Yes')).toBeChecked()
  })

  test('accepting analytics cookies from the banner', async ({ page }) => {
    const aboutPage = new AboutPage(page)
    const cookieBanner = new CookieBanner(page)

    await aboutPage.open()
    await cookieBanner.accept()

    await expect(cookieBanner.acceptedMessage).toBeVisible()
  })

  test('rejecting analytics cookies from the banner', async ({ page }) => {
    const aboutPage = new AboutPage(page)
    const cookieBanner = new CookieBanner(page)

    await aboutPage.open()
    await cookieBanner.reject()

    await expect(cookieBanner.rejectedMessage).toBeVisible()
  })

  test('a page that does not exist shows page not found', async ({ page }) => {
    const notFoundPage = new Page(page)

    const response = await notFoundPage.open('/this-page-does-not-exist')

    expect(response.status()).toBe(404)
    await expect(notFoundPage.pageHeading).toContainText('404')
    await expect(page.getByText('Page not found')).toBeVisible()
  })
})
