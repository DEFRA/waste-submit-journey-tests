import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { runsApi, runsFrontend, selectedProfile } from '../support/profile.js'

describe('selectedProfile', () => {
  it('is the default profile when PROFILE is not set or empty', () => {
    assert.equal(selectedProfile({}), 'default')
    assert.equal(selectedProfile({ PROFILE: '' }), 'default')
  })

  it('accepts each profile', () => {
    for (const profile of [
      'frontend',
      'api',
      'accessibility',
      'compatibility'
    ]) {
      assert.equal(selectedProfile({ PROFILE: profile }), profile)
    }
  })

  it('refuses a profile it does not know, naming the ones it does', () => {
    assert.throws(
      () => selectedProfile({ PROFILE: 'API' }),
      /Unknown PROFILE "API".*frontend, api, accessibility, compatibility/
    )
  })
})

describe('what a profile runs', () => {
  it('the default profile runs the frontend journeys and the API checks', () => {
    assert.equal(runsFrontend('default'), true)
    assert.equal(runsApi('default'), true)
  })

  it('the api profile runs only the API checks', () => {
    assert.equal(runsFrontend('api'), false)
    assert.equal(runsApi('api'), true)
  })

  it('the frontend, accessibility and compatibility profiles leave the API checks out', () => {
    for (const profile of ['frontend', 'accessibility', 'compatibility']) {
      assert.equal(runsFrontend(profile), true)
      assert.equal(runsApi(profile), false)
    }
  })
})
