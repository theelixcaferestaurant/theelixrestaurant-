// THE ELIX: menu data.
// Entered exactly as supplied by the restaurant: names, spelling, order, duplicates and
// price formats (half/full, MRP, platter prices) are preserved. Nothing is auto-corrected,
// merged, reordered or invented. Prices are shown as supplied. Whether each supplied price is the
// Dine In or the Take Away price has not been confirmed by the restaurant yet.

import { THEMES } from '../themes/themeConfig';

// Prices are stored as written. Numbers get the rupee sign. 'MRP' and half/full strings are kept as written.
const money = (value) => (value === 'MRP' ? 'MRP' : `₹${value}`);

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Every item gets a unique id, which is also the photo file name (e.g. hot-garlic-mutton-2.jpg).
const usedIds = new Set();
const uniqueId = (name) => {
  const base = slugify(name);
  let id = base;
  let n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
};

// rows: [name, price, optionalDescription]. path: the menu headings this item sits under.
const makeItems = (category, rows, path = [], vegOf = () => null) =>
  rows.map(([name, price, desc = '']) => ({
    id: uniqueId(name),
    name,
    category,
    sub: path.length ? path[path.length - 1] : '',
    path,
    price: money(price),
    veg: vegOf(name),
    desc,
    featured: false,
    hot: false,
  }));

// ---------------------------------------------------------------------------------------------
// 1. CHAI & BEVERAGES (20 items, no subcategories supplied)
// ---------------------------------------------------------------------------------------------
const CHAI_ROWS = [
  ['Tea – Single', 20],
  ['Tea – Full', 30],
  ['Tea – Parcel', 35],
  ['Zafrani Tea', 40],
  ['Coffee', 40],
  ['Milk', 40],
  ['Blue Lagoon', 199],
  ['Kiwi Lemonade', 199],
  ['Peach Mojito', 199],
  ['Virgin Mojito', 199],
  ['Watermelon Mojito', 199],
  ['Blueberry Mojito', 219],
  ['Virgin Pina Colada', 219],
  ['Orange Twist Mojito', 239],
  ['Big Bull Mango Bellini', 239],
  ['Soft Drink', 'MRP'],
  ['Mineral Water', 'MRP'],
  ['Kurbani Ka Meetha', 110],
  ['Double Ka Meetha', 100],
  ['Apricot Delight', 150],
];

// ---------------------------------------------------------------------------------------------
// 2. SOUTH INDIAN TIFFINS (18 items)
// ---------------------------------------------------------------------------------------------
const TIFFIN_ROWS = [
  ['Idly', 60],
  ['Vada', 70],
  ['Mysore Bonda', 70],
  ['Poori', 80],
  ['Masala Dosa', 80],
  ['Onion Dosa', 60],
  ['Plain Dosa', 60],
  ['Upma Dosa', 70],
  ['Ragi Dosa', 70],
  ['Pesara Attu', 70],
  ['Uttapam', 70],
  ['Rava Dosa', 80],
  ['Idly Sambar', 70],
  ['Sambar Vada', 80],
  ['Upma', 50],
  ['Set Dosa', 100],
  ['70 MM Dosa', 100],
  ['MLA Dosa', 100],
];

