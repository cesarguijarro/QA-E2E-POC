import { test, expect } from '@playwright/test';

/**
 * Bug Reproducer Test for Jam 14812124-d506-4ed1-aa63-1fb0d17829bf
 * 
 * Target Application: SightX Staging (https://staging.sightx.io)
 * Issue: "Error: There is not a comparison active" thrown during question analysis data build.
 * 
 * Recorded Flow Summary:
 * 1. User logs in to SightX staging environment.
 * 2. Navigates to project "6a73a23ce4031b75f185e334" overview page.
 * 3. Clicks "Analyze" and navigates to Question Analysis page.
 * 4. The application attempts to build question analysis data without an active comparison,
 *    triggering a console error: "Error: There is not a comparison active".
 */

test.describe('Jam Bug Reproduction: 14812124-d506-4ed1-aa63-1fb0d17829bf', () => {
  test('should reproduce "There is not a comparison active" error on Question Analysis view', async ({ page }) => {
    const projectId = '6a73a23ce4031b75f185e334';
    
    const email = process.env.SIGHTX_USERNAME!;
    const password = process.env.SIGHTX_PASSWORD!;

    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Step 1: Navigate to login / app entry
    await page.goto('https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io');

    // Handle authentication if redirected to login page
    if (page.url().includes('/login')) {
      
      await page.fill('input#email', email);
      await page.fill('input#password', password);
      await page.waitForTimeout(500);
      await page.click('button[type="submit"]');


      await page.waitForURL((url) => url.origin === 'https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io', { timeout: 15000 });
    }

    // Step 2: Open target project tile from project dashboard
    const projectTile = page.locator('div._projectTile_18ari_1').first();
    if (await projectTile.isVisible()) {
      await projectTile.click();
    } else {
      // Direct navigation if tile selector is dynamic
      await page.goto(`https://staging.sightx.io/analysis/${projectId}/overview`);
    }

    await page.waitForURL(`**/analysis/${projectId}/**`);

    // Step 3: Click "Analyze" tab / navigation link
    const analyzeTab = page.locator('a', { hasText: 'Analyze' });
    if (await analyzeTab.isVisible()) {
      await analyzeTab.click();
    }

    // Step 4: Navigate to Question Analysis view
    await page.goto(`https://staging.sightx.io/analysis/${projectId}/question`);
    await page.waitForLoadState('networkidle');

    // Step 5: Assert that no "There is not a comparison active" error was thrown
    const hasComparisonError = consoleErrors.some((err) =>
      err.includes('There is not a comparison active')
    );

    expect(hasComparisonError, 'Expected no "There is not a comparison active" console error during analysis load').toBeFalsy();
  });
});
