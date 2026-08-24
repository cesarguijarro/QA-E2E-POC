# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\build\b1-project-creation.spec.ts >> Suite Build: Creación de Proyecto (POM) >> b.1 Validar creación de proyecto desde cero con lógica y descalificación
- Location: tests\e2e\build\b1-project-creation.spec.ts:10:7

# Error details

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for getByRole('button', { name: /continue|create|crear|next|save/i }).first()
    - locator resolved to <button disabled type="button" data-e2e-selector="accept-button" class="ant-btn ant-btn-default _sxButton_m0s1n_2 _primary_m0s1n_212 _small_m0s1n_2">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
      - waiting 100ms
    - waiting for element to be visible, enabled and stable
    - element is not enabled
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
  - element was detached from the DOM, retrying

```

# Test source

```ts
  1  | import { Page, Locator, expect } from '@playwright/test';
  2  | 
  3  | export class DashboardPage {
  4  |   readonly page: Page;
  5  |   readonly createProjectBtn: Locator;
  6  |   readonly fromScratchOption: Locator;
  7  |   readonly projectNameInput: Locator;
  8  |   readonly confirmCreateBtn: Locator;
  9  |   readonly userMenu: Locator;
  10 |   readonly logoutBtn: Locator;
  11 | 
  12 |   constructor(page: Page) {
  13 |     this.page = page;
  14 | 
  15 |     // Locators ampliados para cubrir variantes del botón "+ Project" / "Create" en SightX
  16 |     this.createProjectBtn = page.getByRole('button', { name: /create|new project|nuevo proyecto|\+ project/i })
  17 |       .or(page.getByRole('link', { name: /create|new project|\+ project/i }))
  18 |       .or(page.locator('button:has-text("Create")'))
  19 |       .or(page.locator('[data-testid*="create"]'))
  20 |       .or(page.locator('.ant-btn-primary:has-text("Create")'))
  21 |       .first();
  22 | 
  23 |     this.fromScratchOption = page.getByText(/from scratch|desde cero|blank|start from scratch/i)
  24 |       .or(page.locator('[data-testid*="from-scratch"]'))
  25 |       .first();
  26 | 
  27 |     this.projectNameInput = page.getByPlaceholder(/project name|nombre|title/i)
  28 |       .or(page.locator('input[name="projectName"]'))
  29 |       .or(page.locator('input[name="name"]'))
  30 |       .or(page.locator('input[type="text"]').first());
  31 | 
  32 |     this.confirmCreateBtn = page.getByRole('button', { name: /continue|create|crear|next|save/i })
  33 |       .first();
  34 | 
  35 |     this.userMenu = page.locator('[data-testid*="user"]')
  36 |       .or(page.locator('[data-testid*="avatar"]') )
  37 |       .or(page.locator('.ant-avatar'))
  38 |       .or(page.locator('button:has([alt*="avatar"])'))
  39 |       .first();
  40 | 
  41 |     this.logoutBtn = page.getByRole('menuitem', { name: /log out|logout|cerrar sesión/i })
  42 |       .or(page.getByText(/log out|logout|cerrar sesión/i))
  43 |       .first();
  44 |   }
  45 | 
  46 |   /**
  47 |    * Garantiza que la página de Login ya redireccionó al Dashboard
  48 |    */
  49 |   async verifyDashboardLoaded() {
  50 |     // Si aparece un mensaje de error de credenciales en el login, detiene el test con un mensaje claro
  51 |     const loginError = this.page.locator('.ant-alert-error, [role="alert"]').first();
  52 |     if (await loginError.isVisible({ timeout: 3000 }).catch(() => false)) {
  53 |       const errorText = await loginError.innerText();
  54 |       throw new Error(`El login falló en la UI con el mensaje: "${errorText}"`);
  55 |     }
  56 | 
  57 |     await expect(this.page).not.toHaveURL(/.*login/i, { timeout: 20000 });
  58 |   }
  59 | 
  60 |   async createProjectFromScratch(name: string) {
  61 |     await this.verifyDashboardLoaded();
  62 | 
  63 |     await expect(this.createProjectBtn).toBeVisible({ timeout: 20000 });
  64 |     await this.createProjectBtn.click();
  65 | 
  66 |     if (await this.fromScratchOption.isVisible({ timeout: 5000 }).catch(() => false)) {
  67 |       await this.fromScratchOption.click();
  68 |     }
  69 | 
  70 |     await expect(this.projectNameInput).toBeVisible({ timeout: 10000 });
  71 |     await this.projectNameInput.fill(name);
> 72 |     await this.confirmCreateBtn.click();
     |                                 ^ Error: locator.click: Target page, context or browser has been closed
  73 |   }
  74 | 
  75 |   async logout() {
  76 |     await this.userMenu.click();
  77 |     await this.logoutBtn.click();
  78 |     await expect(this.page).toHaveURL(/.*login/i, { timeout: 15000 });
  79 |   }
  80 | }
```