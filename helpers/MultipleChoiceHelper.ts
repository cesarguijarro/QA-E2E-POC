import { Page, expect } from '@playwright/test';

export async function answerMultipleChoiceQuestion(
  page: Page,
  questionData: {
    frontendId: string | number;
    config: {
      allowMultipleSelection: boolean;
      minResponses?: number;
      maxResponses?: number;
    };
    options: Array<{
      frontendId: number;
      label?: string;
      isOther?: boolean;
      isNoneOfAbove?: boolean;
      isDisabled?: boolean;
    }>;
  },
  customOtherText: string = 'Testing text for Other option'
) {
  // 1. Locate the question container
  const container = page.locator(`[data-frontend-id="${questionData.frontendId}"], [id="${questionData.frontendId}"]`).first();
  await expect(container).toBeVisible({ timeout: 10000 });

  const validOptions = questionData.options.filter(opt => !opt.isDisabled);
  if (validOptions.length === 0) return;

  // Internal helper to click on the option
  const clickOption = async (option: typeof validOptions[0]) => {
    const cleanLabel = option.label ? option.label.replace(/<[^>]*>/g, '').trim() : '';
    
    const optionLocator = container.locator([
      `[data-option-id="${option.frontendId}"]`,
      `[data-frontend-id="${option.frontendId}"]`,
      `input[value="${option.frontendId}"]`,
      `span:has-text("${cleanLabel}")`,
      `label:has-text("${cleanLabel}")`
    ].join(', ')).first();

    await expect(optionLocator).toBeVisible({ timeout: 5000 });
    await optionLocator.click();
  };

  // Internal helper to handle text input in 'Other' (inline or in modal with OK)
  const handleOtherInput = async () => {
    // 1. Search for input/textarea in the card or in the global modal
    const otherInput = page.locator('input[type="text"], textarea').first();
    if (await otherInput.isVisible({ timeout: 3000 })) {
      await otherInput.fill(customOtherText);
    }

    // 2. If the SightX modal 'OK' button appears, we confirm to exit
    const okButton = page.locator('button:has-text("OK"), span:has-text("OK")').first();
    if (await okButton.isVisible({ timeout: 2000 })) {
      await okButton.click();
    }
  };

  if (!questionData.config.allowMultipleSelection) {
    // --- SINGLE SELECT ---
    // Select a regular option if it exists, or the first available
    const targetOption = validOptions.find(o => !o.isOther && !o.isNoneOfAbove) || validOptions[0];
    await clickOption(targetOption);

    if (targetOption.isOther) {
      await handleOtherInput();
    }

  } else {
    // --- MULTISELECT ---
    // Prefer normal options to meet min/maxResponses
    const regularOptions = validOptions.filter(o => !o.isOther && !o.isNoneOfAbove);
    const maxToSelect = Math.min(questionData.config.maxResponses || 1, regularOptions.length || validOptions.length);

    const optionsToSelect = regularOptions.length >= maxToSelect 
      ? regularOptions.slice(0, maxToSelect)
      : validOptions.slice(0, maxToSelect);

    for (const option of optionsToSelect) {
      if (option.isNoneOfAbove) {
        await clickOption(option);
        break; 
      }

      await clickOption(option);

      if (option.isOther) {
        await handleOtherInput();
      }
    }
  }
}