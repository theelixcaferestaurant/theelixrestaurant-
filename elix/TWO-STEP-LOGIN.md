# THE ELIX: two-step admin sign in

Only you can open `/admin` and change the website. Signing in takes **two steps**:

1. **Email + password** (Supabase Auth).
2. **A 6-digit code**: from an authenticator app (free) and/or an SMS to your phone.

Safety layers, from outside to inside:

| Layer | What it does |
|---|---|
| Sign-ups OFF (Supabase) | Nobody else can create an account. |
| `admins` table | Only your user id is an administrator. Added in the SQL editor only. |
| Second step in the app | `/admin` stays closed until the code is correct (session level `aal2`). |
| Database rule `is_admin()` | Even a stolen password cannot change data without the second step (run `enforce_two_step_login.sql`). |

## Set it up, in this order (do not skip the order)

### 1. Supabase settings
- **Authentication > Sign In / Providers > User Signups**: "Allow new users to sign up" = **OFF**.
- **Authentication > Multi-Factor** (may be under Sign In / Providers): make sure **TOTP (App Authenticator)** is **enabled**.
- Only if you want SMS codes: enable **Phone** and connect an SMS provider (Twilio, MessageBird, Vonage or TextLocal). In India, SMS usually needs DLT registration with the provider, and phone MFA may need a paid Supabase plan: check Supabase pricing. The authenticator app needs none of this.

### 2. Run the app
```
npm install
npm run dev
```
Open `http://localhost:5173/admin`, sign in with email + password. Because no second step exists yet, you will see **"Set up two-step sign in"**.
- **Authenticator app**: scan the QR code with Google Authenticator (or similar), type the 6-digit code, Confirm.
- **SMS**: type your mobile number, then the code you receive.

You reach the dashboard. Then open **Admin account > Two-step sign in > Add a method** and add a **second method** as a backup (for example the authenticator app AND SMS).

### 3. Lock the database (only after step 2 worked)
Supabase > SQL Editor > New query: paste `supabase/enforce_two_step_login.sql` > Run.
It stops with a message if you have not finished step 2, so it cannot lock you out by mistake.

Now log out and back in: password, then code, then dashboard. Try changing a menu price to confirm saving works.

## Everyday use
Sign in at `/admin` > enter email + password > enter the 6-digit code.

## Lost your phone or authenticator app?
You are never locked out of your own Supabase project, only out of the dashboard.
1. In Supabase > **Authentication > Users**, open your user and delete its MFA factor(s)
   (or in the SQL editor: `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'YOUR-EMAIL');`).
2. Sign in at `/admin` again with email + password. You will be asked to set up a new second step.
3. If dashboard saves are refused meanwhile, run `supabase/turn_off_two_step_login.sql`, finish setup, then run `enforce_two_step_login.sql` again.

## Notes
- The self-test scripts in `supabase/tests/` simulate an administrator without a second step. Run them **before** `enforce_two_step_login.sql`. After it, admin rows in those tests are expected to fail.
- Never put the `service_role` key in this project.
