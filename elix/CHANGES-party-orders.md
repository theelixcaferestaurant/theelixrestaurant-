# Party Orders: individual item rows and Orchid & Slate theme

## What changed
- Party Orders is now its own category-style page (`/explore/take/party`), built with the same
  `CategoryPage` as the other menu pages. The old six-block placeholder is removed.
- Two sections under one heading, "FOR SMALL PARTIES & GET TOGETHERS":
  - Approximately 30 Members: 5 items
  - Approximately 40 Members: 5 items
- Each item is an individual row using the existing Beverage menu row (`FoodCard variant="row"`):
  88px image on the left, name, dotted leader, price badge on the far right, thin divider below.
  No new card design, and no change to row, image, font or price badge dimensions.
- Prices are as supplied (for example ₹4,000, ₹350, ₹1,000).

## Theme
- New palette `party` ("Orchid & Slate") in `src/themes/palettes.js`, with the approved values.
- Two extra palette fields, used only where given: `heading` (heading colour) and `hover`
  (row hover tint). Other themes do not emit them, so their colours are unchanged.
- `src/styles/themes.generated.css` regenerated with `npm run themes:build`.

## Files
- `src/themes/palettes.js`, `src/styles/themes.generated.css`: Orchid & Slate palette.
- `src/themes/themeConfig.js`: `party` theme (not listed on Home, Explore or Footer).
- `src/data/menuData.js`: ten Party Orders items, ids `party-30-…` and `party-40-…`.
- `src/data/takeawayMenus.js`: placeholder party list removed.
- `src/pages/PartyOrders.jsx` (new): Party Orders page.
- `src/pages/TakeAway.jsx`, `src/components/TakeAwayPanel.jsx`: Take Away Menu only.
- `src/App.jsx`: party route points to the new page.
- `src/components/CategoryPage.jsx`: eyebrow shows no stray dash when a theme has no letter.
- `src/styles/components.css`: row hover uses `--row-hover`; party headings use `--heading`.
- `src/lib/content.js`: Party Orders rows are kept when the live menu loads from the database.

## Photos
Party item photos use the usual item-id names, for example `party-30-veg-handi-biryani.jpg`
in `src/assets/images/`. Until a photo is added, the standard demo image panel is shown.
