# Live menu + Take Away slide management (migration 0010)

## What changed
* `supabase/migrations/0010_menu_and_takeaway_management.sql` (also appended to `ALL-IN-ONE-SETUP.sql`)
  - copies all 327 built-in menu items into `menu_items` (names, prices, descriptions, order and nested headings exactly as supplied)
  - new columns `menu_items.price_text` (price exactly as shown: `₹200/380`, `₹2,200`, `MRP`) and `menu_items.path` (nested headings)
  - allows the `shawarma`, `mandi` and `party` categories the website already uses
  - new table `takeaway_slides` (the original 9 pages copied in), admin-only writes, public reads published slides only
  - the 32 placeholder sample dishes from 0002 are hidden (never shown publicly)
* Website: `src/lib/content.js` now shows the database menu once the migration has run (`site_settings.menu_source = database`);
  until then it behaves exactly as before. `src/lib/takeaway.js` + a small change in `TakeAwayMenuViewer.jsx` feed the viewer from the database
  (falls back to the original 9 pages if the table is missing). Viewer animations, gestures and layout are unchanged.
* Dashboard: Menu management (every item, all categories: name, price, description, photo, video, category, section, disable/enable,
  temporarily unavailable, add, delete, reorder inside a section) and new page **Take Away slides**
  (replace image, add, delete, rename, reorder, publish/draft, preview in the real viewer).
