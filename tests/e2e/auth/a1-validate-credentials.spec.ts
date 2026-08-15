import { test, expect, request } from '@playwright/test';

/**
 * Suite: Auth
 * Case: a.1 Validate credentials — Login / Logout
 * Jam: https://jam.dev/c/65aa1a32-5698-498c-a99d-98c8799b198c
 */

const KNOWN_ERRORS = [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection captured',
  'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
];

test.describe('Suite Auth — a.1 Validate credentials', () => {
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

  test('should login with valid credentials and logout successfully', async ({ page }) => {
    const email    = process.env.SIGHTX_USERNAME!;
    const password = process.env.SIGHTX_PASSWORD!;

    if (!email || !password) {
      throw new Error('SIGHTX_USERNAME y SIGHTX_PASSWORD son requeridos en .env');
    }

    // ── Paso 1: Navegar al login ──────────────────────────────────────────
    await test.step('Navegar a la página de login', async () => {
      await page.goto(
        'https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io'
      );
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('input#email')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('input#password')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    // ── Paso 2: Ingresar credenciales válidas ─────────────────────────────
    await test.step('Ingresar credenciales y hacer submit', async () => {
      await page.fill('input#email', email);
      await page.fill('input#password', password);
      await page.waitForTimeout(500);

      // Capturar respuesta del login
      const [loginResponse] = await Promise.all([
        page.waitForResponse(
          res => res.url().includes('/auth') && res.request().method() === 'POST',
          { timeout: 15000 }
        ).catch(() => null),
        page.click('button[type="submit"]'),
      ]);

      if (loginResponse) {
        expect(
          loginResponse.status(),
          `Login API respondió con código inesperado: ${loginResponse.status()}`
        ).toBeLessThan(400);
      }
    });

    // ── Paso 3: Validar redirección al dashboard ──────────────────────────
    await test.step('Validar acceso al dashboard principal', async () => {
      await page.waitForURL('https://staging.sightx.io/**', { timeout: 20000 });
      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveURL(/staging\.sightx\.io/);
      await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('button:has-text("Start a new project")')).toBeVisible();
    });

    // ── Paso 4: Logout ────────────────────────────────────────────────────
    await test.step('Cerrar sesión correctamente', async () => {
    // Abrir menú de cuenta
    const myAccount = page.locator('text=My account').first();
    await myAccount.waitFor({ state: 'visible', timeout: 10000 });
    await myAccount.click();
    await page.waitForTimeout(500); // esperar que se abra el dropdown

    // El Log out aparece en el dropdown abierto
    const logoutBtn = page.locator('text=Log out').first();
    await logoutBtn.waitFor({ state: 'visible', timeout: 8000 });
    await logoutBtn.click();

    await page.waitForURL(/app\.staging-admin\.sightx\.io\/login/, { timeout: 15000 });
    await expect(page.locator('input#email')).toBeVisible({ timeout: 10000 });
    });

  test('should reject invalid credentials', async ({ page }) => {
    await test.step('Intentar login con contraseña incorrecta', async () => {
      await page.goto(
        'https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io'
      );
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input#email', process.env.SIGHTX_USERNAME!);
      await page.fill('input#password', 'wrong_password_123');
      await page.waitForTimeout(500);
      await page.click('button[type="submit"]');

      // Debe mostrar error y NO redirigir
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/login/);

      const errorMsg = page.locator(
        'text=Invalid, text=incorrect, text=wrong, .ant-message-error, .ant-alert-error'
      ).first();
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    });
  });
});