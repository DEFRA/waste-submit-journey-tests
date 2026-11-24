// Signing in through Azure AD B2C. Every page except /health and /cookies needs sign-in, so the sign-in setup
// (test/auth/sign-in.setup.js) signs the test user in once and the journey tests start from its saved cookies.

// Where the sign-in setup saves the signed-in browser's cookies (gitignored).
export const SIGNED_IN_STATE = 'playwright/.auth/user.json'

// The test user, from EPR_USER_EMAIL and EPR_USER_PASSWORD: the same names as waste-obligations-journey-tests, so the
// same account and GitHub secrets can serve both suites.
export function testUser() {
  const missing = ['EPR_USER_EMAIL', 'EPR_USER_PASSWORD'].filter(
    (name) => !process.env[name]
  )
  if (missing.length) {
    throw new Error(
      `Set ${missing.join(' and ')} to the B2C test user's sign-in details (see the README, Signing in)`
    )
  }

  return {
    email: process.env.EPR_USER_EMAIL,
    password: process.env.EPR_USER_PASSWORD
  }
}

export function isOnFrontend(page, baseURL) {
  return new URL(page.url()).origin === new URL(baseURL).origin
}

// Signs the test user in from B2C's sign-in page, and waits until B2C has sent them back to the frontend.
export async function signInThroughB2C(page, baseURL) {
  const { email, password } = testUser()

  const emailField = page.getByLabel(/email/i)
  await emailField.waitFor({ timeout: 60_000 })

  await emailField.fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|continue|next/i }).click()

  await page.waitForURL((url) => url.origin === new URL(baseURL).origin, {
    timeout: 60_000
  })
}
