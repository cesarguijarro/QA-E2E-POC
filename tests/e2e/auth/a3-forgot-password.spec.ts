import { ImapFlow } from 'imapflow';

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

async function deleteResetEmails(): Promise<void> {
  const client = getImapClient();
  await client.connect();
  await client.mailboxOpen('INBOX');

  const messages = await client.search({ subject: RESET_SUBJECT });
  if (Array.isArray(messages) && messages.length > 0) {
    await client.messageDelete(messages, { uid: true });
  }
  await client.close();
}

async function waitForResetEmail(timeoutMs: number): Promise<string | null> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const client = getImapClient();
    try {
      await client.connect();
      await client.mailboxOpen('INBOX');

      const messages = await client.search({ subject: RESET_SUBJECT });
      console.log('Found messages:', messages);

      if (Array.isArray(messages) && messages.length > 0) {
        const uid = messages[messages.length - 1];

        const msg = await client.fetchOne(
          String(uid),
          { bodyParts: ['TEXT'] },
          { uid: true }
        );

        console.log('Message fetched:', msg);

        if (msg?.bodyParts) {
          const textPart = msg.bodyParts.get('TEXT');
          const body = textPart ? textPart.toString() : '';
          console.log('Body preview:', body.substring(0, 300));

          const match = body.match(/https?:\/\/[^\s"<>]+reset[^\s"<>]*/i)
            || body.match(/https?:\/\/[^\s"<>]+token[^\s"<>]*/i)
            || body.match(/https?:\/\/[^\s"<>]+password[^\s"<>]*/i);

          if (match) {
            await client.close();
            return match[0].trim();
          }
        }
      }
      await client.close();
    } catch (err) {
      console.log('IMAP error:', err);
      try { await client.close(); } catch { /* ignore */ }
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return null;
}