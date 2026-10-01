import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { appendFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * History reporter
 * ----------------
 * Appends to two JSON-Lines files (no database, no extra dependencies):
 *
 *   <outputDir>/results.jsonl  one line per test per run   (RunRecord)
 *   <outputDir>/runs.jsonl     one line per run            (RunSummary)
 *
 * Test-case identity comes from an ID in the test title, e.g.
 *   test('[AUTH-A1-01] should login ...')
 * or from an annotation: test.info().annotations.push({ type: 'test-id', description: 'AUTH-A1-01' })
 * Tests without an ID are still recorded (testId: null) so they show up as "unmapped".
 *
 * Read the data with: npm run qa:summary
 */

export const SCHEMA_VERSION = 1;

/** SUITE-CASE[-VARIANT], upper-case, at least one hyphen. Matches "[AUTH-A1-01]". */
const TEST_ID_IN_TITLE = /\[([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\]/;

type Status = 'passed' | 'failed' | 'flaky' | 'skipped';

interface RunRecord {
  schemaVersion: number;
  runId: string;
  startedAt: string;
  commit: string | null;
  branch: string | null;
  env: string;
  ci: boolean;
  testId: string | null;
  title: string;
  file: string;
  project: string;
  status: Status;
  /** Raw Playwright status of the final attempt: passed | failed | timedOut | skipped | interrupted */
  resultStatus: string;
  attempts: number;
  durationMs: number;
  error: string | null;
  errorLocation: string | null;
  tags: string[];
  annotations: { type: string; description?: string }[];
  /** Seed used by the test's randomised helpers (from the 'seed' annotation set by rngFor). */
  seed: string | null;
}

interface RunSummary {
  schemaVersion: number;
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  commit: string | null;
  branch: string | null;
  env: string;
  ci: boolean;
  runStatus: string;
  totals: Record<Status | 'total' | 'unmapped', number>;
}

export interface HistoryReporterOptions {
  outputDir?: string;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const SECRET_KEY = /(PASSWORD|PASS|TOKEN|SECRET|KEY)/i;

class HistoryReporter implements Reporter {
  private rootDir = process.cwd();
  private outputDir: string;
  private startedAt = new Date();
  private runId = '';
  private suite!: Suite;
  private git = { commit: null as string | null, branch: null as string | null };
  private secrets: string[] = [];

  constructor(options: HistoryReporterOptions = {}) {
    this.outputDir = options.outputDir ?? 'qa-history';
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    // config.rootDir is the testDir, not the project root; the config file's folder is the project root.
    this.rootDir = config.configFile ? path.dirname(config.configFile) : process.cwd();
    this.suite = suite;
    this.startedAt = new Date();
    this.git = this.readGit();
    this.runId = this.makeRunId();
    // Error messages can echo typed values (e.g. a failed fill of a password). Scrub them before storing.
    this.secrets = Object.entries(process.env)
      .filter(([k, v]) => SECRET_KEY.test(k) && typeof v === 'string' && v.length >= 4)
      .map(([, v]) => v as string);
  }

  onEnd(result: FullResult): void {
    const finishedAt = new Date();
    // `playwright test --list` (or a run that aborted before starting) produces tests with no results: record nothing.
    const tests = this.suite.allTests().filter((t) => t.results.length > 0);
    if (tests.length === 0) return;
    const records = tests.map((t) => this.toRecord(t));

    const totals = { passed: 0, failed: 0, flaky: 0, skipped: 0, total: records.length, unmapped: 0 };
    for (const r of records) {
      totals[r.status]++;
      if (!r.testId) totals.unmapped++;
    }

    const summary: RunSummary = {
      schemaVersion: SCHEMA_VERSION,
      runId: this.runId,
      startedAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - this.startedAt.getTime(),
      commit: this.git.commit,
      branch: this.git.branch,
      env: process.env.QA_ENV ?? 'staging',
      ci: !!process.env.CI,
      runStatus: result.status,
      totals,
    };

    const dir = path.resolve(this.rootDir, this.outputDir);
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      path.join(dir, 'results.jsonl'),
      records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''),
    );
    appendFileSync(path.join(dir, 'runs.jsonl'), JSON.stringify(summary) + '\n');
  }

  // ---------------------------------------------------------------------------

  private toRecord(test: TestCase): RunRecord {
    const results: TestResult[] = test.results;
    const last: TestResult | undefined = results[results.length - 1];
    const outcome = test.outcome();
    const status: Status =
      outcome === 'expected' ? 'passed' : outcome === 'flaky' ? 'flaky' : outcome === 'skipped' ? 'skipped' : 'failed';

    // For a failure/flaky test, report the error of the last *failed* attempt.
    const failedAttempt = [...results].reverse().find((r) => r.status !== 'passed' && r.status !== 'skipped');
    const error = failedAttempt?.error && status !== 'passed' ? this.clean(failedAttempt.error.message ?? '') : null;
    const loc = failedAttempt?.error?.location;

    return {
      schemaVersion: SCHEMA_VERSION,
      runId: this.runId,
      startedAt: this.startedAt.toISOString(),
      commit: this.git.commit,
      branch: this.git.branch,
      env: process.env.QA_ENV ?? 'staging',
      ci: !!process.env.CI,
      testId: this.extractTestId(test),
      title: test.title,
      file: this.rel(test.location.file),
      project: test.parent.project()?.name || 'default',
      status,
      resultStatus: last?.status ?? 'skipped',
      attempts: results.length,
      durationMs: last?.duration ?? 0,
      error,
      errorLocation: loc && status !== 'passed' ? `${this.rel(loc.file)}:${loc.line}` : null,
      tags: test.tags ?? [],
      annotations: test.annotations.map((a) => ({ type: a.type, description: a.description })),
      seed: test.annotations.find((a) => a.type === 'seed')?.description ?? null,
    };
  }

  private extractTestId(test: TestCase): string | null {
    const fromAnnotation = test.annotations.find((a) => a.type === 'test-id')?.description;
    if (fromAnnotation) return fromAnnotation.trim();
    // titlePath() = [project, file, ...describe titles, test title]; the most specific title wins.
    for (const title of [...test.titlePath()].reverse()) {
      const m = TEST_ID_IN_TITLE.exec(title);
      if (m) return m[1];
    }
    return null;
  }

  private clean(message: string): string {
    let text = message.replace(ANSI, '');
    for (const s of this.secrets) text = text.split(s).join('***');
    text = text.trim();
    return text.length > 800 ? text.slice(0, 800) + '…' : text;
  }

  private rel(file: string): string {
    return path.relative(this.rootDir, file).split(path.sep).join('/');
  }

  private makeRunId(): string {
    if (process.env.QA_RUN_ID) return process.env.QA_RUN_ID;
    if (process.env.GITHUB_RUN_ID) {
      return `gh-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`;
    }
    const stamp = this.startedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return `local-${stamp}`;
  }

  private readGit(): { commit: string | null; branch: string | null } {
    const run = (args: string[]): string | null => {
      try {
        return (
          execFileSync('git', args, { cwd: this.rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim() || null
        );
      } catch {
        return null;
      }
    };
    return {
      commit: process.env.GITHUB_SHA ?? run(['rev-parse', 'HEAD']),
      branch: process.env.GITHUB_REF_NAME ?? run(['rev-parse', '--abbrev-ref', 'HEAD']),
    };
  }
}

export default HistoryReporter;