// ---------------------------------------------------------------------------------------------
// 3. RESTAURANT FOOD
//    VEG > (A, B, C)   NON-VEG > Chicken / Mutton / Seafood / Mixed Non-Veg   EGG > A   COMMON
// ---------------------------------------------------------------------------------------------
const VEG_STARTERS = [
  ['Tomato Soup', 110],
  ['Cream of Veg. Soup', 110],
  ['Veg. Corn Soup', 110],
  ['Veg. Hot & Sour Soup', 110],
  ['Veg. Manchow Soup', 110],
  ['French Fries', 240],
  ['Veg. Manchuria', 260],
  ['Chilli Veg', 260],
  ['Green Peas Fry', 220],
  ['Sezwan Veg', 280],
  ['Ginger Vegetable', 260],
  ['Veg 65', 280],
  ['Aloo 65', 240],
  ['Gobi 65', 240],
  ['Gobi Manchurian', 260],
  ['Gobi Chilli', 260],
  ['Chilli Paneer', 260],
  ['Hot Garlic Paneer', 300],
  ['Paneer Manchuria', 300],
  ['Paneer 65', 300],
  ['Paneer Majestic', 300],
  ['Ginger Paneer', 300],
  ['Mushroom Manchuria', 300],
  ['Mushroom Chilli', 300],
  ['Mushroom 65', 300],
  ['Pepper Mushroom', 310],
  ['Babycorn Manchuria', 280],
  ['Babycorn Chilli', 280],
  ['Babycorn 65', 280],
  ['Babycorn Majestic', 280],
  ['Crispy Corn', 280],
  ['Paneer Tikka', 340],
  ['Paneer Hariyali Tikka', 340],
  ['Paneer Sarson Tikka', 340],
  ['Paneer Jafrani Tikka', 340],
];

const VEG_MAIN = [
  ['Dal Fry', 200],
  ['Dal Tomato', 200],
  ['Dal Moghalai', 200],
  ['Dal Alu', 200],
  ['Dal Palak', 200],
  ['Aloo Gobi', 260],
  ['Aloo Butter', 260],
  ['Aloo Palak', 260],
  ['Gobi Masala', 260],
  ['Green Peas Masala', 260],
  ['Zeera Aloo', 260],
  ['Mutter Gobi', 260],
  ['Mixed Veg. Curry', 260],
  ['Veg. Dahiwala', 260],
  ['Veg. Jaipuri', 260],
  ['Kadhai Veg.', 260],
  ['Malai Kofta', 290],
  ['Veg Kofta', 290],
  ['Mutter Paneer', 290],
  ['Palak Paneer', 290],
  ['Butter Paneer Masala', 290],
  ['Kadai Paneer', 290],
  ['Shahi Paneer', 290],
  ['Paneer Tikka Masala', 290],
  ['Kaju Paneer', 310],
  ['Kaju Masala', 310],
  ['The Elix. SPL. Veg.', 380],
];

const VEG_RICE = [
  ['Veg Biryani', 260],
  ['Paneer Biryani', 280],
  ['Mushroom Biryani', 260],
  ['Plain Rice', 100],
  ['Plain Fried Rice', 110],
  ['Zeera Fried Rice', 190],
  ['Curd Rice', 190],
  ['Schezwan Veg Fried Rice', 240],
  ['Veg Fried Rice', 200],
  ['Veg Pulao', 210],
  ['Paneer Fried Rice', 240],
  ['Peas Pulao', 210],
  ['Peas Fried Price', 210],
  ['Kashmiri Pulao', 210],
  ['Ghee Rice', 210],
  ['Veg Soft Noodles', 190],
  ['Schezwan Noodles', 240],
  ['Kaju Fried Rice', 250],
];

const CHICKEN_STARTERS = [
  ['Chicken Corn Soup', 140],
  ['Chicken Manchow Soup', 140],
  ['Chicken Hot N Sour Soup', 140],
  ['Chicken Manchurian Boneless', 370],
  ['Hot Garlic Chicken', 370],
  ['Chilly Chicken Boneless', 370],
  ['Chicken Roast', 370],
  ['Chicken 65 Boneless', 370],
  ['Garlic Chicken', 370],
  ['Ginger Chicken', 370],
  ['Pepper Chicken', 370],
  ['Chicken Drum Stick', 390],
  ['Chicken Lolli Pop', 390],
  ['Onion Chicken', 390],
  ['Fried Chicken', 390],
  ['Chicken Majestic', 390],
  ['Chicken 555', 390],
  ['Dragon Chicken', 390],
  ['Chicken Tikka', 380],
  ['Reshmi Kabab', 380],
  ['Malai Kabab', 380],
  ['Irani Kabab', 380],
  ['Kalmi Kabab', 380],
  ['Hariyali Kabab', 380],
  ['Lemon Tikka', 380],
  ['Jafrani Kabab', 380],
  ['Navabi Kabab', 380],
  ['Tangi Kabab Half/ Full', '200/380'],
  ['Tandoori Chicken Half/ Full', '270/550'],
  ['Grill Chicken Half / full', '280/550'],
];

