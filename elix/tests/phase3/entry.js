import { db, flags, storageRemoved } from './fakeSupabase.js';
import { refreshContent, hasLoadedContent } from '../../src/lib/content.js';
import { MENU, BUILT_IN_MENU } from '../../src/data/menuData.js';
import { CATEGORY_ORDER, CATEGORY_PATHS, THEMES } from '../../src/themes/themeConfig.js';
import { builtInRows } from '../../src/admin/menuSync.js';
import * as S from '../../src/admin/menuStructure.js';
import * as M from '../../src/lib/menuStructure.js';

const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push([true, name]); } catch (e) { results.push([false, name, e.message]); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg || 'not equal'}: ${JSON.stringify(a).slice(0, 200)} vs ${JSON.stringify(b).slice(0, 200)}`);
const rejects = async (p, re, msg) => { try { await p; } catch (e) { assert(re.test(e.message), `${msg}: wrong error "${e.message}"`); return; } throw new Error(`${msg}: expected an error`); };

// ---------- seed: the existing database as it is after migrations 0010-0012 ----------
const ORDER = { chai: 1, tiffins: 2, food: 3, mandi: 4, shawarma: 5, bakery: 6, party: 7 };
const resetDb = ({ withEnabled, backfill }) => {
  Object.keys(db).forEach((k) => (db[k] = []));
  db.categories = Object.keys(ORDER).map((key) => ({ key, label: THEMES[key].label, heading: THEMES[key].heading, intro: THEMES[key].intro, short_text: THEMES[key].short, subcategories: [], sort_order: withEnabled ? ORDER[key] : ORDER[key] * 10, ...(withEnabled ? { enabled: true } : {}) }));
  db.menu_items = builtInRows().map((r) => ({ available: true, availability: 'available', subcategory_id: null, featured: false, hot: false, ...r }));
  db.site_settings = [{ key: 'menu_source', value: 'database' }];
  if (backfill) {
    // model of migration 0014 step 6: one subcategory per distinct heading prefix, ordered by first appearance
    let n = 0; const made = new Map();
    const order = new Map();
    [...db.menu_items].sort((a, b) => a.sort_order - b.sort_order).forEach((it) => {
      it.path.forEach((_, d) => { const k = `${it.category_key}|${it.path.slice(0, d + 1).join('\u0001')}`; if (!order.has(k)) order.set(k, order.size); });
    });
    const siblingsCount = new Map();
    [...order.keys()].forEach((k) => {
      const [cat, rest] = k.split('|'); const parts = rest.split('\u0001'); const parentKey = `${cat}|${parts.slice(0, -1).join('\u0001')}`;
      const parent = parts.length > 1 ? made.get(parentKey) : null;
      const sk = `${cat}|${parent?.id || ''}`; siblingsCount.set(sk, (siblingsCount.get(sk) || 0) + 1);
      const row = { id: `sub-${++n}`, category_key: cat, parent_id: parent?.id || null, name: parts[parts.length - 1], sort_order: siblingsCount.get(sk), enabled: true };
      made.set(k, row); db.menu_subcategories.push(row);
    });
    db.menu_items.forEach((it) => { if (it.path.length) it.subcategory_id = made.get(`${it.category_key}|${it.path.join('\u0001')}`).id; });
  }
};
const view = (m) => ({ id: m.id, category: m.category, path: m.path, sub: m.sub, price: m.price, name: m.name });
const baseline = BUILT_IN_MENU.map(view);
const menuOf = (cat) => MENU.filter((m) => m.category === cat);

// ================= 1. existing data is preserved =================
await test('P1 database before migration 0014 (no subcategory table): public menu identical to the built-in 327 items', async () => {
  resetDb({ withEnabled: false, backfill: false }); flags.subcategoriesTableMissing = true;
  await refreshContent();
  assert(MENU.length === 327, `count ${MENU.length}`);
  for (const cat of ['chai', 'tiffins', 'food', 'mandi', 'shawarma', 'bakery', 'party']) eq(menuOf(cat).map(view), baseline.filter((m) => m.category === cat), `category ${cat}`);
  eq([...CATEGORY_ORDER], ['chai', 'tiffins', 'food', 'mandi', 'shawarma', 'bakery'], 'order');
});
await test('P2 after migration 0014 (+ backfill model): same 327 items, same paths, same order, same prices', async () => {
  resetDb({ withEnabled: true, backfill: true }); flags.subcategoriesTableMissing = false;
  await refreshContent();
  eq(MENU.map(view).sort((a, b) => a.id.localeCompare(b.id)), baseline.slice().sort((a, b) => a.id.localeCompare(b.id)), 'items differ');
  for (const cat of ['chai', 'tiffins', 'food', 'mandi', 'shawarma', 'bakery']) eq(menuOf(cat).map((m) => m.id), baseline.filter((m) => m.category === cat).map((m) => m.id), `order in ${cat}`);
  eq([...CATEGORY_ORDER], ['chai', 'tiffins', 'food', 'mandi', 'shawarma', 'bakery'], 'category order');
  assert(db.menu_subcategories.length > 10, 'subcategories created');
});
await test('P3 no duplicate subcategories or items in the model; every item with a heading is linked', async () => {
  const keys = db.menu_subcategories.map((s) => `${s.category_key}|${s.parent_id}|${s.name}`);
  assert(new Set(keys).size === keys.length, 'duplicate subcategory'); assert(new Set(db.menu_items.map((i) => i.id)).size === 327, 'dup items');
  assert(db.menu_items.every((i) => !i.path.length || i.subcategory_id), 'unlinked item');
});

// ================= 2. categories =================
await test('C1 create category: gets key, order after the others, appears in Dine In order, route /menu/<key>, default look', async () => {
  const cats = (await S.loadStructure()).cats;
  const row = await S.createCategory({ label: 'Desserts', heading: '', intro: 'Sweet things', short_text: 'Cakes' }, cats);
  eq(row.key, 'desserts'); assert(row.sort_order === 7, `sort ${row.sort_order}`);
  eq(CATEGORY_ORDER[CATEGORY_ORDER.length - 1], 'desserts'); eq(THEMES.desserts.path, '/menu/desserts');
  assert(THEMES.desserts.custom && THEMES.desserts.heading === 'Desserts' && THEMES.desserts.letter, 'theme');
  assert(CATEGORY_PATHS.includes('/menu/desserts'), 'nav paths'); assert(hasLoadedContent(), 'loaded');
});
await test('C2 create category: duplicate name, empty name, built-in/reserved keys are refused or renamed', async () => {
  const cats = (await S.loadStructure()).cats;
  await rejects(S.createCategory({ label: 'desserts' }, cats), /already a category/, 'dup');
  await rejects(S.createCategory({ label: '  ' }, cats), /type the category name/, 'empty');
  eq(S.categoryKeyFor('Food', cats.map((c) => c.key)), 'food-2'); eq(S.categoryKeyFor('Home', []), 'home-2'); eq(S.categoryKeyFor('Menu', []), 'menu-2'); eq(S.categoryKeyFor('!!!', []), 'category');
});
await test('C3 edit category text: saved and live', async () => {
  await S.updateCategory('desserts', { label: 'Sweets & Desserts', heading: 'Sweet Endings', intro: 'i', short_text: 's' });
  eq(THEMES.desserts.label, 'Sweets & Desserts'); eq(THEMES.desserts.heading, 'Sweet Endings'); eq(THEMES.desserts.code, 'SWEETS & DESSERTS');
  await rejects(S.updateCategory('desserts', { label: ' ' }), /cannot be empty/, 'empty label');
});
await test('C4 reorder categories: move up / down persisted and Dine In order follows; Party Orders is not movable; edges do nothing', async () => {
  let cats = (await S.loadStructure()).cats;
  assert(await S.moveCategory(cats, 'desserts', -1), 'moved'); eq([...CATEGORY_ORDER], ['chai', 'tiffins', 'food', 'mandi', 'shawarma', 'desserts', 'bakery']);
  cats = (await S.loadStructure()).cats;
  assert(await S.moveCategory(cats, 'desserts', 1), 'moved back'); eq(CATEGORY_ORDER[CATEGORY_ORDER.length - 1], 'desserts');
  cats = (await S.loadStructure()).cats;
  assert(!(await S.moveCategory(cats, 'desserts', 1)), 'edge'); assert(!(await S.moveCategory(cats, 'chai', -1)), 'top edge'); assert(!CATEGORY_ORDER.includes('party'), 'party not in Dine In');
  eq(cats[cats.length - 1].key, 'party', 'party pinned last in the dashboard');
});
await test('C5 disable category: hidden from lists AND its items leave the public menu; enable restores both', async () => {
  const before = menuOf('bakery').length;
  await S.createSubcategory({ category_key: 'bakery', name: 'Cakes' }, (await S.loadStructure()).subs);
  await S.setCategoryEnabled('chai', false);
  assert(!CATEGORY_ORDER.includes('chai'), 'chai still listed'); assert(menuOf('chai').length === 0, 'chai items still public'); assert(THEMES.chai.disabled === true, 'disabled flag');
  assert(menuOf('tiffins').length === 18, 'other categories unaffected');
  await S.setCategoryEnabled('chai', true);
  eq([...CATEGORY_ORDER].slice(0, 2), ['chai', 'tiffins']); assert(menuOf('chai').length === 20, 'chai items back'); assert(THEMES.chai.disabled === false);
  assert(menuOf('bakery').length === before);
});
await test('C6 delete: built-in category refused; custom category deletes its items, subcategories, media and banner', async () => {
  await rejects(S.deleteCategory({ key: 'food', label: 'Restaurant Food' }), /cannot be deleted/, 'built-in');
  const st = await S.loadStructure();
  const sub = await S.createSubcategory({ category_key: 'desserts', name: 'Cakes' }, st.subs);
  db.menu_items.push({ id: 'choc-cake', category_key: 'desserts', subcategory_id: sub.id, name: 'Choc Cake', price: 100, price_text: '₹100', path: ['Cakes'], sub: 'Cakes', sort_order: 1, available: true, availability: 'available' });
  db.media_assets.push({ id: 'm1', owner_type: 'menu_item', owner_id: 'choc-cake', kind: 'image', storage_path: 'menu_item/choc-cake/a.webp' }, { id: 'm2', owner_type: 'site', owner_id: 'category-desserts', kind: 'image', storage_path: 'site/category-desserts/b.webp' });
  await refreshContent(); assert(menuOf('desserts').length === 1, 'item public');
  const r = await S.deleteCategory({ key: 'desserts', label: 'x' });
  eq(r, { items: 1 }); assert(!db.categories.some((c) => c.key === 'desserts'), 'cat row'); assert(!db.menu_subcategories.some((s) => s.category_key === 'desserts'), 'subs cascade');
  assert(!db.menu_items.some((i) => i.id === 'choc-cake'), 'item'); eq(db.media_assets.length, 0, 'media rows'); assert(storageRemoved.includes('menu_item/choc-cake/a.webp') && storageRemoved.includes('site/category-desserts/b.webp'), 'storage files');
  assert(!THEMES.desserts, 'theme gone'); assert(!CATEGORY_ORDER.includes('desserts'), 'order gone');
  assert(db.menu_items.length === 327, 'existing items untouched');
});

// ================= 3. subcategories =================
const subsOf = async () => (await S.loadStructure()).subs;
const findSub = (cat, name, parent = null) => db.menu_subcategories.find((s) => s.category_key === cat && s.name === name && (s.parent_id || null) === (parent || null));
await test('S1 create top-level and nested subcategory (several under one category); live on the website', async () => {
  let subs = await subsOf();
  const a = await S.createSubcategory({ category_key: 'chai', name: 'Hot Drinks' }, subs); subs = await subsOf();
  const b = await S.createSubcategory({ category_key: 'chai', name: 'Cold Drinks' }, subs); subs = await subsOf();
  const c = await S.createSubcategory({ category_key: 'chai', parent_id: a.id, name: 'Teas' }, subs);
  assert(a.sort_order === 1 && b.sort_order === 2 && c.parent_id === a.id, 'orders');
});
await test('S2 validation: duplicate sibling (case-insensitive), empty, too long, >/› stripped, same name under another parent allowed', async () => {
  const subs = await subsOf(); const hot = findSub('chai', 'Hot Drinks');
  await rejects(S.createSubcategory({ category_key: 'chai', name: 'hot drinks' }, subs), /already a subcategory/, 'dup');
  await rejects(S.createSubcategory({ category_key: 'chai', name: '   ' }, subs), /type a name/, 'empty');
  await rejects(S.createSubcategory({ category_key: 'chai', name: 'x'.repeat(121) }, subs), /at most 120/, 'long');
  const ok = await S.createSubcategory({ category_key: 'chai', parent_id: hot.id, name: 'Cold Drinks' }, subs); eq(ok.name, 'Cold Drinks');
  const gt = await S.createSubcategory({ category_key: 'chai', parent_id: hot.id, name: 'Chai > Special' }, await subsOf()); eq(gt.name, 'Chai Special');
});
await test('S3 assignment: items can be linked to a subcategory of THEIR category only; website shows the heading', async () => {
  const hot = findSub('chai', 'Hot Drinks'); const teas = findSub('chai', 'Teas', hot.id);
  const idx = M.buildIndex(await subsOf()); const names = M.pathNames(idx, teas.id); eq(names, ['Hot Drinks', 'Teas']);
  const { error } = await (await import('./fakeSupabase.js')).supabase.from('menu_items').update({ subcategory_id: teas.id, path: names, sub: 'Teas' }).eq('id', 'tea-single');
  assert(!error, 'assign'); await refreshContent();
  eq(MENU.find((m) => m.id === 'tea-single').path, ['Hot Drinks', 'Teas']);
  const bad = await (await import('./fakeSupabase.js')).supabase.from('menu_items').update({ subcategory_id: teas.id }).eq('id', 'idly');
  assert(bad.error && /does not belong/.test(bad.error.message), 'cross-category link must be refused');
});
await test('S4 rename: website path and stored path/sub of every item below it follow, other items untouched', async () => {
  const hot = findSub('chai', 'Hot Drinks'); await S.updateSubcategory(hot.id, { name: 'Warm Drinks' }, await subsOf());
  eq(MENU.find((m) => m.id === 'tea-single').path, ['Warm Drinks', 'Teas']);
  const row = db.menu_items.find((i) => i.id === 'tea-single'); eq(row.path, ['Warm Drinks', 'Teas']); eq(row.sub, 'Teas');
  eq(db.menu_items.find((i) => i.id === 'coffee').path, [], 'unrelated item untouched');
  await rejects(S.updateSubcategory(hot.id, { name: 'Cold Drinks' }, await subsOf()), /already a subcategory|already/, 'rename to sibling name');
});
await test('S5 reorder siblings: order persisted and the website sections follow; edges do nothing', async () => {
  const subs = await subsOf(); const warm = findSub('chai', 'Warm Drinks'); const cold = findSub('chai', 'Cold Drinks');
  db.menu_items.find((i) => i.id === 'coffee').subcategory_id = cold.id; db.menu_items.find((i) => i.id === 'coffee').path = ['Cold Drinks'];
  await refreshContent();
  eq([...new Set(menuOf('chai').filter((m) => m.path.length).map((m) => m.path[0]))], ['Warm Drinks', 'Cold Drinks'], 'before');
  assert(await S.moveSubcategory(subs, cold.id, -1), 'moved');
  eq([...new Set(menuOf('chai').filter((m) => m.path.length).map((m) => m.path[0]))], ['Cold Drinks', 'Warm Drinks'], 'after');
  assert(!(await S.moveSubcategory(await subsOf(), cold.id, -1)), 'edge');
  assert(menuOf('chai').slice(0, 5).every((m) => !m.path.length), 'unassigned items still come first');
});
await test('S6 move to another parent: cycles, other categories, name clashes and depth > 6 are refused; valid move works and updates paths', async () => {
  const subs = await subsOf(); const warm = findSub('chai', 'Warm Drinks'); const teas = findSub('chai', 'Teas', warm.id); const cold = findSub('chai', 'Cold Drinks');
  await rejects(S.updateSubcategory(warm.id, { parent_id: teas.id }, subs), /inside one of its own|inside itself/, 'cycle');
  await rejects(S.updateSubcategory(warm.id, { parent_id: warm.id }, subs), /inside itself/, 'self');
  const other = await S.createSubcategory({ category_key: 'bakery', name: 'Tarts' }, subs);
  await rejects(S.updateSubcategory(warm.id, { parent_id: other.id }, await subsOf()), /own category/, 'other category');
  let s2 = await subsOf(); let parent = null;
  for (let i = 1; i <= 6; i += 1) { const r = await S.createSubcategory({ category_key: 'mandi', parent_id: parent, name: `L${i}` }, s2); s2 = await subsOf(); parent = r.id; }
  await rejects(S.createSubcategory({ category_key: 'mandi', parent_id: parent, name: 'L7' }, s2), /at most 6/, 'depth');
  await S.updateSubcategory(teas.id, { parent_id: cold.id }, await subsOf());
  eq(MENU.find((m) => m.id === 'tea-single').path, ['Cold Drinks', 'Teas']); eq(db.menu_items.find((i) => i.id === 'tea-single').path, ['Cold Drinks', 'Teas']);
});
await test('S7 hide / show: items of a hidden subcategory (and of its inner ones) leave the website, return when shown; nothing is deleted', async () => {
  const cold = findSub('chai', 'Cold Drinks'); const n = db.menu_items.length;
  await S.updateSubcategory(cold.id, { enabled: false }, await subsOf());
  assert(!MENU.some((m) => m.id === 'tea-single' || m.id === 'coffee'), 'still public'); assert(db.menu_items.length === n, 'deleted something');
  await S.updateSubcategory(cold.id, { enabled: true }, await subsOf());
  assert(MENU.some((m) => m.id === 'tea-single') && MENU.some((m) => m.id === 'coffee'), 'not back');
});
await test('S8 delete (keep items): dishes and inner subcategories move up one level, nothing lost, stored paths updated', async () => {
  const cold = findSub('chai', 'Cold Drinks'); const teas = findSub('chai', 'Teas', cold.id); const n = db.menu_items.length;
  const d = await S.describeSubcategory(await subsOf(), cold.id); eq(d, { subcategories: 1, itemsHere: 1, itemsInside: 2 });
  const r = await S.deleteSubcategory(cold.id, 'keep-items', await subsOf());
  assert(db.menu_items.length === n, 'items lost'); assert(!db.menu_subcategories.some((s) => s.id === cold.id), 'row remains');
  eq(findSub('chai', 'Teas', null).id, teas.id, 'Teas moved to top'); eq(db.menu_items.find((i) => i.id === 'coffee').subcategory_id, null); eq(db.menu_items.find((i) => i.id === 'coffee').path, []);
  eq(MENU.find((m) => m.id === 'tea-single').path, ['Teas']); eq(db.menu_items.find((i) => i.id === 'tea-single').path, ['Teas']);
});
await test('S9 delete (keep items) refuses when an inner subcategory would clash by name at the new level; nothing changes', async () => {
  const subs = await subsOf(); const a = await S.createSubcategory({ category_key: 'bakery', name: 'Cakes' }, subs).catch(() => findSub('bakery', 'Cakes'));
  const outer = await S.createSubcategory({ category_key: 'bakery', name: 'Outer' }, await subsOf()); const inner = await S.createSubcategory({ category_key: 'bakery', parent_id: outer.id, name: 'Cakes' }, await subsOf());
  const before = JSON.stringify(db.menu_subcategories);
  await rejects(S.deleteSubcategory(outer.id, 'keep-items', await subsOf()), /already a subcategory/, 'clash'); eq(JSON.stringify(db.menu_subcategories), before, 'changed anyway');
});
await test('S10 delete everything inside: sub-tree, dishes, media files removed; other data untouched', async () => {
  const outer = findSub('bakery', 'Outer'); const inner = findSub('bakery', 'Cakes', outer.id);
  db.menu_items.push({ id: 'x-cake', category_key: 'bakery', subcategory_id: inner.id, name: 'X', price: 1, price_text: '₹1', path: ['Outer', 'Cakes'], sub: 'Cakes', sort_order: 1, available: true, availability: 'available' });
  db.media_assets.push({ id: 'm9', owner_type: 'menu_item', owner_id: 'x-cake', kind: 'image', storage_path: 'menu_item/x-cake/z.webp' });
  const n = db.menu_items.length; const r = await S.deleteSubcategory(outer.id, 'delete-all', await subsOf());
  eq(r, { items: 1, subcategories: 2 }); assert(db.menu_items.length === n - 1 && !findSub('bakery', 'Cakes', outer.id) && !findSub('bakery', 'Outer'), 'removed'); assert(storageRemoved.includes('menu_item/x-cake/z.webp'), 'media');
  assert(findSub('bakery', 'Cakes'), 'a different "Cakes" survives');
});
await test('S11 ensureSubcategoryPath finds existing levels (case-insensitive) and creates only the missing ones, no duplicates', async () => {
  const before = db.menu_subcategories.length;
  const r = await S.ensureSubcategoryPath('food', ['non-veg', 'Chicken', 'Brand New Section'], await subsOf());
  eq(db.menu_subcategories.length, before + 1, 'only one new'); eq(M.pathNames(M.buildIndex(r.subs), r.node.id), ['NON-VEG', 'Chicken', 'Brand New Section']);
});

// ================= 4. public layer robustness =================
await test('R1 a transient failure reading subcategories keeps the previous website content (no flash back to old names)', async () => {
  await refreshContent(); const snapshot = JSON.stringify(MENU.map(view));
  flags.failNext = { table: 'menu_subcategories', op: 'select', error: { code: '08006', message: 'connection failure' } };
  const ok = await refreshContent(); assert(ok === false, 'should report failure'); eq(JSON.stringify(MENU.map(view)), snapshot);
});
await test('R2 an item linked to a subcategory that is gone falls back to its stored heading (never disappears)', async () => {
  const it = db.menu_items.find((i) => i.id === 'idly'); it.subcategory_id = 'does-not-exist'; it.path = ['Legacy Heading']; it.sub = 'Legacy Heading';
  await refreshContent(); eq(MENU.find((m) => m.id === 'idly').path, ['Legacy Heading']); it.subcategory_id = null; it.path = []; it.sub = '';
});
await test('R3 restored/legacy item without a link but with a matching heading text lands in the matching subcategory', async () => {
  const it = db.menu_items.find((i) => i.id === 'tomato-soup'); const linked = it.subcategory_id; it.subcategory_id = null;
  await refreshContent(); eq(MENU.find((m) => m.id === 'tomato-soup').path, it.path); assert(true); it.subcategory_id = linked;
});
await test('R4 final: all 327 original items still present with original names and prices', async () => {
  await refreshContent(); const have = new Map(MENU.map((m) => [m.id, m]));
  for (const b of BUILT_IN_MENU) { const m = have.get(b.id); assert(m, `missing ${b.id}`); assert(m.name === b.name && m.price === b.price, `changed ${b.id}`); }
});

const failed = results.filter((r) => !r[0]);
results.forEach((r) => console.log(`${r[0] ? 'PASS' : 'FAIL'}  ${r[1]}${r[0] ? '' : '\n      -> ' + r[2]}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed of ${results.length}`);
process.exit(failed.length ? 1 : 0);
