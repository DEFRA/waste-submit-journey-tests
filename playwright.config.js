import { defineConfig, devices } from '@playwright/test'

import { SIGNED_IN_STATE } from './test/support/sign-in.js'

// When ZAP_URL is set, every request the tests make goes through OWASP ZAP, which scans it for security issues
// (test/support/zap.js). entrypoint.sh sets it on CDP and the run-journey-tests action on GitHub.
const zapUrl = process.env.ZAP_URL

// On CDP the Portal sets ENVIRONMENT (dev, test, perf-test). Locally the frontend runs in epr-local-environment
// (submit-data profile) on port 8019; FRONTEND_URL overrides either. Scanning locally, ZAP and the frontend both run in
// this repo's compose.yml, where the frontend is https://localhost:3000 (https-proxy; see the comments there).
const COMPOSE_FRONTEND_URL = 'https://localhost:3000'
const baseURL =
  process.env.FRONTEND_URL ||
  (process.env.ENVIRONMENT
    ? `https://waste-submit-reg-packaging-fe.${process.env.ENVIRONMENT}.cdp-int.defra.cloud`
    : zapUrl
      ? COMPOSE_FRONTEND_URL
      : 'http://localhost:8019')

// The browser hands every URL to ZAP. ZAP in Docker takes localhost to mean its own container's network, which it
// shares with compose.yml's https-proxy: so localhost:3000 reaches the frontend there, and any other localhost address
// would fail on every page instead of scanning the frontend.
const { host } = new URL(baseURL)
if (
  zapUrl &&
  /^(localhost|127\.|\[::1\])/.test(host) &&
  host !== new URL(COMPOSE_FRONTEND_URL).host
) {
  throw new Error(
    `ZAP can't reach ${baseURL}: to ZAP, localhost is its own container. Leave FRONTEND_URL unset to scan the frontend in compose.yml (${COMPOSE_FRONTEND_URL}).`
  )
}

// On CDP every outbound request goes through the platform proxy (HTTP_PROXY, localhost:3128). ZAP takes its place
// when scanning, and passes the traffic on to the platform proxy itself (entrypoint.sh).
const proxyServer = zapUrl || process.env.HTTP_PROXY
const proxy = proxyServer ? { server: proxyServer } : undefined

// With ZAP: zap-setup checks ZAP is up and starts a new session before the tests, and zap-alerts reads what it found
// once they've all finished, pass or fail. Neither needs a browser.
const zapProjects = zapUrl
  ? [
      {
        name: 'zap-setup',
        testDir: './test/security',
        testMatch: 'zap.setup.js',
        teardown: 'zap-alerts'
      },
      {
        name: 'zap-alerts',
        testDir: './test/security',
        testMatch: 'zap-alerts.teardown.js',
        // Waiting for the passive scan to finish can take up to two minutes (test/support/zap.js).
        timeout: 180_000
      }
    ]
  : []

export default defineConfig({
  testDir: './test/specs',
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['allure-playwright', { resultsDir: 'allure-results' }]],
  use: {
    baseURL,
    proxy,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  // The device settings live on the project, not the top-level `use`: the BrowserStack run
  // (playwright.compatibility.config.js) keeps `use` but replaces the projects with its real browsers.
  //
  // sign-in signs the test user in through Azure AD B2C once and saves the browser's cookies; the journey tests start
  // from them (test/auth/sign-in.setup.js). With ZAP, sign-in runs after zap-setup, so the new ZAP session sees it.
  projects: [
    ...zapProjects,
    {
      name: 'sign-in',
      testDir: './test/auth',
      testMatch: 'sign-in.setup.js',
      use: { ...devices['Desktop Chrome'] },
      dependencies: zapUrl ? ['zap-setup'] : []
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: SIGNED_IN_STATE },
      dependencies: ['sign-in']
    }
  ]
})
