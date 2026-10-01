import { test, expect } from '@playwright/test';
import { answerMultipleChoiceQuestion } from '../helpers/MultipleChoiceHelper';
import { rngFor } from '../utils/random';

function extractItems(data: any): any[] | null {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data.items) && data.items.length > 0) return data.items;
  if (Array.isArray(data) && data.length > 0) return data;

  for (const key of Object.keys(data)) {
    if (typeof data[key] === 'object') {
      const found = extractItems(data[key]);
      if (found) return found;
    }
  }
  return null;
}

test('[EXEC-DYN-01] Ejecutar encuesta de forma 100% dinámica con motor de reglas en SightX', async ({ page }) => {
  console.log('--- INICIANDO TEST DINÁMICO REGLAS DE NEGOCIO ---');
  const rng = rngFor(test.info());
  console.log(`Seed: ${process.env.QA_SEED} (replay with QA_SEED=${process.env.QA_SEED})`);

  let rawItems: any[] | null = null;

  // Escuchar red para capturar API de survey-service
  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (response.status() === 200 && (url.includes('survey') || url.includes('sightx'))) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const json = await response.json();
          const items = extractItems(json);
          
          if (items && items.length > 0) {
            console.log(`\n[API CAPTURADA EXITOSAMENTE] Endpoint: ${url}`);
            rawItems = items;
          }
        }
      }
    } catch {}
  });

  await page.goto('https://survey.staging.sightx.io/14fd6b964b484e46bea547f5f24f815dab5aff825084a0dc1587dc39b9b72511');
  

  await expect.poll(() => rawItems, { timeout: 15000 }).not.toBeNull();
  await page.waitForTimeout(1000);

  // Delegar las interacciones al Helper inteligente
  for (const item of rawItems!) {
    if (item.type === 'multiple' || item.type === 'multiple-choice') {
      await answerMultipleChoiceQuestion(page, item, undefined, rng);
    }
  }

  const nextButton = page.locator('#nextPageId, button:has-text("Submit"), button:has-text("Next")').first();
  if (await nextButton.isVisible()) {
    await nextButton.click();
  }
});
