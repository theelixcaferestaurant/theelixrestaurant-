// Pure helpers (no Deno or network APIs) so they can be unit-tested in plain Node:
//   node --experimental-strip-types supabase/tests/validate.test.mjs

export const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email || email.length > 254 || email.includes('..') || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

// Indian mobile: 10 digits starting 6-9, with an optional +91 prefix. Saved as +91XXXXXXXXXX.
export function normalizeMobile(raw: unknown): string | null {
  const compact = String(raw ?? '').replace(/[\s\-()]/g, '');
  if (/^\+91[6-9]\d{9}$/.test(compact)) return compact;
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  return null;
}

// Throw-away / obviously fake mailbox providers. Not exhaustive: the real proof is the OTP.
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com', 'sharklasers.com',
  'grr.la', 'pokemail.net', 'spam4.me', '10minutemail.com', '10minutemail.net', '20minutemail.com', 'tempmail.com',
  'temp-mail.org', 'temp-mail.io', 'tempmail.net', 'tempmailo.com', 'tempail.com', 'throwawaymail.com', 'yopmail.com',
  'yopmail.net', 'yopmail.fr', 'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'mailnesia.com',
  'trashmail.com', 'trashmail.net', 'trashmail.de', 'fakeinbox.com', 'fakemail.net', 'mintemail.com', 'mohmal.com',
  'emailondeck.com', 'mytemp.email', 'burnermail.io', 'discard.email', 'discardmail.com', 'spamgourmet.com', 'mailcatch.com',
  'moakt.com', 'tmail.ws', 'tmpmail.org', 'tmpmail.net', 'inboxbear.com', 'mail.tm', 'emailfake.com', 'fakemailgenerator.com',
  'luxusmail.org', 'mailforspam.com', '33mail.com', 'anonaddy.me', 'cs.email', 'zetmail.com', 'dropmail.me', 'harakirimail.com',
  'incognitomail.com', 'jetable.org', 'mailexpire.com', 'mailnull.com', 'meltmail.com', 'mt2015.com', 'spambox.us',
  'tempinbox.com', 'trbvm.com', 'wegwerfmail.de', 'owlymail.com', 'guerrillamail.biz', 'guerrillamail.de', 'example.com',
  'example.org', 'example.net', 'test.com', 'invalid.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1] ?? '';
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // sub-domains of a listed provider (x.mailinator.com)
  return [...DISPOSABLE_DOMAINS].some((d) => domain.endsWith(`.${d}`));
}

export function clean(text: unknown, max: number): string {
  // remove control characters, keep ordinary newlines/tabs in free text
  return String(text ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