const CHICKEN_MAIN = [
  ['Chicken Curry', 380],
  ['Chicken Masala', 390],
  ['Kadai Chicken', 390],
  ['Chicken Tikka Masala', 390],
  ['Butter Chicken', 390],
  ['Chicken Mogalai', 390],
  ['Chicken Dahiwala', 390],
  ['Punjabi Chicken', 390],
  ['Chicken Kolhapuri', 390],
  ['Chicken Chatpat', 390],
  ['Chicken Peswari', 390],
  ['Chicken Bharta', 390],
  ['Chicken Kassa', 390],
  ['Chicken Do Pyaza', 390],
  ['Methi Chicken', 390],
  ['Andhra Chicken', 390],
  ['Tangdi Masala', 390],
];

const CHICKEN_RICE = [
  ['Mini Chicken Biryani', 190],
  ['Full Chicken Biryani', 360],
  ['Elix. Spl. Biryani', 450],
  ['Chicken Family Pack', 700],
  ['Chicken Jumbo Pack', 950],
  ['Boneless Chicken Biryani', 450],
  ['Chicken 65 Boneless Biryani', 450],
  ['Chicken Lollipop Biryani', 420],
  ['Chicken Fry Piece Biryani', 420],
  ['Gongura Chicken Biryani', 450],
  ['Tandoori Chicken Biryani', 450],
  ['Tangdi Kabab Biryani', 450],
  ['Chicken Fried Rice', 290],
  ['Schezwan Chicken Fried Rice', 320],
  ['Chicken Soft Noodles', 240],
];

const MUTTON_STARTERS = [
  ['Mutton Manchurian', 550],
  ['Mutton 65', 550],
  ['Hot Garlic Mutton', 550],
  ['Ginger Mutton', 550],
  ['Mutton Bowl', 550],
  ['Mutton Bhuna', 550],
  ['Hot Garlic Mutton', 550], // intentional repeat as supplied
  ['Ginger Mutton', 550], // intentional repeat as supplied
  ['Chilli Mutton', 550],
  ['Mutton Roast', 550],
  ['Mutton Sheekh Kabab', 510],
  ['Mutton Shami Kabab', 510],
];

const MUTTON_MAIN = [
  ['Mutton Masala', 460],
  ['Dum Ka Mutton', 460],
  ['Mutton Kassa', 460],
  ['Hara Daniya Mutton', 460],
  ['Kadai Mutton', 460],
  ['Mutton Ashiyana', 460],
  ['Mutton Do Pyaza', 460],
  ['Mutton Khandari', 460],
  ['Mutton Korma', 460],
  ['Mutton Moghlai', 460],
  ['Mutton Shahi Korma', 460],
  ['Hyderabadi Mutton', 460],
  ['Mutton Sagawa', 460],
  ['Kheema Curry', 460],
  ['Kheema Masala', 460],
  ['Mutton Rogan Josh', 480],
];

const MUTTON_RICE = [
  ['Mini Mutton Biryani', 280],
  ['Full Mutton Biryani', 480],
  ['Mutton Family Pack', 950],
  ['Mutton Jumbo Pack', 1400],
  ['Elix. Spl. Mutton Biryani', 550],
  ['Mutton Bouble Ghose', 750],
  ['Gongura Mutton Biryani', 520],
  ['Mutton Khima Biryani', 550],
  ['Mutton Fried Rice', 320],
];

