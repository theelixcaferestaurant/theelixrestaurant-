# Phase 3: dynamic menu management

## What was already there (kept)
Item add / edit / delete / disable / "temporarily unavailable" / reorder / photo + video upload (Menu management), category text + banner editing, public site reading the menu from Supabase, RLS (public read, admin write), `elix-media` storage bucket. All reused.

## What was missing and is new
| Area | Before | Now |
|---|---|---|
| Categories | edit text only; fixed list | create, edit, reorder (up/down), hide/show, delete (with confirmation, custom ones) |
| Subcategories | only text typed inside each item (`menu_items.path`); could not exist empty, be reordered, hidden or assigned | real table: create (several, nested up to 6 levels), rename, move, reorder, hide/show, delete (keep dishes or delete all), assign to items |
| Items | free-text section | pick a real subcategory (or create one inline with `A > B`) |

## Database: migration 0014 (also appended to ALL-IN-ONE-SETUP.sql, safe to re-run)
* `categories.enabled` (new column, default true).
* `menu_subcategories` (new table) with RLS: public read, administrators write. Guards: no self/cyclic parent, same category, max 6 levels, unique sibling name.
* `menu_items.subcategory_id` (new column, FK, `on delete set null`) + guard (subcategory must belong to the item's category).
* One-time copy (marker `menu_structure_0014`): every existing heading path becomes a subcategory (same names/nesting/order), items are linked. `path`/`sub` columns are untouched. Category order is written once as the website already shows it.
* Nothing is deleted, renamed, hidden or re-priced. Hidden 0002 placeholder dishes are skipped.
* Until it is run the dashboard shows a "one database step" card with the SQL and Copy button; the public site behaves exactly as before.

## Public website
* `src/lib/content.js`: reads `menu_subcategories`; headings/order come from the tree; hidden subcategory/category removes its dishes; Dine In / Footer / Home / nav lists follow category order and visibility (arrays updated in place, so those components are unchanged). A failed read keeps the previous content.
* New `src/pages/MenuCategory.jsx` + route `/menu/:key` (App.jsx): pages for categories created in the dashboard, same layout as the built-in category pages, site-standard colours.
* `CategoryPage.jsx`: a hidden category shows "not available right now".
* `themeConfig.js`: exports `BUILT_IN_CATEGORY_KEYS`.

## Dashboard
* `pages/CategoriesPage.jsx` (rewritten), `SubcategoryManager.jsx`, `StructureSetup.jsx`, `menuStructure.js` (all writes), `lib/menuStructure.js` (pure tree logic), `pages/MenuPage.jsx` (subcategory picker/filter/manager), `menuSync.js` (two small edits), `admin.css` (appended).

## Decisions / limits (please read)
* **Built-in categories (Chai, Tiffins, Restaurant Food, Mandi, Shawarma, Bakery, Party Orders) cannot be deleted**, only hidden: each has its own page and colour palette in the code. Categories created in the dashboard can be deleted.
* New categories use the site's standard colours (palettes are Phase 1/2 design work).
* The sentence "Six experiences. One destination." on Explore / Dine In is a Phase 2 editable text and does not count categories by itself.
* Restoring a backup made before 0014 restores item names/prices/paths but not their subcategory link (backup SQL was not modified).
* Reordering uses up/down buttons, not drag and drop.

## Not touched
Phase 1/2 work, Take Away slides, backup SQL, hours, reviews, gallery, auth/2FA, RLS of existing tables.
