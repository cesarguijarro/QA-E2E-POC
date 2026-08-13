import { test, expect } from '@playwright/test';

/**
 * Reproductor E2E para el flujo capturado en Jam: 14812124-d506-4ed1-aa63-1fb0d17829bf
 * App: SightX Staging (https://staging.sightx.io)
 */

test.describe('Jam Bug Reproduction: 14812124-d506-4ed1-aa63-1fb0d17829bf', () => {
  test('should reproduce "There is not a comparison active" error on Question Analysis view', async ({ page }) => {
    const projectId = '6a73a23ce4031b75f185e334';
    const email = process.env.SIGHTX_USERNAME!;
    const password = process.env.SIGHTX_PASSWORD!;

    // Capturar errores de consola durante la ejecución
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Paso 1: Login directo
    await page.goto('https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io');
    await page.waitForLoadState('domcontentloaded');

    await page.fill('input#email', email);
    await page.fill('input#password', password);
    await page.waitForTimeout(500);
    await page.click('button[type="submit"]');

    // Paso 2: Esperar redirección a staging.sightx.io
    await page.waitForURL('https://staging.sightx.io/**', { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');

    // Paso 3: Navegar directamente al análisis de preguntas
    await page.goto(`https://staging.sightx.io/analysis/${projectId}/question`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Paso 4: Validar que no exista el error de consola
    const hasComparisonError = consoleErrors.some((err) =>
      err.includes('There is not a comparison active')
    );

    expect(
      hasComparisonError,
      'Se detectó el error "There is not a comparison active" en la consola'
    ).toBeFalsy();
  });
});