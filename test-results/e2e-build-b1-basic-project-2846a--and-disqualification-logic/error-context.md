# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\build\b1-basic-project-creation.spec.ts >> Suite Build — b.1 Validate basic Project Creation >> should create project with Numeric and MC questions, conditional display and disqualification logic
- Location: tests\e2e\build\b1-basic-project-creation.spec.ts:36:7

# Error details

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for locator('button:has-text("Create")').first()
    - locator resolved to <button disabled type="button" data-e2e-selector="accept-button" class="ant-btn ant-btn-default _sxButton_m0s1n_2 _primary_m0s1n_212 _small_m0s1n_2">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is not stable
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is not enabled
  - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is not enabled
  - retrying click action
    - waiting 100ms
    - waiting for element to be visible, enabled and stable
  - element was detached from the DOM, retrying
    - locator resolved to <button disabled type="button" data-e2e-selector="accept-button" class="ant-btn ant-btn-default _sxButton_m0s1n_2 _primary_m0s1n_212 _small_m0s1n_2">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    13 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Suite: Build
  5   |  * Case: b.1 Validate basic Project Creation
  6   |  * Jam: https://jam.dev/c/469467f2-4756-46bc-a0ca-38df8ae3888a
  7   |  * Flow: Login → Create project from scratch → Add Numeric + MC questions
  8   |  *       → Conditional Display on Q2 based on Q1 → Disqualification on Q1 → Logout
  9   |  */
  10  | 
  11  | const KNOWN_ERRORS = [
  12  |   'ResizeObserver loop limit exceeded',
  13  |   'Non-Error promise rejection captured',
  14  |   'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
  15  |   'There is not a comparison active',
  16  | ];
  17  | 
  18  | const PROJECT_NAME = `E2E Build Test - ${Date.now()}`;
  19  | 
  20  | test.describe('Suite Build — b.1 Validate basic Project Creation', () => {
  21  |   let unexpectedErrors: string[] = [];
  22  |   let projectId: string = '';
  23  | 
  24  |   test.setTimeout(180000);
  25  | 
  26  |   test.beforeEach(async ({ page }) => {
  27  |     unexpectedErrors = [];
  28  |     page.on('console', msg => {
  29  |       if (msg.type() === 'error') {
  30  |         const isKnown = KNOWN_ERRORS.some(e => msg.text().includes(e));
  31  |         if (!isKnown) unexpectedErrors.push(msg.text());
  32  |       }
  33  |     });
  34  |   });
  35  | 
  36  |   test('should create project with Numeric and MC questions, conditional display and disqualification logic', async ({ page }) => {
  37  |     const email    = process.env.SIGHTX_USERNAME!;
  38  |     const password = process.env.SIGHTX_PASSWORD!;
  39  | 
  40  |     if (!email || !password) {
  41  |       throw new Error('SIGHTX_USERNAME and SIGHTX_PASSWORD are required in .env');
  42  |     }
  43  | 
  44  |     // ── Step 1: Login ─────────────────────────────────────────────────────
  45  |     await test.step('Login', async () => {
  46  |       await page.goto(
  47  |         'https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io'
  48  |       );
  49  |       await page.waitForLoadState('domcontentloaded');
  50  |       await page.fill('input#email', email);
  51  |       await page.fill('input#password', password);
  52  |       await page.waitForTimeout(500);
  53  |       await page.click('button[type="submit"]');
  54  |       await page.waitForURL('https://staging.sightx.io/**', { timeout: 20000 });
  55  |       await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 10000 });
  56  |     });
  57  | 
  58  |     // ── Step 2: Create new project from scratch ───────────────────────────
  59  |     await test.step('Create new project from scratch', async () => {
  60  |       // Open "Start a new project" dropdown
  61  |       const startBtn = page.locator('button:has-text("Start a new project")').first();
  62  |       await startBtn.waitFor({ state: 'visible', timeout: 10000 });
  63  |       await startBtn.click();
  64  |       await page.waitForTimeout(500);
  65  | 
  66  |       // Select "Create from scratch"
  67  |       
  68  |       const scratchOption = page.locator('._customOption_13vre_1:has-text("Create from scratch")').first();
  69  | 
  70  |       await scratchOption.waitFor({ state: 'visible', timeout: 8000 });
  71  |       await scratchOption.click();
  72  | 
  73  |       // Enter project name
  74  |       const nameInput = page.locator('input.ant-input').first();
  75  |       await nameInput.waitFor({ state: 'visible', timeout: 8000 });
  76  |       await nameInput.fill(PROJECT_NAME);
  77  |       await page.waitForTimeout(300);
  78  | 
  79  |       // Click Create
  80  |       const createBtn = page.locator('button:has-text("Create")').first();
> 81  |       await createBtn.click();
      |                       ^ Error: locator.click: Target page, context or browser has been closed
  82  | 
  83  |       // Wait for redirect to build page
  84  |       await page.waitForURL(/.*\/project\/([a-zA-Z0-9]+)\/build/, { timeout: 25000 });
  85  |       await page.waitForLoadState('domcontentloaded');
  86  | 
  87  |       // Extract project ID from URL
  88  |       const match = page.url().match(/\/project\/([a-zA-Z0-9]+)\/build/);
  89  |       expect(match).not.toBeNull();
  90  |       projectId = match![1];
  91  |       console.log('Project ID:', projectId);
  92  |     });
  93  | 
  94  |     // ── Step 3: Add Numeric Entry question ────────────────────────────────
  95  |     await test.step('Add Numeric Entry question (Q1)', async () => {
  96  |       // Click "Build your survey" area
  97  |       const buildArea = page.locator('[data-e2e-selector="add-item"]').first();
  98  |       await buildArea.waitFor({ state: 'visible', timeout: 10000 });
  99  |       await buildArea.click();
  100 |       await page.waitForTimeout(500);
  101 | 
  102 |       // Select Numeric Entry from palette
  103 |       const numericItem = page.locator('[data-e2e-selector="input-number"]').first();
  104 |       await numericItem.waitFor({ state: 'visible', timeout: 8000 });
  105 |       await numericItem.click();
  106 |       await page.waitForTimeout(500);
  107 | 
  108 |       // Validate question was added
  109 |       await expect(page.locator('[data-e2e-selector="item-container"]').first())
  110 |         .toBeVisible({ timeout: 8000 });
  111 |     });
  112 | 
  113 |     // ── Step 4: Add Multiple Choice question ──────────────────────────────
  114 |     await test.step('Add Multiple Choice question (Q2)', async () => {
  115 |       // Click "Add item" at bottom
  116 |       const addItem = page.locator('[data-e2e-selector="add-item"]').last();
  117 |       await addItem.waitFor({ state: 'visible', timeout: 8000 });
  118 |       await addItem.click();
  119 |       await page.waitForTimeout(500);
  120 | 
  121 |       // Select Multiple Choice from palette
  122 |       const mcItem = page.locator('[data-e2e-selector="multiple-text"]').first();
  123 |       await mcItem.waitFor({ state: 'visible', timeout: 8000 });
  124 |       await mcItem.click();
  125 |       await page.waitForTimeout(500);
  126 | 
  127 |       // Validate two questions now exist
  128 |       const questions = page.locator('[data-e2e-selector="item-container"]');
  129 |       await expect(questions).toHaveCount(2, { timeout: 8000 });
  130 |     });
  131 | 
  132 |     // ── Step 5: Add Conditional Display on Q2 based on Q1 ────────────────
  133 |     await test.step('Add Conditional Display on Q2 based on Q1', async () => {
  134 |       // Click second question's "Conditional Display" tab
  135 |       const questions = page.locator('[data-e2e-selector="item-container"]');
  136 |       const q2 = questions.nth(1);
  137 |       await q2.click();
  138 |       await page.waitForTimeout(300);
  139 | 
  140 |       // Click "Conditional Display" tab
  141 |       const conditionalTab = page.locator('[data-node-key="conditionalDisplay"]').last();
  142 |       await conditionalTab.waitFor({ state: 'visible', timeout: 8000 });
  143 |       await conditionalTab.click();
  144 |       await page.waitForTimeout(500);
  145 | 
  146 |       // Add condition button
  147 |       const addConditionBtn = page.locator('button:has-text("Add condition"), button:has-text("Add display condition")').first();
  148 |       if (await addConditionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  149 |         await addConditionBtn.click();
  150 |         await page.waitForTimeout(500);
  151 |       }
  152 | 
  153 |       // Validate conditional display panel is visible
  154 |       await expect(
  155 |         page.locator('[data-node-key="conditionalDisplay"]').last()
  156 |       ).toBeVisible({ timeout: 5000 });
  157 |     });
  158 | 
  159 |     // ── Step 6: Add Disqualification logic on Q1 ─────────────────────────
  160 |     await test.step('Add Disqualification logic on Q1 via Logic module', async () => {
  161 |       // Navigate to Logic module
  162 |       await page.goto(`https://staging.sightx.io/project/${projectId}/skipLogic`);
  163 |       await page.waitForLoadState('domcontentloaded');
  164 |       await page.waitForTimeout(1000);
  165 | 
  166 |       // Validate Logic page loaded
  167 |       await expect(page.locator('[data-e2e-selector="page-container"]').first())
  168 |         .toBeVisible({ timeout: 10000 });
  169 | 
  170 |       // Click "Add logic" on Q1 (first item-container → first add-logic button)
  171 |       const q1Container = page.locator('[data-e2e-selector="item-container"]').first();
  172 |       await q1Container.waitFor({ state: 'visible', timeout: 8000 });
  173 | 
  174 |       const addLogicBtn = q1Container.locator('[data-e2e-selector="add-logic"]').first();
  175 |       await addLogicBtn.waitFor({ state: 'visible', timeout: 8000 });
  176 |       await addLogicBtn.click();
  177 |       await page.waitForTimeout(500);
  178 | 
  179 |       // Validate condition form appeared
  180 |       const conditionContainer = page.locator('[data-e2e-selector="condition-container"]').first();
  181 |       await expect(conditionContainer).toBeVisible({ timeout: 8000 });
```