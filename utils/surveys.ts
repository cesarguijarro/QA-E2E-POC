import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface SurveyEntry {
  key: string;
  /** Catalog ID the result is reported under (goes in the test title as [ID]). */
  testId?: string;
  description?: string;
  url: string;
  enabled?: boolean;
  /** questionLabel (as set in the builder, e.g. "MCSS") -> option labels to select. Unlisted questions are answered randomly. */
  answers?: Record<string, string[]>;
  otherText?: string;
}

const ID_RE = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/;
const FILE = path.resolve(__dirname, '..', 'test-data', 'surveys.json');

/**
 * Surveys to run, from test-data/surveys.json.
 *   SURVEY_KEY=a,b   run only these keys (also runs entries marked enabled:false)
 *   SURVEY_LINK=url  run one ad-hoc survey (all questions random), ignoring the file
 */
export function loadSurveys(): SurveyEntry[] {
  const link = process.env.SURVEY_LINK?.trim();
  if (link) {
    assertUrl(link, 'SURVEY_LINK');
    return [{ key: 'adhoc', description: 'ad-hoc survey from SURVEY_LINK', url: link }];
  }

  let raw: { surveys?: SurveyEntry[] };
  try {
    raw = JSON.parse(readFileSync(FILE, 'utf8'));
  } catch (e) {
    throw new Error(`Cannot read ${FILE}: ${(e as Error).message}`);
  }
  const all = raw.surveys ?? [];

  const keys = new Set<string>();
  for (const s of all) {
    const at = `test-data/surveys.json entry "${s.key ?? '(no key)'}"`;
    if (!s.key || typeof s.key !== 'string') throw new Error(`${at}: "key" is required`);
    if (keys.has(s.key)) throw new Error(`${at}: duplicate key`);
    keys.add(s.key);
    assertUrl(s.url, at);
    if (s.testId && !ID_RE.test(s.testId)) throw new Error(`${at}: testId "${s.testId}" is not like SUITE-CASE[-N]`);
    for (const [q, opts] of Object.entries(s.answers ?? {})) {
      if (!Array.isArray(opts) || opts.length === 0 || opts.some((o) => typeof o !== 'string')) {
        throw new Error(`${at}: answers["${q}"] must be a non-empty array of option labels`);
      }
    }
  }

  const wanted = process.env.SURVEY_KEY?.split(',').map((k) => k.trim()).filter(Boolean);
  if (wanted?.length) {
    const missing = wanted.filter((k) => !keys.has(k));
    if (missing.length) throw new Error(`SURVEY_KEY not found in surveys.json: ${missing.join(', ')} (have: ${[...keys].join(', ')})`);
    return all.filter((s) => wanted.includes(s.key));
  }
  return all.filter((s) => s.enabled !== false);
}

function assertUrl(url: unknown, at: string): asserts url is string {
  if (typeof url !== 'string' || !/^https?:\/\/\S+$/.test(url)) {
    throw new Error(`${at}: "url" must be a full http(s) link (got ${JSON.stringify(url)})`);
  }
}

/**
 * URL of one survey from test-data/surveys.json, whether or not it is enabled.
 * For specs that still drive the page by hand: keeps the link out of the code.
 */
export function surveyUrl(key: string): string {
  const raw = JSON.parse(readFileSync(FILE, 'utf8')) as { surveys?: SurveyEntry[] };
  const all = raw.surveys ?? [];
  const found = all.find((s) => s.key === key);
  if (!found) {
    throw new Error(`Survey "${key}" not found in test-data/surveys.json (have: ${all.map((s) => s.key).join(', ')})`);
  }
  assertUrl(found.url, `test-data/surveys.json entry "${key}"`);
  return found.url;
}
