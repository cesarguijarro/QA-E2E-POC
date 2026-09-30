import { test } from '@playwright/test';
import { SurveyPage } from '../../pages/SurveyPage';

import { surveyScenarios } from './surveyScenarios';

for (const scenario of surveyScenarios) {
  test(`Ejecutar escenario: ${scenario.flowName}`, async ({ page }) => {
    const survey = new SurveyPage(page);

    await survey.navigate(scenario.surveyUrl);

    for (const step of scenario.steps) {
      // 1. Ejecutamos la acción según el tipo de pregunta (El Dispatcher lógico)
      switch (step.questionType) {
        case 'single_choice':
        case 'multiple_choice':
          // Si es un array (múltiple) o string (simple), lo manejamos
          const options = Array.isArray(step.answers) ? step.answers : [step.answers];
          for (const opt of options) {
            await survey.selectOption(opt);
          }
          break;

        case 'text_input':
          await survey.fillTextInput(step.answers as string);
          break;

        case 'slider':
          // Aquí llamarías a tu método de slider pasándole el valor
          break;
      }

      // 2. Si la pregunta requiere el botón OK interno que mapeamos
      if (step.requiresOk) {
        await survey.clickOkConfirmation();
      }

      // 3. Avanzamos a la siguiente página del survey
      await survey.clickNextPage();
    }
  });
}