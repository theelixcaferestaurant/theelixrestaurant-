import { supabase } from '../lib/supabase';
import { refreshContent } from '../lib/content';
import { fetchAllRows } from '../lib/fetchAll';
import { BUILT_IN_MENU } from '../data/menuData';
import { BUILT_IN_CATEGORY_KEYS, CATEGORY_ORDER, THEMES } from '../themes/themeConfig';
import SETUP_SQL from '../../supabase/migrations/0012_menu_categories_and_columns.sql?raw';

// ---------------------------------------------------------------------------------------------------------------------
// Copies the website's built-in menu (src/data/menuData.js) into the database, so every item and category the website
// shows can be managed in the dashboard. This is the same one-time copy that migration 0010 performs, but it runs from
// the dashboard, with the administrator's own sign-in, so no SQL has to be pasted for the items themselves.
//
// SAFETY RULES (the same as migration 0010):
//   * Only rows that are MISSING are added. A row that already exists is never overwritten, except the eight sample
//     dishes from migration 0002 that share an id with a real menu item, and only while they are still exactly the
//     untouched sample.
//   * Nothing is deleted. The 32 placeholder dishes from 0002 (never part of the real menu) are only hidden.
//   * The website is switched to "database menu" (site_settings.menu_source) as the very LAST step, and only after every
//     built-in item has been verified in the database, so the website can never lose items half-way.
// ---------------------------------------------------------------------------------------------------------------------

export const SETUP_SQL_TEXT = SETUP_SQL;
export const SETUP_SQL_FILE = 'supabase/migrations/0012_menu_categories_and_columns.sql';

// The order the categories appear on the website (Explore Menu), then Party Orders (which lives under Take Away).
export const ADMIN_CATEGORY_ORDER = [...CATEGORY_ORDER, 'party'];
export const sortCategories = (cats) => {
  // Once migration 0014 has run, the order saved in the database (changed with the arrows on the Categories page) is the order.
  if (cats.some((c) => 'enabled' in c)) {
    return [...cats].sort((a, b) => (a.key === 'party') - (b.key === 'party') || (a.sort_order || 0) - (b.sort_order || 0) || String(a.label).localeCompare(String(b.label)));
  }
  const rank = (key) => {
    const i = ADMIN_CATEGORY_ORDER.indexOf(key);
    return i === -1 ? 999 : i;
  };
  return [...cats].sort((a, b) => rank(a.key) - rank(b.key) || (a.sort_order || 0) - (b.sort_order || 0));
};

const NEW_CATEGORY_ORDER = { shawarma: 10, mandi: 11, party: 12 };
// Only the categories that exist in the website's code can be copied in; categories created in the dashboard are never "missing".
const WEBSITE_CATEGORY_KEYS = [...BUILT_IN_CATEGORY_KEYS];

// Placeholder dishes created by migration 0002. They were never part of the real menu.
const SAMPLE_IDS = new Set([
  'irani-chai', 'masala-chai', 'ginger-tea', 'lemon-tea', 'filter-coffee', 'cappuccino',
  'cold-coffee', 'chocolate-milkshake', 'fresh-lime-mojito', 'watermelon-juice', 'plain-idli',
  'ghee-idli', 'medu-vada', 'mysore-masala-dosa', 'ghee-karam-dosa', 'pongal',
  'chocolate-truffle-cake', 'red-velvet-pastry', 'black-forest-pastry', 'blueberry-cheesecake',
  'chocolate-brownie', 'butter-croissant', 'chocolate-donut', 'choco-chip-cookies',
  'walnut-brownie', 'chocolate-mousse', 'veg-dum-biryani', 'chicken-dum-biryani', 'chicken-65',
  'paneer-butter-masala', 'chicken-mandi', 'mutton-mandi',
]);

