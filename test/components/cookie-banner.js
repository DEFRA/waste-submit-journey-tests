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

  get acceptedMessage() {
    return this.banner.getByText("You've accepted analytics cookies.")
  }

  accept() {
    return this.acceptButton.click()
  }
}

export { CookieBanner }
