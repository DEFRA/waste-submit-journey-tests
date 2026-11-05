import fs from 'node:fs/promises'

import { test as teardown, expect } from '@playwright/test'

import { acceptedAlerts } from '#support/zap-accepted-alerts.js'
import { Zap, assessAlerts, describeFinding } from '#support/zap.js'

const REPORT_DIR = 'zap-report'

// Runs after the journey tests, pass or fail, when ZAP_URL is set. Everything they did went through ZAP, so its
// passive scan has seen each page and response they reached. Fails on any High or Medium alert for the frontend that
// isn't in zap-accepted-alerts.js. Alerts for other hosts (analytics, for one) aren't ours to fix, so they're left out.
teardown(
  'ZAP passive scan: no High or Medium risk alerts',
  async ({ baseURL }) => {
    const zap = new Zap(process.env.ZAP_URL)
    const target = new URL(baseURL).origin

    await zap.waitForPassiveScan()
    const messages = await zap.numberOfMessages(target)
    const alerts = await zap.alerts(target)
    const { failing, accepted, other } = assessAlerts(alerts, acceptedAlerts)

    const summary = {
      zapVersion: await zap.version(),
      target,
      requestsScanned: messages,
      failing,
      accepted,
      other
    }
    const html = await zap.htmlReport()
    await fs.mkdir(REPORT_DIR, { recursive: true })
    await fs.writeFile(`${REPORT_DIR}/zap-report.html`, html)
    await fs.writeFile(
      `${REPORT_DIR}/zap-alerts.json`,
      JSON.stringify(summary, null, 2)
    )
    await teardown.info().attach('ZAP report', {
      contentType: 'text/html',
      body: html
    })
    await teardown.info().attach('ZAP alerts', {
      contentType: 'application/json',
      body: JSON.stringify(summary, null, 2)
    })

    // No traffic means the browser didn't go through ZAP, so a pass would prove nothing.
    expect(
      messages,
      `requests to ${target} that went through ZAP`
    ).toBeGreaterThan(0)
    expect(
      failing.map(describeFinding),
      `High and Medium ZAP alerts on ${target} (see the ZAP report attached, and test/support/zap-accepted-alerts.js)`
    ).toEqual([])
  }
)
