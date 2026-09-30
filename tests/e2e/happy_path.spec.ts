import { test } from '@playwright/test';
import { SurveyPage } from '../../pages/SurveyPage';

test('Ejecución completa del flujo crítico del Survey', async ({ page }) => {
  const survey = new SurveyPage(page);

  // 1. Cargar el entorno de staging
  await survey.navigate('https://survey.staging.sightx.io/eb6a13812600854fdb647839399076c5deddf726199964de7978901ee31e972c');

  // 2. Ejecutar la primera sección
  await survey.fillFirstSection();

  // 3. Continuar con los siguientes bloques...
  // (Aquí irían llamándose los métodos organizados del resto de la encuesta)
});