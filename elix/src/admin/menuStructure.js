import { supabase } from '../lib/supabase';
import { refreshContent } from '../lib/content';
import { fetchAllRows } from '../lib/fetchAll';
import { BUILT_IN_CATEGORY_KEYS } from '../themes/themeConfig';
import {
  MAX_DEPTH,
  buildIndex,
  childrenOf,
  cleanName,
  depthOf,
  descendantIds,
  pathNames,
  reorderSiblings,
  validateMove,
  validateSubcategoryName,
} from '../lib/menuStructure';
import { removeAllMedia } from './media';
import { rememberDeleted } from './menuSync';
import { slugify } from './ui';
import STRUCTURE_SQL from '../../supabase/migrations/0014_dynamic_menu_management.sql?raw';

// ---------------------------------------------------------------------------------------------------------------------
// Dashboard operations for menu categories and subcategories (Phase 3).
// Every write goes through the signed-in administrator's own session, so the Row Level Security policies decide what is
// allowed (only administrators can write). Every function throws an Error with a readable message when something is
// refused, and refreshes the public website's live content after a successful change.
// ---------------------------------------------------------------------------------------------------------------------

export const STRUCTURE_SQL_TEXT = STRUCTURE_SQL;
export const STRUCTURE_SQL_FILE = 'supabase/migrations/0014_dynamic_menu_management.sql';

export const isMissingTable = (error) =>
  Boolean(error) && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table|schema cache/i.test(error.message || ''));

const must = ({ error }) => {
  if (error) throw error;
};

const PINNED_LAST = 'party'; // Party Orders lives under Take Away, so it is not part of the Dine In order

// Categories in the order the website uses (Party Orders last).
export const sortCategoriesForAdmin = (cats) =>
  [...cats].sort((a, b) => (a.key === PINNED_LAST) - (b.key === PINNED_LAST) || (a.sort_order || 0) - (b.sort_order || 0) || String(a.label).localeCompare(String(b.label)));

export const isBuiltInCategory = (key) => BUILT_IN_CATEGORY_KEYS.includes(key);

// ---- reading ----
export async function loadStructure() {
  const [cats, subs] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    fetchAllRows(() => supabase.from('menu_subcategories').select('*').order('id')),
  ]);
  must(cats);
  if (subs.error && !isMissingTable(subs.error)) throw subs.error;
  const ready = !subs.error && cats.data.every((row) => 'enabled' in row);
  const items = await fetchAllRows(() =>
    supabase.from('menu_items').select(ready ? 'id, category_key, subcategory_id' : 'id, category_key').order('id')
  );
  must(items);
  return { ready, cats: sortCategoriesForAdmin(cats.data), subs: ready ? subs.data : [], items: items.data };
}

