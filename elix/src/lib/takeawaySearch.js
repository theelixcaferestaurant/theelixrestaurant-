import { MENU } from '../data/menuData';
import { THEMES } from '../themes/themeConfig';
import { filterItems, normalize } from './menuFilter';

// Search for the Take Away menu book. The menu pages are pictures, so the search works on what is known about
// each page: its title, and the dishes of the menu that belong to that page's section (for example the chicken
// dishes belong to "Restaurant Food – Chicken"). Each result opens the matching page.

// Words that appear in many page titles and say nothing about which section a page is.
const GENERIC = new Set(['restaurant', 'food', 'and', 'the', 'menu', 'non', 'nonveg', 'of', 'in', 'a']);

// Words of a text ("Non-Veg" is already one word after normalize(), so it is never mistaken for "Veg").
const tokens = (text) => normalize(text).split(' ').filter(Boolean);

const pageKeywords = (page) => tokens(page.title).filter((word) => !GENERIC.has(word));

const itemTokens = (item) => new Set(tokens([THEMES[item.category]?.label, item.sub, ...(item.path || [])].join(' ')));

// The page indexes whose section an item belongs to.
export function pagesForItem(item, keywordsByPage) {
  const own = itemTokens(item);
  const hits = [];
  keywordsByPage.forEach((words, index) => {
    if (words.length > 0 && words.some((word) => own.has(word))) hits.push(index);
  });
  return hits;
}

// Returns [{ index, page, dishes }] in page order. `dishes` lists up to three matching dish names for that page.
export function searchTakeawayPages(pages, query, items = MENU) {
  const terms = normalize(query);
  if (!terms) return [];

  const keywordsByPage = pages.map(pageKeywords);
  const found = new Map(); // page index -> dish names

  // 1. Pages whose own title matches every word of the query.
  const words = terms.split(' ');
  pages.forEach((page, index) => {
    const titleWords = tokens(page.title);
    if (words.every((word) => titleWords.some((t) => t.startsWith(word)))) found.set(index, []);
  });

  // 2. Pages holding a dish that matches the query.
  filterItems(items, query).forEach((item) => {
    pagesForItem(item, keywordsByPage).forEach((index) => {
      const names = found.get(index) || [];
      if (!names.includes(item.name)) names.push(item.name);
      found.set(index, names);
    });
  });

  return [...found.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, names]) => ({ index, page: pages[index], dishes: names.slice(0, 3), more: Math.max(names.length - 3, 0) }));
}
