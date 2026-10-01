#!/usr/bin/env node
// Checks that test-catalog/*.json and the [TEST-ID] tags in tests/ agree with each other.
//   node scripts/validate-catalog.mjs        (npm run qa:validate)
// Exit code 1 on errors, so it can gate CI. Untagged tests are warnings only.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ID_RE, ID_IN_TITLE, loadCatalog, walk } from './lib.mjs';

const root = process.cwd();
const SUITES = ['authentication', 'build', 'execution', 'distribution', 'analysis', 'other'];
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const STATUSES = ['draft', 'automated', 'flaky', 'blocked', 'deprecated'];

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// 1. Catalog entries
const entries = loadCatalog(root);
const byId = new Map();
for (const { file, data, error } of entries) {
  if (error) { err(`${file}: invalid JSON (${error})`); continue; }
  const at = `${file}`;
  if (!data.id || !ID_RE.test(data.id)) err(`${at}: "id" missing or not like SUITE-CASE[-N] (got ${JSON.stringify(data.id)})`);
  if (!data.title) err(`${at}: "title" is required`);
  if (!SUITES.includes(data.suite)) err(`${at}: "suite" must be one of ${SUITES.join(', ')}`);
  if (!PRIORITIES.includes(data.priority)) err(`${at}: "priority" must be one of ${PRIORITIES.join(', ')}`);
  if (!STATUSES.includes(data.status)) err(`${at}: "status" must be one of ${STATUSES.join(', ')}`);
  if (data.status === 'blocked' && !data.blockedReason) err(`${at}: status "blocked" needs a "blockedReason"`);
  if (data.id && path.basename(file, '.json') !== data.id) warn(`${at}: file name should be ${data.id}.json`);
  if (data.id) {
    if (byId.has(data.id)) err(`${at}: duplicate id ${data.id} (also in ${byId.get(data.id).file})`);
    else byId.set(data.id, { file, data });
  }
  if (data.status !== 'draft') {
    if (!data.spec) err(`${at}: "spec" is required unless status is "draft"`);
    else if (!existsSync(path.join(root, data.spec))) err(`${at}: spec file not found: ${data.spec}`);
  }
}

// 2. Tags found in spec files
const specFiles = walk(path.join(root, 'tests'), (n) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(n));
const tagged = new Map(); // id -> Set(files)
const untagged = [];

// Parameter-driven specs build their titles from test-data/surveys.json, so the IDs live there.
const surveyFile = path.join(root, 'test-data', 'surveys.json');
const driven = specFiles.filter((f) => readFileSync(f, 'utf8').includes('loadSurveys('));
if (existsSync(surveyFile) && driven.length) {
  let surveys = [];
  try { surveys = JSON.parse(readFileSync(surveyFile, 'utf8')).surveys ?? []; } catch (e) { err(`test-data/surveys.json: invalid JSON (${e.message})`); }
  const seenIds = new Map();
  for (const sv of surveys) {
    if (!sv.testId) { if (sv.enabled !== false) warn(`test-data/surveys.json: survey "${sv.key}" has no testId, so its results are unmapped`); continue; }
    if (seenIds.has(sv.testId)) warn(`test-data/surveys.json: testId ${sv.testId} is used by "${seenIds.get(sv.testId)}" and "${sv.key}"; their history will be merged`);
    seenIds.set(sv.testId, sv.key);
    if (!tagged.has(sv.testId)) tagged.set(sv.testId, new Set());
    for (const f of driven) tagged.get(sv.testId).add(path.relative(root, f).split(path.sep).join('/'));
  }
}

for (const f of specFiles) {
  const rel = path.relative(root, f).split(path.sep).join('/');
  if (driven.includes(f)) continue; // titles are generated; handled above
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!/^\s*test(\.(only|fixme|fail|skip))?\(\s*[`'"]/.test(line)) return; // test titles only, not describe
    const m = ID_IN_TITLE.exec(line);
    if (m) {
      if (!tagged.has(m[1])) tagged.set(m[1], new Set());
      tagged.get(m[1]).add(rel);
    } else untagged.push(`${rel}:${i + 1}`);
  });
}

// 3. Cross-checks
for (const [id, files] of tagged) {
  const entry = byId.get(id);
  if (!entry) { err(`[${id}] is used in ${[...files].join(', ')} but has no entry in test-catalog/`); continue; }
  if (entry.data.spec && !files.has(entry.data.spec)) {
    err(`[${id}] catalog says spec is ${entry.data.spec} but the tag is in ${[...files].join(', ')}`);
  }
}
for (const [id, { file, data }] of byId) {
  if (['automated', 'flaky', 'blocked'].includes(data.status) && !tagged.has(id)) {
    err(`${file}: status "${data.status}" but no test titled [${id}] was found in tests/`);
  }
  if (data.status === 'draft' && tagged.has(id)) warn(`${file}: status is "draft" but [${id}] already has a test; update the status`);
}
for (const loc of untagged) warn(`untagged test (no [TEST-ID] in title): ${loc}`);

// 3b. Survey links belong in test-data/surveys.json, never in code
const SURVEY_LINK = /https?:\/\/survey[\w.-]*\.sightx\.io\/[0-9a-f]{16,}/;
for (const dir of ['tests', 'pages', 'helpers', 'flows', 'utils']) {
  for (const f of walk(path.join(root, dir), (n) => /\.[cm]?[jt]sx?$/.test(n))) {
    readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (SURVEY_LINK.test(line)) err(`${path.relative(root, f).split(path.sep).join('/')}:${i + 1}: hardcoded survey link; add it to test-data/surveys.json and use surveyUrl('<key>')`);
    });
  }
}

// 4. Report
console.log(`Catalog entries: ${byId.size} | tagged test IDs in specs: ${tagged.size} | untagged tests: ${untagged.length}`);
if (warnings.length) { console.log('\nWarnings:'); warnings.forEach((w) => console.log('  - ' + w)); }
if (errors.length) { console.log('\nErrors:'); errors.forEach((e) => console.log('  ✖ ' + e)); process.exit(1); }
console.log('\n✔ Catalog and spec tags are consistent.');
