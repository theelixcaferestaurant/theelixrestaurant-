// POST /functions/v1/review-otp
//   { action: 'send',   channel: 'email'|'mobile', target, captchaToken? }
//   { action: 'verify', channel: 'email'|'mobile', target, code }
// Always answers JSON: { ok: true, ... } or { ok: false, code, error, ... }.
import {
  adminClient, captchaOk, captchaEnabled, corsHeaders, hmacHex, ipHash, isDisposableEmail, normalizeEmail, normalizeMobile,
  pepper, randomCode, randomToken, readJson, reply, sha256Hex, timingSafeEqual,
} from '../_shared/common.ts';
import { checkSmsOtp, emailConfigured, sendEmailOtp, sendSmsOtp, smsConfigured } from '../_shared/providers.ts';

const OTP_TTL_SECONDS = 600; // codes expire after 10 minutes
const TOKEN_TTL_SECONDS = 1800; // a verified contact stays valid for 30 minutes
const RESEND_SECONDS = 60;

const waitText = (s: number) => (s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${s} seconds`);

// Does the e-mail domain exist and accept mail? Fails OPEN if DNS lookups are unavailable in the runtime.
async function domainCanReceiveMail(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  try {
    const mx = await Deno.resolveDns(domain, 'MX');
    if (mx.length > 0) return true;
    const a = await Deno.resolveDns(domain, 'A').catch(() => []);
    return a.length > 0;
  } catch (e) {
    return !(e instanceof Deno.errors.NotFound);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { ok: false, code: 'method', error: 'Method not allowed.' }, 405);

  try {
    const body = await readJson(req);
    if (!body) return reply(req, { ok: false, code: 'invalid', error: 'Invalid request.' }, 400);

    const channel = body.channel;
    if (channel !== 'email' && channel !== 'mobile') return reply(req, { ok: false, code: 'invalid', error: 'Invalid request.' }, 400);
    const target = channel === 'email' ? normalizeEmail(body.target) : normalizeMobile(body.target);
    if (!target) {
      return reply(req, {
        ok: false, code: 'invalid_target',
        error: channel === 'email'
          ? 'Please enter an email address like name@example.com.'
          : 'Please enter a valid 10-digit Indian mobile number (the +91 code is optional).',
      }, 400);
    }

    const db = adminClient();

    // ------------------------------------------------------------ SEND
    if (body.action === 'send') {
      if (channel === 'email' && !emailConfigured()) return reply(req, { ok: false, code: 'not_configured', error: 'Email verification is not available right now. Please try again later.' }, 503);
      if (channel === 'mobile' && !smsConfigured()) return reply(req, { ok: false, code: 'not_configured', error: 'Mobile verification is not available right now. Please try again later.' }, 503);

      if (!(await captchaOk(body.captchaToken, req))) {
        return reply(req, { ok: false, code: 'captcha', error: 'Please complete the security check and try again.' }, 400);
      }

      if (channel === 'email') {
        if (isDisposableEmail(target)) {
          return reply(req, { ok: false, code: 'disposable', error: 'Please use a permanent email address, not a temporary or disposable one.' }, 400);
        }
        if (!(await domainCanReceiveMail(target))) {
          return reply(req, { ok: false, code: 'invalid_domain', error: 'That email domain does not appear to exist. Please check the address.' }, 400);
        }
      }

      const code = channel === 'email' ? randomCode() : null;
      const codeHash = code ? await hmacHex(pepper(), `${channel}:${target}:${code}`) : null;

      const { data: issued, error } = await db.rpc('review_otp_issue', {
        p_channel: channel, p_target: target, p_code_hash: codeHash, p_ip_hash: await ipHash(req), p_ttl_seconds: OTP_TTL_SECONDS,
      });
      if (error || !issued) {
        console.error('review_otp_issue failed', error?.message);
        return reply(req, { ok: false, code: 'server', error: 'Something went wrong. Please try again.' }, 500);
      }
      if (!issued.ok) {
        const wait = Number(issued.retry_after) || RESEND_SECONDS;
        const msg = issued.code === 'cooldown' ? `Please wait ${waitText(wait)} before requesting another code.`
          : issued.code === 'too_many' ? `Too many codes requested. Please try again in ${waitText(wait)}.`
          : issued.code === 'busy' ? 'Verification is very busy right now. Please try again later.'
          : 'Invalid request.';
        return reply(req, { ok: false, code: issued.code, retry_after: wait, error: msg }, issued.code === 'invalid' ? 400 : 429);
      }

      let delivered = false;
      let invalidNumber = false;
      if (channel === 'email') {
        delivered = await sendEmailOtp(target, code!);
      } else {
        const r = await sendSmsOtp(target);
        delivered = r.ok;
        invalidNumber = Boolean(r.invalidNumber);
      }
      if (!delivered) {
        await db.rpc('review_otp_void', { p_id: issued.id }); // so the customer can retry immediately
        return reply(req, {
          ok: false, code: invalidNumber ? 'invalid_target' : 'send_failed',
          error: invalidNumber
            ? 'That mobile number could not receive an SMS. Please check the number.'
            : channel === 'email'
              ? 'We could not send the email. Please check the address and try again.'
              : 'We could not send the SMS. Please try again in a moment.',
        }, invalidNumber ? 400 : 502);
      }
      return reply(req, { ok: true, expires_in: OTP_TTL_SECONDS, resend_after: RESEND_SECONDS, captcha: captchaEnabled() });
    }

    // ------------------------------------------------------------ VERIFY
    if (body.action === 'verify') {
      const code = String(body.code ?? '').replace(/\s/g, '');
      if (!/^\d{6}$/.test(code)) return reply(req, { ok: false, code: 'format', error: 'Please enter the 6-digit code.' }, 400);

      // The attempt is counted BEFORE the code is checked, so parallel guessing cannot exceed the limit.
      const { data: att, error } = await db.rpc('review_otp_attempt', { p_channel: channel, p_target: target });
      if (error || !att) {
        console.error('review_otp_attempt failed', error?.message);
        return reply(req, { ok: false, code: 'server', error: 'Something went wrong. Please try again.' }, 500);
      }
      if (!att.ok) {
        const msg = att.code === 'expired' ? 'This code has expired. Please request a new code.'
          : att.code === 'locked' ? 'Too many incorrect attempts. Please request a new code.'
          : 'No code is active for this address. Please request a new code.';
        return reply(req, { ok: false, code: att.code, error: msg }, 400);
      }

      let correct = false;
      if (channel === 'email') {
        const expected = await hmacHex(pepper(), `${channel}:${target}:${code}`);
        correct = typeof att.code_hash === 'string' && timingSafeEqual(expected, att.code_hash);
      } else {
        const result = await checkSmsOtp(target, code);
        if (result === 'expired') return reply(req, { ok: false, code: 'expired', error: 'This code has expired. Please request a new code.' }, 400);
        if (result === 'error') return reply(req, { ok: false, code: 'server', error: 'We could not check the code right now. Please try again.' }, 502);
        correct = result === 'approved';
      }

      if (!correct) {
        const left = Number(att.attempts_left);
        return reply(req, {
          ok: false, code: left > 0 ? 'incorrect' : 'locked', attempts_left: left,
          error: left > 0
            ? `That code is not correct. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`
            : 'That code is not correct and no attempts are left. Please request a new code.',
        }, 400);
      }

      const token = randomToken();
      const { data: done, error: e2 } = await db.rpc('review_otp_succeed', {
        p_otp_id: att.id, p_token_hash: await sha256Hex(token), p_ttl_seconds: TOKEN_TTL_SECONDS,
      });
      if (e2 || !done?.ok) {
        return reply(req, { ok: false, code: 'expired', error: 'This code has expired or was already used. Please request a new code.' }, 400);
      }
      return reply(req, { ok: true, token, expires_in: TOKEN_TTL_SECONDS });
    }

    return reply(req, { ok: false, code: 'invalid', error: 'Invalid request.' }, 400);
  } catch (e) {
    console.error('review-otp crashed', e);
    return reply(req, { ok: false, code: 'server', error: 'Something went wrong. Please try again.' }, 500);
  }
});
