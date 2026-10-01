import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

// Imported after dotenv so QA_ENV / BASE_URL from .env are visible.
import { ENV } from './config/env';
import { baseSeed } from './utils/random';

const isCI = !!process.env.CI;

// One random seed per run (or QA_SEED to replay). Workers inherit it from this process.
baseSeed();

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 10_000 },

  // Fail the CI build if someone commits test.only.
  forbidOnly: isCI,

  // Retries are what make "flaky" detectable: a test that fails then passes is recorded as flaky.
  retries: isCI ? 2 : 0,

  // Serial by default: the suites share one staging account and a.3 resets its password.
  // Raise with QA_WORKERS once tests use isolated accounts/data.
  workers: Number(process.env.QA_WORKERS ?? 1),
  fullyParallel: false,

  use: {
    baseURL: ENV.adminUrl,
    // Headed locally (as before), headless in CI. Force headless locally with HEADLESS=true.
    headless: isCI || process.env.HEADLESS === 'true',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure', // was 'on': kept a trace for every passing test too
    // video: 'retain-on-failure',
  },

  reporter: [
    [isCI ? 'github' : 'list'],
    ['html', { open: 'never' }],
    // Appends one record per test per run to qa-history/ (see README.md).
    ['./reporters/history-reporter.ts', { outputDir: 'qa-history' }],
  ],
});
