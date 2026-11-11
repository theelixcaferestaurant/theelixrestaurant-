# THE ELIX: backend and admin dashboard setup (Supabase)

> **Start with `LIVE-DASHBOARD-SETUP.md`.** It is the current, complete setup (migrations 0001 to 0011, backups, launch). The steps below are the original, shorter version.

The public website and the private dashboard (`/admin`) now read and write the same Supabase project:
PostgreSQL for content, Supabase Auth for the administrator login, Supabase Storage for photos and videos.
Without a `.env` file the website still runs exactly as before using its built-in sample content.

## 1. Create the Supabase project
1. Go to https://supabase.com, create a project, wait until it is ready.
2. **Authentication > Providers > Email**: keep Email enabled. **Authentication > Sign In / Providers**: turn **"Allow new users to sign up" OFF**
   (only you should be able to create accounts).

## 2. Create the tables, security rules and storage
1. **SQL Editor > New query**: paste all of `supabase/migrations/0001_schema_rls_storage.sql` and press Run.
2. New query again: paste all of `supabase/migrations/0002_seed_content.sql` and Run, then `0003_pillar_settings.sql` (the editable "Why The Elix" texts). This loads your current menu (40 items), categories,
   gallery list, hours, social rows and homepage wording so nothing starts empty.

## 3. Create your administrator
1. **Authentication > Users > Add user > Create new user**: enter your email and a strong password (tick "Auto Confirm User").
2. **SQL Editor**, run (use your email):

       insert into public.admins (user_id, email)
       select id, email from auth.users where email = 'you@example.com';

   Only people in the `admins` table can change content. Anyone else who somehow signs in is shown "Access denied"
   and the database refuses their writes (Row Level Security).

## 3b. Two-step sign in (recommended)
After step 4 works, follow **TWO-STEP-LOGIN.md** so that a password alone can never open the dashboard.

## 4. Connect the website
1. Copy `.env.example` to `.env`.
2. **Project Settings > API**: copy **Project URL** into `VITE_SUPABASE_URL` and the **Publishable key** into `VITE_SUPABASE_PUBLISHABLE_KEY`.
   Do **not** use the `service_role` key anywhere in this project.
3. `npm install` then `npm run dev`. Open http://localhost:5173/admin and sign in.

When you deploy (Vercel, Netlify, ...) add the same two variables in the host's environment settings and rebuild:
Vite bakes them in at build time. `vercel.json` and `public/_redirects` make `/admin` work on those hosts.

## 5. Verify Row Level Security (do this once, and after any SQL change)
**SQL Editor > New query**: paste all of `supabase/tests/verify_rls.sql` and Run. It simulates a visitor, a signed-in
non-administrator and your administrator, checks the storage bucket and RLS flags, rolls back everything it touched,
and shows one table. **Every row must say PASS.** A FAIL row names the exact rule that is wrong. (If you have not
created your administrator yet, the admin rows say SKIPPED and "at least one administrator exists" says FAIL.)

If you use the Supabase CLI, the two files in `supabase/migrations/` are already in CLI migration order
(`supabase db push`).

## 6. Replace sample visuals with your real photos and videos
Dashboard > Menu items > open an item > upload a new photo or video: it replaces the old file instantly (the old file is
deleted from Storage). Same for Gallery, Categories (banner) and Homepage (hero video, cover photo, page photographs).
Dashboard uploads always override files bundled in `src/assets`, so nothing needs redeploying.

## What the dashboard controls
| Dashboard page | Database table(s) | Storage |
|---|---|---|
| Menu items (add / edit / delete, price, description, hide, featured) | `menu_items` | photo + hover video in `elix-media` |
| Categories (names, text, subcategories) | `categories` | category banner photo |
| Gallery (photos and videos) | `gallery_items` | photo + video |
| Restaurant details (address, phone, email, hours, social links) | `restaurant_info`, `opening_hours`, `social_links` | none |
| Homepage and settings (wording, hero video, page photos) | `site_settings` | hero video, cover photo, page photos |

All uploaded files go to the public bucket `elix-media`; their public URLs are stored in `media_assets`
(one row per photo or video, with the storage path so replaced files are deleted automatically).

## How changes reach the public website
Saving in the dashboard writes to Supabase, then immediately refreshes the public content layer (`src/lib/content.js`).
Other open browsers update through Supabase Realtime within about a second, and also when a tab becomes visible again.
Photos and videos uploaded in the dashboard take priority over files in `src/assets/images` and `src/assets/videos`.

## Security summary
- Visitors (anon key) can only **read** public content. Hidden menu items and gallery entries are not readable by them.
- Every write to every table and to the storage bucket requires `public.is_admin()` (your user id is in `admins`).
- The `admins` table cannot be changed from the website at all. Add or remove administrators only in the SQL editor.
- Uploads are limited to JPG/PNG/WebP/AVIF and MP4/WebM, 10 MB per photo, 50 MB per video (enforced by the storage bucket too).
- `/admin` is a separate, lazy-loaded bundle marked `noindex`.
- No ordering, cart, checkout, payment, delivery or WhatsApp/Zomato features exist.

## Troubleshooting
- "Access denied": your user is not in `admins` (step 3.2).
- "Not allowed" when saving: you are signed out, or the schema was not run completely. Run `0001_schema_rls_storage.sql` again (safe to repeat).
- Upload fails: check the file size, and that the `elix-media` bucket exists (Storage tab).
- Public site still shows sample text: the `.env` values are missing or wrong; check the browser console for "could not load live content".