// The eight 0002 sample rows whose id is also a real menu item, exactly as 0002 created them.
const SAMPLE_ORIGINALS = {
  'plain-dosa': { category_key: 'tiffins', sub: 'Dosa', name: 'Plain Dosa', price: 65, description: 'A thin, crisp fermented rice and lentil crepe.', featured: false, hot: true },
  'masala-dosa': { category_key: 'tiffins', sub: 'Dosa', name: 'Masala Dosa', price: 85, description: 'A crisp dosa filled with spiced potato, served with chutneys.', featured: true, hot: true },
  poori: { category_key: 'tiffins', sub: 'Breakfast Specials', name: 'Poori (2 pcs)', price: 70, description: 'Two golden puffed breads served with potato masala.', featured: false, hot: true },
  upma: { category_key: 'tiffins', sub: 'Breakfast Specials', name: 'Upma', price: 55, description: 'Semolina cooked with vegetables and tempered with mustard seeds.', featured: false, hot: true },
  'butter-naan': { category_key: 'food', sub: 'Tandoori', name: 'Butter Naan', price: 45, description: 'Leavened bread from the tandoor, brushed with butter.', featured: false, hot: true },
  'chicken-tikka': { category_key: 'food', sub: 'Kebabs', name: 'Chicken Tikka', price: 230, description: 'Marinated chicken chargrilled in the tandoor.', featured: false, hot: true },
  'veg-fried-rice': { category_key: 'food', sub: 'Chinese', name: 'Veg Fried Rice', price: 150, description: 'Wok-tossed rice with fresh vegetables and soy.', featured: false, hot: true },
  'chicken-fried-rice': { category_key: 'food', sub: 'Chinese', name: 'Chicken Fried Rice', price: 190, description: 'Wok-tossed rice with chicken, spring onion and soy.', featured: false, hot: true },
};

// "₹200/380" -> 200, "₹2,200" -> 2200, "MRP" -> 0 (the number is only used for sorting).
export function numericPrice(display) {
  const text = String(display ?? '').trim();
  if (!text || /^mrp$/i.test(text)) return 0;
  const first = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return first ? Number(first[0]) : 0;
}

// The built-in menu as database rows (same values, same order numbers as migration 0010).
export function builtInRows() {
  const counter = {};
  return BUILT_IN_MENU.map((item) => {
    counter[item.category] = (counter[item.category] || 0) + 1;
    return {
      id: item.id,
      category_key: item.category,
      sub: item.sub || '',
      path: [...(item.path || [])],
      name: item.name,
      price: numericPrice(item.price),
      price_text: item.price,
      veg: item.veg ?? null,
      description: item.desc || '',
      sort_order: counter[item.category],
    };
  });
}

// ---- items the owner deleted on purpose are remembered, so "restore missing items" never brings them back ----
const DELETED_KEY = 'menu_deleted_ids';
const parseIds = (value) => {
  try {
    const list = JSON.parse(value || '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export async function rememberDeleted(ids) {
  const builtIn = new Set(BUILT_IN_MENU.map((i) => i.id));
  const wanted = ids.filter((id) => builtIn.has(id));
  if (!wanted.length) return;
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', DELETED_KEY).maybeSingle();
    const merged = [...new Set([...parseIds(data?.value), ...wanted])];
    await supabase.from('site_settings').upsert({ key: DELETED_KEY, value: JSON.stringify(merged) }, { onConflict: 'key' });
  } catch {
    /* best effort: the worst case is that a deleted item is offered again in "restore" */
  }
}

async function forgetDeleted(ids) {
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', DELETED_KEY).maybeSingle();
    const remaining = parseIds(data?.value).filter((id) => !ids.includes(id));
    await supabase.from('site_settings').upsert({ key: DELETED_KEY, value: JSON.stringify(remaining) }, { onConflict: 'key' });
  } catch {
    /* best effort */
  }
}

// ---- reading the current state ----
export class SetupNeeded extends Error {
  constructor(message) {
    super(message);
    this.name = 'SetupNeeded';
  }
}

const isConstraintError = (error) => error && (error.code === '23514' || /check constraint|violates check/i.test(error.message || ''));
const isMissingColumn = (error) => error && (error.code === '42703' || error.code === 'PGRST204' || /column .* (does not exist|of relation)|could not find the .* column/i.test(error.message || ''));

export async function loadSyncState() {
  const [cats, items, settings, probe] = await Promise.all([
    supabase.from('categories').select('key, sort_order'),
    fetchAllRows(() => supabase.from('menu_items').select('*').order('id')),
    supabase.from('site_settings').select('key, value').in('key', ['menu_source', 'menu_seed_0010', DELETED_KEY]),
    supabase.from('menu_items').select('price_text, path').limit(1),
  ]);
  const failed = [cats, items, settings].find((r) => r.error);
  if (failed) throw failed.error;
  const setting = Object.fromEntries((settings.data || []).map((r) => [r.key, r.value]));
  return {
    cats: cats.data,
    items: items.data,
    setting,
    columnsMissing: Boolean(probe.error && isMissingColumn(probe.error)),
  };
}

