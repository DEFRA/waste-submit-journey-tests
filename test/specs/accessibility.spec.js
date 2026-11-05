import { test, expect } from '@playwright/test'

import { CookieBanner } from '#components/cookie-banner.js'
import { AboutPage } from '#page-objects/about.page.js'
import { CookiesPage } from '#page-objects/cookies.page.js'
import { HomePage } from '#page-objects/home.page.js'
import { Page } from '#page-objects/page.js'
import { expectNoAccessibilityViolations } from '#support/accessibility.js'

// One test per page and state a user can reach: each checks it's on the right page, then scans it with axe against
// WCAG 2.2 AA (the EPR Test Strategy's standard). Automated checks find only some issues; the manual checks in the
// EPR Accessibility testing guidance (keyboard, zoom, display settings, read aloud) still apply.
test.describe('accessibility (WCAG 2.2 AA)', { tag: '@accessibility' }, () => {
  test('home page, with the cookie banner', async ({ page }) => {
    const homePage = new HomePage(page)
    const cookieBanner = new CookieBanner(page)

    await homePage.open()

    await expect(homePage.pageHeading).toHaveText('Home')
    await expect(cookieBanner.acceptButton).toBeVisible()
    await expectNoAccessibilityViolations(page)
  })

  test('cookie banner after accepting analytics cookies', async ({ page }) => {
    const homePage = new HomePage(page)
    const cookieBanner = new CookieBanner(page)

    await homePage.open()
    await cookieBanner.accept()

    await expect(cookieBanner.acceptedMessage).toBeVisible()
    await expectNoAccessibilityViolations(page)
  })

  test('about page', async ({ page }) => {
    const aboutPage = new AboutPage(page)

    await aboutPage.open()

    await expect(aboutPage.pageHeading).toContainText('About')
    await expectNoAccessibilityViolations(page)
  })

  test('cookies page', async ({ page }) => {
    const cookiesPage = new CookiesPage(page)

    await cookiesPage.open()

    await expect(cookiesPage.pageHeading).toHaveText('Cookies')
    await expectNoAccessibilityViolations(page)
  })

  test('cookies page after saving cookie settings', async ({ page }) => {
    const cookiesPage = new CookiesPage(page)

    await cookiesPage.open()
    await cookiesPage.saveAnalytics('No')

    await expect(cookiesPage.successBanner).toBeVisible()
    await expectNoAccessibilityViolations(page)
  })

  test('page not found', async ({ page }) => {
    const notFoundPage = new Page(page)

    await notFoundPage.open('/this-page-does-not-exist')

    await expect(notFoundPage.pageHeading).toContainText('404')
    await expect(page.getByText('Page not found')).toBeVisible()
    await expectNoAccessibilityViolations(page)
  })
})
