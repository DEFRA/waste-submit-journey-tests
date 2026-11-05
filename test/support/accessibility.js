import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// The EPR Test Strategy sets WCAG 2.2 AA as a deployment-blocking check. axe tags each rule with the WCAG version and
// level that introduced it, so 2.2 AA is every A and AA tag from 2.0 to 2.2. Best-practice rules aren't WCAG success
// criteria, so they don't fail the build.
const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const describeViolation = (violation) =>
  `[${violation.impact}] ${violation.id}: ${violation.help} (${violation.helpUrl}) at ` +
  violation.nodes.map((node) => node.target.join(' ')).join(', ')

// Scans the page as it stands against WCAG 2.2 AA and fails the test on any violation. axe's results go on the report
// as evidence, including what it couldn't decide (`incomplete`), which needs a person to check by hand.
async function expectNoAccessibilityViolations(page) {
  const { pathname, search } = new URL(page.url())
  const path = pathname + search

  await test.step(`WCAG 2.2 AA scan of ${path}`, async () => {
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_22_AA)
      .analyze()

    await test.info().attach(`axe results for ${path}`, {
      contentType: 'application/json',
      body: JSON.stringify(
        {
          url: results.url,
          timestamp: results.timestamp,
          testEngine: results.testEngine,
          tags: WCAG_22_AA,
          violations: results.violations,
          incomplete: results.incomplete,
          passes: results.passes.map((rule) => rule.id)
        },
        null,
        2
      )
    })

    expect(
      results.violations.map(describeViolation),
      `WCAG 2.2 AA violations on ${path}`
    ).toEqual([])
  })
}

export { expectNoAccessibilityViolations }
