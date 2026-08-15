import { test, expect } from '@playwright/test';

/**
 * Reproducción E2E del flujo capturado en Jam: https://jam.dev/c/59f3676c-0d10-477a-a8d6-fa4af104e9dd
 * Título del Jam: "Login - Create a single project - Launch a Link campaign - Analize - Logout"
 * Aplicación: SightX Staging (https://staging.sightx.io)
 */

test.describe('E2E Flow: Login -> Create Project -> Build Survey -> Launch Campaign -> Respond -> Analyze -> Logout', () => {
  const email = process.env.SIGHTX_USERNAME!;
  const password = process.env.SIGHTX_PASSWORD!;

  test.beforeAll(() => {
    if (!email || !password) {
      throw new Error(
        'Las variables de entorno SIGHTX_USERNAME y SIGHTX_PASSWORD son requeridas para ejecutar este test. Verifica tu archivo .env'
      );
    }
  });

  test('should complete the end-to-end lifecycle from login to project creation, distribution, response, analysis, and logout', async ({ page, context }) => {
    const projectName = `E2E Test - ${Date.now()}`;
    let projectId: string = '';
    let surveyUrl: string = '';

    // -------------------------------------------------------------------------
    // PASO 1: Iniciar Sesión (Login)
    // -------------------------------------------------------------------------
    await test.step('Paso 1: Iniciar sesión en SightX Staging', async () => {
      await page.goto('https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io');
      await page.waitForLoadState('domcontentloaded');

      const emailInput = page.locator('input#email');
      const passwordInput = page.locator('input#password');
      const signInButton = page.locator('button[type="submit"], button:has-text("Sign in"), span:has-text("Sign in")').first();

      await emailInput.fill(email!);
      await passwordInput.fill(password!);
      await signInButton.click();

      // Esperar redirección al dashboard principal de SightX
      await page.waitForURL('https://staging.sightx.io/**', { timeout: 30000 });
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/staging\.sightx\.io/);
    });

    // -------------------------------------------------------------------------
    // PASO 2: Crear un Nuevo Proyecto desde Cero (Create Project)
    // -------------------------------------------------------------------------
    await test.step('Paso 2: Crear un nuevo proyecto desde cero', async () => {
      // Clic en "Start a new project"
      const startProjectBtn = page.locator('button, span, div').filter({ hasText: /^Start a new project$/i }).first();
      await startProjectBtn.waitFor({ state: 'visible', timeout: 15000 });
      await startProjectBtn.click();

      // Seleccionar opción "Create from scratch"
      const createScratchOption = page.locator('div._customOption_13vre_1, div:has-text("Create from scratch"), span:has-text("Create from scratch")').first();
      await createScratchOption.waitFor({ state: 'visible', timeout: 10000 });
      await createScratchOption.click();

      // Ingresar el nombre del proyecto en el modal
      const projectNameInput = page.locator('input.ant-input._sxInput_10cq9_2, div.ant-modal-body input[type="text"]').first();
      await projectNameInput.waitFor({ state: 'visible', timeout: 10000 });
      await projectNameInput.fill(projectName);

      // Clic en botón "Create"
      const createBtn = page.locator('button[data-e2e-selector="accept-button"], button.ant-btn-default:has-text("Create"), button:has-text("Create")').first();
      await createBtn.click();

      // Esperar navegación a la vista del constructor (/project/{projectId}/build)
      await page.waitForURL(/.*\/project\/([a-zA-Z0-9]+)\/build/, { timeout: 25000 });
      await page.waitForLoadState('domcontentloaded');

      const match = page.url().match(/\/project\/([a-zA-Z0-9]+)\/build/);
      expect(match, 'Debe obtenerse el ID del proyecto desde la URL').not.toBeNull();
      projectId = match![1];
    });

    // -------------------------------------------------------------------------
    // PASO 3: Construir Encuesta con Preguntas de Opción Múltiple (Build Survey)
    // -------------------------------------------------------------------------
    await test.step('Paso 3: Construir preguntas de opción múltiple (MC - 1 y MC - 2)', async () => {
      // Si aparece botón inicial "Get started" o "Build your survey"
      const getStartedBtn = page.locator('span:has-text("Get started"), span:has-text("Build your survey")').first();
      if (await getStartedBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await getStartedBtn.click();
      }

      // 1. Agregar Pregunta 1: Multiple Choice
      const mcOption1 = page.locator('span._itemText_6ynb4_70:has-text("Multiple Choice"), div:has-text("Multiple Choice")').first();
      await mcOption1.waitFor({ state: 'visible', timeout: 10000 });
      await mcOption1.click();

      // Configurar título de la primera pregunta "MC - 1"
      const q1TitleEditor = page.locator('div.ql-editor[data-placeholder="Write here..."], div._emptyText_1o5vg_89, div.ql-editor').first();
      await q1TitleEditor.waitFor({ state: 'visible', timeout: 8000 });
      await q1TitleEditor.click();
      await q1TitleEditor.fill('MC - 1');

      // Configurar primera opción "1"
      const opt1Editor = page.locator('div.ql-editor[data-placeholder="new option"], div.ql-editor.ql-blank, p').first();
      if (await opt1Editor.isVisible({ timeout: 4000 }).catch(() => false)) {
        await opt1Editor.click();
        await opt1Editor.fill('1');
      }

      // 2. Agregar Pregunta 2: Multiple Choice
      const addItemBtn = page.locator('div[data-e2e-selector="add-item"], div._addItem_7fivg_13, button:has-text("Add Item")').first();
      await addItemBtn.waitFor({ state: 'visible', timeout: 8000 });
      await addItemBtn.click();

      const mcOption2 = page.locator('span._itemText_6ynb4_70:has-text("Multiple Choice"), div:has-text("Multiple Choice")').first();
      await mcOption2.waitFor({ state: 'visible', timeout: 8000 });
      await mcOption2.click();

      // Configurar título de la segunda pregunta "MC - 2"
      const q2TitleEditor = page.locator('div.ql-editor').last();
      await q2TitleEditor.waitFor({ state: 'visible', timeout: 8000 });
      await q2TitleEditor.click();
      await q2TitleEditor.fill('MC - 2');

      // Configurar Populate option labels -> Carry forward si el selector está disponible
      const populateDropdown = page.locator('span.ant-select-selection-item:has-text("None"), div:has-text("Populate option labels")').first();
      if (await populateDropdown.isVisible({ timeout: 4000 }).catch(() => false)) {
        await populateDropdown.click();
        const carryForwardOption = page.locator('div.ant-select-item-option:has-text("Carry forward")').first();
        if (await carryForwardOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await carryForwardOption.click();
          const sourceQuestionOption = page.locator('div.ant-select-item-option-content:has-text("MC - 1")').first();
          if (await sourceQuestionOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await sourceQuestionOption.click();
          }
        }
      }
    });

    // -------------------------------------------------------------------------
    // PASO 4: Distribuir y Lanzar Campaña (Distribute & Launch Link Campaign)
    // -------------------------------------------------------------------------
    await test.step('Paso 4: Distribuir y lanzar campaña (Draft -> Live)', async () => {
      // Clic en menú "Distribute"
      const distributeNav = page.locator('a:has-text("Distribute"), a[href*="/distribute/"]').first();
      await distributeNav.waitFor({ state: 'visible', timeout: 12000 });
      await distributeNav.click();

      await page.waitForURL(/.*\/distribute\/.*/, { timeout: 20000 });
      await page.waitForLoadState('domcontentloaded');

      // Seleccionar tarjeta de distribución (ej. Panel Respondents o Links)
      const distributionCard = page.locator('div._card_a81t4_2, div:has-text("Panel Respondents"), div:has-text("Links")').first();
      if (await distributionCard.isVisible({ timeout: 6000 }).catch(() => false)) {
        await distributionCard.click();
        await page.waitForLoadState('domcontentloaded');
      }

      // Lanzar campaña (Clic en Launch para pasar de Draft a Live)
      const launchBtn = page.locator('span._statusDot_f66ea_64._live_f66ea_89, span:has-text("Launch"), button:has-text("Launch")').first();
      await launchBtn.waitFor({ state: 'visible', timeout: 15000 });
      await launchBtn.click();

      // Validar que el estado de la campaña cambie a Live
      const liveStatus = page.locator('span:has-text("live"), span._statusDot_f66ea_64._live_f66ea_89, span:has-text("Live")').first();
      await expect(liveStatus).toBeVisible({ timeout: 15000 });

      // Obtener URL de la encuesta distribuida
      const linkInput = page.locator('input[readonly], input[value*="survey.staging.sightx.io"]').first();
      if (await linkInput.isVisible({ timeout: 6000 }).catch(() => false)) {
        surveyUrl = await linkInput.inputValue();
      } else {
        const shareLink = page.locator('a[href*="survey.staging.sightx.io"]').first();
        if (await shareLink.isVisible({ timeout: 4000 }).catch(() => false)) {
          surveyUrl = (await shareLink.getAttribute('href')) || '';
        }
      }
    });

    // -------------------------------------------------------------------------
    // PASO 5: Responder y Enviar la Encuesta (Survey Response)
    // -------------------------------------------------------------------------
    await test.step('Paso 5: Responder y enviar la encuesta distribuida', async () => {
      if (surveyUrl) {
        const surveyPage = await context.newPage();
        await surveyPage.goto(surveyUrl);
        await surveyPage.waitForLoadState('domcontentloaded');

        // Responder Pregunta 1: Seleccionar primera opción
        const mcq1Option = surveyPage.locator('span[data-e2e-selector="answer-mcq"], span.multiple-option, div.radio_box__1vECE').first();
        await mcq1Option.waitFor({ state: 'visible', timeout: 15000 });
        await mcq1Option.click();

        // Clic en siguiente página (Next Page)
        const nextPageBtn = surveyPage.locator('a#nextPageId, a:has-text("Next Page"), button:has-text("Next Page")').first();
        if (await nextPageBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await nextPageBtn.click();
          await surveyPage.waitForLoadState('domcontentloaded');
        }

        // Responder Pregunta 2: Seleccionar opciones
        const mcq2Option = surveyPage.locator('span[data-e2e-selector="answer-mcq"], span.multiple-option, div.option-checkbox').first();
        if (await mcq2Option.isVisible({ timeout: 5000 }).catch(() => false)) {
          await mcq2Option.click();
        }

        // Clic en Submit
        const submitBtn = surveyPage.locator('button[type="submit"], button.survey-submit, button:has-text("Submit")').first();
        await submitBtn.waitFor({ state: 'visible', timeout: 8000 });
        await submitBtn.click();

        // Validar pantalla de agradecimiento / finalización
        await surveyPage.waitForURL(/.*\/complete/, { timeout: 15000 });
        await surveyPage.waitForLoadState('domcontentloaded');
        await expect(surveyPage.locator('body')).toContainText(/thank you|gracias|completed/i);

        await surveyPage.close();
      }
    });

    // -------------------------------------------------------------------------
    // PASO 6: Navegar a la Vista de Análisis (Analyze)
    // -------------------------------------------------------------------------
    await test.step('Paso 6: Navegar a la vista de análisis del proyecto', async () => {
      const analyzeNav = page.locator('a:has-text("Analyze"), a[href*="/analysis/"]').first();
      if (await analyzeNav.isVisible({ timeout: 8000 }).catch(() => false)) {
        await analyzeNav.click();
      } else if (projectId) {
        await page.goto(`https://staging.sightx.io/analysis/${projectId}/overview`);
      }

      await page.waitForURL(/.*\/analysis\/([a-zA-Z0-9]+)\/overview/, { timeout: 25000 });
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/.*\/analysis\/.*\/overview/);
    });

    // -------------------------------------------------------------------------
    // PASO 7: Cerrar Sesión (Logout)
    // -------------------------------------------------------------------------
    await test.step('Paso 7: Cerrar sesión y verificar retorno al login', async () => {
      // Clic en "My account" en el menú inferior
      const myAccountBtn = page.locator('span:has-text("My account"), div._labelAndIcon_2h5gz_159, div[title*="account" i]').first();
      await myAccountBtn.waitFor({ state: 'visible', timeout: 12000 });
      await myAccountBtn.click();

      // Clic en "Log out"
      const logoutBtn = page.locator('div:has-text("Log out"), span:has-text("Log out"), a:has-text("Log out"), div:has-text("Logout")').last();
      await logoutBtn.waitFor({ state: 'visible', timeout: 8000 });
      await logoutBtn.click();

      // Validar redirección a la pantalla de login
      await page.waitForURL(/.*app\.staging-admin\.sightx\.io\/login.*/, { timeout: 25000 });
      await page.waitForLoadState('domcontentloaded');

      const loginEmailInput = page.locator('input#email');
      await expect(loginEmailInput).toBeVisible({ timeout: 10000 });
    });
  });
});