const SEA_STARTERS = [
  ['Chilly Prawn', 450],
  ['Garlic Prawn', 450],
  ['Prawn Manchurian', 450],
  ['Pepper Prawn', 450],
  ['Fried Prawn', 450],
  ['Loose Prawn', 450],
  ['Ginger Prawn', 450],
  ['Apollo Fish', 450],
  ['Chilly Fish', 450],
  ['Fish Manchurian', 450],
  ['Hot Garlic Fish', 450],
  ['Fried Fish', 450],
  ['Finger Fish', 450],
  ['Ginger Fish', 450],
  ['Pepper Fish', 450],
  ['Golden Fish', 450],
  ['Fish Tikka', 490],
  ['Fish Ajwani Tikka', 490],
  ['Tandoori Prawns', 490],
];

const SEA_MAIN = [
  ['Prawn Curry', 450],
  ['Fish Masala', 450],
];

const SEA_RICE = [
  ['Fish Biryani', 490],
  ['Prawns Biryani', 490],
  ['Prawns Fried Rice', 310],
  ['Prawns Soft Noodles', 260],
];

const SEA_PLATTER = [
  [
    'SPL FISH PLATTERS (4 Persons)',
    '2,200',
    'Components: Fish Tikka, Fish Ajwain Tikka, Jafrani Fish Tikka',
  ],
];

const MIXED_PLATTERS = [
  ['ELIX. SPL. Platter (4 Persons)', '1,560', 'Components: 4 Chicken Kabab, 1 Mutton Kabab, 2 Seafood'],
  ['ELIX. SPL. Platter (6 Persons)', '2,420', 'Components: 4 Chicken Kabab, 1 Mutton Kabab, 3 Seafood'],
];

const MIXED_RICE = [
  ['Mix Fried Rice', 310],
  ['Mix Soft Noodles', 290],
];

const EGG_ITEMS = [
  ['Egg Masala', 200],
  ['Egg Curry', 180],
  ['Egg Burgi', 190],
  ['Egg 65', 190],
  ['Egg Manchuria', 190],
  ['Egg Chilly', 190],
  ['Egg Omlet', 70],
  ['Boiled Egg', 15],
  ['Egg Biryani', 260],
  ['Egg Fried Rice', 210],
  ['Egg Soft Noodles', 190],
];

const COMMON_ITEMS = [
  ['Green Salad', 100],
  ['Onion Salad', 50],
  ['Cucumber Salad', 80],
  ['Roasted Papad', 50],
  ['Fry Papad', 50],
  ['Masala Papad', 90],
  ['Roasted Masala Papad', 80],
  ['Onion Raitha', 120],
  ['Mix Raitha', 130],
  ['Boondi Raitha', 120],
  ['Rumali Roti', 25],
  ['Tandoori Roti', 25],
  ['Tandoori Butter Roti', 35],
  ['Plain Naan', 35],
  ['Butter Naan', 45],
  ['Garlic Naan', 60],
  ['Kothmir Naan', 60],
  ['Lacha Paratha', 60],
  ['Pudina Paratha', 60],
  ['Plain Kulcha', 50],
  ['Masala Kulcha', 65],
  ['Alu Paratha', 65],
  ['Paneer Paratha', 60],
  ['Chicken Kheema Paratha', 80],
  ['Mutton Kheema Paratha', 120],
];

// ---------------------------------------------------------------------------------------------
// 5. SHAWARMA (6 items)
// ---------------------------------------------------------------------------------------------
const SHAWARMA_ROWS = [
  ['Chicken Shawarma with Salad', 120],
  ['Special Chicken Shawarma', 150],
  ['Chicken 65 Shawarma', 150],
  ['Veg Shawarma', 120],
  ['Paneer Shawarma', 120],
  ['Mushroom Shawarma', 120],
];

