#!/usr/bin/env node
// Turns qa-history/*.jsonl into a health report (Markdown) for the test cases.
//   node scripts/history-summary.mjs [dir ...]      (npm run qa:summary)
// Each dir is searched recursively for results.jsonl / runs.jsonl, so CI artifacts from many runs
// can be downloaded into qa-history/ci/<run>/ and merged. Duplicates (same runId) are ignored.
// Output: printed to the console and written to <first dir>/summary.md
import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadCatalog, readJsonl, walk } from './lib.mjs';

const root = process.cwd();
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['qa-history'];
const WINDOW = 20; // runs considered per test case

// ---- load ----------------------------------------------------------------
const resultFiles = dirs.flatMap((d) => walk(path.resolve(root, d), (n) => n === 'results.jsonl'));
const runFiles = dirs.flatMap((d) => walk(path.resolve(root, d), (n) => n === 'runs.jsonl'));
if (!resultFiles.length) {
  console.error(`No results.jsonl found under: ${dirs.join(', ')}. Run the tests first (npx playwright test).`);
  process.exit(1);
}

const runs = new Map();
for (const f of runFiles) for (const r of readJsonl(f)) if (!runs.has(r.runId)) runs.set(r.runId, r);

const seen = new Set();
const records = [];
for (const f of resultFiles) {
  for (const r of readJsonl(f)) {
    const key = `${r.runId}|${r.testId ?? r.file + r.title}|${r.project}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push(r);
  }
}
records.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
const runList = [...runs.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

const catalog = new Map();
for (const { data } of loadCatalog(root)) if (data?.id) catalog.set(data.id, data);

// ---- helpers -------------------------------------------------------------
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '-');
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const day = (iso) => iso.slice(0, 10);
const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

// ---- per test case ---------------------------------------------------------
const byId = new Map();
const unmapped = new Map();
for (const r of records) {
  if (!r.testId) {
    unmapped.set(`${r.file}|${r.title}`, r); // keep latest
    continue;
  }
  if (!byId.has(r.testId)) byId.set(r.testId, []);
  byId.get(r.testId).push(r);
}

const cases = [...byId.entries()].map(([id, all]) => {
  const recs = all.slice(-WINDOW);
  const executed = recs.filter((r) => r.status !== 'skipped');
  const last = recs[recs.length - 1];
  const passed = executed.filter((r) => r.status === 'passed').length;
  const flaky = executed.filter((r) => r.status === 'flaky').length;
  let failStreak = 0;
  for (let i = recs.length - 1; i >= 0 && recs[i].status === 'failed'; i--) failStreak++;
  const prior = executed.filter((r) => r.status === 'passed' && r !== last).map((r) => r.durationMs);
  const med = median(prior);
  const slow = prior.length >= 3 && last.status === 'passed' && last.durationMs > med * 1.5 && last.durationMs - med > 5000;
  const cat = catalog.get(id);
  let health = 'stable';
  if (cat?.status === 'blocked') health = 'blocked';
  else if (last.status === 'failed') health = failStreak > 1 ? `failing (${failStreak} runs)` : 'failing';
  else if (flaky > 0) health = 'flaky';
  else if (slow) health = 'slower';
  else if (last.status === 'skipped') health = 'skipped';
  return { id, cat, recs, last, executed: executed.length, passed, flaky, failStreak, med, slow, health, first: all[0] };
}).sort((a, b) => a.id.localeCompare(b.id));

// ---- report ----------------------------------------------------------------
const out = [];
const w = (s = '') => out.push(s);

w('# QA history summary');
w();
w(`Generated ${new Date().toISOString()} · ${runList.length} runs · ${records.length} test results · window: last ${WINDOW} runs per case`);
w();

w('## Run trend (latest 10)');
w();
w(table(['Run', 'Date', 'Env', 'Commit', 'Passed', 'Failed', 'Flaky', 'Skipped', 'Duration'],
  runList.slice(-10).reverse().map((r) => [
    r.runId, day(r.startedAt), r.env, (r.commit ?? '-').slice(0, 7),
    r.totals.passed, r.totals.failed, r.totals.flaky, r.totals.skipped, secs(r.durationMs),
  ])));
w();

const attention = cases.filter((c) => c.health !== 'stable' && c.health !== 'blocked');
w('## Needs attention');
w();
if (!attention.length) w('Nothing flagged: no failing, flaky or slower cases in the window.');
else {
  for (const c of attention) {
    const err = c.last.error ? ` — \`${c.last.error.split('\n')[0].slice(0, 120)}\`${c.last.errorLocation ? ` at ${c.last.errorLocation}` : ''}` : '';
    w(`- **${c.id}** ${c.cat?.title ?? ''}: ${c.health}${c.slow ? ` (last ${secs(c.last.durationMs)} vs median ${secs(c.med)})` : ''}${err}`);
  }
}
w();

