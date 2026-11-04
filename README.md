# waste-submit-journey-tests

Playwright journey tests for Submit Data's CDP frontend, `waste-submit-reg-packaging-fe`, run by the CDP Portal against
dev, test and perf-test.

- [Setup](#setup)
- [Running the tests](#running-the-tests)
  - [Against the local Docker setup](#against-the-local-docker-setup)
  - [Against a CDP environment](#against-a-cdp-environment)
  - [Options](#options)
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
```

To run the Docker image the way CDP does:

```bash
docker build --platform linux/amd64 -t waste-submit-journey-tests .
docker run --rm -e BASE_URL=http://host.docker.internal:8019 waste-submit-journey-tests
```

It ends with "failed to publish test results" locally, because only CDP sets `RESULTS_OUTPUT_S3_PATH`.

## On CDP

- Every merge to `main` builds and publishes a new image (`.github/workflows/publish.yml`); the Portal always runs
  the latest build.
- Run it from the Portal: Test Suites, `waste-submit-journey-tests`, choose the environment and press Run. The Portal
  sets `ENVIRONMENT`, so the tests go to `https://waste-submit-reg-packaging-fe.<environment>.cdp-int.defra.cloud`,
  through the platform proxy (`HTTP_PROXY`).
- After a deployment: the frontend's Portal page, Automations, Test Runs, runs this suite whenever the frontend is
  deployed to the environments chosen there.
- Pass or fail is the container's exit code (`entrypoint.sh`); the Allure report is uploaded to the Portal by
  `bin/publish-tests.sh`.

## On GitHub

GitHub can't reach CDP environments, so `.github/workflows/journey-tests.yml` runs the tests against the frontend's
Docker Hub image started from `compose.yml`. Locally: `docker compose up -d --wait` then `npm test`. A service repo
can run them on its pull requests with `DEFRA/waste-submit-journey-tests/run-journey-tests@main`, passing the image
tag it built as `waste-submit-reg-packaging-fe`.

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
