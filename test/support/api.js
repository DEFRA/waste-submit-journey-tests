// The backend, waste-submit-reg-packaging-api, for the API checks in test/api. They ask one question: does the deployed
// API answer? Its business rules are tested in its own repository, on every pull request.

const SERVICE = 'waste-submit-reg-packaging-api'

// API_URL overrides; otherwise the service's address in the CDP environment the Portal names. Neither set means the
// API checks don't run (playwright.config.js): locally, set API_URL=http://localhost:8085 to run them.
export function apiBaseUrl() {
  if (process.env.API_URL) {
    return process.env.API_URL.replace(/\/+$/, '')
  }
  return process.env.ENVIRONMENT
    ? `https://${SERVICE}.${process.env.ENVIRONMENT}.cdp-int.defra.cloud`
    : undefined
}

// The API takes its key as HTTP Basic credentials for a client in its Acl:Clients list. The names are the same as
// waste-submit-performance-tests uses. On CDP both are secrets on this test suite.
export function apiAuthorization() {
  const missing = ['API_CLIENT_ID', 'API_CLIENT_SECRET'].filter(
    (name) => !process.env[name]
  )
  if (missing.length) {
    throw new Error(
      `Set ${missing.join(' and ')} to an API key client of ${SERVICE} with the read scope (see the README, API checks)`
    )
  }

  const credentials = `${process.env.API_CLIENT_ID}:${process.env.API_CLIENT_SECRET}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

export const packagingYear = Number(process.env.PACKAGING_YEAR || 2025)
