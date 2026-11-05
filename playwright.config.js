import { defineConfig, devices } from '@playwright/test'

// When ZAP_URL is set, every request the tests make goes through OWASP ZAP, which scans it for security issues
// (test/support/zap.js). entrypoint.sh sets it on CDP and the run-journey-tests action on GitHub.
const zapUrl = process.env.ZAP_URL

// On CDP the Portal sets ENVIRONMENT (dev, test, perf-test). Locally the frontend runs in epr-local-environment
// (submit-data profile) on port 8019; BASE_URL overrides either. Scanning locally, ZAP and the frontend both run in
// this repo's compose.yml, where the frontend is waste-submit-reg-packaging-fe.localhost:3000 (see the comments there).
const baseURL =
  process.env.BASE_URL ||
  (process.env.ENVIRONMENT
    ? `https://waste-submit-reg-packaging-fe.${process.env.ENVIRONMENT}.cdp-int.defra.cloud`
    : zapUrl
      ? 'http://waste-submit-reg-packaging-fe.localhost:3000'
      : 'http://localhost:8019')

// The browser hands every URL to ZAP. ZAP in Docker would take localhost to mean its own container, so the tests
// would fail on every page instead of scanning the frontend.
if (zapUrl && /^(localhost|127\.|\[::1\])/.test(new URL(baseURL).host)) {
  throw new Error(
    `ZAP can't reach ${baseURL}: to ZAP, localhost is its own container. Leave BASE_URL unset to scan the frontend in compose.yml.`
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
  projects: [
    ...zapProjects,
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: zapUrl ? ['zap-setup'] : []
    }
  ]
})
