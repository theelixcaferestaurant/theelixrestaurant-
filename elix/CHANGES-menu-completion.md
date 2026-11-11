# THE ELIX: menu completion changes

## What was changed
- Six main categories: 1 Chai & Beverages, 2 South Indian Tiffins, 3 Restaurant Food, 4 Mandi, 5 Shawarma, 6 Bakery.
- Explore Menu lists all six. Each category has a DINE IN | TAKE AWAY switch.
- TAKE AWAY shows exactly two options: TAKE AWAY MENU (original picture viewer) and PARTY ORDERS.
- Restaurant Food shows VEG, NON-VEG, EGG and COMMON, with the nested sections as supplied.
- Each menu item has the same compact row: small square picture space on the left, name and price on the right.
- Colour themes updated to the supplied palettes for all six categories and the Restaurant Food sub-sections.
- Menu data in src/data/menuData.js is the supplied menu, entered as written (288 items).
  Duplicates kept: Hot Garlic Mutton and Ginger Mutton appear twice in Mutton Soups & Starters.
  Spelling kept: Fish Ajwani Tikka (Sea Starters) and Fish Ajwain Tikka (platter).
  Half/full and MRP prices kept as written.

## Still missing from the supplied brief (not invented)
- Mandi menu: category shown, no dishes or prices.
- Bakery menu: category shown, no products or prices.
- Party Orders package names and prices: shown as a placeholder.
- Take Away Menu pictures for all six categories: placeholders listed in public/takeaway/README.txt.
- Food photographs: none in the ZIP. Every item shows a neutral labelled placeholder in its picture space.
- Dine In and Take Away price split: each supplied price is shown as the Dine In price. The restaurant has
  not confirmed which mode each price belongs to.

## Notes for the owner
- The Supabase database still holds the earlier demo items. When the site is connected to Supabase, those
  database items override src/data/menuData.js. Re-seed or clear the menu table before going live.
- Chicken, mutton and seafood accent colours (plum, brown, ocean blue) are not applied yet.
- The earlier featured dish blocks and the Tiffins breakfast mosaic were removed, because the supplied
  menu does not name featured dishes.

## Photo option in empty picture spaces
- Every menu item's square picture space now shows an "Add photo" button, always visible, on its placeholder.
- Photos are saved in that browser. They become public only when the owner is signed in to /admin and Supabase is connected.
- The floating "Show add-photo buttons" switch still works for the other picture slots.
