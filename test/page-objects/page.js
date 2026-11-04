class Page {
  constructor(page) {
    this.page = page
  }

  get pageHeading() {
    return this.page.locator('h1')
  }

  open(path) {
    return this.page.goto(path)
  }
}

export { Page }
