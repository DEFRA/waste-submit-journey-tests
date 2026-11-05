import { test as setup, expect } from '@playwright/test'

import { Zap } from '#support/zap.js'

// Runs before the journey tests when ZAP_URL is set: fails fast if ZAP isn't there (rather than every test failing
// on a proxy error), starts a clean ZAP session for this run and tells ZAP the frontend's anti-CSRF field.
setup('ZAP is running, with a new session', async () => {
  const zap = new Zap(process.env.ZAP_URL)

  const version = await zap.version()
  await zap.newSession()
  await zap.addAntiCsrfToken('crumb')

  expect(version, `ZAP at ${process.env.ZAP_URL}`).toBeTruthy()
  setup.info().annotations.push({ type: 'ZAP version', description: version })
})
