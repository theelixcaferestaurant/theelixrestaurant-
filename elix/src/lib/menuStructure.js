// Subcategory tree helpers shared by the public website (src/lib/content.js) and the dashboard.
// Pure functions only: no Supabase, no React, so they can be tested on their own.
//
// A subcategory row: { id, category_key, parent_id, name, sort_order, enabled }
// An item row:       { id, category_key, subcategory_id, path (text[]), sub, sort_order, ... }

export const MAX_DEPTH = 6;
export const MAX_NAME = 120;

const byOrder = (a, b) =>
  (a.sort_order || 0) - (b.sort_order || 0) || String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id));

// Builds a lookup of the whole tree. Siblings are sorted by sort_order (then name), and every node knows its position.
export function buildIndex(rows) {
  const byId = new Map();
  (rows || []).forEach((row) => byId.set(row.id, { ...row, enabled: row.enabled !== false, rank: 0 }));
  const kids = new Map(); // `${category}|${parentId or ''}` -> sorted nodes
  byId.forEach((node) => {
    // a node whose parent is missing is treated as top level, so a broken link never hides its items
    const parent = node.parent_id && byId.has(node.parent_id) ? node.parent_id : '';
    const key = `${node.category_key}|${parent}`;
    if (!kids.has(key)) kids.set(key, []);
    kids.get(key).push(node);
  });
  kids.forEach((list) => {
    list.sort(byOrder);
    list.forEach((node, i) => {
      node.rank = i;
    });
  });
  return { byId, kids };
}

export const childrenOf = (index, categoryKey, parentId = null) => index.kids.get(`${categoryKey}|${parentId || ''}`) || [];

// Nodes from the top level down to `id`, or null if the chain is broken or loops.
export function chainOf(index, id) {
  const chain = [];
  const seen = new Set();
  let node = index.byId.get(id);
  while (node) {
    if (seen.has(node.id)) return null;
    seen.add(node.id);
    chain.unshift(node);
    node = node.parent_id ? index.byId.get(node.parent_id) : null;
    if (!node && chain[0].parent_id) return null;
  }
  return chain.length ? chain : null;
}

export const pathNames = (index, id) => {
  const chain = chainOf(index, id);
  return chain ? chain.map((node) => node.name) : null;
};

// Hidden when the subcategory itself, or any subcategory above it, is switched off.
export const isHiddenNode = (index, id) => {
  const chain = chainOf(index, id);
  return chain ? chain.some((node) => !node.enabled) : false;
};

export const depthOf = (index, id) => {
  const chain = chainOf(index, id);
  return chain ? chain.length : 0;
};

// All ids below a node (not including it).
export function descendantIds(index, id) {
  const out = [];
  const walk = (node) => {
    childrenOf(index, node.category_key, node.id).forEach((child) => {
      out.push(child.id);
      walk(child);
    });
  };
  const start = index.byId.get(id);
  if (start) walk(start);
  return out;
}

// The subtree of one category in display order, flattened for lists and pickers.
export function flattenTree(index, categoryKey) {
  const out = [];
  const walk = (parentId, depth, trail) => {
    childrenOf(index, categoryKey, parentId).forEach((node) => {
      const path = [...trail, node.name];
      const siblings = childrenOf(index, categoryKey, parentId);
      out.push({ node, depth, path, label: path.join(' › '), position: node.rank, siblingCount: siblings.length });
      walk(node.id, depth + 1, path);
    });
  };
  walk(null, 0, []);
  return out;
}

// Finds the node that has exactly this heading path inside a category.
export function findByPath(index, categoryKey, path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  let parent = null;
  let node = null;
  for (const name of path) {
    node = childrenOf(index, categoryKey, parent).find((candidate) => candidate.name === name) || null;
    if (!node) return null;
    parent = node.id;
  }
  return node;
}

