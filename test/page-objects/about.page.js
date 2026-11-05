import { Page } from '#page-objects/page.js'

class AboutPage extends Page {
  open() {
    return super.open('/about')
  }
}

export { AboutPage }
