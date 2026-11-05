// High and Medium ZAP alerts the team has looked at and accepted, so they don't fail the run. Empty means every one
// fails. Accept an alert only when it's a false positive or the risk has been accepted, and say who decided:
//
//   {
//     pluginId: 10038,                      // the ZAP rule, from the failure message or the report
//     urls: /\/cookies$/,                   // optional: only these URLs; leave out to accept the rule everywhere
//     reason: 'Why this is safe to ignore', // the evidence for the decision
//     ticket: 'SUB-123'                     // where it was decided, or the ticket that fixes it
//   }
//
// A Low or Informational alert never fails the run, so it doesn't need an entry here. Remove an entry once its ticket
// is done, so the scan checks that again.
const acceptedAlerts = [
  {
    // Content Security Policy (CSP) Header Not Set
    pluginId: 10038,
    urls: /\/this-page-does-not-exist$/,
    reason:
      "The frontend's error pages are served without the CSP the other pages have. Clickjacking is still covered " +
      'by X-Frame-Options: DENY and the pages show little, so accepted until the frontend fixes it.',
    ticket: 'SUB-436'
  }
]

export { acceptedAlerts }
