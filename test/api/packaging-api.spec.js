import { test, expect } from '@playwright/test'

import { apiAuthorization, packagingYear } from '#support/api.js'

// Sanity checks of the deployed API: every published endpoint answers, with the shape its OpenAPI contract promises.
// Nothing here asserts specific data, because the data differs by environment and the visible periods by date.
// Only published endpoints belong here; rules, validation and error codes are tested in the API's own repository.

const TILE_FIELDS = [
  'name',
  'year',
  'openingDate',
  'deadlineDate',
  'isOpen',
  'dataPeriods'
]
const COMPLIANCE_SCHEME = { submitterType: 'ComplianceScheme' }

test.describe('waste-submit-reg-packaging-api is up', () => {
  test('the health check responds without credentials', async ({ request }) => {
    const response = await request.get('/health')

    expect(response.status()).toBe(200)
  })

  test('a call without credentials is refused', async ({ request }) => {
    const response = await request.get('/describe')

    expect(response.status()).toBe(401)
  })

  test('an unpublished endpoint is not found', async ({ request }) => {
    // Unpublished endpoints are only switched on locally, so this is a deployed-environment check.
    // eslint-disable-next-line playwright/no-skipped-test -- a local API has them switched on
    test.skip(
      !process.env.ENVIRONMENT,
      'only checked in a CDP environment (ENVIRONMENT)'
    )

    const response = await request.get(
      '/registrations/00000000-0000-4000-8000-000000000000'
    )

    expect(response.status()).toBe(404)
  })
})

test.describe('published endpoints', () => {
  test.use({
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: apiAuthorization()
    }
  })

  test('describe names the service', async ({ request }) => {
    const response = await request.get('/describe')

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({
      service: 'waste-submit-reg-packaging-api'
    })
  })

  test('producer material totals, by submitter and for one submitter', async ({
    request
  }) => {
    // The API reads these from epr-common-data-api, which can take tens of seconds for a whole year.
    test.setTimeout(150_000)

    const bySubmitter = await request.get(
      `/packaging/${packagingYear}/producer-material-totals-by-submitter`,
      { timeout: 70_000 }
    )

    expect(bySubmitter.status()).toBe(200)
    const { items } = await bySubmitter.json()
    expect(Array.isArray(items)).toBe(true)

    // A submitter the environment knows when it has one. An unknown one still answers, with no items.
    const submitterOrganisationId =
      items[0]?.submitterOrganisationId ??
      '00000000-0000-4000-8000-000000000000'

    const forSubmitter = await request.get(
      `/packaging/${packagingYear}/submitter-organisation/${submitterOrganisationId}/producer-material-totals`,
      { timeout: 70_000 }
    )

    expect(forSubmitter.status()).toBe(200)
    expect(Array.isArray((await forSubmitter.json()).items)).toBe(true)
  })

  test('packaging submission periods, with their data periods', async ({
    request
  }) => {
    const response = await request.get('/submission-periods/packaging')

    expect(response.status()).toBe(200)
    const periods = await response.json()
    expect(periods.length).toBeGreaterThan(0)
    expect(Object.keys(periods[0])).toEqual(
      expect.arrayContaining([
        'name',
        'year',
        'openingDate',
        'visibleFromDate',
        'deadlineDate',
        'registrationYear',
        'dataPeriods'
      ])
    )
  })

  test('packaging submission periods for a submitter type, all and one', async ({
    request
  }) => {
    const all = await request.get(
      '/submission-periods/packaging/for-submitter-type',
      { params: COMPLIANCE_SCHEME }
    )

    expect(all.status()).toBe(200)
    const tiles = await all.json()
    expect(tiles.length).toBeGreaterThan(0)
    expect(Object.keys(tiles[0])).toEqual(expect.arrayContaining(TILE_FIELDS))

    const one = await request.get(
      `/submission-periods/packaging/${encodeURIComponent(tiles[0].name)}/for-submitter-type`,
      { params: COMPLIANCE_SCHEME }
    )

    expect(one.status()).toBe(200)
    expect((await one.json()).name).toBe(tiles[0].name)
  })
})
