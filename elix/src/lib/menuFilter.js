// Search helpers shared by every menu page. Everything runs in the browser on the items already on the page.

// Lower-cases, drops accents and punctuation: "Tea – Single" and "tea single" are the same text.
// "Non-Veg" / "non veg" become one word, so searching "veg" never lists non-vegetarian dishes.
export const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/non[^a-z0-9]*veg/g, 'nonveg')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Everything a customer might type to find an item: its name, description, section headings and price.
const haystack = (item) => normalize([item.name, item.desc, item.sub, ...(item.path || []), item.price].join(' '));

// Items matching every word of the query, where each typed word may be the start of a word in the item
// ("chicken biryani" and "chick bir" both find "Chicken Dum Biryani"). An empty query returns the list unchanged.
export function filterItems(items, query) {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (terms.length === 0) return items;
  return items.filter((item) => {
    const words = haystack(item).split(' ');
    return terms.every((term) => words.some((word) => word.startsWith(term)));
  });
}

// All items at or below a node of the menu tree built by buildTree().
export function collectItems(node) {
  if (!node) return [];
  const out = [...node.items];
  node.children.forEach((child) => out.push(...collectItems(child)));
  return out;
}
