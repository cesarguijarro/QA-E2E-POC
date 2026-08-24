import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.emailInput = page.getByPlaceholder(/email/i)
      .or(page.locator('input[name="email"]'))
      .or(page.locator('input[type="email"]'))
      .first();

    this.passwordInput = page.locator('input[type="password"]').first();

    // Priorizamos el botón tipo submit del formulario
    this.loginButton = page.locator('button[type="submit"]')
      .or(page.getByRole('button', { name: /^sign in$/i }))
      .or(page.getByRole('button', { name: /^log in$/i }))
      .first();
  }

  async goto() {
    const baseUrl = process.env.BASE_URL || 'https://app.staging-admin.sightx.io';
    await this.page.goto(`${baseUrl}/login`);
  }

  async login(email: string, pass: string) {
    await this.goto();
    await expect(this.emailInput).toBeVisible({ timeout: 10000 });
    
    await this.emailInput.fill(email);
    await this.passwordInput.fill(pass);

    // Hacemos clic y esperamos que la red o la redirección procese el token
    await Promise.all([
      this.page.waitForURL((url) => !url.href.includes('/login'), { timeout: 15000 }).catch(() => {}),
      this.loginButton.click(),
    ]);
  }
}