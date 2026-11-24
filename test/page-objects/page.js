import { test } from '@playwright/test'

import { isOnFrontend, signInThroughB2C } from '#support/sign-in.js'

class Page {
  constructor(page) {
    this.page = page
  }

  get pageHeading() {
    return this.page.locator('h1')
  }

  // Tests normally start signed in (test/auth/sign-in.setup.js). Where they don't, as in the cross-browser run, which
  // has no sign-in setup, the frontend sends them to B2C: sign in, then open the page again.
  async open(path) {
    const response = await this.page.goto(path)
    const { baseURL } = test.info().project.use

    if (!isOnFrontend(this.page, baseURL)) {
      await signInThroughB2C(this.page, baseURL)
      return this.page.goto(path)
    }

    return response
  }
}

export { Page }