const sameSample = (row, original) =>
  row.category_key === original.category_key &&
  (row.sub || '') === original.sub &&
  row.name === original.name &&
  Number(row.price) === original.price &&
  (row.description || '') === original.description &&
  Boolean(row.featured) === original.featured &&
  Boolean(row.hot) === original.hot &&
  row.available !== false &&
  (row.availability || 'available') === 'available';

// Works out exactly what would be added or changed. Pure: it changes nothing.
export function planSync(state) {
  const rows = builtInRows();
  const builtIds = new Set(rows.map((r) => r.id));
  const have = new Map(state.items.map((r) => [r.id, r]));
  const deleted = new Set(parseIds(state.setting[DELETED_KEY]));
  const catKeys = new Set(state.cats.map((c) => c.key));
  const firstRun = state.setting.menu_source !== 'database' && !state.setting.menu_seed_0010;

  const missingItems = rows.filter((r) => !have.has(r.id) && !deleted.has(r.id));
  const missingCategories = WEBSITE_CATEGORY_KEYS.filter((key) => !catKeys.has(key));
  const repair = rows.filter((r) => SAMPLE_ORIGINALS[r.id] && have.has(r.id) && sameSample(have.get(r.id), SAMPLE_ORIGINALS[r.id]));
  // A same-id row that was edited by hand is kept as it is. Only blanks are filled so it sits in the right place:
  // the display price and headings when empty, and the order number when it is still a never-ordered sample (0).
  const repairIds = new Set(repair.map((r) => r.id));
  const fill = firstRun
    ? rows
        .filter((r) => have.has(r.id) && !repairIds.has(r.id))
        .map((r) => {
          const row = have.get(r.id);
          const patch = {};
          if (!row.price_text && Number(row.price) === r.price) patch.price_text = r.price_text;
          if ((!Array.isArray(row.path) || row.path.length === 0) && row.category_key === r.category_key) patch.path = r.path;
          if (!row.sort_order && row.category_key === r.category_key) patch.sort_order = r.sort_order;
          return { id: r.id, name: r.name, patch };
        })
        .filter((f) => Object.keys(f.patch).length)
    : [];
  const hide = state.items.filter((r) => SAMPLE_IDS.has(r.id) && !builtIds.has(r.id) && r.available !== false);
  // Items the owner added before the copy: kept, placed after the built-in items of their category.
  const shift = firstRun
    ? state.items.filter((r) => !builtIds.has(r.id) && !SAMPLE_IDS.has(r.id) && !SAMPLE_ORIGINALS[r.id] && (r.sort_order || 0) < 1000)
    : [];

  return {
    firstRun,
    total: rows.length,
    inDatabase: rows.filter((r) => have.has(r.id)).length,
    missingItems,
    missingCategories,
    repair: firstRun ? repair : [],
    fill,
    hide: firstRun ? hide : [],
    shift,
    // is there anything to do?
    needed: firstRun || missingItems.length > 0 || missingCategories.length > 0,
  };
}

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const must = ({ error }, what) => {
  if (error) {
    const e = new Error(`${what}: ${error.message || error}`);
    e.cause = error;
    throw e;
  }
};

