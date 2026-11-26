# waste-submit-journey-tests

Playwright journey tests for Submit Data's CDP frontend, `waste-submit-reg-packaging-fe`, run by the CDP Portal against
dev, test and perf-test.

- [Setup](#setup)
- [Running the tests](#running-the-tests)
  - [Signing in](#signing-in)
  - [Against the local Docker setup](#against-the-local-docker-setup)
  - [Against a CDP environment](#against-a-cdp-environment)
  - [Options](#options)
- [Profiles](#profiles)
- [API checks](#api-checks)
- [Cross-browser (BrowserStack)](#cross-browser-browserstack)
- [Accessibility](#accessibility)
- [Security (OWASP ZAP)](#security-owasp-zap)
  - [When it runs](#when-it-runs)
  - [Running it locally](#running-it-locally)
  - [When it fails](#when-it-fails)
  - [What it doesn't cover](#what-it-doesnt-cover)
- [On CDP](#on-cdp)
- [On GitHub](#on-github)
- [Licence](#licence)

## Setup

Node.js `>= v24` (`nvm use` picks up `.nvmrc`). Then:

```bash
npm install
npm run install:browsers   # Playwright's Chromium
```

## Running the tests

Where the tests go is set by environment variables, checked in this order:

| Set                        | Tests run against                                                         |
| -------------------------- | ------------------------------------------------------------------------- |
| `FRONTEND_URL`             | that URL                                                                  |
| `ENVIRONMENT` (e.g. `dev`) | `https://waste-submit-reg-packaging-fe.<ENVIRONMENT>.cdp-int.defra.cloud` |
| neither                    | `http://localhost:8019`, the local Docker setup                           |

### Signing in

Every page except `/health` and `/cookies` needs sign-in, through Azure AD B2C. Before the tests, the `sign-in` project
(`test/auth/sign-in.setup.js`) signs a test user in once and saves the browser's cookies in `playwright/.auth/`; each test starts from them, so it's already signed in. Where a test isn't signed in, eg. in the
cross-browser run, which has no `sign-in` project, the page objects sign in when the frontend sends them to B2C.

The test user's details come from environment variables, the same names as
[waste-obligations-journey-tests](https://github.com/DEFRA/waste-obligations-journey-tests), so one account and one
set of secrets can serve both suites:

| Variable                                          | Needed by                                          | What                              |
| ------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `EPR_USER_EMAIL`                                  | the tests, everywhere                              | the B2C test user's email address |
| `EPR_USER_PASSWORD`                               | the tests, everywhere                              | the B2C test user's password      |
| `WASTE_SUBMIT_REG_PACKAGING_FE_B2C_CLIENT_SECRET` | this repo's `compose.yml` (the frontend it starts) | the frontend's B2C client secret  |

Set them in your shell, never in a file in this repository: it's public. Test traces and reports can contain the
values filled in on B2C's sign-in page, so handle them accordingly.

```bash
export EPR_USER_EMAIL=… EPR_USER_PASSWORD=…
```

The frontend in this repo's `compose.yml` signs in with the `AZDCUSPOC2` B2C test tenant, using the frontend's app
registration there. The only local redirect URI that registration allows is `https://localhost:3000/signin-oidc`, so
`compose.yml` serves the frontend there, over HTTPS (see [Running it locally](#running-it-locally)). B2C rejects any
other local address with `AADB2C90006` (`redirect_uri_mismatch`) and sends the browser to that one instead.

### Against the local Docker setup

The frontend runs in [epr-local-environment](https://github.com/DEFRA/epr-local-environment), `submit-data` profile,
on http://localhost:8019.

1. Start it, from your epr-local-environment clone:

   ```bash
   docker compose --profile submit-data up -d --wait
   ```

   It pulls `defradigital/waste-submit-reg-packaging-fe:latest`; set `WASTE_SUBMIT_REG_PACKAGING_FE=<version>` to run
   another version.

2. Run the tests, from this repo:

   ```bash
   npm test
   ```

3. Stop it when you're done, from epr-local-environment (this leaves any other profiles you have running alone):

   ```bash
   docker compose stop waste-submit-reg-packaging-fe
   ```

To test the frontend's own `npm run dev` instead (port 3000): `FRONTEND_URL=http://localhost:3000 npm test`.

### Against a CDP environment

Connect to the DEFRA VPN, then name the environment:

```bash
ENVIRONMENT=dev npm test
ENVIRONMENT=test npm test
```

This runs from your machine against what's deployed there (check with the CDP Portal). perf-test didn't answer from
the VPN when this was set up; run it from the Portal instead (see [On CDP](#on-cdp)).

### Options

These work with either target:

```bash
npm run test:local         # the browser visible
npm run test:local:debug   # step through in the Playwright inspector
npm run report             # build the Allure report from the last run (needs Java)
npm run test:unit          # unit tests for the test helpers (no browser or frontend needed)
```

To run the Docker image the way CDP does, security scan included, against the frontend in this repo's `compose.yml`:

```bash
docker build --platform linux/amd64 -t waste-submit-journey-tests .
docker compose up -d --wait https-proxy
docker run --rm --network container:waste-submit-journey-tests-https-proxy-1 \
  -e FRONTEND_URL=https://localhost:3000 -e EPR_USER_EMAIL -e EPR_USER_PASSWORD waste-submit-journey-tests
```

The image starts its own ZAP, so this starts the frontend and its HTTPS proxy without `compose.yml`'s `zap`, and runs
the tests in the proxy's network, where `https://localhost:3000` is the frontend (see
[Running it locally](#running-it-locally)). It ends with "failed to publish test results" locally, because only CDP
sets `RESULTS_OUTPUT_S3_PATH`.

## Profiles

The suite holds two kinds of test: the frontend journeys (browser, sign-in, security scan) and the
[API checks](#api-checks). The `PROFILE` environment variable chooses what a run does:

| `PROFILE`       | Runs                                                                                  |
| --------------- | ------------------------------------------------------------------------------------- |
| not set         | Everything: the frontend journeys, and the API checks where there is an API to call   |
| `frontend`      | The frontend journeys only, through OWASP ZAP where there is one                      |
| `api`           | The API checks only: no browser, no sign-in, no ZAP. Fails if there is no API to call |
| `accessibility` | The `@accessibility` tests only ([Accessibility](#accessibility))                     |
| `compatibility` | The `@compat` tests on BrowserStack ([Cross-browser](#cross-browser-browserstack))    |

Any other value fails the run, so a typo can't quietly run everything.

Who sets it:

| Run                                                    | Profile    | Set by                                                |
| ------------------------------------------------------ | ---------- | ----------------------------------------------------- |
| Pull request on `waste-submit-reg-packaging-fe`        | `frontend` | The `profile` input of the `run-journey-tests` action |
| After a deployment of `waste-submit-reg-packaging-fe`  | `frontend` | The Profile field of the test run in the CDP Portal   |
| After a deployment of `waste-submit-reg-packaging-api` | `api`      | The Profile field of the test run in the CDP Portal   |
| By hand, from the Portal or your machine               | any        | The Portal's Profile field, or `PROFILE=api npm test` |

`npm run test:frontend` and `npm run test:api` set it for you. `playwright.config.js` reads it
(`test/support/profile.js`) to choose the Playwright projects; `entrypoint.sh` reads it to decide whether to start ZAP.

## API checks

`test/api` checks the backend, `waste-submit-reg-packaging-api`, in a deployed environment: does every **published**
endpoint answer, with the shape its OpenAPI contract promises? It is the `api` Playwright project: no browser, no
sign-in, and it calls the API directly rather than through ZAP.

What it checks:

- `/health` answers without credentials, and `/describe` without credentials is a 401.
- An unpublished endpoint is a 404 (CDP environments only: locally they are switched on).
- Each published endpoint returns 200 and the expected fields.

What doesn't belong here: business rules, validation, error codes, and assertions on specific data. The data differs
by environment and the visible submission periods by date; the rules are tested in the API's own repository on every
pull request (see "Testing" in its `CLAUDE.md`). When an endpoint is published, add one check for it here.

The project runs with no profile or with the `api` profile ([Profiles](#profiles)), and only where there is an API to
call:

| Set                        | API checks run against                                                     |
| -------------------------- | -------------------------------------------------------------------------- |
| `API_URL`                  | that URL                                                                   |
| `ENVIRONMENT` (e.g. `dev`) | `https://waste-submit-reg-packaging-api.<ENVIRONMENT>.cdp-int.defra.cloud` |
| neither                    | they don't run                                                             |

They need an API key client of the API with the `read` scope, in `API_CLIENT_ID` and `API_CLIENT_SECRET` (the same
names as waste-submit-performance-tests). Without them the run fails, rather than skipping the checks.

On CDP the suite calls as its own client, `JourneyTests`, set up per environment (dev, test and perf-test):

1. In the CDP Portal, on the API's secrets: `Acl__Clients__JourneyTests__Secret`, a new random value. Do this first:
   the API won't start with a client that has no secret.
2. In cdp-app-config, for the API: `Acl__Clients__JourneyTests__Type=ApiKey` and
   `Acl__Clients__JourneyTests__Scopes__0=read`. Redeploy the API so it picks the client up.
3. In cdp-app-config, for this suite: `API_CLIENT_ID=JourneyTests`. In the CDP Portal, on this suite's secrets:
   `API_CLIENT_SECRET`, the same value as step 1.

Against an API running locally (`dotnet run`, with its `Developer` client):

```bash
PROFILE=api API_URL=http://localhost:8085 API_CLIENT_ID=Developer API_CLIENT_SECRET=developer-pwd npm test
```

The producer material totals check needs the API's upstream, epr-common-data-api, so it fails locally unless one is
running. `PACKAGING_YEAR` (default 2025) picks the year it asks for.

## Cross-browser (BrowserStack)

The `compatibility` profile runs the tests tagged `@compat` in real browsers on BrowserStack Automate:

| Platform   | Browser                               |
| ---------- | ------------------------------------- |
| Windows 11 | Chrome (latest)                       |
| Windows 11 | Edge (latest)                         |
| Windows 11 | Firefox (Playwright's build)          |
| macOS      | Safari's engine (Playwright's WebKit) |

The browsers are the `platforms` in `browserstack.yml`; to add one, add a platform there, not a Playwright project.
To put a test in the cross-browser run, tag it: `test('…', { tag: '@compat' }, async ({ page }) => …)`. Browser tests
only: the run doesn't go through CDP's proxy, so an API-only test like the health check stays out of it.

You need the team's BrowserStack service account (see CDP's
[BrowserStack guide](https://portal.cdp-int.defra.cloud/documentation/how-to/testing/browserstack-from-portal.md) for
how to get one). Never use a personal BrowserStack login in automated tests, and never commit the credentials: this
repository is public.

**From the CDP Portal:**

1. Once: on the test suite's page, Secrets tab, add `BROWSERSTACK_USER` and `BROWSERSTACK_KEY`.
2. Run the suite with Profile `compatibility`. The entrypoint then runs `npm run test:compatibility` instead of
   `npm test`.

**From your machine,** against the local Docker setup or a CDP environment, as in
[Running the tests](#running-the-tests):

```bash
export BROWSERSTACK_USER=… BROWSERSTACK_KEY=…   # from the service account; never commit them
npm run test:compatibility                      # the local Docker setup
ENVIRONMENT=dev npm run test:compatibility      # a CDP environment (VPN)
```

`browserstack.yml` turns on the BrowserStack Local tunnel, which lets BrowserStack's browsers reach hosts that aren't
on the internet: your local frontend or the CDP environments. Watch the runs, with video, on the
[BrowserStack Automate dashboard](https://automate.browserstack.com/); Playwright traces aren't recorded there.

## Accessibility

`test/specs/accessibility.spec.js` opens each page, and each state of it a user can reach (the cookie banner before
and after accepting, the cookies page after saving, page not found), and scans it with
[axe-core](https://github.com/dequelabs/axe-core) through `@axe-core/playwright`. The scan checks
**WCAG 2.2 AA**, the standard the
[EPR Test Strategy](https://eaflood.atlassian.net/wiki/spaces/EDIA/pages/6626740224/EPR+Test+Strategy) sets as a
deployment-blocking check, so any violation fails the test. Each test attaches axe's results to the Allure report,
including the checks axe couldn't decide (`incomplete`), which need a person to look at.

The tests are tagged `@accessibility` and run with the rest of `npm test`, so they also run on every frontend pull
request (see [On GitHub](#on-github)). To run them alone, locally or with Profile `accessibility` in the Portal:

```bash
npm run test:accessibility
```

To cover a new page, add a test there that reaches it through the page objects, checks it's on the right page, then
calls `expectNoAccessibilityViolations(page)` from `#support/accessibility.js`.

axe finds only some accessibility issues. The manual checks in the EPR
[Accessibility testing guidance](https://eaflood.atlassian.net/wiki/spaces/EDIA/pages/6270353488/Accessibility+testing)
(keyboard navigation, 200-300% zoom, dark and high contrast modes, read aloud) still apply to each change. The Submit
Data team's `/a11y-scenarios` Claude Code skill ([epr-submit-data](https://github.com/DEFRA/epr-submit-data)) lists
the manual checks a page needs for the WCAG 2.2 AA criteria axe can't check, and logs the results.

## Security (OWASP ZAP)

The [EPR Test Strategy](https://eaflood.atlassian.net/wiki/spaces/EDIA/pages/6626740224/EPR+Test+Strategy) names
OWASP ZAP for dynamic security testing (DAST). The journey tests' traffic goes through [ZAP](https://www.zaproxy.org/)
as a proxy, and ZAP's passive scan checks every request and response they make: security headers such as the Content
Security Policy, cookie flags, anti-CSRF tokens on forms, information leaks. A passive scan only reads the traffic and
sends nothing of its own, so it's safe against a shared environment.

The run fails on any **High** or **Medium** alert for the frontend (ZAP has no Critical), the same policy as the other
EPR journey-test suites. Low and Informational alerts are on the report but don't fail it. Alerts for other hosts, such
as Google Analytics, aren't ours to fix, so they're left out.

When `ZAP_URL` is set, `playwright.config.js` sends the browser's traffic through ZAP and adds two projects around the
journey tests, both in `test/security/`:

| Project      | Runs                          | Does                                                                                                                                                                                                     |
| ------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zap-setup`  | before the tests              | Fails fast if ZAP isn't there, starts a new ZAP session and names the frontend's anti-CSRF field (`crumb`) so ZAP recognises it                                                                          |
| `zap-alerts` | after the tests, pass or fail | Waits for the passive scan to finish, then fails on any High or Medium alert not in `test/support/zap-accepted-alerts.js`. Also fails if no traffic went through ZAP, since then the scan proved nothing |

`zap-alerts` attaches ZAP's HTML report and a summary of the alerts to the Allure report, and saves both in
`zap-report/` (`zap-report.html`, `zap-alerts.json`).

ZAP only sees the pages the tests reach. `test/specs/pages.spec.js` goes to every page and form the frontend has
(about, cookies, saving cookie settings, the banner's accept and reject, page not found), so the security run covers
them without the `@accessibility` tests. **When the frontend gets a new page or form, add a test for it there**, or
ZAP never scans it.

### When it runs

| Where                                                                                                                                     | How                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every pull request on `waste-submit-reg-packaging-fe`, before it merges                                                                   | The `run-journey-tests` action runs the `frontend` profile, accessibility included, through ZAP (`ZAP_URL` set, `npm test`) against the PR's image, with ZAP from `compose.yml`. The ZAP report is the `zap-report` artifact on the workflow run |
| The CDP Portal's default run (no Profile) and its `frontend` profile: run by hand, or automatically after each deployment of the frontend | `entrypoint.sh` starts the ZAP bundled in the image (pinned in the `Dockerfile`) and chains it to the platform proxy, then runs `npm test` through it. The ZAP report is attached to the Allure report                                           |
| Your machine                                                                                                                              | `npm run test:security` ([below](#running-it-locally))                                                                                                                                                                                           |

The `api`, `accessibility` and `compatibility` profiles don't go through ZAP.

### Running it locally

ZAP runs in Docker, from this repo's `compose.yml`, along with the frontend and what it needs. The frontend is at
`https://localhost:3000`, so stop anything else on port 3000 first: epr-local-environment's `waste-packaging-regulators-fe`
(regulator profile), or the frontend's own `npm run dev`.

```bash
docker compose up -d --wait   # the frontend and its HTTPS proxy, ZAP, Redis, MongoDB, LocalStack
npm run test:security         # the journey tests (not @accessibility) through ZAP, then the alert check
docker compose down           # when you're done
```

`npm run test:security` leaves out the `@accessibility` tests. It sets `ZAP_URL=http://localhost:8080` and, unless you
set `FRONTEND_URL`, goes to `https://localhost:3000`. That address takes three pieces in `compose.yml`:

- **Sign-in.** It's the only local redirect URI B2C allows for the frontend (see [Signing in](#signing-in)), and it's
  `https`. The frontend only serves `http`, so `https-proxy` (Caddy, `docker/https-proxy/Caddyfile`) serves it over
  HTTPS with its own certificate, which the browser and ZAP don't check. The frontend has `AUTH_COOKIE_SECURE=true`,
  so it tells B2C to send the browser back to `https://`, and its cookies are `Secure`, as on CDP.
- **ZAP.** The browser hands every URL to ZAP, and to ZAP in its own container `localhost` would be itself. So `zap`
  shares `https-proxy`'s network (`network_mode`), where `localhost:3000` is the proxy. That's why ZAP's port is
  published on `https-proxy`.
- **No other port.** The frontend itself isn't published: sign-in only works through `https://localhost:3000`.

Without ZAP, run the same tests against it with `FRONTEND_URL=https://localhost:3000 npm test`.

Open `zap-report/zap-report.html` for the detail of each alert. Leaving ZAP running is fine: each run starts a new
session.

### When it fails

The failure lists each alert: risk, the ZAP rule's name and id, and the URLs. The ZAP report says why ZAP raised it,
the evidence and the fix.

1. **A real issue:** fix it in the frontend, or raise a ticket for it.
2. **A false positive, or a risk the team accepts:** add it to `test/support/zap-accepted-alerts.js` with the rule's
   id, the reason, and the ticket where it was decided. Limit it to the URLs it applies to (`urls`) where you can, so
   the same problem on a new page still fails. Prefer teaching ZAP over accepting an alert where ZAP allows it, as
   `zap-setup` does for the `crumb` field.

### What it doesn't cover

- **Active scanning** (ZAP sending attack payloads, such as injection, to the frontend) isn't run: it would change
  data on shared environments and needs agreeing with the environment's owners first.
- **Pages the journey tests don't reach.** Alerts for B2C's own sign-in pages are left out with the other hosts'.
- **Static analysis (SAST) and dependency scanning,** the Test Strategy's other security checks, belong in the
  frontend's own pipeline, not here.

## On CDP

- Every merge to `main` builds and publishes a new image (`.github/workflows/publish.yml`); the Portal always runs
  the latest build.
- Run it from the Portal: Test Suites, `waste-submit-journey-tests`, choose the environment and press Run. The Portal
  sets `ENVIRONMENT`, so the tests go to `https://waste-submit-reg-packaging-fe.<environment>.cdp-int.defra.cloud`,
  through the platform proxy (`HTTP_PROXY`).
- With no Profile the run includes the [API checks](#api-checks) of `waste-submit-reg-packaging-api` in that
  environment, so the suite needs its `JourneyTests` client set up there first. Set Profile to `frontend` or `api` to
  run one without the other ([Profiles](#profiles)).
- After a deployment: a service's Portal page, Automations, Test Runs, runs this suite whenever that service is
  deployed to the environments chosen there. Set it up twice: on the frontend's page with Profile `frontend`, and on
  the API's page with Profile `api`, so a deployment of the API runs the API checks and nothing else.
- The default run (no Profile) goes through OWASP ZAP and fails on any High or Medium security alert; see
  [Security (OWASP ZAP)](#security-owasp-zap). If ZAP doesn't start, the tests still run but the run fails.
- Pass or fail is the container's exit code (`entrypoint.sh`); the Allure report is uploaded to the Portal by
  `bin/publish-tests.sh`.

## On GitHub

GitHub can't reach CDP environments, so `.github/workflows/journey-tests.yml` runs the tests against the frontend's
Docker Hub image started from `compose.yml`, the `frontend` profile through OWASP ZAP. Only the frontend is in
`compose.yml`, so the API checks can't run on GitHub: the action takes a `profile` input of `frontend` (the default)
or `accessibility`, and refuses `api`. Locally: `docker compose up -d --wait` then
`ZAP_URL=http://localhost:8080 npm run test:frontend`. A service repo can run them on its pull requests with
`DEFRA/waste-submit-journey-tests/run-journey-tests@main`, passing the image tag it built as
`waste-submit-reg-packaging-fe`; `waste-submit-reg-packaging-fe` does, so its pull request check fails on a High or
Medium security alert. The action uploads the Allure report, the ZAP report and the Docker Compose logs as artifacts.

A composite action can't read its caller's secrets, so the caller passes them in as inputs:

```yaml
- uses: DEFRA/waste-submit-journey-tests/run-journey-tests@main
  with:
    waste-submit-reg-packaging-fe: ${{ github.sha }}
    profile: frontend
    b2c-client-secret: ${{ secrets.WASTE_SUBMIT_REG_PACKAGING_FE_B2C_CLIENT_SECRET }}
    user-email: ${{ secrets.EPR_USER_EMAIL }}
    user-password: ${{ secrets.EPR_USER_PASSWORD }}
```

The three secrets are needed in each repository that runs the tests: this one, for `journey-tests.yml`, and
`waste-submit-reg-packaging-fe`. Organisation-level Actions secrets, limited to those repositories, save setting them
twice. Pull requests from forks don't get secrets, so their journey tests fail at sign-in.

To run a frontend change against changed tests before either merges, give both branches the same name: the frontend's
pull request check uses this repo's branch of that name when there is one (`journey-tests-ref`), and `main` otherwise.

On CDP, add `EPR_USER_EMAIL` and `EPR_USER_PASSWORD` on the test suite's page in the Portal, Secrets tab. The deployed
frontends have their own B2C settings, so the tests need nothing else there.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government licence v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
