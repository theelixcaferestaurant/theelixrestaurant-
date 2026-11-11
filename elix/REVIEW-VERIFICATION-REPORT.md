# Review system: audit, changes and test report

## Issues found in the delivered project
1. **No ownership verification.** Email and mobile were checked by pattern only (ReviewForm.jsx, `submit_review()` in 0005). Any invented address was accepted.
2. **Public write path.** `submit_review()` was executable by `anon`, so anyone could call the RPC directly. Any verification added only in React could have been bypassed.
3. **Realtime was absent** for reviews (only a refresh on tab focus). Putting `reviews` into the realtime publication would have been unsafe (rows contain email/mobile), so a content-free broadcast ping is used.
4. **Layout risks on the public page:** `.review-grid` used `minmax(280px,1fr)` (overflow on 320px phones), no `min-width:0` on grid children, no `overflow-wrap`, and line breaks in reviews were collapsed.
5. **Admin page** showed contacts without any verification evidence.
6. **No retry safety:** a dropped network after save could cause a duplicate on retry.
7. 0005 `get_public_reviews`, RLS on `reviews`, admin policy: reviewed, correct, kept.
8. No conflicts with 0001/0005: 0006 only adds columns/tables/functions and drops `submit_review()`.

## Files
New: `supabase/migrations/0006_review_verification.sql`, `supabase/functions/review-otp/index.ts`, `supabase/functions/review-submit/index.ts`, `supabase/functions/_shared/{common,providers,validate}.ts`, `supabase/functions/.env.example`, `supabase/config.toml`, `supabase/tests/verify_reviews_otp.sql`, `supabase/tests/validate.test.mjs`, `src/components/Turnstile.jsx`, `REVIEW-VERIFICATION-REPORT.md`.
Modified: `src/lib/reviews.js`, `src/components/ReviewForm.jsx`, `src/admin/pages/ReviewsPage.jsx`, `src/styles/components.css` (review wrapping + verification styles), `src/styles/pages.css` (one `min-width` rule), `REVIEWS-SETUP.md`, `.env.example`, `.gitignore`.
Renamed: `supabase/tests/verify_reviews.sql` -> `verify_reviews_legacy_0005_SUPERSEDED.sql` (tests the removed function; fails by design after 0006).
Untouched: homepage, intro, menu, themes, gallery, contact/WhatsApp, other admin pages, migrations 0001-0005.

## Test report (honest status)
Legend: PASS = actually executed here. NOT RUN = needs your Supabase/Resend/Twilio; written but not executed in this environment (no network, no Postgres, npm registry unreachable).

| # | Test | Result |
|---|---|---|
| Build | `npm run build` | **NOT RUN** (dependencies cannot be installed here). All changed JS/JSX/TS files pass an esbuild syntax parse: PASS |
| Unit | Email/mobile normalisation, +91 handling, invalid numbers, SQL-injection string, disposable domains (18 cases, `validate.test.mjs`) | PASS |
| 1 | Valid email + mobile with real OTPs | NOT RUN (needs providers) |
| 2 | Invalid email | PASS (unit) + DB test written |
| 3-6 | Wrong/expired email and SMS OTP | NOT RUN live; DB logic covered by `verify_reviews_otp.sql` (NOT RUN, run it) |
| 7 | Invalid mobile | PASS (unit) |
| 8-9 | Changing email/mobile after verifying | Frontend resets instantly; DB rejects mismatched tokens (SQL test written, NOT RUN) |
| 10-12 | Submit without email / mobile / either | SQL tests written, NOT RUN |
| 13-15 | Valid submit saved, Pending in admin | NOT RUN |
| 16-18 | Approve, public display, persistence | NOT RUN |
| 19 | Long text on mobile/desktop | CSS changed; not visually tested |
| 20-22 | Pending/rejected hidden; non-admin blocked; anon blocked | SQL tests written, NOT RUN |
| 23 | Duplicates, rate limits, honeypot | SQL tests written (dupe text, idempotent retry, per-IP SMS cap), NOT RUN; honeypot/CAPTCHA live NOT RUN |

I have not verified that any email or SMS is actually delivered. Do the section 9 checklist in REVIEWS-SETUP.md and run `verify_reviews_otp.sql`; please send me any FAIL.

## Needs your configuration
Resend key + verified domain; Twilio account/Verify service with India enabled; Turnstile keys (recommended); `OTP_PEPPER`; `ALLOWED_ORIGINS`; run migration 0006; deploy both functions; set `VITE_*` variables; Realtime "Allow public access".
Decision for you: existing `legacy_unverified` reviews that are already approved stay public. Reject them in admin if you do not want that.
