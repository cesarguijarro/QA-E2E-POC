import { test, expect } from '@playwright/test';
import { SurveyPage } from '../../pages/SurveyPage';

test('Smoke test: validar interacción con componentes complejos', async ({ page }) => {
  const survey = new SurveyPage(page);

  // 1. Entra a la URL de tu build de encuesta
  await survey.navigate('https://survey.staging.sightx.io/6349f7dc75eb0cbb1af39ad0d90a87b6c7679f623f6a8b040d515300dc75aefd');

  // 2. Prueba una selección simple o input de texto inicial
  await survey.selectOption('25-34');
  await survey.clickNext();

  await survey.selectOption('Male');
  await survey.clickNext();

  await survey.selectOption('Some College');
  await survey.clickNextPage();



  // 3. PRUEBA DEL SLIDER: Intentemos moverlo y veamos si Playwright se queja o si se mueve
  // (Descomenta y ajusta el selector según tu componente)
  /*
  const slider = page.locator('input[type="range"]'); // O el selector de tu slider
  await survey.setSliderValue(slider, '5');
  */

  // 4. PRUEBA DE RANKING / MULTIPLE: Haz clic en algún elemento para ver si responde
  // await survey.selectOption('Elemento de ranking o múltiple');

  // Pausa opcional para ver el navegador en modo depuración si ejecutas con headed mode
  // await page.pause();
});