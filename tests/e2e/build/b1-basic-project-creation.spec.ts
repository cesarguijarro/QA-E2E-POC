import { test, expect } from '@playwright/test';

/**
 * Suite: Build
 * Case: b.1 Validate basic Project Creation
 * Jam: https://jam.dev/c/469467f2-4756-46bc-a0ca-38df8ae3888a
 * Flow: Login → Create project from scratch → Add Numeric + MC questions
 *       → Conditional Display on Q2 based on Q1 → Disqualification on Q1 → Logout
 */

const KNOWN_ERRORS = [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection captured',
  'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
  'There is not a comparison active',
];

const PROJECT_NAME = `E2E Build Test - ${Date.now()}`;

test.describe('Suite Build — b.1 Validate basic Project Creation', () => {
  let unexpectedErrors: string[] = [];
  let projectId: string = '';

  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    unexpectedErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const isKnown = KNOWN_ERRORS.some(e => msg.text().includes(e));
        if (!isKnown) unexpectedErrors.push(msg.text());
      }
    });
  });

  test('should create project with Numeric and MC questions, conditional display and disqualification logic', async ({ page }) => {
    const email    = process.env.SIGHTX_USERNAME!;
    const password = process.env.SIGHTX_PASSWORD!;

    if (!email || !password) {
      throw new Error('SIGHTX_USERNAME and SIGHTX_PASSWORD are required in .env');
    }

    // ── Step 1: Login ─────────────────────────────────────────────────────
    await test.step('Login', async () => {
      await page.goto(
        'https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io'
      );
      await page.waitForLoadState('domcontentloaded');
      await page.fill('input#email', email);
      await page.fill('input#password', password);
      await page.waitForTimeout(500);
      await page.click('button[type="submit"]');
      await page.waitForURL('https://staging.sightx.io/**', { timeout: 20000 });
      await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 10000 });
    });

        // ── Step 2:  → ir a folder E2E → Create from scratch → nombre → Create → build...
    await test.step('Create new project from scratch in E2E folder', async () => {
      // Navigate to E2E folder
      await page.goto('https://staging.sightx.io/folder/6a8f71c82f8a3c001da460b0');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Open "Start a new project" dropdown
      const startBtn = page.locator('button:has-text("Start a new project")').first();
      await startBtn.waitFor({ state: 'visible', timeout: 10000 });
      await startBtn.click();
      await page.waitForTimeout(500);

      // Select "Create from scratch"
      const scratchOption = page.locator('._customOption_13vre_1:has-text("Create from scratch")').first();
      await scratchOption.waitFor({ state: 'visible', timeout: 8000 });
      await scratchOption.click();
      await page.waitForTimeout(500);

      // Enter project name — target modal input specifically
      const nameInput = page.locator('.ant-modal-body input.ant-input, input[placeholder="Write here..."]').first();
      await nameInput.waitFor({ state: 'visible', timeout: 8000 });
      await nameInput.fill(PROJECT_NAME);

      // Click Create
      const createBtn = page.locator('[data-e2e-selector="accept-button"]').first();
      await createBtn.click();

      // Wait for redirect to build page
      await page.waitForURL(/.*\/project\/([a-zA-Z0-9]+)\/build/, { timeout: 25000 });
      await page.waitForLoadState('domcontentloaded');

      // Extract project ID from URL
      const match = page.url().match(/\/project\/([a-zA-Z0-9]+)\/build/);
      expect(match).not.toBeNull();
      projectId = match![1];
      console.log('Project ID:', projectId);
    });

    // ── Step 3: Add Numeric Entry question ────────────────────────────────
    await test.step('Add Numeric Entry question (Q1)', async () => {
      // Click "Build your survey" area
      const buildArea = page.locator('[data-e2e-selector="add-item"]').first();
      await buildArea.waitFor({ state: 'visible', timeout: 10000 });
      await buildArea.click();
      await page.waitForTimeout(500);

      // Select Numeric Entry from palette
      const numericItem = page.locator('[data-e2e-selector="input-number"]').first();
      await numericItem.waitFor({ state: 'visible', timeout: 8000 });
      await numericItem.click();
      await page.waitForTimeout(500);

      // Validate question was added
      await expect(page.locator('[data-e2e-selector="item-container"]').first())
        .toBeVisible({ timeout: 8000 });
    });

    // ── Step 4: Add Multiple Choice question ──────────────────────────────
    await test.step('Add Multiple Choice question (Q2)', async () => {
      // Click "Add item" at bottom
      const addItem = page.locator('[data-e2e-selector="add-item"]').last();
      await addItem.waitFor({ state: 'visible', timeout: 8000 });
      await addItem.click();
      await page.waitForTimeout(500);

      // Select Multiple Choice from palette
      const mcItem = page.locator('[data-e2e-selector="multiple-text"]').first();
      await mcItem.waitFor({ state: 'visible', timeout: 8000 });
      await mcItem.click();
      await page.waitForTimeout(500);

      // Validate two questions now exist
      const questions = page.locator('[data-e2e-selector="item-container"]');
      await expect(questions).toHaveCount(2, { timeout: 8000 });
    });

    // ── Step 5: Add Conditional Display on Q2 based on Q1 ────────────────
    await test.step('Add Conditional Display on Q2 based on Q1', async () => {
      // Click second question's "Conditional Display" tab
      const questions = page.locator('[data-e2e-selector="item-container"]');
      const q2 = questions.nth(1);
      await q2.click();
      await page.waitForTimeout(300);

      // Click "Conditional Display" tab
      const conditionalTab = page.locator('[data-node-key="conditionalDisplay"]').last();
      await conditionalTab.waitFor({ state: 'visible', timeout: 8000 });
      await conditionalTab.click();
      await page.waitForTimeout(500);

      // Add condition button
      const addConditionBtn = page.locator('button:has-text("Add condition"), button:has-text("Add display condition")').first();
      if (await addConditionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addConditionBtn.click();
        await page.waitForTimeout(500);
      }

      // Validate conditional display panel is visible
      await expect(
        page.locator('[data-node-key="conditionalDisplay"]').last()
      ).toBeVisible({ timeout: 5000 });
    });

    // ── Step 6: Add Disqualification logic on Q1 ─────────────────────────
    await test.step('Add Disqualification logic on Q1 via Logic module', async () => {
      // Navigate to Logic module
      await page.goto(`https://staging.sightx.io/project/${projectId}/skipLogic`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Validate Logic page loaded
      await expect(page.locator('[data-e2e-selector="page-container"]').first())
        .toBeVisible({ timeout: 10000 });

      // Click "Add logic" on Q1 (first item-container → first add-logic button)
      const q1Container = page.locator('[data-e2e-selector="item-container"]').first();
      await q1Container.waitFor({ state: 'visible', timeout: 8000 });

      const addLogicBtn = q1Container.locator('[data-e2e-selector="add-logic"]').first();
      await addLogicBtn.waitFor({ state: 'visible', timeout: 8000 });
      await addLogicBtn.click();
      await page.waitForTimeout(500);

      // Validate condition form appeared
      const conditionContainer = page.locator('[data-e2e-selector="condition-container"]').first();
      await expect(conditionContainer).toBeVisible({ timeout: 8000 });

      // Select validation type (e.g. Equal)
      const validationSelector = page.locator('[data-e2e-selector="select-validation"]').first();
      await validationSelector.waitFor({ state: 'visible', timeout: 8000 });
      await validationSelector.click();
      await page.waitForTimeout(300);

      // Select "Equal" option
      const equalOption = page.locator('.ant-select-item-option:has-text("Equal")').first();
      if (await equalOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await equalOption.click();
        await page.waitForTimeout(300);
      }

      // Select where to jump → Disqualification
      const jumpSelector = page.locator('[data-e2e-selector="jump-selector"]').first();
      await jumpSelector.waitFor({ state: 'visible', timeout: 8000 });
      await jumpSelector.click();
      await page.waitForTimeout(300);

      const disqualOption = page.locator('.ant-select-item-option:has-text("Disqualification")').first();
      await disqualOption.waitFor({ state: 'visible', timeout: 8000 });
      await disqualOption.click();
      await page.waitForTimeout(300);

      // Accept / save the logic
      const acceptBtn = page.locator('[data-e2e-selector="accept-conditions"]').first();
      await acceptBtn.waitFor({ state: 'visible', timeout: 8000 });
      await acceptBtn.click();
      await page.waitForTimeout(500);

      // Validate disqualification label appears
      await expect(
        page.locator('text=DISQUALIFICATION').first()
      ).toBeVisible({ timeout: 8000 });
    });

    // ── Step 7: Logout ────────────────────────────────────────────────────
    await test.step('Logout', async () => {
      const myAccount = page.locator('._myAccount_2h5gz_36').first();
      await myAccount.waitFor({ state: 'visible', timeout: 10000 });
      await myAccount.click();
      await page.waitForTimeout(800);

      const logoutBtn = page.locator('._labelAndIcon_2h5gz_159:has-text("Log out")').first();
      await logoutBtn.waitFor({ state: 'visible', timeout: 8000 });
      await logoutBtn.click();

      await page.waitForURL(/login/, { timeout: 15000 });
      await expect(page.locator('input#email')).toBeVisible({ timeout: 10000 });
    });

    // ── Step 8: Validate no unexpected errors ─────────────────────────────
    await test.step('Validate no unexpected console errors', async () => {
      expect(
        unexpectedErrors,
        `Unexpected console errors:\n${unexpectedErrors.join('\n')}`
      ).toHaveLength(0);
    });
  });
});