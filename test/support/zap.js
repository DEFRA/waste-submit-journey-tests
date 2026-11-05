// Talks to OWASP ZAP's API. When ZAP_URL is set, the browser's traffic goes through ZAP (playwright.config.js) and
// ZAP's passive scanner checks every request and response for security issues: headers, cookies, information leaks.
// The passive scan only reads the traffic; it doesn't send anything of its own to the service.

// The alerts that fail the run. ZAP has no Critical; High and Medium both fail, the same policy as the other EPR
// journey-test suites (waste-packaging-regulator-tests). Low and Informational go on the report.
const FAILING_RISKS = ['High', 'Medium']

class Zap {
  constructor(zapUrl) {
    this.zapUrl = zapUrl
  }

  async call(path, params = {}) {
    const url = new URL(path, this.zapUrl)
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value)
    }

    let response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    } catch (error) {
      throw new Error(
        `Can't reach ZAP at ${this.zapUrl}: is it running? (docker compose up -d --wait zap)`,
        { cause: error }
      )
    }
    if (!response.ok) {
      throw new Error(
        `ZAP API ${path} answered ${response.status}: ${await response.text()}`
      )
    }
    return response
  }

  async json(path, params) {
    return (await this.call(path, params)).json()
  }

  async version() {
    const { version } = await this.json('/JSON/core/view/version/')
    return version
  }

  // Clears what ZAP has recorded, so alerts from an earlier run against a long-running ZAP don't fail this one.
  newSession() {
    return this.json('/JSON/core/action/newSession/', { overwrite: 'true' })
  }

  // ZAP's "Absence of Anti-CSRF Tokens" rule looks for the form fields it knows. Naming the frontend's field (the
  // crumb @hapi/crumb adds to each form) keeps the rule on: a form without one still fails.
  async addAntiCsrfToken(name) {
    const { optionTokensNames } = await this.json(
      '/JSON/acsrf/view/optionTokensNames/'
    )
    if (!optionTokensNames.includes(name)) {
      await this.json('/JSON/acsrf/action/addOptionToken/', {
        String: name
      })
    }
  }

  async numberOfMessages(baseUrl) {
    const { numberOfMessages } = await this.json(
      '/JSON/core/view/numberOfMessages/',
      { baseurl: baseUrl }
    )
    return Number(numberOfMessages)
  }

  // The passive scanner works through a queue after the traffic has passed. Reading the alerts before the queue is
  // empty under-counts them, so a run that should fail could pass.
  async waitForPassiveScan({ timeout = 120_000, interval = 1_000 } = {}) {
    const deadline = Date.now() + timeout
    let remaining
    do {
      const { recordsToScan } = await this.json(
        '/JSON/pscan/view/recordsToScan/'
      )
      remaining = Number(recordsToScan)
      if (remaining === 0) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    } while (Date.now() < deadline)

    throw new Error(
      `ZAP's passive scan still had ${remaining} records to scan after ${timeout / 1000}s, so its alerts are incomplete`
    )
  }

  async alerts(baseUrl) {
    const { alerts } = await this.json('/JSON/alert/view/alerts/', {
      baseurl: baseUrl
    })
    return alerts
  }

  async htmlReport() {
    return (await this.call('/OTHER/core/other/htmlreport/')).text()
  }
}

// Groups ZAP's alerts (one per URL) by scan rule and sorts them into those that fail the run, those accepted in
// zap-accepted-alerts.js, and the rest (Low, Informational, or marked as false positives in ZAP).
function assessAlerts(alerts, acceptedAlerts = []) {
  const byRule = new Map()
  for (const alert of alerts) {
    if (alert.confidence === 'False Positive') {
      continue
    }
    const key = `${alert.pluginId}|${alert.risk}`
    if (!byRule.has(key)) {
      byRule.set(key, {
        pluginId: alert.pluginId,
        name: alert.name,
        risk: alert.risk,
        urls: new Set()
      })
    }
    byRule.get(key).urls.add(alert.url)
  }

  const failing = []
  const accepted = []
  const other = []
  for (const rule of byRule.values()) {
    const finding = { ...rule, urls: [...rule.urls].sort() }
    const acceptance = acceptedAlerts.find((entry) =>
      acceptanceCovers(entry, finding)
    )
    if (!FAILING_RISKS.includes(finding.risk)) {
      other.push(finding)
    } else if (acceptance) {
      accepted.push({ ...finding, acceptance })
    } else {
      failing.push(finding)
    }
  }

  return { failing, accepted, other }
}

// An acceptance covers a finding when it names the rule and, if it limits itself to some URLs, every URL the rule
// fired on matches. A new page with the same problem then fails the run until someone looks at it.
function acceptanceCovers(entry, finding) {
  if (String(entry.pluginId) !== String(finding.pluginId)) {
    return false
  }
  return !entry.urls || finding.urls.every((url) => entry.urls.test(url))
}

function describeFinding(finding) {
  return `[${finding.risk}] ${finding.name} (ZAP rule ${finding.pluginId}) on ${finding.urls.join(', ')}`
}

export { Zap, assessAlerts, describeFinding, FAILING_RISKS }
