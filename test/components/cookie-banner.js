// The cookie banner the layout shows on every page until the user accepts or rejects analytics cookies.
class CookieBanner {
  constructor(page) {
    this.page = page
  }

  get banner() {
    return this.page.getByRole('region', { name: /^Cookies on / })
  }

  get acceptButton() {
    return this.banner.getByRole('button', {
      name: 'Accept analytics cookies'
    })
  }

  get rejectButton() {
    return this.banner.getByRole('button', {
      name: 'Reject analytics cookies'
    })
  }

  get acceptedMessage() {
    return this.banner.getByText("You've accepted analytics cookies.")
  }

  get rejectedMessage() {
    return this.banner.getByText("You've rejected analytics cookies.")
  }

  accept() {
    return this.acceptButton.click()
  }

  reject() {
    return this.rejectButton.click()
  }
}

export { CookieBanner }
