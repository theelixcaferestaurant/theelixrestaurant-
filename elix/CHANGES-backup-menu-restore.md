# Public menu restored to the backup (frontend only)

## What was wrong
- The live content loader (src/lib/content.js) replaced the built-in menu with the rows in the Supabase
  `menu_items` table. That table holds 40 sample rows (migration 0002), so the public site showed 50 items
  instead of the 327 items in the supplied menu.
- The same loader replaced the Restaurant Food subcategories with sample ones (Biryani, Chinese, Tea, Coffee...).
  Restaurant Food was no longer VEG / NON-VEG / EGG / COMMON.
- Database rows have no `path` field, so the category page's tree builder (CategoryPage.jsx) threw
  `TypeError: Cannot read properties of undefined (reading 'forEach')` on the first database item.
- Database prices differed from the supplied prices (for example Plain Dosa ₹65 in the database, ₹60 in the menu).

## What changed
- src/lib/content.js
  - The built-in menu (src/data/menuData.js, from the backup) is the public menu: names, prices, descriptions,
    order and nested headings are used exactly as supplied.
  - From Supabase, built-in items take only live status: temporarily unavailable, and scheduled hours.
  - Items added in the dashboard (ids not in the built-in menu) are added under their sub-heading.
  - The 32 sample items from migration 0002 are kept off the public site (SAMPLE_ITEM_IDS).
  - Subcategories are no longer taken from the database; they come from the built-in menu only.
  - Category labels, headings and intro text still come from the database, as before.
- src/components/CategoryPage.jsx: buildTree tolerates an item without a path.

## Not changed
Supabase client and configuration, schema, RLS policies, migrations, authentication, admin login,
two-step verification, admin dashboard, Storage and backend services.

## Known limits
- Dashboard edits to names, prices or descriptions of built-in items do not change the public site.
- Hiding a built-in item from the dashboard does not hide it publicly: the public read policy returns only
  available rows, so the site cannot tell a hidden item from one that was never added. Changing that policy
  would be a database change and was not made.