// Adds what is missing. `only` (optional) = ids of missing items to add (used by "restore selected items").
// Returns a short summary. Throws SetupNeeded when a database change that only SQL can make is still pending.
export async function applySync(state, { only = null, onProgress = () => {} } = {}) {
  const plan = planSync(state);
  if (state.columnsMissing) throw new SetupNeeded('The menu table is missing two columns (price_text and path).');

  // 0. A restore point first (best effort: it needs migration 0011 and a complete 0010, so it may not exist yet).
  onProgress('Saving a restore point of the current menu…');
  try {
    await supabase.rpc('create_content_backup', { p_label: 'Automatic copy before copying the website menu', p_kind: 'auto' });
  } catch {
    /* no restore point available: the copy below only ever adds rows, so it is still safe */
  }

  // 1. Categories (Shawarma, Mandi, Party Orders). A database rule from the first setup may still forbid them.
  if (plan.missingCategories.length) {
    onProgress('Adding the missing categories…');
    const rows = plan.missingCategories.map((key) => ({
      key,
      label: THEMES[key].label,
      heading: THEMES[key].heading || '',
      intro: THEMES[key].intro || '',
      short_text: THEMES[key].short || '',
      subcategories: [],
      sort_order: NEW_CATEGORY_ORDER[key] ?? 20,
    }));
    const res = await supabase.from('categories').upsert(rows, { onConflict: 'key', ignoreDuplicates: true });
    if (res.error) {
      if (isConstraintError(res.error)) throw new SetupNeeded('The database still only allows four categories.');
      must(res, 'Could not add the categories');
    }
  }

  // 2. Items the owner had already added: keep them, after the built-in items.
  if (plan.shift.length && !only) {
    onProgress('Keeping your own items…');
    for (const row of plan.shift) {
      const res = await supabase
        .from('menu_items')
        .update({ sort_order: 1000 + (row.sort_order || 0), path: Array.isArray(row.path) && row.path.length ? row.path : row.sub ? [row.sub] : [] })
        .eq('id', row.id);
      must(res, `Could not keep “${row.name}”`);
    }
  }

  // 3. The missing built-in items (never overwrites an existing row).
  const toAdd = only ? plan.missingItems.filter((r) => only.includes(r.id)) : plan.missingItems;
  let added = 0;
  for (const part of chunk(toAdd, 100)) {
    onProgress(`Adding menu items… ${added} of ${toAdd.length}`);
    const res = await supabase.from('menu_items').upsert(part, { onConflict: 'id', ignoreDuplicates: true });
    if (res.error && isMissingColumn(res.error)) throw new SetupNeeded('The menu table is missing two columns (price_text and path).');
    if (res.error && isConstraintError(res.error)) throw new SetupNeeded('The database rejected the new categories.');
    must(res, 'Could not add the menu items');
    added += part.length;
  }

  // 4. First copy only: repair the eight untouched sample rows, hide the placeholder dishes.
  for (const row of plan.repair) {
    onProgress('Correcting sample items with real menu values…');
    const res = await supabase
      .from('menu_items')
      .update({
        category_key: row.category_key, sub: row.sub, path: row.path, name: row.name, price: row.price, price_text: row.price_text,
        veg: row.veg, description: row.description, featured: false, hot: false, sort_order: row.sort_order,
        available: true, availability: 'available', unavailable_until: null, available_from: null, available_to: null,
      })
      .eq('id', row.id);
    must(res, `Could not update “${row.name}”`);
  }
  for (const f of plan.fill) {
    const res = await supabase.from('menu_items').update(f.patch).eq('id', f.id);
    must(res, `Could not place “${f.name}”`);
  }
  if (plan.hide.length) {
    onProgress('Hiding the placeholder sample dishes…');
    const res = await supabase.from('menu_items').update({ available: false }).in('id', plan.hide.map((r) => r.id));
    must(res, 'Could not hide the sample dishes');
  }

  // 5. Verify before the website is switched over: every built-in item (except ones deleted on purpose) must be in the table.
  onProgress('Checking every item…');
  const present = new Set();
  for (const part of chunk(builtInRows().map((r) => r.id), 100)) {
    const check = await supabase.from('menu_items').select('id').in('id', part);
    must(check, 'Could not verify the menu');
    check.data.forEach((r) => present.add(r.id));
  }
  const deleted = new Set(parseIds(state.setting[DELETED_KEY]));
  const stillMissing = builtInRows().filter((r) => !present.has(r.id) && !deleted.has(r.id) && (!only || only.includes(r.id)));
  if (stillMissing.length) throw new Error(`${stillMissing.length} menu items could not be added (first: ${stillMissing[0].name}). The website has not been changed.`);

  if (only) await forgetDeleted(only);

  // 6. Last step: the database becomes the menu. Until now the website kept showing its built-in menu.
  if (plan.firstRun) {
    onProgress('Connecting the website to the database menu…');
    const res = await supabase
      .from('site_settings')
      .upsert([{ key: 'menu_source', value: 'database' }, { key: 'menu_seed_0010', value: 'applied' }], { onConflict: 'key' });
    must(res, 'Could not switch the website to the database menu');
  }

  await refreshContent();
  return { added, categories: plan.missingCategories.length, repaired: plan.repair.length, hidden: plan.hide.length, switchedOn: plan.firstRun };
}
