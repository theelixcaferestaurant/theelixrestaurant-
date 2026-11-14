// Theme metadata and category copy. Colour palettes live in src/themes/palettes.js (the single
// source of truth) and are compiled into src/styles/themes.generated.css as [data-theme="..."] blocks.

export const DEFAULT_THEME = 'home';

export const THEMES = {
  home: { label: 'The Elix', path: '/' },
  chai: {
    label: 'Chai & Beverages',
    code: 'CHAI',
    letter: 'A',
    path: '/chai',
    heading: 'A Perfect Cup of Happiness.',
    intro: 'Discover comforting teas, refreshing beverages and carefully crafted drinks.',
    short: 'Comforting teas, coffees and chilled drinks in a warm, golden lounge.',
  },
  tiffins: {
    label: 'South Indian Tiffins',
    code: 'TIFFINS',
    letter: 'C',
    path: '/tiffins',
    heading: 'Freshness in Every Bite.',
    intro: 'Experience the comfort and flavour of traditional South Indian breakfast.',
    short: 'Idli, dosa, vada and breakfast favourites, fresh and natural.',
  },
  bakery: {
    label: 'Bakery',
    code: 'BAKERY',
    letter: 'D',
    path: '/bakery',
    heading: 'A Little Sweetness in Every Moment.',
    intro: 'Explore freshly presented pastries, cakes, desserts and bakery favourites.',
    short: 'Cakes, pastries, brownies and desserts, elegantly presented.',
  },
  food: {
    label: 'Restaurant Food',
    code: 'FOOD',
    letter: 'B',
    path: '/food',
    heading: 'Discover the Art of Flavour.',
    intro: 'Explore rich flavours, carefully presented dishes and memorable restaurant favourites.',
    short: 'Vegetarian, non-vegetarian, egg and common dishes, rich with flavour.',
  },
  mandi: {
    label: 'Mandi',
    code: 'MANDI',
    letter: 'E',
    path: '/mandi',
    heading: 'The Mandi Table.',
    intro: 'Our mandi menu will be presented here.',
    short: 'Premium mandi, served in a charcoal and desert-sand setting.',
  },
  party: {
    label: 'Party Orders',
    code: 'PARTY ORDERS',
    letter: '',
    path: '/explore/take/party',
    heading: 'Party Orders',
    intro: 'Handi biryani packages for small parties and get-togethers, by number of members.',
    short: 'Handi biryani packages for small parties and get-togethers.',
  },
  shawarma: {
    label: 'Shawarma',
    code: 'SHAWARMA',
    letter: 'F',
    path: '/shawarma',
    heading: 'Fresh, Modern Shawarma.',
    intro: 'Chicken, veg, paneer and mushroom shawarma, freshly wrapped.',
    short: 'Chicken, paneer, mushroom and veg shawarma, fresh and modern.',
  },
};

// The categories that have their own page and palette in the code. Anything else in the categories table was created
// in the dashboard (Phase 3) and is added to THEMES at run time by src/lib/content.js (page address /menu/<key>).
// Taken here, before any live content is applied, so it always lists only the built-in ones.
export const BUILT_IN_CATEGORY_KEYS = Object.freeze(Object.keys(THEMES).filter((key) => key !== 'home'));

// Party Orders sits under Take Away and is not in this list, so it is not shown on Home, Explore or Footer.
// Display order used on the Explore page and Home page, matching the supplied menu numbering:
// 1 Chai & Beverages, 2 South Indian Tiffins, 3 Restaurant Food, 4 Mandi, 5 Shawarma, 6 Bakery.
// (This array and CATEGORY_PATHS are updated in place by src/lib/content.js when the dashboard reorders, hides or adds categories.)
export const CATEGORY_ORDER = ['chai', 'tiffins', 'food', 'mandi', 'shawarma', 'bakery'];

export const CATEGORY_PATHS = CATEGORY_ORDER.map((key) => THEMES[key].path);