// ---- categories ----
// A readable, unique address key for a new category ("Hot Desserts" -> hot-desserts, then hot-desserts-2 ...).
export function categoryKeyFor(label, takenKeys) {
  const taken = new Set([...takenKeys, 'home', 'admin', 'explore', 'menu', ...BUILT_IN_CATEGORY_KEYS]);
  const base = slugify(label) || 'category';
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`.slice(0, 60);
  return key;
}

export async function createCategory(fields, cats) {
  const label = String(fields.label || '').trim();
  if (!label) throw new Error('Please type the category name.');
  if (label.length > 60) throw new Error('The category name can have at most 60 characters.');
  if (cats.some((c) => c.label.trim().toLowerCase() === label.toLowerCase())) throw new Error(`There is already a category called “${cats.find((c) => c.label.trim().toLowerCase() === label.toLowerCase()).label}”.`);
  const key = categoryKeyFor(label, cats.map((c) => c.key));
  const sortOrder = Math.max(0, ...cats.filter((c) => c.key !== PINNED_LAST).map((c) => c.sort_order || 0)) + 1;
  const row = {
    key,
    label,
    heading: String(fields.heading || '').trim() || label,
    intro: String(fields.intro || '').trim(),
    short_text: String(fields.short_text || '').trim(),
    subcategories: [],
    sort_order: sortOrder,
    enabled: true,
  };
  must(await supabase.from('categories').insert(row));
  await refreshContent();
  return row;
}

export async function updateCategory(key, fields) {
  const label = String(fields.label || '').trim();
  if (!label) throw new Error('The category name cannot be empty.');
  must(
    await supabase
      .from('categories')
      .update({ label, heading: String(fields.heading || '').trim(), intro: String(fields.intro || '').trim(), short_text: String(fields.short_text || '').trim() })
      .eq('key', key)
  );
  await refreshContent();
}

export async function setCategoryEnabled(key, enabled) {
  must(await supabase.from('categories').update({ enabled }).eq('key', key));
  await refreshContent();
}

// Moves a category one place up (-1) or down (+1) among the categories shown in Dine In.
export async function moveCategory(cats, key, direction) {
  const movable = sortCategoriesForAdmin(cats).filter((c) => c.key !== PINNED_LAST);
  const updates = reorderSiblings(movable, key, direction);
  if (!updates.length) return false;
  const results = await Promise.all(updates.map((u) => supabase.from('categories').update({ sort_order: u.sort_order }).eq('key', u.id)));
  results.forEach(must);
  await refreshContent();
  return true;
}

// Deletes a category created in the dashboard, together with its subcategories (database cascade) and its dishes.
// Built-in categories have their own page in the website's code: they can be hidden but not deleted.
export async function deleteCategory(cat) {
  if (isBuiltInCategory(cat.key)) throw new Error('This category has its own page on the website, so it cannot be deleted. Use Hide instead.');
  const found = await fetchAllRows(() => supabase.from('menu_items').select('id').eq('category_key', cat.key).order('id'));
  must(found);
  const ids = found.data.map((row) => row.id);
  if (ids.length) must(await supabase.from('menu_items').delete().eq('category_key', cat.key)); // dishes first (they point at the category)
  must(await supabase.from('categories').delete().eq('key', cat.key)); // subcategories go with it
  // the photographs and videos of the removed dishes and the category banner (after the rows, so a failure never orphans a dish)
  for (const id of ids) await removeAllMedia('menu_item', id);
  await removeAllMedia('site', `category-${cat.key}`);
  await refreshContent();
  return { items: ids.length };
}

// ---- subcategories ----
// Rewrites the heading text stored on the items of the given subcategories (menu_items.path / sub), so the old columns
// always agree with the tree. `subs` must already be the NEW state of the tree.
export async function syncStoredPaths(subs, ids) {
  const index = buildIndex(subs);
  const results = await Promise.all(
    ids.map((id) => {
      const names = pathNames(index, id) || [];
      return supabase.from('menu_items').update({ path: names, sub: names[names.length - 1] || '' }).eq('subcategory_id', id);
    })
  );
  results.forEach(must);
}

const nextOrder = (siblings) => Math.max(0, ...siblings.map((s) => s.sort_order || 0)) + 1;

export async function createSubcategory({ category_key, parent_id = null, name }, subs) {
  const index = buildIndex(subs);
  const bad = validateSubcategoryName(subs, { category_key, parent_id, name });
  if (bad) throw new Error(bad);
  if (parent_id && depthOf(index, parent_id) + 1 > MAX_DEPTH) throw new Error(`Subcategories can be nested at most ${MAX_DEPTH} levels deep.`);
  const row = { category_key, parent_id: parent_id || null, name: cleanName(name), sort_order: nextOrder(childrenOf(index, category_key, parent_id)), enabled: true };
  const { data, error } = await supabase.from('menu_subcategories').insert(row).select().single();
  if (error) throw error;
  await refreshContent();
  return data;
}

// Finds or creates every level of a heading path ("NON-VEG > Chicken") inside a category. Returns the last node.
export async function ensureSubcategoryPath(category_key, names, subs) {
  let working = [...subs];
  let parent = null;
  let node = null;
  for (const raw of names) {
    const name = cleanName(raw);
    if (!name) continue;
    const index = buildIndex(working);
    node = childrenOf(index, category_key, parent).find((s) => s.name.trim().toLowerCase() === name.toLowerCase()) || null;
    if (!node) {
      node = await createSubcategory({ category_key, parent_id: parent, name }, working);
      working = [...working, node];
    }
    parent = node.id;
  }
  return { node, subs: working };
}

// patch: any of { name, parent_id, enabled }
export async function updateSubcategory(id, patch, subs) {
  const index = buildIndex(subs);
  const node = index.byId.get(id);
  if (!node) throw new Error('That subcategory no longer exists. Reload the page.');
  const next = {};
  if (patch.name !== undefined) {
    const bad = validateSubcategoryName(subs, { category_key: node.category_key, parent_id: patch.parent_id !== undefined ? patch.parent_id : node.parent_id, name: patch.name, exceptId: id });
    if (bad) throw new Error(bad);
    next.name = cleanName(patch.name);
  }
  if (patch.parent_id !== undefined && (patch.parent_id || null) !== (node.parent_id || null)) {
    const bad = validateMove(index, id, patch.parent_id || null);
    if (bad) throw new Error(bad);
    const clash = validateSubcategoryName(subs, { category_key: node.category_key, parent_id: patch.parent_id || null, name: next.name || node.name, exceptId: id });
    if (clash) throw new Error(clash);
    next.parent_id = patch.parent_id || null;
    next.sort_order = nextOrder(childrenOf(index, node.category_key, patch.parent_id || null));
  }
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (!Object.keys(next).length) return node;

  const { data, error } = await supabase.from('menu_subcategories').update(next).eq('id', id).select().single();
  if (error) throw error;

  if (next.name !== undefined || next.parent_id !== undefined) {
    const after = subs.map((s) => (s.id === id ? { ...s, ...next } : s));
    await syncStoredPaths(after, [id, ...descendantIds(buildIndex(after), id)]);
  }
  await refreshContent();
  return data;
}

export async function moveSubcategory(subs, id, direction) {
  const index = buildIndex(subs);
  const node = index.byId.get(id);
  if (!node) throw new Error('That subcategory no longer exists. Reload the page.');
  const siblings = childrenOf(index, node.category_key, node.parent_id);
  const updates = reorderSiblings(siblings, id, direction);
  if (!updates.length) return false;
  const results = await Promise.all(updates.map((u) => supabase.from('menu_subcategories').update({ sort_order: u.sort_order }).eq('id', u.id)));
  results.forEach(must);
  await refreshContent();
  return true;
}

// What would deleting this subcategory affect? (shown in the confirmation)
export async function describeSubcategory(subs, id) {
  const index = buildIndex(subs);
  const below = descendantIds(index, id);
  const ids = [id, ...below];
  const { count: direct, error: e1 } = await supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('subcategory_id', id);
  if (e1) throw e1;
  const { count: all, error: e2 } = await supabase.from('menu_items').select('id', { count: 'exact', head: true }).in('subcategory_id', ids);
  if (e2) throw e2;
  return { subcategories: below.length, itemsHere: direct || 0, itemsInside: all || 0 };
}

// mode 'keep-items': only this heading is removed. Its dishes and its own subcategories move up one level (to the parent
//                    subcategory, or to the top of the category) and nothing is lost.
// mode 'delete-all': this subcategory, everything below it and every dish in them are deleted.
export async function deleteSubcategory(id, mode, subs) {
  const index = buildIndex(subs);
  const node = index.byId.get(id);
  if (!node) throw new Error('That subcategory no longer exists. Reload the page.');
  const below = descendantIds(index, id);

  if (mode === 'delete-all') {
    const ids = [id, ...below];
    const found = await fetchAllRows(() => supabase.from('menu_items').select('id').in('subcategory_id', ids).order('id'));
    must(found);
    const itemIds = found.data.map((row) => row.id);
    if (itemIds.length) must(await supabase.from('menu_items').delete().in('id', itemIds));
    must(await supabase.from('menu_subcategories').delete().eq('id', id)); // children are removed by the database
    for (const itemId of itemIds) await removeAllMedia('menu_item', itemId);
    await rememberDeleted(itemIds);
    await refreshContent();
    return { items: itemIds.length, subcategories: below.length + 1 };
  }

  // keep-items: first check that nothing would clash by name at the new level, before changing anything
  const parentId = node.parent_id || null;
  const kids = childrenOf(index, node.category_key, id);
  for (const kid of kids) {
    const clash = validateSubcategoryName(subs.filter((s) => s.id !== id), { category_key: node.category_key, parent_id: parentId, name: kid.name, exceptId: kid.id });
    if (clash) throw new Error(`${clash} Rename one of them first, or choose “delete everything inside”.`);
  }
  let order = nextOrder(childrenOf(index, node.category_key, parentId).filter((s) => s.id !== id));
  for (const kid of kids) {
    must(await supabase.from('menu_subcategories').update({ parent_id: parentId, sort_order: order }).eq('id', kid.id));
    order += 1;
  }
  const after = subs.filter((s) => s.id !== id).map((s) => (kids.some((k) => k.id === s.id) ? { ...s, parent_id: parentId } : s));
  const parentPath = parentId ? pathNames(buildIndex(after), parentId) || [] : [];
  const moved = await supabase
    .from('menu_items')
    .update({ subcategory_id: parentId, path: parentPath, sub: parentPath[parentPath.length - 1] || '' })
    .eq('subcategory_id', id)
    .select('id');
  must(moved);
  must(await supabase.from('menu_subcategories').delete().eq('id', id));
  if (below.length) await syncStoredPaths(after, below);
  await refreshContent();
  return { items: (moved.data || []).length, subcategories: 1 };
}
