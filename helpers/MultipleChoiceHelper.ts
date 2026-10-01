import { Page, expect } from '@playwright/test';
import { Rng, pick, shuffle } from '../utils/random';

export interface OptionData {
  frontendId: number | string;
  label?: string;
  isOther?: boolean;
  isNoneOfAbove?: boolean;
  isNotApplicable?: boolean; // Soporte para N/A
  isDisabled?: boolean;
}

export interface QuestionData {
  frontendId: string | number;
  displayType?: 'list' | 'dropdown' | string;
  config: {
    allowMultipleSelection: boolean;
    minResponses?: number;
    maxResponses?: number;
  };
  options: OptionData[];
}

export async function answerMultipleChoiceQuestion(
  page: Page,
  questionData: QuestionData,
  customOtherText: string = 'Respuesta aleatoria QA',
  rng: Rng = Math.random // pass rngFor(test.info()) to make the run reproducible (QA_SEED)
) {
  const container = page.locator(`[data-frontend-id="${questionData.frontendId}"], [id="${questionData.frontendId}"]`).first();
  await expect(container).toBeVisible({ timeout: 10000 });

  const validOptions = questionData.options.filter(opt => !opt.isDisabled);
  if (validOptions.length === 0) return;

  const isDropdown = questionData.displayType === 'dropdown' || (await container.locator('select, [role="combobox"], .select-container').count()) > 0;

  if (isDropdown) {
    await handleDropdownSelection(page, container, validOptions, questionData, customOtherText, rng);
  } else {
    await handleListSelection(page, container, validOptions, questionData, customOtherText, rng);
  }
}

// ---------------------------------------------------------------------------
// 1. MANEJO DE SELECCIÓN EN LISTA (Single Select & Multiselect con Aleatoriedad)
// ---------------------------------------------------------------------------
async function handleListSelection(
  page: Page,
  container: any,
  validOptions: OptionData[],
  questionData: QuestionData,
  customOtherText: string,
  rng: Rng
) {
  const isMulti = questionData.config.allowMultipleSelection;

  if (!isMulti) {
    // --- SINGLE SELECT ALEATORIO ---
    const selectedOption = pick(validOptions, rng);

    await clickListOption(page, container, selectedOption);

    if (selectedOption.isOther) {
      await fillOtherInputAndConfirm(page);
    }

    // Validación de Exclusividad en Single Select (Si es None of Above o N/A, asegurar que es la única activa)
    if (selectedOption.isNoneOfAbove || selectedOption.isNotApplicable) {
      await verifyExclusivityInUI(container, selectedOption);
    }

  } else {
    // --- MULTISELECT CON MIN/MAX Y OPCIONES EXCLUSIVAS ---
    const exclusiveOptions = validOptions.filter(o => o.isNoneOfAbove || o.isNotApplicable);
    const regularOptions = validOptions.filter(o => !o.isNoneOfAbove && !o.isNotApplicable);

    // Decisión Aleatoria: ¿Probar flujo exclusivo o flujo combinado de opciones regulares?
    const chooseExclusive = exclusiveOptions.length > 0 && rng() < 0.25; // 25% de probabilidad de probar exclusividad

    if (chooseExclusive) {
      // Probar selección exclusiva
      const targetExclusive = pick(exclusiveOptions, rng);
      await clickListOption(page, container, targetExclusive);
      await verifyExclusivityInUI(container, targetExclusive);

    } else {
      // Probar combinación de opciones regulares respetando Min/Max
      const min = questionData.config.minResponses || 1;
      const max = Math.min(questionData.config.maxResponses || regularOptions.length, regularOptions.length);
      
      // Calcular cantidad aleatoria a seleccionar dentro del rango [min, max]
      const countToSelect = Math.floor(rng() * (max - min + 1)) + min;
      
      // Desordenar arreglo para seleccionar opciones aleatorias de la lista regular
      const shuffled = shuffle(regularOptions, rng);
      const selectedSet = shuffled.slice(0, countToSelect);

      for (const option of selectedSet) {
        await clickListOption(page, container, option);
        if (option.isOther) {
          await fillOtherInputAndConfirm(page);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. MANEJO DE DROPDOWN CON BUSCADOR Y PRUEBA DE BÚSQUEDA FALLIDA
// ---------------------------------------------------------------------------
async function handleDropdownSelection(
  page: Page,
  container: any,
  validOptions: OptionData[],
  questionData: QuestionData,
  customOtherText: string,
  rng: Rng
) {
  const dropdownTrigger = container.locator('[role="combobox"], select, .select-trigger, input[readonly]').first();
  await dropdownTrigger.click();

  const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="Buscar"]').first();

  // --- ESCENARIO DE BÚSQUEDA REAL CON MATCH ---
  const targetOption = pick(validOptions, rng);
  const cleanLabel = targetOption.label ? targetOption.label.replace(/<[^>]*>/g, '').trim() : '';

  if (await searchInput.isVisible({ timeout: 2000 })) {
    // Probar filtrado tipeando las primeras letras
    const searchQuery = cleanLabel.substring(0, Math.min(3, cleanLabel.length));
    await searchInput.fill(searchQuery);
    await page.waitForTimeout(300); // Esperar que reactive el filtro
  }

  // Seleccionar la opción filtrada en el dropdown
  const dropdownOption = page.locator(`[role="option"]:has-text("${cleanLabel}"), li:has-text("${cleanLabel}"), option:has-text("${cleanLabel}")`).first();
  await dropdownOption.click();

  if (targetOption.isOther) {
    await fillOtherInputAndConfirm(page);
  }
}

// ---------------------------------------------------------------------------
// HELPERS AUXILIARES DE UI Y VALIDACIÓN
// ---------------------------------------------------------------------------
async function clickListOption(page: Page, container: any, option: OptionData) {
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
}

async function fillOtherInputAndConfirm(page: Page) {
  const otherInput = page.locator('input[type="text"], textarea').first();
  if (await otherInput.isVisible({ timeout: 3000 })) {
    await otherInput.fill('Texto aleatorio QA');
  }

  const okButton = page.locator('button:has-text("OK"), span:has-text("OK")').first();
  if (await okButton.isVisible({ timeout: 2000 })) {
    await okButton.click();
  }
}

async function verifyExclusivityInUI(container: any, exclusiveOption: OptionData) {
  // Verificación en el DOM: Apenas se selecciona una opción exclusiva, 
  // las demás casillas no deben tener la clase o estado 'checked'/'selected'
  const checkedItems = container.locator('.checked, [aria-checked="true"], input:checked');
  const count = await checkedItems.count();
  expect(count).toBeLessThanOrEqual(1);
}