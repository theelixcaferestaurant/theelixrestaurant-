# Live Admin Dashboard completion

## Fixed: SQL migration 0010 (supabase/migrations/0010_menu_and_takeaway_management.sql, also inside ALL-IN-ONE-SETUP.sql)
* **Eight overlapping menu records.** 0002 created sample dishes with the same ids as eight real menu items
  (plain-dosa, masala-dosa, poori, upma, butter-naan, chicken-tikka, veg-fried-rice, chicken-fried-rice).
  The old 0010 kept the sample values (e.g. Plain Dosa 65 instead of 60, Chicken Tikka 230 instead of 380, wrong headings,
  steam flag on) and only filled in new columns. Now each is replaced by the supplied menu values, but only while it is
  still exactly the untouched 0002 sample, so a dashboard edit is never overwritten. Also repairs projects that already ran the old 0010.
* **Unsafe re-runs.** The old script re-inserted every missing built-in item (deleted items came back), could shift
  dashboard-added items again, and re-inserted deleted Take Away slides. Now the one-time copies are guarded by marker rows in
  site_settings (`menu_seed_0010`, `takeaway_seed_0010`; existing installs are detected by `menu_source` / the existing table).
* A one-time safety copy of menu_items is kept in `menu_items_backup_pre0010` (admin read-only, never overwritten).
* The script stops with an error, marking nothing as done, if any of the 327 built-in items is missing.
* The 32 placeholder dishes stay hidden (not deleted). Optional `supabase/optional_remove_placeholder_samples.sql` removes them.
* The two repeated mutton starters (Hot Garlic Mutton, Ginger Mutton, ids `-2`) are kept: they are in your supplied menu, marked "intentional repeat as supplied".

## New
* `supabase/migrations/0011_backup_and_recovery.sql`: `content_backups` table (admin-only), functions to create, import, restore (all-or-nothing, automatic safety copy first) and a once-a-day automatic copy.
* Dashboard page **Backup & recovery** (`src/admin/pages/BackupPage.jsx`, menu entry and route in `AdminApp.jsx`); the daily copy is requested when an administrator opens the dashboard.
* `supabase/tests/verify_backup.sql`: SQL self-test for the repair, markers, backup permissions and a restore round trip (rolls itself back).
* `LIVE-DASHBOARD-SETUP.md`: plain setup and launch steps.

## Small fix
* Deleting a menu item now deletes the database row first and its photo/video second, so a failed delete no longer strips the media from an item that stays.

## Not changed
Website design, animations, colours, typography, categories, navigation, menu data, login/2FA and all other dashboard pages. No new dependencies.