w('## Test case health');
w();
w(table(['ID', 'Case', 'Prio', 'Catalog', 'Health', 'Pass rate', 'Flaky runs', 'Runs', 'Median time', 'Last run', 'First seen'],
  cases.map((c) => [
    c.id, c.cat?.title ? c.cat.title.slice(0, 60) : '_not in catalog_', c.cat?.priority ?? '-', c.cat?.status ?? '-', c.health,
    pct(c.passed, c.executed), c.flaky, c.executed, c.med ? secs(c.med) : '-', `${c.last.status} (${day(c.last.startedAt)})`, day(c.first.startedAt),
  ])));
w();

// coverage by feature, from the catalog
const features = new Map(); // "kind: value" -> {total, automated, green}
for (const cat of catalog.values()) {
  for (const [kind, vals] of Object.entries(cat.covers ?? {})) {
    for (const v of vals) {
      const k = `${kind}: ${v}`;
      if (!features.has(k)) features.set(k, { total: 0, live: 0, green: 0 });
      const f = features.get(k);
      f.total++;
      if (['automated', 'flaky'].includes(cat.status)) f.live++;
      const c = cases.find((x) => x.id === cat.id);
      if (c && ['passed', 'flaky'].includes(c.last.status) && cat.status !== 'blocked') f.green++;
    }
  }
}
w('## Coverage by feature (from test-catalog)');
w();
w(features.size
  ? table(['Feature', 'Cases', 'Automated', 'Passing in last run'], [...features.entries()].sort().map(([k, f]) => [k, f.total, f.live, f.green]))
  : 'No `covers` data in the catalog yet.');
w();

w('## Catalog gaps');
w();
const neverRun = [...catalog.values()].filter((c) => ['automated', 'flaky'].includes(c.status) && !byId.has(c.id));
const blocked = [...catalog.values()].filter((c) => c.status === 'blocked');
const notInCatalog = cases.filter((c) => !c.cat);
neverRun.forEach((c) => w(`- ${c.id}: marked ${c.status} but has no recorded results`));
blocked.forEach((c) => w(`- ${c.id}: blocked — ${c.blockedReason}`));
notInCatalog.forEach((c) => w(`- ${c.id}: has results but no catalog entry`));
if (!neverRun.length && !blocked.length && !notInCatalog.length) w('None.');
w();

w('## Unmapped tests (no [TEST-ID] in the title)');
w();
w(unmapped.size
  ? table(['File', 'Title', 'Last status', 'Last run'], [...unmapped.values()].map((r) => [r.file, r.title.slice(0, 70), r.status, day(r.startedAt)]))
  : 'None.');
w();

const text = out.join('\n');
console.log(text);
const target = path.resolve(root, dirs[0], 'summary.md');
if (existsSync(path.dirname(target))) {
  writeFileSync(target, text + '\n');
  console.error(`\nWrote ${path.relative(root, target)}`);
}