// Where does a database item row sit? Returns { path, sub, node, hidden, orderKey }.
//   * linked to a subcategory  -> the subcategory's own names decide the headings
//   * not linked, but its stored heading text matches a subcategory -> that one (for example a restored item)
//   * otherwise                -> the heading text stored on the item itself, as before this feature existed
export function placeItem(index, row) {
  const stored = Array.isArray(row.path) && row.path.length ? row.path : row.sub ? [row.sub] : [];
  if (!index) return { path: stored, sub: stored[stored.length - 1] || '', node: null, hidden: false, orderKey: null };
  let node = row.subcategory_id ? index.byId.get(row.subcategory_id) : null;
  if (node && node.category_key !== row.category_key) node = null; // a leftover link to another category is ignored
  if (!node && !row.subcategory_id) node = findByPath(index, row.category_key, stored);
  const chain = node ? chainOf(index, node.id) : null;
  if (!chain) return { path: stored, sub: stored[stored.length - 1] || '', node: null, hidden: false, orderKey: null };
  const path = chain.map((n) => n.name);
  return {
    path,
    sub: path[path.length - 1],
    node,
    hidden: chain.some((n) => !n.enabled),
    orderKey: chain.map((n) => n.rank),
  };
}

// Compares two subcategory order keys. An item with no subcategory (null key) sorts before the ones in subcategories:
// the website shows a category's own items first and its subcategories after them.
export function compareOrderKeys(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

// ---- validation used by the dashboard before it writes ----
export const cleanName = (text) => String(text ?? '').replace(/[>›]/g, ' ').replace(/\s+/g, ' ').trim();

export function validateSubcategoryName(subs, { category_key, parent_id = null, name, exceptId = null }) {
  const clean = cleanName(name);
  if (!clean) return 'Please type a name.';
  if (clean.length > MAX_NAME) return `The name can have at most ${MAX_NAME} characters.`;
  const clash = (subs || []).find(
    (s) =>
      s.id !== exceptId &&
      s.category_key === category_key &&
      (s.parent_id || null) === (parent_id || null) &&
      s.name.trim().toLowerCase() === clean.toLowerCase()
  );
  if (clash) return `There is already a subcategory called “${clash.name}” here.`;
  return null;
}

// Can `id` become a child of `newParentId` (null = top level)?  Returns an error text, or null when it is fine.
export function validateMove(index, id, newParentId) {
  if (!newParentId) return null;
  if (newParentId === id) return 'A subcategory cannot be placed inside itself.';
  const node = index.byId.get(id);
  const parent = index.byId.get(newParentId);
  if (!node || !parent) return 'That subcategory no longer exists. Reload the page.';
  if (parent.category_key !== node.category_key) return 'A subcategory must stay in its own category.';
  if (descendantIds(index, id).includes(newParentId)) return 'A subcategory cannot be placed inside one of its own subcategories.';
  const subtreeHeight = Math.max(0, ...descendantIds(index, id).map((d) => depthOf(index, d) - depthOf(index, id))) + 1;
  if (depthOf(index, newParentId) + subtreeHeight > MAX_DEPTH) return `Subcategories can be nested at most ${MAX_DEPTH} levels deep.`;
  return null;
}

// New order numbers (1..n) for a list of siblings after moving `id` one place up (-1) or down (+1).
// Returns [] when it cannot move, otherwise [{ id, sort_order }] for the rows that actually change.
export function reorderSiblings(siblings, id, direction) {
  const list = [...siblings];
  const from = list.findIndex((row) => row.id === id || row.key === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= list.length) return [];
  [list[from], list[to]] = [list[to], list[from]];
  const idOf = (row) => (row.id !== undefined ? row.id : row.key);
  return list
    .map((row, i) => ({ id: idOf(row), sort_order: i + 1, was: row.sort_order }))
    .filter((row) => row.was !== row.sort_order)
    .map(({ id: rowId, sort_order }) => ({ id: rowId, sort_order }));
}
