import { test } from '@playwright/test';
import { LoginPage } from '../../../pages/LoginPage';
import { DashboardPage } from '../../../pages/DashboardPage';
import { ProjectBuilderPage } from '../../../pages/ProjectBuilderPage';

test.describe('Suite Build: Creación de Proyecto (POM)', () => {

  const projectName = `E2E Test Project - ${Date.now()}`;

  test('b.1 Validar creación de proyecto desde cero con lógica y descalificación', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const builderPage = new ProjectBuilderPage(page);

    // 1. Login
    await loginPage.login(
      process.env.GMAIL_USER!, 
      process.env.TEST_PASSWORD || 'Password123!'
    );

    // 2. Crear Proyecto Desde Cero
    await dashboardPage.createProjectFromScratch(projectName);
    await builderPage.verifyProjectOpened(projectName);

    // 3. Agregar Pregunta Múltiple Choice con Descalificación
    await builderPage.addMultipleChoiceQuestion(
      'Q1: ¿Cuál es tu rango de edad?',
      ['Menor de 18 años', '18 años o más']
    );
    await builderPage.addDisqualificationLogicToFirstQuestion('Menor de 18 años');

    // 4. Agregar Pregunta Numérica con Lógica Condicional basada en Q1
    await builderPage.addNumericQuestionWithDisplayLogic(
      'Q2: Ingresa tu edad exacta en años',
      'Q1: ¿Cuál es tu rango de edad?',
      '18 años o más'
    );

    // 5. Logout
    await dashboardPage.logout();
  });

});