import { Page, Locator, expect } from '@playwright/test';

export class ProjectBuilderPage {
  readonly page: Page;
  readonly addQuestionBtn: Locator;
  readonly multipleChoiceType: Locator;
  readonly numericType: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addQuestionBtn = page.getByRole('button', { name: /add question|agregar pregunta/i })
      .or(page.locator('button:has-text("Add Question")'));

    this.multipleChoiceType = page.getByText(/multiple choice|opción múltiple/i);
    this.numericType = page.getByText(/numeric|numérica|number/i);
  }

  async verifyProjectOpened(projectName: string) {
    await expect(this.page.getByText(projectName).first()).toBeVisible({ timeout: 15000 });
  }

  async addMultipleChoiceQuestion(title: string, options: string[]) {
    await this.addQuestionBtn.click();
    await this.multipleChoiceType.click();

    const titleInput = this.page.locator('[contenteditable="true"]')
      .or(this.page.locator('textarea, input[placeholder*="Question"]'))
      .last();
    await titleInput.fill(title);

    for (let i = 0; i < options.length; i++) {
      if (i >= 2) {
        const addOptionBtn = this.page.getByText(/add option|agregar opción/i);
        await addOptionBtn.click();
      }
      const optionInput = this.page.getByPlaceholder(new RegExp(`option ${i + 1}`, 'i'))
        .or(this.page.locator(`input[value*="Option ${i + 1}"]`));
      await optionInput.fill(options[i]);
    }
  }

  async addDisqualificationLogicToFirstQuestion(optionToDisqualify: string) {
    const logicBtn = this.page.locator('button:has-text("Logic"), button:has-text("Disqualification")')
      .or(this.page.getByRole('button', { name: /logic|descalificación/i })).first();
    await logicBtn.click();

    const addRuleBtn = this.page.getByRole('button', { name: /add rule|agregar regla/i });
    if (await addRuleBtn.isVisible()) {
      await addRuleBtn.click();
    }

    const disqualifyAction = this.page.getByText(/disqualify|screenout|descalificar/i).first();
    await disqualifyAction.click();

    const saveLogicBtn = this.page.getByRole('button', { name: /save|apply|guardar/i });
    if (await saveLogicBtn.isVisible()) {
      await saveLogicBtn.click();
    }
  }

  async addNumericQuestionWithDisplayLogic(title: string, dependsOnQuestion: string, dependsOnAnswer: string) {
    await this.addQuestionBtn.click();
    await this.numericType.click();

    const titleInput = this.page.locator('[contenteditable="true"]')
      .or(this.page.locator('textarea, input[placeholder*="Question"]'))
      .last();
    await titleInput.fill(title);

    // Configurar Display Logic
    const logicBtn = this.page.locator('button:has-text("Display Logic"), button:has-text("Logic")').last();
    await logicBtn.click();

    const conditionDropdown = this.page.getByText(/select question|seleccionar pregunta/i).first();
    if (await conditionDropdown.isVisible()) {
      await conditionDropdown.click();
      await this.page.getByText(dependsOnQuestion).click();
    }

    const selectValueDropdown = this.page.getByText(/select answer|seleccionar respuesta/i).first();
    if (await selectValueDropdown.isVisible()) {
      await selectValueDropdown.click();
      await this.page.getByText(dependsOnAnswer).click();
    }

    const saveLogicBtn = this.page.getByRole('button', { name: /save|apply|guardar/i });
    if (await saveLogicBtn.isVisible()) {
      await saveLogicBtn.click();
    }
  }
}