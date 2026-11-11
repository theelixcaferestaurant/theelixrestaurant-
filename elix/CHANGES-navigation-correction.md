# THE ELIX: navigation correction

## Customer journey
Opening video, then Explore Menu, which shows two main options: DINE IN and TAKE AWAY.
- DINE IN (/explore/dine): the six categories in order: Chai & Beverages, South Indian Tiffins,
  Restaurant Food, Mandi, Shawarma, Bakery. Each card opens its category page, which shows its
  subcategories, sub-subcategories and menu items directly.
- TAKE AWAY (/explore/take): two options, Take Away Menu (/explore/take/menu) and Party Orders
  (/explore/take/party). Each page shows the six categories in the same order.

## What changed
- src/pages/Explore.jsx: shows only two cards, DINE IN and TAKE AWAY. The toggle buttons and the
  category grid were removed from this page.
- src/pages/DineIn.jsx (new): the six existing category cards.
- src/pages/TakeAway.jsx (new): the two take-away cards, plus the Take Away Menu and Party Orders
  pages (TakeAwayPage) that use the existing TakeAwayPanel.
- src/App.jsx: routes for /explore/dine, /explore/take, /explore/take/menu and /explore/take/party.
- src/components/Navbar.jsx: "Explore Menu" stays highlighted on every /explore page.
- src/styles/pages.css: styles for the two-card choice (.choice-grid, .choice-card) and .back-link.
- DINE IN / TAKE AWAY buttons are not shown on category pages, nested menu pages or the take-away
  pages. Category pages (src/components/CategoryPage.jsx) render only their menu.

## Unchanged
Opening video, menu data and prices, item cards and modals, category themes and colours, images,
layouts, animations, admin dashboard, Supabase setup and the rest of the site.

## Still missing from the supplied brief (not invented)
Take Away Menu pictures, Party Orders prices, Mandi and Bakery menus, and food photographs.
