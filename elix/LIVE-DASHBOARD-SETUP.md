# THE ELIX: connect and launch the Live Admin Dashboard

Plain steps, in order. Nothing here runs against your Supabase project until YOU paste it into the Supabase SQL Editor.
Without a `.env` file the public website still shows its built-in menu exactly as before.

## 1. Supabase project (once)
1. https://supabase.com > New project.
2. **Authentication > Sign In / Providers**: keep Email on, turn **"Allow new users to sign up" OFF**.

## 2. Database (SQL Editor > New query > paste > Run)
**New project:** paste all of `supabase/ALL-IN-ONE-SETUP.sql` and Run. (It contains migrations 0001 to 0011.)

**Project that already ran 0001-0009 (or the old 0010):** run these two files, in this order:
1. `supabase/migrations/0010_menu_and_takeaway_management.sql` (the corrected one: replaces the old file)
2. `supabase/migrations/0011_backup_and_recovery.sql`

Both are safe to run again. After 0010 you should see the notice *"Menu check: 327 built-in items defined, 327 present now"*.
Take a Supabase backup first if your plan offers it (Project Settings > Database > Backups).

## 3. Your administrator login
1. **Authentication > Users > Add user > Create new user** (tick Auto Confirm User). Use a strong password.
2. Open `supabase/grant_admin.sql`, put your email in it, paste it in the SQL Editor, Run.

## 4. Connect the website
1. Copy `.env.example` to `.env`.
2. Supabase **Project Settings > API**: put **Project URL** in `VITE_SUPABASE_URL` and the **Publishable key** in `VITE_SUPABASE_PUBLISHABLE_KEY`.
   Never use the `service_role` / secret key anywhere in this project.

## 5. Launch
    npm install
    npm run dev          (local)     -> open http://localhost:5173/admin
    npm run build        (production build, output in dist/)

Sign in, then finish the two-step sign-in setup (authenticator app). After you have reached the dashboard once,
run `supabase/enforce_two_step_login.sql` so the DATABASE also refuses changes from a password-only session.

## 6. Check it (SQL Editor, each must show only PASS)
* `supabase/tests/verify_rls.sql` : security rules
* `supabase/tests/verify_dashboard.sql` : dashboard and review rules
* `supabase/tests/verify_backup.sql` : menu repair, backup and restore (needs your administrator from step 3)

## 7. Deploy once, then never again for content
Add the same two variables in your host (Vercel/Netlify), build once. From then on every dashboard change
(menu, prices, photos, videos, Take Away slides, gallery, homepage text, restaurant details, hours) is saved in Supabase and
is designed to appear on the public website without a redeploy: pages that are already open update through Supabase live updates, and everyone else sees it on their next visit or refresh.
No code editing and no redeploy.

## Day to day
* **Menu management**: all 327 items. Edit, add, delete, change price/description/category/section, availability (Disable = off the website,
  Mark unavailable = shown with "Currently Unavailable"), photo and video, order.
* **Take Away slides**, **Gallery**, **Website content**, **Restaurant details**, **Opening hours**, **Website media**: each has its own page.
* **Backup & recovery**: a restore point is saved automatically once a day and before every restore. Click "Save and download a backup file"
  before big changes and keep the file somewhere safe. Restore puts back menu, Take Away slides, gallery list or restaurant details/texts.
  Photos and videos are files: deleting one is permanent, so keep your originals.

## Optional
`supabase/optional_remove_placeholder_samples.sql` removes the 32 hidden placeholder dishes so the dashboard counts exactly 327.
