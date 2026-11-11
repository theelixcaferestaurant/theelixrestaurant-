# THE ELIX: customer reviews (simple version, no email/SMS codes)

## How it works
1. A visitor opens **Contact** (or **Reviews**) and fills in **Send a review**: name, email, phone (optional), topic (Review), star rating and review text, then presses **Send review**.
2. The review is saved in the Supabase table `reviews` as **pending**. Nothing is public yet.
3. The administrator opens `/admin` > **Customer reviews** > **Pending** and presses **Approve**.
4. Approved reviews appear on the **Reviews** page. Email and phone are never shown publicly (only name, rating, text, date).

Protection: hidden spam-trap field, limits (3 reviews/hour per network address, 3/day per email or phone, identical text refused, 100/hour overall), and admin approval before anything is public.

## One-time setup
1. `.env` (next to `package.json`) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Restart `npm run dev` after editing it.
2. Supabase > SQL Editor: run migrations `0001` to `0009` in order (or paste supabase/ALL-IN-ONE-SETUP.sql once). "Success. No rows returned" is the normal result.
3. Make yourself an administrator (once): create your user under Authentication > Users, then run
   `insert into public.admins (user_id, email) select id, email from auth.users where email = 'YOUR-EMAIL';`

## Not needed any more
Resend, Twilio, Turnstile and deploying the Edge Functions in `supabase/functions/` (left in the project, unused).
