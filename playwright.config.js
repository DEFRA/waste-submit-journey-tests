import { defineConfig, devices } from '@playwright/test'

// On CDP the Portal sets ENVIRONMENT (dev, test, perf-test). Locally the frontend runs in epr-local-environment
// (submit-data profile) on port 8019; BASE_URL overrides either.
const baseURL =
  process.env.BASE_URL ||
  (process.env.ENVIRONMENT
    ? `https://waste-submit-reg-packaging-fe.${process.env.ENVIRONMENT}.cdp-int.defra.cloud`
    : 'http://localhost:8019')

// On CDP every outbound request goes through the platform proxy (HTTP_PROXY, localhost:3128).
const proxy = process.env.HTTP_PROXY
  ? { server: process.env.HTTP_PROXY }
  : undefined

export default defineConfig({
  testDir: './test/specs',
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['allure-playwright', { resultsDir: 'allure-results' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    proxy,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
})
