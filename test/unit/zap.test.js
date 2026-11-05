import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assessAlerts, describeFinding } from '../support/zap.js'

const alert = (overrides) => ({
  pluginId: '10038',
  name: 'Content Security Policy (CSP) Header Not Set',
  risk: 'Medium',
  confidence: 'High',
  url: 'http://frontend/one',
  ...overrides
})

describe('assessAlerts', () => {
  it('fails on High and Medium alerts, one finding per rule with each URL once', () => {
    const { failing, other } = assessAlerts([
      alert({ url: 'http://frontend/two' }),
      alert({ url: 'http://frontend/one' }),
      alert({ url: 'http://frontend/one' }),
      alert({ pluginId: '40012', name: 'XSS', risk: 'High' })
    ])

    assert.deepEqual(
      failing.map(({ pluginId, urls }) => ({ pluginId, urls })),
      [
        {
          pluginId: '10038',
          urls: ['http://frontend/one', 'http://frontend/two']
        },
        { pluginId: '40012', urls: ['http://frontend/one'] }
      ]
    )
    assert.deepEqual(other, [])
  })

  it("doesn't fail on Low or Informational alerts", () => {
    const { failing, other } = assessAlerts([
      alert({ risk: 'Low' }),
      alert({ pluginId: '10112', risk: 'Informational' })
    ])

    assert.deepEqual(failing, [])
    assert.equal(other.length, 2)
  })

  it('leaves out alerts marked as false positives in ZAP', () => {
    const { failing, accepted, other } = assessAlerts([
      alert({ confidence: 'False Positive' })
    ])

    assert.deepEqual([failing, accepted, other], [[], [], []])
  })

  it('accepts a rule listed with no URLs everywhere it fires', () => {
    const acceptance = { pluginId: 10038, reason: 'r', ticket: 'SUB-1' }
    const { failing, accepted } = assessAlerts(
      [alert({}), alert({ url: 'http://frontend/two' })],
      [acceptance]
    )

    assert.deepEqual(failing, [])
    assert.equal(accepted[0].acceptance, acceptance)
  })

  it('accepts a rule listed with URLs only when every URL it fires on matches', () => {
    const acceptedAlerts = [
      { pluginId: '10038', urls: /\/one$/, reason: 'r', ticket: 'SUB-1' }
    ]

    assert.equal(assessAlerts([alert({})], acceptedAlerts).accepted.length, 1)
    assert.equal(
      assessAlerts(
        [alert({}), alert({ url: 'http://frontend/two' })],
        acceptedAlerts
      ).failing.length,
      1
    )
  })

  it("doesn't let an acceptance for one rule cover another", () => {
    const { failing } = assessAlerts(
      [alert({})],
      [{ pluginId: '10202', reason: 'r', ticket: 'SUB-1' }]
    )

    assert.equal(failing.length, 1)
  })
})

describe('describeFinding', () => {
  it('names the risk, the rule and the URLs', () => {
    const [finding] = assessAlerts([alert({})]).failing

    assert.equal(
      describeFinding(finding),
      '[Medium] Content Security Policy (CSP) Header Not Set (ZAP rule 10038) on http://frontend/one'
    )
  })
})
