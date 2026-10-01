# ai-qa-poc: E2E QA framework (Playwright)

End-to-end tests for the survey platform (build + execution) that also record **every result**, so the
evolution of each test case (pass rate, flakiness, duration, coverage) can be tracked over time.

## Setup
```bash
npm ci
cp .env.example .env        # fill in real values; .env is git-ignored
npx playwright install
```

## Commands
| Command | What it does |
| --- | --- |
| `npm test` | Run all specs (headed locally, headless in CI). `HEADLESS=true` forces headless. |
| `npm run qa:validate` | Check `test-catalog/` against the `[TEST-ID]` tags in `tests/`. Fails on mismatch. |
| `npm run qa:summary` | Build `qa-history/summary.md` (health, flaky, slower, coverage, gaps). |
| `npm run qa:report` | validate, then run, then summary. |

## Test-case IDs
Every test case has a stable ID: `SUITE-CASE[-VARIANT]`, upper-case (`AUTH-A1-01`, `BUILD-B1-01`, `EXEC-MC-01`).
Put it in square brackets at the start of the test title:

```ts
test('[AUTH-A1-01] should login with valid credentials and logout successfully', async ({ page }) => { ... });
```
(Alternative for generated titles: `test.info().annotations.push({ type: 'test-id', description: 'AUTH-A1-01' })`.)

Tests without an ID still run and are recorded, but appear under **Unmapped tests** in the summary.
The ID never changes when the test is renamed or moved; that is what keeps its history continuous.

## Catalog (`test-catalog/<suite>/<ID>.json`)
One file per case, described by `test-catalog/schema.json` (editors that support JSON Schema will autocomplete).
It holds what the code can't say: priority, status (`draft | automated | flaky | blocked | deprecated`),
why it is blocked, what it covers (`questionTypes`, `logic`, `areas`), Jam/issue links and a changelog.
Add a catalog file first, then tag the spec. `npm run qa:validate` keeps both sides honest.

## History (`qa-history/`, git-ignored)
The custom reporter (`reporters/history-reporter.ts`) appends to:
- `results.jsonl`: one line per test per run (status `passed | failed | flaky | skipped`, attempts, duration,
  error text with secrets redacted, error location, commit, branch, env).
- `runs.jsonl`: one line per run with totals.

`flaky` = failed, then passed on a retry (retries are 2 in CI, 0 locally).
"Pass rate" in the summary counts clean passes only; flaky runs are counted separately.

**CI:** the workflow uploads `qa-history/` as an artifact per run. To analyse many runs, download those
artifacts into `qa-history/ci/<run>/` and run `npm run qa:summary` (it merges everything below the folder and ignores duplicates).
Later you can move this to a dedicated `qa-history` branch or a database without changing the record format.

## Surveys under test (`test-data/surveys.json`)
Surveys are hand-built in the platform, so each one is registered here with its respondent link; no link or
question id lives in code. Entries: `key`, `url`, optional `testId` (catalog ID), `answers` (pin options by the
`questionLabel` set in the builder; everything else is answered randomly) and `enabled`.
```bash
SURVEY_KEY=mc-basic-pinned npx playwright test tests/execution      # one survey
SURVEY_LINK=<respondent url> npx playwright test tests/execution    # ad-hoc, all random
```
Specs that drive the page by hand use `surveyUrl('<key>')` from `utils/surveys.ts`. `npm run qa:validate` fails
if a survey link is hardcoded anywhere in `tests/`, `pages/`, `helpers/`, `flows/` or `utils/`.

## Replaying a random failure
Tests that answer surveys randomly use a seeded generator (`utils/random.ts`). Each run gets a seed, printed in the
test output, attached to the test as a `seed` annotation and stored in `qa-history`. To replay a failure exactly:
```bash
QA_SEED=<seed from the failed run> npx playwright test tests/execution/survey-execution.spec.ts
```
Use `rngFor(test.info())` in a test and pass the result to helpers; never call `Math.random()` in test code.

## Layout
```
config/env.ts          environment URLs (override via .env)
reporters/             history reporter
utils/                 seeded random helpers
scripts/               validate-catalog, history-summary
test-catalog/          one JSON per test case
pages/ helpers/        page objects and survey-answering helpers
tests/                 specs
```
