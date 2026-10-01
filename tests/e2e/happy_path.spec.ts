import { test } from '@playwright/test';
import { surveyUrl } from '../../utils/surveys';
import { SurveyPage } from '../../pages/SurveyPage';

test('Ejecución completa del flujo crítico del Survey', async ({ page }) => {
  const survey = new SurveyPage(page);

  // 1. Cargar el entorno de staging
  await survey.navigate(surveyUrl('all-question-types'));

  // 2. Ejecutar la primera sección
  await survey.fillFirstSection();

  // 3. Continuar con los siguientes bloques...
  // (Aquí irían llamándose los métodos organizados del resto de la encuesta)
});