// Vegetarian markers: restaurant food uses the supplied VEG / NON-VEG grouping.
// Shawarma is marked by name (chicken = non-veg, everything else = veg).
const chickenOrVeg = (name) => !/chicken/i.test(name);

const CHAI = makeItems('chai', CHAI_ROWS);
const TIFFINS = makeItems('tiffins', TIFFIN_ROWS);

const FOOD = [
  ...makeItems('food', VEG_STARTERS, ['VEG', 'Veg Soups & Starters (Including Kebabs & Tandoori)'], () => true),
  ...makeItems('food', VEG_MAIN, ['VEG', 'Veg Indian Main Course'], () => true),
  ...makeItems('food', VEG_RICE, ['VEG', 'Veg Biryani, Rice & Noodles'], () => true),

  ...makeItems('food', CHICKEN_STARTERS, ['NON-VEG', 'Chicken', 'Chicken Soups & Starters (Including Kebabs & Tandoori)'], () => false),
  ...makeItems('food', CHICKEN_MAIN, ['NON-VEG', 'Chicken', 'Chicken Main Course'], () => false),
  ...makeItems('food', CHICKEN_RICE, ['NON-VEG', 'Chicken', 'Chicken Biryani, Rice & Noodles'], () => false),

  ...makeItems('food', MUTTON_STARTERS, ['NON-VEG', 'Mutton', 'Mutton Soups & Starters'], () => false),
  ...makeItems('food', MUTTON_MAIN, ['NON-VEG', 'Mutton', 'Mutton Main Course'], () => false),
  ...makeItems('food', MUTTON_RICE, ['NON-VEG', 'Mutton', 'Mutton Biryani & Rice'], () => false),

  ...makeItems('food', SEA_STARTERS, ['NON-VEG', 'Seafood', 'Sea Starters & Tandoori'], () => false),
  ...makeItems('food', SEA_MAIN, ['NON-VEG', 'Seafood', 'Seafood Main Course'], () => false),
  ...makeItems('food', SEA_RICE, ['NON-VEG', 'Seafood', 'Seafood Biryani, Rice & Noodles'], () => false),
  ...makeItems('food', SEA_PLATTER, ['NON-VEG', 'Seafood', 'Seafood Platters'], () => false),

  ...makeItems('food', MIXED_PLATTERS, ['NON-VEG', 'Mixed Non-Veg', 'Mixed Non-Veg Platters'], () => false),
  ...makeItems('food', MIXED_RICE, ['NON-VEG', 'Mixed Non-Veg', 'Mixed Non-Veg Rice & Noodles'], () => false),

  ...makeItems('food', EGG_ITEMS, ['EGG', 'Egg Items'], () => null),
  ...makeItems('food', COMMON_ITEMS, ['COMMON'], () => null),
];

const SHAWARMA = makeItems('shawarma', SHAWARMA_ROWS, [], chickenOrVeg);

// PARTY ORDERS (Take Away). Two member-count sections under one heading, five items each, as supplied.
// Ids carry the section (party-30-..., party-40-...) so each row has its own photo key.
const PARTY_HEADING = 'FOR SMALL PARTIES & GET TOGETHERS';
const PARTY_30_ROWS = [
  ['Veg Handi Biryani', '4,000'],
  ['Chicken Handi Biryani', '5,400'],
  ['Mutton Handi Biryani', '7,500'],
  ['1Kg Chicken Piece Extra', '350'],
  ['1Kg Mutton Piece Extra', '1,000'],
];
const PARTY_40_ROWS = [
  ['Veg Handi Biryani', '5,000'],
  ['Chicken Handi Biryani', '7,200'],
  ['Mutton Handi Biryani', '9,900'],
  ['1Kg Chicken Piece Extra', '350'],
  ['1Kg Mutton Piece Extra', '1,000'],
];
const makePartyItems = (prefix, rows, members) => {
  const path = [PARTY_HEADING, `Approximately ${members} Members`];
  return rows.map(([name, price]) => ({
    id: `${prefix}-${slugify(name)}`,
    name,
    category: 'party',
    sub: path[path.length - 1],
    path,
    price: money(price),
    veg: null,
    desc: '',
    featured: false,
    hot: false,
  }));
};
const PARTY = [...makePartyItems('party-30', PARTY_30_ROWS, 30), ...makePartyItems('party-40', PARTY_40_ROWS, 40)];

