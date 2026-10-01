// Small shared helpers for the QA scripts (no dependencies).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

export const ID_RE = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/;
export const ID_IN_TITLE = /\[([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\]/;

/** Recursively list files under dir whose name passes the filter. Skips node_modules/.git. */
export function walk(dir, filter = () => true) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, filter));
    else if (filter(name, full)) out.push(full);
  }
  return out;
}

export function loadCatalog(root) {
  const dir = path.join(root, 'test-catalog');
  return walk(dir, (n) => n.endsWith('.json') && n !== 'schema.json').map((file) => {
    try {
      return { file: path.relative(root, file).split(path.sep).join('/'), data: JSON.parse(readFileSync(file, 'utf8')) };
    } catch (e) {
      return { file: path.relative(root, file).split(path.sep).join('/'), error: e.message };
    }
  });
}

export function readJsonl(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null; // tolerate a truncated last line
      }
    })
    .filter(Boolean);
}
