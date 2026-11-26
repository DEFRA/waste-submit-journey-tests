// PROFILE chooses what a run does. The CDP Portal sets it from the Run form's Profile field, the run-journey-tests
// action from its `profile` input, and anyone can set it by hand. Not set, the run does everything.
//
//   frontend       the frontend journeys only, through ZAP where there is one
//   api            the API checks only (test/api): no browser, no sign-in, no ZAP
//   accessibility  the @accessibility tests only (entrypoint.sh)
//   compatibility  the @compat tests on BrowserStack (entrypoint.sh)

export const DEFAULT_PROFILE = 'default'

const PROFILES = [
  DEFAULT_PROFILE,
  'frontend',
  'api',
  'accessibility',
  'compatibility'
]

// The Portal's Profile field is free text, so a typo fails the run instead of quietly running everything.
export function selectedProfile(env = process.env) {
  const profile = env.PROFILE || DEFAULT_PROFILE
  if (!PROFILES.includes(profile)) {
    throw new Error(
      `Unknown PROFILE "${profile}". Leave it unset to run everything, or use one of: ${PROFILES.slice(1).join(', ')}`
    )
  }
  return profile
}

export const runsFrontend = (profile) => profile !== 'api'

export const runsApi = (profile) =>
  profile === DEFAULT_PROFILE || profile === 'api'
