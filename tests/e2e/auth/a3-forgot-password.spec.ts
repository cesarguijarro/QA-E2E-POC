import { ImapFlow } from 'imapflow';
import { test, expect } from '@playwright/test';

// 1. Asunto del correo de reseteo enviado por el backend
const RESET_SUBJECT = 'SightX Password Reset'; 

// Helper para instanciar el cliente IMAP
const getImapClient = () => new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_APP_PASSWORD!,
  },
  logger: false,
  disableAutoIdle: true,
});

/**
 * Limpia mensajes antiguos de reseteo para evitar falsos positivos
 */
async function deleteResetEmails(): Promise<void> {
  const client = getImapClient();
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const messages = await client.search({ subject: RESET_SUBJECT });
    if (Array.isArray(messages) && messages.length > 0) {
      await client.messageDelete(messages, { uid: true });
    }
  } catch (err) {
    console.log('Error al limpiar correos:', err);
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

async function waitForResetEmail(timeoutMs: number): Promise<string | null> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const client = getImapClient();
    try {
      await client.connect();
      await client.mailboxOpen('INBOX');

      const messages = await client.search({ subject: RESET_SUBJECT });
      console.log('Correos encontrados:', messages);

      if (Array.isArray(messages) && messages.length > 0) {
        // Obtenemos el correo más reciente (último del arreglo)
        const latestMessageSeq = messages[messages.length - 1];

        // 💡 Cambio principal: Traemos el código fuente completo ('source: true')
        const msg = await client.fetchOne(latestMessageSeq, { source: true });

        if (msg && msg.source) {
          // Convertimos el Buffer fuente a String
          let body = msg.source.toString('utf-8');
          
          // Reemplazamos entidades HTML comunes como &amp; para que la URL sea válida
          body = body.replace(/&amp;/g, '&');

          console.log('Vista previa del cuerpo:', body.substring(0, 300));

          // Buscamos el patrón del enlace de reseteo en el código HTML/texto
          const match = body.match(/https?:\/\/[^\s"<>]+reset[^\s"<>]*/i)
            || body.match(/https?:\/\/[^\s"<>]+token[^\s"<>]*/i)
            || body.match(/https?:\/\/[^\s"<>]+password[^\s"<>]*/i);

          if (match) {
            await client.close();
            // Limpiamos comillas o caracteres de escape HTML sobrantes al final de la URL
            const cleanUrl = match[0].replace(/["'>].*$/, '').trim();
            return cleanUrl;
          }
        }
      }
      await client.close();
    } catch (err) {
      console.log('Error en polling IMAP:', err);
      try { await client.close(); } catch { /* ignore */ }
    }

    // Esperar 5 segundos antes de intentar el siguiente polling
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return null;
}


// =========================================================================
// SUITE DE PRUEBAS PLAYWRIGHT
// =========================================================================
test.describe('Autenticación: Restablecimiento de Contraseña', () => {

  test.beforeEach(async () => {
    await deleteResetEmails();
  });

  test('Debe solicitar el enlace de reseteo e ingresar la nueva contraseña', async ({ page }) => {
    // 1. Navegar a la página de login
    await page.goto('/login');

    // 2. Si hay un botón/enlace a "Forgot password", hacer clic
    const forgotPasswordLink = page.getByRole('link', { name: /forgot password|restablecer|recuperar/i })
      .or(page.locator('a[href*="forgot"]'));
    
    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click();
    }

    // 3. Buscar e ingresar el correo
    const emailInput = page.getByPlaceholder(/email/i)
      .or(page.locator('input[name="email"]'))
      .or(page.locator('input[type="email"]'))
      .first();

    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill(process.env.GMAIL_USER!);

    // 4. Enviar solicitud de reseteo
    const submitButton = page.getByRole('button', { name: /send|submit|enviar|reset/i })
      .or(page.locator('button[type="submit"]'));
    await submitButton.click();

    // 5. Esperar recepción del correo IMAP
    console.log('Esperando correo con el token de reseteo...');
    const resetUrl = await waitForResetEmail(30000);

    expect(resetUrl, 'No se encontró una URL de reseteo válida en el correo').not.toBeNull();
    console.log('URL de reseteo obtenida:', resetUrl);

    // 6. Navegar a la URL recibida por correo y actualizar contraseña
    if (resetUrl) {
      console.log('Navegando a la URL de reseteo...');
      await page.goto(resetUrl);
      
      // Esperar a que la página cargue los elementos dinámicos
      await page.waitForLoadState('domcontentloaded');

      // Seleccionamos todos los campos de tipo password presentes en el formulario
      const passwordInputs = page.locator('input[type="password"]');

      // Esperar hasta 15s a que el primer campo de contraseña sea visible
      await expect(passwordInputs.first()).toBeVisible({ timeout: 15000 });

      const inputCount = await passwordInputs.count();

      if (inputCount >= 2) {
        // Si la pantalla tiene 2 campos (Nueva Contraseña y Confirmar Contraseña)
        await passwordInputs.nth(0).fill('NuevaClaveSegura123!');
        await passwordInputs.nth(1).fill('NuevaClaveSegura123!');
      } else if (inputCount === 1) {
        // Si la pantalla solo tiene 1 campo para la contraseña
        await passwordInputs.nth(0).fill('NuevaClaveSegura123!');

        // Intentar llenar la confirmación si usa otro tipo de selector
        const confirmInput = page.locator('input[name*="confirm"i]')
          .or(page.getByPlaceholder(/confirm/i));
        
        if (await confirmInput.isVisible()) {
          await confirmInput.fill('NuevaClaveSegura123!');
        }
      }

      // Clic en el botón para guardar la nueva contraseña
      const saveButton = page.getByRole('button', { name: /save|update|guardar|reset|change|confirm/i })
        .or(page.locator('button[type="submit"]'));

      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Confirmar que fuimos redirigidos al login o que hay un mensaje de éxito
      await expect(page).toHaveURL(/.*login/i, { timeout: 15000 });
      console.log('¡Flujo de reseteo completado con éxito!');
    
    }
  });

});