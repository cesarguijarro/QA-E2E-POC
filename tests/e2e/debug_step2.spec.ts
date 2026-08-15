import { test, expect } from '@playwright/test';

test('debug step 2 dropdown and create', async ({ page }) => {
  const email = process.env.SIGHTX_USERNAME!;
  const password = process.env.SIGHTX_PASSWORD!;

  await page.goto('https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io');
  await page.waitForLoadState('domcontentloaded');

  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');

  await page.waitForURL('https://staging.sightx.io/**', { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');

  // 1. Abrir dropdown "Start a new project"
  const startProjectBtn = page.getByRole('button', { name: /Start a new project/i });
  await startProjectBtn.waitFor({ state: 'visible', timeout: 15000 });
  await startProjectBtn.click();

  // 2. Seleccionar "Create from scratch"
  const createScratchOption = page.locator('.ant-dropdown, .ant-dropdown-menu, [role="menu"]').getByText('Create from scratch').or(page.getByText('Create from scratch', { exact: true }));
  await createScratchOption.waitFor({ state: 'visible', timeout: 10000 });
  await createScratchOption.click();

  // 3. Modal New Project - selector específico dentro del modal
  const modalInput = page.locator('.ant-modal-content input, .ant-modal-body input').first();
  await modalInput.waitFor({ state: 'visible', timeout: 10000 });
  await modalInput.fill(`E2E Project ${Date.now()}`);

  const createModalBtn = page.locator('.ant-modal-content button[data-e2e-selector="accept-button"], .ant-modal-content button:has-text("Create")').first();
  await createModalBtn.click();

  await page.waitForURL(/.*\/project\/([a-zA-Z0-9]+)\/build/, { timeout: 25000 });
  await page.waitForLoadState('domcontentloaded');
  console.log('SUCCESS! Navigated to:', page.url());
});
