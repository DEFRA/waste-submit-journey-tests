import { defineConfig } from '@playwright/test'
import { bootstrap } from 'global-agent'
import { ProxyAgent, setGlobalDispatcher } from 'undici'

import baseConfig from './playwright.config.js'

// Cross-browser runs on BrowserStack's real browsers, listed as `platforms` in browserstack.yml. Run it through the
// SDK, which builds one project per platform and drops the projects here: npm run test:compatibility.

// On CDP, BrowserStack is outside the platform, so the SDK's own calls (the BrowserStack API and the Local tunnel)
// go through the proxy, as CDP's BrowserStack guide sets up.
if (process.env.HTTP_PROXY) {
  setGlobalDispatcher(new ProxyAgent({ uri: process.env.HTTP_PROXY }))
  bootstrap()
  globalThis.GLOBAL_AGENT.HTTP_PROXY = process.env.HTTP_PROXY
}

export default defineConfig({
  ...baseConfig,
  // Only tests tagged @compat: the browser tests worth repeating in every browser.
  grep: /@compat/,
  use: {
    ...baseConfig.use,
    // The remote browsers reach the app through the BrowserStack Local tunnel, not CDP's proxy, and
    // BrowserStack's remote browsers don't record Playwright traces.
    proxy: undefined,
    trace: 'off'
  },
  projects: []
})
