import { Page } from '#page-objects/page.js'

class CookiesPage extends Page {
  open() {
    return super.open('/cookies')
  }

  // answer: 'Yes' or 'No', to "Do you want to accept analytics cookies?"
  analyticsOption(answer) {
    return this.page.getByRole('radio', { name: answer })
  }

  get saveButton() {
    return this.page.getByRole('button', { name: 'Save cookie settings' })
  }

  get successBanner() {
    return this.page.getByRole('alert').filter({
      hasText: "You've set your cookie preferences."
    })
  }

  async saveAnalytics(answer) {
    await this.analyticsOption(answer).check()
    await this.saveButton.click()
  }
}

export { CookiesPage }
