# Admin menu sync fix

## Root cause (found by auditing the project)
* The website's menu (327 items, 7 categories) lives in `src/data/menuData.js`. The dashboard reads ONLY the database.
* The first database setup (0001) allowed only 4 categories (chai, tiffins, bakery, food), so Mandi, Shawarma and Party Orders
  could not exist in the database, and the 327 items were never copied in. Result: the dashboard showed only old sample dishes.
* Until the database holds the menu, the website ignores dashboard edits to price/name/description (it keeps its built-in menu).

## What was changed
* `src/admin/menuSync.js` (new) + panel at the top of Menu management: copies every missing item/category into the database
  from the dashboard, then switches the website to the database menu as the LAST step. Adds only; never overwrites or deletes.
* `supabase/migrations/0012_menu_categories_and_columns.sql` (new, also in ALL-IN-ONE-SETUP.sql): one small SQL step that lets
  the database store all categories (adds Shawarma, Mandi, Party Orders) and adds the two columns the dashboard needs.
  The dashboard shows this SQL with a Copy button if it is still needed.
* Menu management: tabs in website order, "Rename this section" tool, items you delete on purpose are remembered so
  "restore" never brings them back. Categories page lists all 7 with item counts.
* Sync fixes: photos saved in the dashboard now win over an old photo stored only in one browser; a save made while the site
  was loading is no longer missed; lists are read in pages so a menu over 1000 items is never cut off.
* Migration 0010: kept (hand-edited) rows now keep their place in the menu order.
* NOT changed: any CSS, theme, layout, page or component of the website or dashboard.
