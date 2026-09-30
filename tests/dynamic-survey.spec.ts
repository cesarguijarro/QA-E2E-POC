import { test, expect } from '@playwright/test';
import { answerMultipleChoiceQuestion } from '../helpers/MultipleChoiceHelper';

// Function to find the 'items' array at any level of the JSON
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

test('Run a dynamic survey based on the SightX API', async ({ page }) => {
  console.log('--- INITIATING DYNAMIC TEST ---');

  let rawItems: any[] | null = null;

  // 1. Listen to the network for responses tolerant to subdomains and parameters
  page.on('response', async (response) => {
    try {
      const url = response.url();
      // Filter by any API call that contains 'survey' or 'sightx'
      if (response.status() === 200 && (url.includes('survey') || url.includes('sightx'))) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const json = await response.json();
          const items = extractItems(json);
          
          if (items && items.length > 0) {
            console.log(`\n[API SUCCESSFULLY CAPTURED] Endpoint: ${url}`);
            console.log(`-> ${items.length} items extracted from the JSON.`);
            rawItems = items;
          }
        }
      }
    } catch {
      // Ignore incomplete stream reads
    }
  });

  // 2. Navigate to the survey
  await page.goto('https://survey.staging.sightx.io/14fd6b964b484e46bea547f5f24f815dab5aff825084a0dc1587dc39b9b72511');

  // 3. Wait for 'rawItems' to be populated
  await expect.poll(() => rawItems, {
    message: 'Waiting for the SightX API to respond with the list of items',
    timeout: 15000,
  }).not.toBeNull();

  console.log(`-> Questions to process on the page: ${rawItems!.length}`);

  // 4. Wait for the page to finish rendering (React/Vue)
  await page.waitForTimeout(1200);

  // 5. Answer Multiple Choice questions
  for (const item of rawItems!) {
    if (item.type === 'multiple') {
      console.log(`-> Answering question ID: ${item.frontendId}`);
      await answerMultipleChoiceQuestion(page, item);
    }
  }

  // 6. Advance to the next page or submit
  const nextButton = page.locator('#nextPageId, button:has-text("Submit"), button:has-text("Next")').first();
  if (await nextButton.isVisible()) {
    console.log('-> Advancing to the next page...');
    await nextButton.click();
  }
});