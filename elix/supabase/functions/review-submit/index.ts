// POST /functions/v1/review-submit
// { name, email, mobile, rating, message, emailToken, mobileToken, submissionId, website }
// The database function review_submit_verified() makes the final decision; this function only forwards a cleaned request.
import { adminClient, clean, corsHeaders, ipHash, isDisposableEmail, isUuid, normalizeEmail, normalizeMobile, readJson, reply, sha256Hex } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { ok: false, code: 'method', error: 'Method not allowed.' }, 405);

  try {
    const body = await readJson(req);
    if (!body) return reply(req, { ok: false, code: 'invalid', field: 'form', error: 'Invalid request.' }, 400);

    // Honeypot: bots fill the hidden field. Pretend success, save nothing.
    if (String(body.website ?? '').trim() !== '') return reply(req, { ok: true });

    const email = normalizeEmail(body.email);
    const mobile = normalizeMobile(body.mobile);
    if (!email) return reply(req, { ok: false, code: 'invalid', field: 'email', error: 'Please enter an email address like name@example.com.' }, 400);
    if (isDisposableEmail(email)) return reply(req, { ok: false, code: 'disposable', field: 'email', error: 'Please use a permanent email address.' }, 400);
    if (!mobile) return reply(req, { ok: false, code: 'invalid', field: 'mobile', error: 'Please enter a valid 10-digit Indian mobile number (the +91 code is optional).' }, 400);

    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return reply(req, { ok: false, code: 'invalid', field: 'rating', error: 'Please choose a star rating from 1 to 5.' }, 400);

    const hashOrNull = async (t: unknown) => (typeof t === 'string' && t.length >= 20 && t.length <= 100 ? await sha256Hex(t) : null);

    const { data, error } = await adminClient().rpc('review_submit_verified', {
      p_name: clean(body.name, 200),
      p_email: email,
      p_mobile: mobile,
      p_rating: rating,
      p_message: clean(body.message, 5000),
      p_email_token_hash: await hashOrNull(body.emailToken),
      p_mobile_token_hash: await hashOrNull(body.mobileToken),
      p_submission_id: isUuid(body.submissionId) ? body.submissionId : null,
      p_ip_hash: await ipHash(req),
    });

    if (error || !data) {
      console.error('review_submit_verified failed', error?.message);
      return reply(req, { ok: false, code: 'server', field: 'form', error: 'Sorry, your review could not be saved. Please try again in a moment.' }, 500);
    }
    // ok === true only after the INSERT has committed.
    return reply(req, data, data.ok ? 200 : data.code === 'rate_limited' || data.code === 'busy' ? 429 : 400);
  } catch (e) {
    console.error('review-submit crashed', e);
    return reply(req, { ok: false, code: 'server', field: 'form', error: 'Sorry, your review could not be saved. Please try again in a moment.' }, 500);
  }
});