// The Mandi menu has not been supplied yet. Its list stays empty on purpose.
const MANDI = [];

// Bakery: 28 items, a flat list like Chai (no subcategories supplied).
const BAKERY_ROWS = [
  ['Yizwan Biscuits', 10],
  ['Ghee Biscuits', 10],
  ['Black & White', 15],
  ['Fine Biscuits', 20],
  ['Methi Biscuits', 15],
  ['Pista Badam', 15],
  ['Coconut Biscuits (Small)', 15],
  ['Fruit Biscuits', 15],
  ['Choco Vanilla Biscuits', 15],
  ['Coconut Pista', 15],
  ['Osmani Biscuits', 10],
  ['Moon Biscuits', 10],
  ['Coconut (Big)', 30],
  ['Badam Biscuits', 15],
  ['Jemes Cake', 25],
  ['Paneer Puff', 20],
  ['Veg Puff', 20],
  ['Cream Roll', 20],
  ['Fruit Roll', 20],
  ['Veg Roll', 20],
  ['Paneer Burger', 60],
  ['Chicken Burger', 60],
  ['Chicken Roll', 70],
  ['Chicken Puff', 25],
  ['Chicken Hotdog', 75],
  ['Dil Pasand (Small)', 20],
  ['Dilkhush', 20],
  ['Dil Pasand (Big)', 30],
];
const BAKERY = makeItems('bakery', BAKERY_ROWS);

export const MENU = [...CHAI, ...TIFFINS, ...FOOD, ...MANDI, ...SHAWARMA, ...BAKERY, ...PARTY];

// An untouched copy of the built-in menu, taken before the live content layer (src/lib/content.js) replaces the
// items of MENU with the database rows. The dashboard uses it only to copy the built-in menu into the database
// (Menu management > Sync). It is never shown on the website and is never edited.
export const BUILT_IN_MENU = Object.freeze(MENU.map((item) => Object.freeze({ ...item, path: Object.freeze([...(item.path || [])]) })));

// Subcategory labels per category. Restaurant Food uses its four main groups. The others have none.
export const SUBCATEGORIES = {
  chai: [],
  tiffins: [],
  food: ['VEG', 'NON-VEG', 'EGG', 'COMMON'],
  mandi: [],
  shawarma: [],
  bakery: [],
  party: [],
};

export const getItemsByCategory = (category) => MENU.filter((item) => item.category === category);
export const getItemById = (id) => MENU.find((item) => item.id === id);

// Frontend-only search. Ranks name matches first, then subcategory matches.
// Description matches are used only when nothing else matches.
export function searchMenu(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = MENU.map((item) => {
    const name = item.name.toLowerCase();
    const sub = item.sub.toLowerCase();
    let score = 0;
    if (name.startsWith(q)) score = 4;
    else if (name.split(/\s+/).some((word) => word.startsWith(q))) score = 3;
    else if (name.includes(q)) score = 2.5;
    else if (sub && (sub.includes(q) || q.includes(sub))) score = 2;
    return { item, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  if (scored.length > 0) return scored.map((entry) => entry.item);

  return MENU.filter(
    (item) => item.desc.toLowerCase().includes(q) || THEMES[item.category].label.toLowerCase().includes(q)
  );
}

export const SEARCH_SUGGESTIONS = ['Biryani', 'Chicken', 'Dosa', 'Shawarma', 'Chai', 'Mutton'];
