import type { TestInfo } from '@playwright/test';

/**
 * Seeded randomness, so a failure in a "random answers" test can be replayed exactly.
 *
 *   QA_SEED=abc123 npx playwright test tests/dynamic-survey.spec.ts
 *
 * - One base seed per run: QA_SEED if set, otherwise generated once (playwright.config.ts) and shared with workers.
 * - One RNG per test, derived from base seed + test title, so a single test replays the same way
 *   whether it runs alone or inside the full suite, in any order.
 * - The seed is attached to the test as a 'seed' annotation (shown in the HTML report and stored in qa-history).
 */

export type Rng = () => number; // returns [0, 1), same contract as Math.random

/** mulberry32: tiny, fast, good enough for test-data variation. NOT for security. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash -> 32-bit integer. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function newBaseSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Base seed for this run (set by playwright.config.ts when not provided). */
export function baseSeed(): string {
  return (process.env.QA_SEED ??= newBaseSeed());
}

/** The RNG to use inside a test. Also records the seed on the test. */
export function rngFor(testInfo: TestInfo): Rng {
  const seed = baseSeed();
  if (!testInfo.annotations.some((a) => a.type === 'seed')) {
    testInfo.annotations.push({ type: 'seed', description: seed });
  }
  return createRng(hashSeed(`${seed}:${testInfo.titlePath.join('>')}`));
}

/** Unbiased in-place-safe shuffle (Fisher-Yates); returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}
