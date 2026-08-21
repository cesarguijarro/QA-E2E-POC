import { test, expect } from '@playwright/test';
import { ImapFlow } from 'imapflow';

/**
 * Suite: Auth
 * Case: a.3 Forgot password flow
 * Jam: https://jam.dev/c/39b7e518-54b0-4015-a14f-bc86f00d554b
 * Precondition: inbox must have no emails with subject "SightX Password Reset"
 */

const RESET_SUBJECT  = 'SightX Password Reset';
const NEW_PASSWORD   = 'NewPassword2026!';
const EMAIL_TIMEOUT  = 60000;

const KNOWN_ERRORS = [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection captured',
  'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
];

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

// ── Gmail helpers ─────────────────────────────────────────────────────────────

async function deleteResetEmails(): Promise<void> {
  const client = getImapClient();
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    const messages = await client.search({ subject: RESET_SUBJECT });
    console.log('Emails to delete:', messages);
    if (Array.isArray(messages) && messages.length > 0) {
      await client.messageFlagsAdd(messages, ['\\Deleted'], { uid: true });
      await client.mailboxClose();
    }
    await client.close();
    console.log('Inbox cleaned.');
  } catch (err) {
    console.log('Delete error:', err);
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
      console.log('Found emails:', messages);

      if (Array.isArray(messages) && messages.length > 0) {
      const uid = messages[messages.length - 1];
      let resetLink: string | null = null;

      for await (const msg of client.fetch(
        `${uid}:${uid}`,
        { source: true },
        { uid: true }
      )) {
        const fetchedMsg = msg as any;
        if (!fetchedMsg?.source) continue;

        let body = fetchedMsg.source.toString('utf-8');
        body = body.replace(/&amp;/g, '&');
        console.log('Body preview:', body.substring(0, 300));

        const match = body.match(/https?:\/\/[^\s"<>]+reset-password[^\s"<>]*/i)
          || body.match(/https?:\/\/[^\s"<>]+reset[^\s"<>]*/i)
          || body.match(/https?:\/\/[^\s"<>]+token[^\s"<>]*/i);

        if (match) {
          resetLink = match[0].replace(/["'>].*$/, '').trim();
        }
      }

}



      await client.close();
    } catch (err) {
      console.log('IMAP error:', err);
      try { await client.close(); } catch { /* ignore */ }
    }

    console.log('Retrying in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return null;
}

// ── Test ──────────────────────────────────────────────────────────────────────

test.describe('Suite Auth — a.3 Forgot password flow', () => {
  let unexpectedErrors: string[] = [];

  test.setTimeout(120000);

  test.beforeAll(async () => {
    console.log('Precondition: cleaning inbox...');
    await deleteResetEmails();
  });

  test.beforeEach(async ({ page }) => {
    unexpectedErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const isKnown = KNOWN_ERRORS.some(e => msg.text().includes(e));
        if (!isKnown) unexpectedErrors.push(msg.text());
      }
    });
  });

  test('should complete forgot password flow and login with new password', async ({ page }) => {
    const email = process.env.GMAIL_USER!;

    if (!email || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD are required in .env');
    }

    // ── Step 1: Navigate to login ─────────────────────────────────────────
    await test.step('Navigate to login page', async () => {
      await page.goto(
        'https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io'
      );
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('input#email')).toBeVisible({ timeout: 10000 });
    });

    // ── Step 2: Click Forgot password ─────────────────────────────────────
    await test.step('Click Forgot password link', async () => {
      await page.click('a[href="/forgot-password"]');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('input#email').first()).toBeVisible({ timeout: 10000 });
    });

    // ── Step 3: Submit reset request ──────────────────────────────────────
    await test.step('Submit email for password reset', async () => {
      await page.fill('input#email', email);
      await page.waitForTimeout(500);

      const submitBtn = page.locator(
        'button:has-text("Send recovery email"), button[type="submit"]'
      ).first();
      await submitBtn.click();
      await page.waitForTimeout(2000);
    });

    // ── Step 4: Wait for reset email ──────────────────────────────────────
    let resetLink: string | null = null;

    await test.step('Wait for password reset email', async () => {
      console.log('Waiting for reset email...');
      resetLink = await waitForResetEmail(EMAIL_TIMEOUT);
      expect(resetLink, 'Reset email not received within 60 seconds').not.toBeNull();
      console.log('Reset link:', resetLink);
    });

    // ── Step 5: Navigate to reset link ────────────────────────────────────
    await test.step('Navigate to reset link', async () => {
      await page.goto(resetLink!);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('input[type="password"]').first())
        .toBeVisible({ timeout: 15000 });
    });

    // ── Step 6: Set new password ──────────────────────────────────────────
    await test.step('Set new password', async () => {
      const passwordInputs = page.locator('input[type="password"]');
      const count = await passwordInputs.count();

      await passwordInputs.nth(0).fill(NEW_PASSWORD);
      if (count > 1) await passwordInputs.nth(1).fill(NEW_PASSWORD);

      await page.waitForTimeout(500);
      const saveBtn = page.locator('button[type="submit"]').first();
      await saveBtn.click();
      await page.waitForTimeout(2000);
    });

    // ── Step 7: Login with new password ───────────────────────────────────
    await test.step('Login with new password', async () => {
      await page.goto(
        'https://app.staging-admin.sightx.io/login?redirectUrl=https://staging.sightx.io'
      );
      await page.waitForLoadState('domcontentloaded');
      await page.fill('input#email', email);
      await page.fill('input#password', NEW_PASSWORD);
      await page.waitForTimeout(500);
      await page.click('button[type="submit"]');
      await page.waitForURL('https://staging.sightx.io/**', { timeout: 20000 });
      await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 10000 });
    });

    // ── Step 8: Logout ────────────────────────────────────────────────────
    await test.step('Logout', async () => {
      const myAccount = page.locator('._myAccount_2h5gz_36').first();
      await myAccount.waitFor({ state: 'visible', timeout: 10000 });
      await myAccount.click();
      await page.waitForTimeout(800);
      const logoutBtn = page.locator('._labelAndIcon_2h5gz_159:has-text("Log out")').first();
      await logoutBtn.waitFor({ state: 'visible', timeout: 8000 });
      await logoutBtn.click();
      await page.waitForURL(/login/, { timeout: 15000 });
      await expect(page.locator('input#email')).toBeVisible({ timeout: 10000 });
    });

    // ── Step 9: Restore original password ────────────────────────────────
    await test.step('Restore original password', async () => {
      await page.fill('input#email', email);
      await page.fill('input#password', process.env.SIGHTX_PASSWORD!);
      await page.waitForTimeout(500);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    });

    // ── Step 10: Validate no unexpected errors ────────────────────────────
    await test.step('Validate no unexpected console errors', async () => {
      expect(
        unexpectedErrors,
        `Unexpected console errors:\n${unexpectedErrors.join('\n')}`
      ).toHaveLength(0);
    });
  });
});
