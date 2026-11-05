import { Page } from '#page-objects/page.js'

class HomePage extends Page {
  open() {
    return super.open('/')
  }
}

export { HomePage }
