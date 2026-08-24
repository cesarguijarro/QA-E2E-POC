import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly createProjectBtn: Locator;
  readonly fromScratchOption: Locator;
  readonly projectNameInput: Locator;
  readonly confirmCreateBtn: Locator;
  readonly userMenu: Locator;
  readonly logoutBtn: Locator;

  constructor(page: Page) {
    this.page = page;

    // Locators ampliados para cubrir variantes del botón "+ Project" / "Create" en SightX
    this.createProjectBtn = page.getByRole('button', { name: /create|new project|nuevo proyecto|\+ project/i })
      .or(page.getByRole('link', { name: /create|new project|\+ project/i }))
      .or(page.locator('button:has-text("Create")'))
      .or(page.locator('[data-testid*="create"]'))
      .or(page.locator('.ant-btn-primary:has-text("Create")'))
      .first();

    this.fromScratchOption = page.getByText(/from scratch|desde cero|blank|start from scratch/i)
      .or(page.locator('[data-testid*="from-scratch"]'))
      .first();

    this.projectNameInput = page.getByPlaceholder(/project name|nombre|title/i)
      .or(page.locator('input[name="projectName"]'))
      .or(page.locator('input[name="name"]'))
      .or(page.locator('input[type="text"]').first());

    this.confirmCreateBtn = page.getByRole('button', { name: /continue|create|crear|next|save/i })
      .first();

    this.userMenu = page.locator('[data-testid*="user"]')
      .or(page.locator('[data-testid*="avatar"]') )
      .or(page.locator('.ant-avatar'))
      .or(page.locator('button:has([alt*="avatar"])'))
      .first();

    this.logoutBtn = page.getByRole('menuitem', { name: /log out|logout|cerrar sesión/i })
      .or(page.getByText(/log out|logout|cerrar sesión/i))
      .first();
  }

  /**
   * Garantiza que la página de Login ya redireccionó al Dashboard
   */
  async verifyDashboardLoaded() {
    // Si aparece un mensaje de error de credenciales en el login, detiene el test con un mensaje claro
    const loginError = this.page.locator('.ant-alert-error, [role="alert"]').first();
    if (await loginError.isVisible({ timeout: 3000 }).catch(() => false)) {
      const errorText = await loginError.innerText();
      throw new Error(`El login falló en la UI con el mensaje: "${errorText}"`);
    }

    await expect(this.page).not.toHaveURL(/.*login/i, { timeout: 20000 });
  }

  async createProjectFromScratch(name: string) {
    await this.verifyDashboardLoaded();

    await expect(this.createProjectBtn).toBeVisible({ timeout: 20000 });
    await this.createProjectBtn.click();

    if (await this.fromScratchOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.fromScratchOption.click();
    }

    await expect(this.projectNameInput).toBeVisible({ timeout: 10000 });
    await this.projectNameInput.fill(name);
    await this.confirmCreateBtn.click();
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutBtn.click();
    await expect(this.page).toHaveURL(/.*login/i, { timeout: 15000 });
  }
}