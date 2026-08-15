import { test, expect } from '@playwright/test';

/**
 * Suite: Auth
 * Case: a.2 Validate user can access Non-Core — Login / Switch / Logout
 * Jam: https://jam.dev/c/96d86d5b-39a5-4ffe-a471-c002543d7121
 */

const KNOWN_ERRORS = [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection captured',
  'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
];

test.describe('Suite Auth — a.2 Validate Non-Core access', () => {
  let unexpectedErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    unexpectedErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const isKnown = KNOWN_ERRORS.some(e => msg.text().includes(e));
        if (!isKnown) unexpectedErrors.push(msg.text());
      }
    });
  });

  test('should login, switch to Non-Core workspace and logout', async ({ page }) => {
    const email    = process.env.SIGHTX_USERNAME!;
    const password = process.env.SIGHTX_PASSWORD!;

    if (!email || !password) {
      throw new Error('SIGHTX_USERNAME y SIGHTX_PASSWORD son requeridos en .env');
    }

    // ── Paso 1: Login ─────────────────────────────────────────────────────
    await test.step('Login con credenciales válidas', async () => {
      await page.goto(
        'https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io'
      );
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input#email', email);
      await page.fill('input#password', password);
      await page.waitForTimeout(500);
      await page.click('button[type="submit"]');

      await page.waitForURL('https://staging.sightx.io/**', { timeout: 20000 });
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/staging\.sightx\.io/);
    });

    // ── Paso 2: Cambiar a workspace Non-Core ─────────────────────────────
    await test.step('Cambiar a workspace Non-Core', async () => {
      // El switcher de workspace suele estar en el header o sidebar
      const workspaceSwitcher = page.locator(
        '[class*="workspace"], [class*="org"], [class*="switcher"], text=Non-Core'
      ).first();

      await workspaceSwitcher.waitFor({ state: 'visible', timeout: 10000 });
      await workspaceSwitcher.click();

      // Si hay un dropdown, buscar la opción Non-Core
      const nonCoreOption = page.locator('text=Non-Core').first();
      if (await nonCoreOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nonCoreOption.click();
      }

      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Validar que estamos en Non-Core
      await expect(
        page.locator('text=Non-Core').first()
      ).toBeVisible({ timeout: 10000 });
    });

    // ── Paso 3: Validar acceso en Non-Core ───────────────────────────────
    await test.step('Validar que el dashboard de Non-Core cargó correctamente', async () => {
      await expect(page).toHaveURL(/staging\.sightx\.io/);

      // Debe mostrar el dashboard con proyectos o contenido de Non-Core
      const dashboardContent = page.locator(
        'text=Projects, text=Welcome, [class*="dashboard"], [class*="project"]'
      ).first();
      await expect(dashboardContent).toBeVisible({ timeout: 10000 });
    });

    // ── Paso 4: Logout ────────────────────────────────────────────────────
    await test.step('Cerrar sesión desde Non-Core', async () => {
      const myAccount = page.locator('text=My account').first();
      await myAccount.waitFor({ state: 'visible', timeout: 10000 });
      await myAccount.click();

      const logoutBtn = page.locator('text=Log out').last();
      await logoutBtn.waitFor({ state: 'visible', timeout: 5000 });
      await logoutBtn.click();

      await page.waitForURL(/app\.staging-admin\.sightx\.io\/login/, { timeout: 15000 });
      await expect(page.locator('input#email')).toBeVisible({ timeout: 10000 });
    });

    // ── Paso 5: Validar errores ───────────────────────────────────────────
    await test.step('Validar ausencia de errores inesperados', async () => {
      expect(
        unexpectedErrors,
        `Errores inesperados:\n${unexpectedErrors.join('\n')}`
      ).toHaveLength(0);
    });
  });
});