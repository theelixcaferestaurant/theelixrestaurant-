// In-memory stand-in for the Supabase client, used ONLY by tests/phase3/run.mjs.
// It emulates the table rules this phase relies on (primary keys, the sibling-name unique index, foreign keys with
// restrict / cascade / set-null, the two guard triggers). It is NOT Postgres: it cannot prove the SQL itself is correct.
export const isSupabaseConfigured = true;
export const SUPABASE_URL = 'http://fake';
export const SUPABASE_PUBLIC_KEY = 'fake';
export const MEDIA_BUCKET = 'elix-media';

export const db = { categories: [], menu_items: [], menu_subcategories: [], site_settings: [], media_assets: [], gallery_items: [], opening_hours: [], social_links: [], restaurant_info: [], takeaway_slides: [] };
export const storageRemoved = [];
export const flags = { subcategoriesTableMissing: false, failNext: null };
let uuid = 0;
const newId = () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`;
const pk = { categories: 'key', menu_items: 'id', menu_subcategories: 'id', site_settings: 'key', media_assets: 'id' };
const err = (message, code = '23000') => ({ message, code });

function checkInsert(table, row) {
  if (table === 'categories' && db.categories.some((r) => r.key === row.key)) return err('duplicate key value violates unique constraint', '23505');
  if (table === 'menu_items') {
    if (db.menu_items.some((r) => r.id === row.id)) return err('duplicate key value violates unique constraint', '23505');
    if (!db.categories.some((c) => c.key === row.category_key)) return err('violates foreign key constraint', '23503');
  }
  if (table === 'menu_subcategories') {
    if (!db.categories.some((c) => c.key === row.category_key)) return err('violates foreign key constraint', '23503');
    return checkSubGuard(row, null);
  }
  return null;
}
function checkSubGuard(row, old) {
  const dup = db.menu_subcategories.find((r) => r.id !== row.id && r.category_key === row.category_key && (r.parent_id || null) === (row.parent_id || null) && r.name === row.name);
  if (dup) return err('duplicate key value violates unique constraint "menu_subcategories_unique_name"', '23505');
  if (!row.name || !row.name.trim() || row.name.length > 120) return err('violates check constraint', '23514');
  if (!row.parent_id || (old && (old.parent_id || null) === (row.parent_id || null))) return null;
  if (row.parent_id === row.id) return err('A subcategory cannot be its own parent.');
  const parent = db.menu_subcategories.find((r) => r.id === row.parent_id);
  if (!parent) return err('The parent subcategory does not exist.');
  if (parent.category_key !== row.category_key) return err('A subcategory must stay in the same category as its parent.');
  let cur = row.parent_id; let depth = 1;
  while (cur) { depth += 1; if (cur === row.id) return err('A subcategory cannot be moved inside itself.'); if (depth > 6) return err('Subcategories can be nested at most 6 levels deep.'); cur = db.menu_subcategories.find((r) => r.id === cur)?.parent_id || null; }
  return null;
}
function checkItemGuard(row) {
  if (row.subcategory_id && !db.menu_subcategories.some((s) => s.id === row.subcategory_id && s.category_key === row.category_key)) return err("That subcategory does not belong to the item's category.");
  return null;
}
function cascadeDeleteSub(id) {
  db.menu_subcategories.filter((s) => s.parent_id === id).forEach((s) => cascadeDeleteSub(s.id));
  db.menu_items.forEach((i) => { if (i.subcategory_id === id) i.subcategory_id = null; });
  db.menu_subcategories = db.menu_subcategories.filter((s) => s.id !== id);
}

class Query {
  constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.orders = []; this.cols = '*'; this.opts = {}; this.rangeV = null; this.single_ = null; this.afterSelect = false; }
  select(cols = '*', opts = {}) { if (this.op === 'select') { this.cols = cols; this.opts = opts; } else this.afterSelect = true; return this; }
  insert(rows) { this.op = 'insert'; this.payload = rows; return this; }
  update(patch) { this.op = 'update'; this.payload = patch; return this; }
  upsert(rows) { this.op = 'upsert'; this.payload = rows; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
  in(c, vs) { this.filters.push((r) => vs.includes(r[c])); return this; }
  order(c) { this.orders.push(c); return this; }
  range(a, b) { this.rangeV = [a, b]; return this; }
  limit() { return this; }
  maybeSingle() { this.single_ = 'maybe'; return this; }
  single() { this.single_ = 'one'; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  run() {
    const t = this.table;
    if (t === 'menu_subcategories' && flags.subcategoriesTableMissing) return { data: null, error: { code: 'PGRST205', message: 'Could not find the table public.menu_subcategories in the schema cache' } };
    if (flags.failNext && flags.failNext.table === t && flags.failNext.op === this.op) { const e = flags.failNext.error; flags.failNext = null; return { data: null, error: e }; }
    const rows = db[t];
    if (!rows) return { data: null, error: err(`unknown table ${t}`, '42P01') };
    const match = (r) => this.filters.every((f) => f(r));
    let out = [];
    if (this.op === 'select') {
      out = rows.filter(match).map((r) => ({ ...r }));
      this.orders.forEach(() => {});
      const ord = [...this.orders].reverse();
      ord.forEach((c) => out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0)));
      if (this.opts.head) return { data: null, count: out.length, error: null };
      if (this.rangeV) out = out.slice(this.rangeV[0], this.rangeV[1] + 1);
      if (this.cols !== '*') { const keep = this.cols.split(',').map((x) => x.trim()); out = out.map((r) => Object.fromEntries(keep.filter((k) => k in r).map((k) => [k, r[k]]))); }
    } else if (this.op === 'insert' || this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const raw of list) {
        let row = { ...raw };
        if (t === 'menu_subcategories') row = { id: newId(), parent_id: null, sort_order: 0, enabled: true, ...row };
        if (t === 'menu_items') row = { subcategory_id: null, path: [], sub: '', available: true, availability: 'available', sort_order: 0, ...row };
        if (this.op === 'upsert' && rows.some((r) => r[pk[t]] === row[pk[t]])) { Object.assign(rows.find((r) => r[pk[t]] === row[pk[t]]), row); continue; }
        const bad = checkInsert(t, row) || (t === 'menu_items' ? checkItemGuard(row) : null);
        if (bad) return { data: null, error: bad };
        rows.push(row); out.push({ ...row });
      }
    } else if (this.op === 'update') {
      const targets = rows.filter(match);
      for (const r of targets) {
        const next = { ...r, ...this.payload };
        const bad = t === 'menu_subcategories' ? checkSubGuard(next, r) : t === 'menu_items' ? checkItemGuard(next) : null;
        if (bad) return { data: null, error: bad };
      }
      targets.forEach((r) => { Object.assign(r, this.payload); out.push({ ...r }); });
    } else if (this.op === 'delete') {
      const targets = rows.filter(match);
      if (t === 'categories') {
        for (const c of targets) if (db.menu_items.some((i) => i.category_key === c.key)) return { data: null, error: err('violates foreign key constraint on table menu_items', '23503') };
        targets.forEach((c) => { db.menu_subcategories.filter((s) => s.category_key === c.key).forEach((s) => (db.menu_subcategories = db.menu_subcategories.filter((x) => x.id !== s.id))); });
      }
      if (t === 'menu_subcategories') targets.forEach((s) => cascadeDeleteSub(s.id));
      else db[t] = rows.filter((r) => !targets.includes(r));
      out = targets;
    }
    if (['insert', 'update', 'upsert', 'delete'].includes(this.op) && !this.afterSelect) return { data: null, error: null };
    if (this.single_) {
      if (out.length === 0) return this.single_ === 'maybe' ? { data: null, error: null } : { data: null, error: err('no rows', 'PGRST116') };
      return { data: out[0], error: null };
    }
    return { data: out, error: null };
  }
}
export const supabase = {
  from: (t) => new Query(t),
  storage: { from: () => ({ remove: async (paths) => { storageRemoved.push(...paths); return { error: null }; } }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  rpc: async () => ({ error: null }),
};
