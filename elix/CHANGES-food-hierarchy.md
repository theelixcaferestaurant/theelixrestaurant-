# THE ELIX: Restaurant Food hierarchy (drill-down)

## Customer journey
Opening video → Explore Menu → DINE IN (or TAKE AWAY, unchanged) → Restaurant Food →
one step at a time:

1. Restaurant Food (/food): four cards, VEG, NON-VEG, EGG, COMMON (each in its own colour).
2. VEG (/food/veg): three subcategory cards. Each opens its items.
3. NON-VEG (/food/non-veg): four cards, CHICKEN, MUTTON, SEAFOOD, MIXED NON-VEG.
   - CHICKEN (/food/non-veg/chicken): three subcategory cards.
   - MUTTON (/food/non-veg/mutton): three subcategories, opening items directly.
   - SEAFOOD (/food/non-veg/seafood): four subcategories, opening items directly.
   - MIXED NON-VEG (/food/non-veg/mixed-non-veg): two subcategories, opening items directly.
4. EGG (/food/egg): the Egg Items list, shown directly (EGG has a single section).
5. COMMON (/food/common): the COMMON items, shown directly.

Each subcategory page shows its existing individual items with the same compact rows,
pictures, names and prices, and the same item detail window as before.

## What changed
- src/pages/Food.jsx: rewritten as a step-by-step drill-down. Previously every group was
  shown on one long page. Routes now take any depth beneath /food.
- src/App.jsx: /food is now /food/* so the nested pages resolve.
- src/components/CategoryPage.jsx: buildTree is exported, and an optional `menu` prop lets
  the Restaurant Food top page show its four group cards inside the existing hero layout.
- src/components/Navbar.jsx: "Explore Menu" stays highlighted on the nested food pages.
- src/styles/pages.css: appended styles so each group card uses its group colours
  (data-group) from themes.css.
- Each page's Back link returns to the step above it.

## Unchanged
Menu items, prices, spelling and order (src/data/menuData.js), the group colour palettes
(src/styles/themes.css), the item cards and detail window, the opening video, the six Dine In
categories, the Take Away pages, the admin dashboard and the Supabase setup.

## Checks run
- All Restaurant Food pages render for every route tested (top, each group, each subcategory,
  EGG, COMMON, and an unknown address shows "Menu not found").
- All 244 Restaurant Food items are reachable through the navigation (none lost).
- Each group card and page uses its own data-group palette.

## Still missing from the supplied brief (not invented)
Mandi and Bakery menus, Party Orders prices, Take Away Menu pictures, and food photographs.
