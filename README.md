# waste-submit-journey-tests

Playwright journey tests for Submit Data's CDP frontend, `waste-submit-reg-packaging-fe`, run by the CDP Portal against
dev, test and perf-test.

- [Setup](#setup)
- [Running the tests](#running-the-tests)
  - [Against the local Docker setup](#against-the-local-docker-setup)
  - [Against a CDP environment](#against-a-cdp-environment)
  - [Options](#options)
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
| `BASE_URL`                 | that URL                                                                  |
| `ENVIRONMENT` (e.g. `dev`) | `https://waste-submit-reg-packaging-fe.<ENVIRONMENT>.cdp-int.defra.cloud` |
| neither                    | `http://localhost:8019`, the local Docker setup                           |

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

To test the frontend's own `npm run dev` instead (port 3000): `BASE_URL=http://localhost:3000 npm test`.

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
docker compose up -d --wait
docker run --rm --network waste-submit-journey-tests_default \
  -e BASE_URL=http://waste-submit-reg-packaging-fe.localhost:3000 waste-submit-journey-tests
```

It ends with "failed to publish test results" locally, because only CDP sets `RESULTS_OUTPUT_S3_PATH`. (Why the
`.localhost` name: see [Running it locally](#running-it-locally).)

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

| Where                                                                                                          | How                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every pull request on `waste-submit-reg-packaging-fe`, before it merges                                        | The `run-journey-tests` action runs the whole suite, accessibility included, through ZAP (`ZAP_URL` set, `npm test`) against the PR's image, with ZAP from `compose.yml`. The ZAP report is the `zap-report` artifact on the workflow run |
| The CDP Portal's default run (no Profile): run by hand, or automatically after each deployment of the frontend | `entrypoint.sh` starts the ZAP bundled in the image (pinned in the `Dockerfile`) and chains it to the platform proxy, then runs `npm test` through it. The ZAP report is attached to the Allure report                                    |
| Your machine                                                                                                   | `npm run test:security` ([below](#running-it-locally))                                                                                                                                                                                    |

The `accessibility` and `compatibility` profiles don't go through ZAP.

### Running it locally

ZAP runs in Docker, from this repo's `compose.yml`, along with the frontend and what it needs. Stop epr-local-environment's
frontend first if it's running: both use port 8019.

```bash
docker compose up -d --wait   # the frontend, ZAP, Redis, MongoDB, LocalStack
npm run test:security         # the journey tests (not @accessibility) through ZAP, then the alert check
docker compose down           # when you're done
```

`npm run test:security` leaves out the `@accessibility` tests. It sets `ZAP_URL=http://localhost:8080` and, unless you
set `BASE_URL`, goes to
`http://waste-submit-reg-packaging-fe.localhost:3000`. That name is two workarounds in one:

- The browser hands every URL to ZAP. To ZAP, in its own container, `localhost:8019` would be itself, so it needs
  the frontend's name on the Docker network (an alias in `compose.yml`).
- The frontend's image runs in production mode, so its CSRF and cookie-policy cookies are `Secure`. Over plain HTTP,
  Chromium only keeps `Secure` cookies for `localhost` and `*.localhost`; on any other name the cookie forms fail.

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
- **Pages the journey tests don't reach,** and signed-in pages until the journeys sign in.
- **Static analysis (SAST) and dependency scanning,** the Test Strategy's other security checks, belong in the
  frontend's own pipeline, not here.

## On CDP

- Every merge to `main` builds and publishes a new image (`.github/workflows/publish.yml`); the Portal always runs
  the latest build.
- Run it from the Portal: Test Suites, `waste-submit-journey-tests`, choose the environment and press Run. The Portal
  sets `ENVIRONMENT`, so the tests go to `https://waste-submit-reg-packaging-fe.<environment>.cdp-int.defra.cloud`,
  through the platform proxy (`HTTP_PROXY`).
- After a deployment: the frontend's Portal page, Automations, Test Runs, runs this suite whenever the frontend is
  deployed to the environments chosen there.
- The default run (no Profile) goes through OWASP ZAP and fails on any High or Medium security alert; see
  [Security (OWASP ZAP)](#security-owasp-zap). If ZAP doesn't start, the tests still run but the run fails.
- Pass or fail is the container's exit code (`entrypoint.sh`); the Allure report is uploaded to the Portal by
  `bin/publish-tests.sh`.

## On GitHub

GitHub can't reach CDP environments, so `.github/workflows/journey-tests.yml` runs the tests against the frontend's
Docker Hub image started from `compose.yml`, the whole suite through OWASP ZAP. Locally: `docker compose up -d --wait`
then `ZAP_URL=http://localhost:8080 npm test`. A service repo can run them on its pull requests with
`DEFRA/waste-submit-journey-tests/run-journey-tests@main`, passing the image tag it built as
`waste-submit-reg-packaging-fe`; `waste-submit-reg-packaging-fe` does, so its pull request check fails on a High or
Medium security alert. The action uploads the Allure report, the ZAP report and the Docker Compose logs as artifacts.

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
