import { Page, Locator, expect } from '@playwright/test';

export class SurveyPage {
  readonly page: Page;
  readonly nextButton: Locator;
  readonly prevButton: Locator;
  readonly submitButton: Locator;

constructor(page: Page) {
    this.page = page;
    // Apuntamos directamente al ID específico de navegación que encontraste
    this.nextButton = page.locator('#nextPageId');
    this.prevButton = page.locator('#prevPageId'); // O el ID correspondiente si lo hay
    this.submitButton = page.getByRole('button', { name: /enviar|submit|finalizar/i });
  }


  async navigate(url: string) {
    await this.page.goto(url);
  }

  // ==========================================
  // 1. MÉTODOS PARA TIPOS DE PREGUNTAS
  // ==========================================

  /** Selección simple o múltiple basada en el texto de la opción */
  async selectOption(optionText: string) {
    const option = this.page.getByText(optionText, { exact: true });
    await option.click();
  }

  /** Pregunta tipo texto (Input single) */
  async fillTextInput(answerValue: string) {
    const inputField = this.page.locator('input[type="text"], input[type="number"], textarea').first();
    await inputField.fill(answerValue);
    await expect(inputField).toHaveValue(answerValue);
  }

  /** Pregunta tipo Scale / Slider */
  async setSliderValue(sliderLocator: Locator, targetValue: string) {
    // Dependiendo de cómo esté construido el slider (input range o elemento interactivo)
    await sliderLocator.fill(targetValue);
  }

  /** Pregunta tipo Ranking (ordenar elementos por preferencia, ej: arrastrar o usar botones de posición) */
  async rankItem(itemText: string, targetPositionIndex: number) {
    // Lógica genérica para ubicar o reordenar elementos en un ranking
    const item = this.page.getByText(itemText);
    await item.scrollIntoViewIfNeeded();
    // Aquí puedes integrar la interacción de drag-and-drop o clics de ordenamiento según tu DOM
  }

  // ==========================================
  // 2. MÉTODOS DE VALIDACIÓN DE LÓGICA Y FLUJOS
  // ==========================================

  /** Valida si una pregunta condicional está oculta o visible según lo esperado */
  async verifyQuestionVisibility(questionText: string, shouldBeVisible: boolean) {
    const questionLocator = this.page.getByText(questionText, { exact: false });
    if (shouldBeVisible) {
      await expect(questionLocator).toBeVisible();
    } else {
      await expect(questionLocator).not.toBeVisible();
    }
  }

  /** Valida si el flujo desvió al usuario a una pantalla de descalificación (Screenout) */
  async verifyScreenoutState() {
    const screenoutMessage = this.page.getByText(/no cumples|gracias por tu tiempo|descalificado|terminado/i);
    await expect(screenoutMessage).toBeVisible();
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async clickNextPage() {
    // Nos aseguramos de que el botón esté visible y listo antes de hacer clic
    await this.nextButton.waitFor({ state: 'visible' });
    await this.nextButton.click();
  }


  
}