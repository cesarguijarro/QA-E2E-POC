import { test, expect } from '@playwright/test';

test.describe('Ejecución de Encuestas - Flujo E2E Multiple Choice', () => {

  test('Debería responder encuestas de Multiple Choice, navegar entre páginas y enviar resultados', async ({ page }) => {
    
    // ----------------------------------------------------
    // PASO 1: Carga Inicial y Página 1 (No Randomize)
    // ----------------------------------------------------
    // Escuchar la llamada inicial del servicio de encuestas
    const initialPagePromise = page.waitForResponse(response => 
      response.url().includes('survey-service') && response.status() === 200
    );

    await page.goto('https://survey.staging.sightx.io/14fd6b964b484e46bea547f5f24f815dab5aff825084a0dc1587dc39b9b72511');
    await initialPagePromise;

    // Responder Pregunta MCSS (Single Select) - Seleccionar Opción
    const question1 = page.locator('[data-frontend-id="1790344820182"], [id="1790344820182"]');
    await question1.locator('span, label').filter({ hasText: 'OPTION - 1' }).first().click();

    // Responder Pregunta MCMS (Multiselect) - Seleccionar Opción 2 y Opción 3
    const question2 = page.locator('[data-frontend-id="1790344820190"], [id="1790344820190"]');
    await question2.locator('span, label').filter({ hasText: 'OPTION - 2' }).first().click();
    await question2.locator('span, label').filter({ hasText: 'OPTION - 3' }).first().click();

    // ----------------------------------------------------
    // PASO 2: Navegación a la Página 2 (Next Page)
    // ----------------------------------------------------
    // Esperar a que el backend procese la solicitud de la siguiente página
    const nextPagePromise = page.waitForResponse(response => 
      response.url().includes('survey-service') && response.status() === 200
    );

    const nextButton = page.locator('#nextPageId');
    await expect(nextButton).toBeVisible();
    await nextButton.click();
    
    await nextPagePromise; // Confirma que survey-service devolvió la Página 2

    // ----------------------------------------------------
    // PASO 3: Página 2 (Randomize Questions)
    // ----------------------------------------------------
    // Responder Pregunta MCSS Randomize Basic
    const questionRandom1 = page.locator('[data-frontend-id="1790344820198"], [id="1790344820198"]');
    await questionRandom1.locator('span, label').filter({ hasText: 'OPTION - 5' }).first().click();

    // Responder Pregunta MCSS Randomize Beginning
    const questionRandom2 = page.locator('[data-frontend-id="1790344820210"], [id="1790344820210"]');
    await questionRandom2.locator('span, label').filter({ hasText: 'OPTION - 3' }).first().click();

    // Responder Pregunta MCMS Flip (FrontendId: 1790344820224)
    const questionFlip = page.locator('[data-frontend-id="1790344820224"], [id="1790344820224"]');
    const optionsFlip = questionFlip.locator('.list_grid__uUdTI > span, label');
    await optionsFlip.nth(0).click();
    await optionsFlip.nth(1).click();
    await optionsFlip.nth(2).click();

    // Confirmación modal si aplica (OK)
    const okButton = page.getByText('OK');
    if (await okButton.isVisible()) {
      await okButton.click();
    }

    // Responder Pregunta MCMS Advanced (FrontendId: 1790344820199)
    const questionAdvanced = page.locator('[data-frontend-id="1790344820199"], [id="1790344820199"]');
    const optionsAdvanced = questionAdvanced.locator('.list_grid__uUdTI > span, label');
    await optionsAdvanced.nth(0).click();
    await optionsAdvanced.nth(1).click();

    // ----------------------------------------------------
    // PASO 4: Envío de la Encuesta (Submit)
    // ----------------------------------------------------
    // Interceptamos la llamada al endpoint de submit para validar la respuesta del servidor
    const submitPromise = page.waitForResponse(response => 
      response.url().includes('/submit') && (response.status() === 200 || response.status() === 201)
    );

    const submitButton = page.getByRole('button', { name: 'Submit' });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    const submitResponse = await submitPromise;
    expect(submitResponse.status()).toBeLessThan(400); // Valida registro exitoso en backend
  });

});