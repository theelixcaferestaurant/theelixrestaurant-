# Backend and dashboard: requirement status
PASS = verified here (static review, parsing, or executed test). PENDING = needs your Supabase project and credentials.
Nothing below was executed against a live Supabase project: none was available.

| # | Requirement | Status | Evidence / what is needed |
|---|---|---|---|
| 1 | Connect Postgres, Auth, Storage | PENDING | Client code is complete (`src/lib/supabase.js`, anon key only). Needs your `.env`. |
| 2a | Tables and RLS policies written | PASS (review) | `0001_schema_rls_storage.sql`: 9 tables, public read / admin write, no write policy on `admins`. |
| 2b | Seed data correct | PASS (executed check) | Parsed `0002_seed_content.sql`: 40 menu items identical to `menuData.js` (0 mismatches), 16 gallery entries, 4 categories. |
| 2c | SQL runs and RLS enforced in a real database | PENDING | Run both migrations, then `supabase/tests/verify_rls.sql` (24 checks, must all be PASS). That script is written but has NOT been executed. |
| 3 | Secure /admin login | PENDING (live test) | Email+password via Supabase Auth, then an `admins` membership check; non-admins see "Access denied"; page is `noindex`. Needs a real project to test. |
| 4-5 | Add / edit / delete items; names, categories, prices, descriptions | PENDING (live test) | `MenuPage.jsx` uses only existing columns (cross-checked against the schema). |
| 6 | Upload / replace / remove photo and video per item | PENDING (live test) | `media.js` + `MediaField.jsx`: validates type and size, resizes photos, replaces and deletes old file. |
| 7 | Categories and gallery (images and videos) | PENDING (live test) | `CategoriesPage.jsx` (incl. 4 banners), `GalleryPage.jsx`. |
| 8 | Address, phone, email, hours, social links | PENDING (live test) | `RestaurantPage.jsx`. |
| 9 | Homepage content and settings | PENDING (live test) | `HomepagePage.jsx` (16 texts including the four "Why The Elix" pillars, hero video, cover, 6 page photos). |
| 10 | Changes appear on the public site | PENDING (live test) | Saves call `refreshContent()`; other tabs update by Realtime, on focus, and every 5 min. |
| 11 | Responsive dashboard | PENDING (browser test) | Mobile layout exists (stacked at 860 px); not viewed on a device. |
| 12 | Replace sample visuals later | PASS (design) | Dashboard uploads override bundled files; hero video removal now restores defaults (bug fixed this pass). |
| - | No exposed secrets | PASS | Scan: no service_role key, JWT, DB URL or `.env` in the project; `.env` is git-ignored. |
| - | No ordering/cart/payment/delivery | PASS | None exist. |


## Update: live dashboard completion pass (migration 0010 repaired, 0011 backups added)
Nothing here was executed against a live Supabase project, and no Postgres server was available to run the SQL.

| Item | Status | Evidence |
|---|---|---|
| 0010: eight overlapping records repaired, re-runs safe | PASS (logic simulated, SQL parsed) | Python model of the script on the 0002 rows: first run, re-run after a delete and an edit, legacy (old 0010) repair, edited-sample protection. SQL quoting/terminators checked. NOT run in Postgres. |
| 327 built-in items in the seed match menuData.js | PASS (executed) | Every id, name, price text, category, description, heading path, veg marker and order compared: 0 differences. |
| Public site shows the database menu and dashboard edits (edit, move, disable, unavailable, delete, add, Take Away slides) | PASS (executed against an in-memory stand-in for Supabase) | 13 checks; a deliberately wrong old-style row makes it fail. |
| 0011 backup / restore SQL | PENDING | Written and parsed only. Run `supabase/tests/verify_backup.sql` after the migrations. |
| Realtime updates, uploads, storage, login, 2FA, RLS in a real project | PENDING | Need your project. Run verify_rls.sql, verify_dashboard.sql, verify_backup.sql. |
| `npm install` and `vite build` | PENDING | No internet in the build environment: dependencies could not be installed. All source compiles with esbuild (syntax/JSX), imports not resolved. |
