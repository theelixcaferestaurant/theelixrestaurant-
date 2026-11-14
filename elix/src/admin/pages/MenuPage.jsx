import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { refreshContent } from '../../lib/content';
import { fetchAllRows } from '../../lib/fetchAll';
import { SETUP_SQL_FILE, SETUP_SQL_TEXT, SetupNeeded, applySync, loadSyncState, planSync, rememberDeleted, sortCategories } from '../menuSync';
import MediaField from '../MediaField';
import StructureSetup from '../StructureSetup';
import SubcategoryManager from '../SubcategoryManager';
import { ensureSubcategoryPath, isMissingTable } from '../menuStructure';
import { buildIndex, cleanName, compareOrderKeys, flattenTree, placeItem } from '../../lib/menuStructure';
import { removeAllMedia } from '../media';
import { formatRestaurantDateTime, isRowUnavailable, isoToLocalInput, localInputToIso } from '../../lib/availability';
import { Button, Card, Check, Field, LoadState, Modal, Select, TextArea, TextInput, errorText, slugify, useConfirm, useLoad, useToast } from '../ui';

const EMPTY = { id: '', name: '', category_key: 'chai', sub: '', path: [], subcategory_id: null, price_text: null, price: '', veg: 'none', description: '', featured: false, hot: false, available: true, sort_order: 0, availability: 'available', unavailable_until: null, available_from: null, available_to: null };
const vegToValue = (veg) => (veg === true ? 'veg' : veg === false ? 'nonveg' : 'none');
const valueToVeg = (value) => (value === 'veg' ? true : value === 'nonveg' ? false : null);

// ---- menu sections (the nested headings an item sits under, e.g. NON-VEG › Chicken › Chicken Main Course) ----
const SEP = ' › ';
const pathOf = (item) => (Array.isArray(item.path) && item.path.length ? item.path : item.sub ? [item.sub] : []);
const pathKey = (item) => pathOf(item).join(SEP);
const NEW_SECTION = '__new__'; // the "+ New subcategory…" choice
const LEGACY = '__legacy__'; // an item whose heading text is not a subcategory yet (database not updated)
const groupKey = (item) => item.subcategory_id || `legacy:${pathKey(item)}`;

// The price as the customer sees it. "200" -> ₹200, "200/380" -> ₹200/380, "2,200" -> ₹2,200, "MRP" -> MRP.
// price (the number) is the first figure, used only for sorting and the sample rating.
function parsePrice(input) {
  const text = String(input ?? '').trim().replace(/^(₹|rs\.?|inr)\s*/i, '');
  if (!text) return null;
  if (/^mrp$/i.test(text)) return { price: 0, price_text: 'MRP' };
  const first = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
  if (!first) return null;
  return { price: Number(first[0]), price_text: `₹${text}` };
}
const pathNamesOf = (subRows, id) => placeItem(buildIndex(subRows), { category_key: subRows.find((x) => x.id === id)?.category_key, subcategory_id: id }).path;
const editablePrice = (item) => (item.price_text ? item.price_text.replace(/^₹/, '') : String(item.price ?? ''));

async function loadAll() {
  const [cats, items, media, subs] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    fetchAllRows(() => supabase.from('menu_items').select('*').order('category_key').order('sort_order').order('name').order('id')),
    supabase.from('media_assets').select('owner_id, kind, url').eq('owner_type', 'menu_item'),
    fetchAllRows(() => supabase.from('menu_subcategories').select('*').order('id')),
  ]);
  const failed = [cats, items, media].find((r) => r.error);
  if (failed) throw failed.error;
  if (subs.error && !isMissingTable(subs.error)) throw subs.error;
  // false until migration 0014 has been run: subcategories then cannot be managed and items keep their stored headings
  const structureReady = !subs.error && cats.data.every((c) => 'enabled' in c);
  const thumbs = {};
  const clips = new Set();
  media.data.forEach((m) => (m.kind === 'image' ? (thumbs[m.owner_id] = m.url) : clips.add(m.owner_id)));
  return { cats: sortCategories(cats.data), items: items.data, thumbs, clips, subs: structureReady ? subs.data : [], structureReady };
}

function ItemForm({ initial, cats, items, subs, structureReady, onSaved, onClose }) {
  const toast = useToast();
  const isNew = !initial.created_at;
  const [form, setForm] = useState({
    ...initial,
    price: editablePrice(initial),
    veg: vegToValue(initial.veg),
    until: isoToLocalInput(initial.unavailable_until),
    from: (initial.available_from || '').slice(0, 5),
    to: (initial.available_to || '').slice(0, 5),
  });
  const [idTouched, setIdTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(isNew ? null : initial.id); // media can be uploaded once the item exists
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  // Subcategories of the chosen category, in website order (nested ones indented by their path).
  const index = useMemo(() => buildIndex(subs), [subs]);
  const choices = useMemo(() => flattenTree(index, form.category_key), [index, form.category_key]);
  const startLegacy = !initial.subcategory_id && pathOf(initial).length > 0 && !placeItem(index, initial).node;
  const [section, setSection] = useState(() => {
    if (initial.subcategory_id) return initial.subcategory_id;
    const found = placeItem(index, initial).node;
    return found ? found.id : startLegacy ? LEGACY : '';
  });
  const [customSection, setCustomSection] = useState('');
  const changeCategory = (key) => {
    set('category_key', key);
    // a subcategory belongs to one category: keep the choice only if it is still valid in the new category
    if (section !== NEW_SECTION && section !== LEGACY && !flattenTree(index, key).some(({ node }) => node.id === section)) setSection('');
    if (section === LEGACY) setSection('');
  };

  const save = async () => {
    const name = form.name.trim();
    const id = (savedId || form.id || slugify(name)).trim();
    const parsed = parsePrice(form.price);
    if (!name) return toast.error('Please enter the food name.');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return toast.error('The id may only contain lowercase letters, numbers and single dashes.');
    if (!parsed) return toast.error('Please enter the price, for example 120, 200/380 (half/full) or MRP.');
    let path = [];
    let subcategoryId = null;
    let newPath = null;
    if (section === NEW_SECTION) {
      newPath = customSection.split(/[>›]/).map(cleanName).filter(Boolean);
      if (!newPath.length) return toast.error('Type the new subcategory name, or choose “No subcategory”.');
    } else if (section === LEGACY) {
      path = pathOf(initial); // unchanged: the database has not been updated for subcategories yet
    } else if (section) {
      const node = index.byId.get(section);
      if (!node) return toast.error('That subcategory no longer exists. Reload the page.');
      subcategoryId = node.id;
      path = placeItem(index, { category_key: form.category_key, subcategory_id: node.id }).path;
    }
    if (Boolean(form.from) !== Boolean(form.to)) return toast.error('Serving hours need both a start time and an end time (or leave both empty).');
    if (form.availability === 'unavailable' && form.until && !localInputToIso(form.until)) return toast.error('The “unavailable until” date is not valid.');

    // a new item goes to the end of its category; a clashing id (two dishes with the same name) gets a number
    const nextOrder = items.filter((i) => i.category_key === form.category_key).reduce((m, i) => Math.max(m, i.sort_order || 0), 0) + 1;
    let finalId = id;
    if (!savedId) {
      const taken = new Set(items.map((i) => i.id));
      for (let n = 2; taken.has(finalId); n += 1) finalId = `${id}-${n}`;
    }

    setSaving(true);
    try {
      if (newPath) {
        const made = await ensureSubcategoryPath(form.category_key, newPath, subs);
        subcategoryId = made.node.id;
        path = newPath.length ? pathNamesOf(made.subs, made.node.id) : [];
      }
      const row = {
        category_key: form.category_key,
        sub: path.length ? path[path.length - 1] : '',
        path,
        ...(structureReady ? { subcategory_id: subcategoryId } : {}),
        name,
        price: parsed.price,
        price_text: parsed.price_text,
        veg: valueToVeg(form.veg),
        description: form.description.trim(),
        featured: form.featured,
        hot: form.hot,
        available: form.available,
        sort_order: Number(form.sort_order) || nextOrder,
        availability: form.availability,
        unavailable_until: form.availability === 'unavailable' ? localInputToIso(form.until) : null,
        available_from: form.from || null,
        available_to: form.to || null,
      };
      const query = savedId
        ? supabase.from('menu_items').update(row).eq('id', savedId)
        : supabase.from('menu_items').insert({ id: finalId, ...row });
      const { error } = await query;
      if (error) throw error;
      // one featured dish per category
      if (row.featured) {
        const { error: e2 } = await supabase.from('menu_items').update({ featured: false }).eq('category_key', row.category_key).neq('id', savedId || finalId);
        if (e2) throw e2;
      }
      await refreshContent();
      toast.success(savedId ? `“${name}” saved and live on the website.` : `“${name}” added. You can now upload its photo and video.`);
      setSavedId(savedId || finalId);
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={savedId ? `Edit: ${form.name || savedId}` : 'Add food item'} onClose={onClose}>
      <div className="a-grid">
        <Field label="Food name *">
          <TextInput
            value={form.name}
            onChange={(e) => {
              set('name', e.target.value);
              if (!savedId && !idTouched) set('id', slugify(e.target.value));
            }}
            placeholder="e.g. Masala Dosa"
          />
        </Field>
        <Field label="Price (₹) *" hint="Type it as it should appear: 120, 200/380 (half/full), 2,200 or MRP.">
          <TextInput inputMode="text" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="e.g. 120" />
        </Field>
        <Field label="Category *">
          <Select value={form.category_key} onChange={(e) => changeCategory(e.target.value)}>
            {cats.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subcategory" hint={structureReady ? 'Where the item sits on the menu page. Pick an existing subcategory or create a new one.' : 'Subcategories can be assigned after the database step shown on this page.'}>
          <Select value={section} onChange={(e) => setSection(e.target.value)} disabled={!structureReady}>
            <option value="">No subcategory (top of the category)</option>
            {choices.map(({ node, label, depth }) => (
              <option key={node.id} value={node.id}>
                {'\u00A0\u00A0'.repeat(depth)}{label}{node.enabled ? '' : ' (hidden)'}
              </option>
            ))}
            {startLegacy && <option value={LEGACY}>{pathKey(initial)} (current heading)</option>}
            {structureReady && <option value={NEW_SECTION}>+ New subcategory…</option>}
          </Select>
        </Field>
        {section === NEW_SECTION && (
          <Field label="New subcategory name" hint="Use › or > between levels to create nested ones, for example: NON-VEG > Chicken > Chicken Main Course" wide>
            <TextInput value={customSection} onChange={(e) => setCustomSection(e.target.value)} placeholder="e.g. VEG > Veg Desserts" />
          </Field>
        )}
        <Field label="Vegetarian marker">
          <Select value={form.veg} onChange={(e) => set('veg', e.target.value)}>
            <option value="none">No marker</option>
            <option value="veg">Vegetarian</option>
            <option value="nonveg">Non-vegetarian</option>
          </Select>
        </Field>
        <Field label="Display order" hint="Lower numbers appear first.">
          <TextInput type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
        </Field>
        <Field label="Availability" hint="“Temporarily unavailable” keeps the item on the menu with a “Currently Unavailable” label.">
          <Select value={form.availability} onChange={(e) => set('availability', e.target.value)}>
            <option value="available">Available</option>
            <option value="unavailable">Temporarily unavailable</option>
          </Select>
        </Field>
        {form.availability === 'unavailable' && (
          <Field label="Unavailable until (optional)" hint="Restaurant time (India). It becomes available automatically at this moment. Leave empty to stay unavailable until you switch it back.">
            <TextInput type="datetime-local" value={form.until} onChange={(e) => set('until', e.target.value)} />
          </Field>
        )}
        <Field label="Served from (optional)" hint="Daily serving hours, restaurant time. Outside these hours the item shows as unavailable.">
          <TextInput type="time" value={form.from} onChange={(e) => set('from', e.target.value)} />
        </Field>
        <Field label="Served until (optional)">
          <TextInput type="time" value={form.to} onChange={(e) => set('to', e.target.value)} />
        </Field>
        <Field label="Description" wide>
          <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        {!savedId && (
          <Field label="Item id (used in file names and links)" hint="Created from the name. Cannot be changed after saving." wide>
            <TextInput
              value={form.id}
              onChange={(e) => {
                setIdTouched(true);
                set('id', slugify(e.target.value));
              }}
            />
          </Field>
        )}
        <div className="a-checks is-wide">
          <Check label="Show on website" hint="Untick to remove it from the website completely without deleting it." checked={form.available} onChange={(v) => set('available', v)} />
          <Check label="Featured dish" hint="Shown large at the top of its category page." checked={form.featured} onChange={(v) => set('featured', v)} />
          <Check label="Hot (steam effect)" checked={form.hot} onChange={(v) => set('hot', v)} />
        </div>
      </div>

      <div className="a-actions">
        <Button busy={saving} onClick={save}>
          {savedId ? 'Save changes' : 'Add item'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {savedId ? 'Close' : 'Cancel'}
        </Button>
      </div>

      <div className="a-media-grid">
        {savedId ? (
          <>
            <MediaField ownerType="menu_item" ownerId={savedId} kind="image" label="Food photograph" onChanged={onSaved} />
            <MediaField ownerType="menu_item" ownerId={savedId} kind="video" label="Hover video" hint="Plays when visitors hover over the photo (desktop) or open the item (mobile). MP4 or WebM, 5–10 seconds." onChanged={onSaved} />
          </>
        ) : (
          <p className="a-hint">Add the item first, then you can upload its photograph and video.</p>
        )}
      </div>
    </Modal>
  );
}


// ---- Copies the website's built-in menu into the database (so every item and category can be managed here) ----
function SetupSql() {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL_TEXT);
      toast.success('SQL copied. Paste it into the Supabase SQL Editor and press Run.');
    } catch {
      toast.error('Could not copy automatically. Open the file below and copy its text.');
    }
  };
  return (
    <Card title="One quick database step is needed first">
      <p className="a-hint">
        Your database still only allows four categories, so Mandi, Shawarma and Party Orders cannot be stored yet. Open the Supabase Dashboard › SQL Editor › New query, paste the SQL below and press Run. It only adds the missing categories and two columns; it never deletes or changes any item. Then come back and reload this page.
      </p>
      <div className="a-actions">
        <Button onClick={copy}>Copy the SQL</Button>
      </div>
      <p className="a-hint">File in your project: <code>{SETUP_SQL_FILE}</code></p>
      <textarea className="a-input" readOnly rows={8} value={SETUP_SQL_TEXT} onFocus={(e) => e.target.select()} aria-label="SQL to run in Supabase" />
    </Card>
  );
}

function RestoreModal({ plan, onClose, onRestore, busy }) {
  const [chosen, setChosen] = useState(() => new Set(plan.missingItems.map((i) => i.id)));
  const toggle = (id) => setChosen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Modal title="Restore items from the website menu" onClose={onClose}>
      <p className="a-hint">These items are in the website's original menu but are not in the database now. Items you deleted in this dashboard are not listed. Tick the ones to add back (nothing existing is changed).</p>
      <div className="a-list" style={{ maxHeight: '45vh', overflow: 'auto' }}>
        {plan.missingItems.map((i) => (
          <Check key={i.id} label={`${i.name} · ${i.price_text} · ${i.path.join(' › ') || i.category_key}`} checked={chosen.has(i.id)} onChange={() => toggle(i.id)} />
        ))}
      </div>
      <div className="a-actions">
        <Button busy={busy} disabled={!chosen.size} onClick={() => onRestore([...chosen])}>Restore {chosen.size} item{chosen.size === 1 ? '' : 's'}</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

function SyncPanel({ onDone }) {
  const toast = useToast();
  const { loading, error, data: state, reload } = useLoad(loadSyncState);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [needsSql, setNeedsSql] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (loading || error || !state) return null;
  const plan = planSync(state);
  if (state.columnsMissing || needsSql) return <SetupSql />;
  if (!plan.needed) return null;

  const run = async (only) => {
    setBusy(true);
    try {
      const result = await applySync(state, { only, onProgress: setProgress });
      toast.success(result.switchedOn ? `Done. ${plan.inDatabase + result.added} menu items are now in the dashboard and the website reads them from the database.` : `${result.added} item${result.added === 1 ? '' : 's'} restored.`);
      setRestoring(false);
      reload();
      onDone();
    } catch (e) {
      if (e instanceof SetupNeeded) setNeedsSql(true);
      else toast.error(`Not completed. ${errorText(e)} Nothing was deleted.`);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  if (plan.firstRun) {
    return (
      <Card title="Copy the website menu into the dashboard">
        <p>
          The website shows <strong>{plan.total}</strong> menu items, but only <strong>{plan.inDatabase}</strong> of them are in the database, so the rest cannot be edited here yet.
          {plan.missingCategories.length > 0 && <> Missing categories: <strong>{plan.missingCategories.map((k) => k).join(', ')}</strong>.</>}
        </p>
        <p className="a-hint">This adds every missing item and category (including Shawarma, Mandi and Party Orders) and keeps everything already here: nothing is deleted or overwritten, and photos stay attached. The placeholder sample dishes are only hidden. After this, whatever you change in the dashboard is what the website shows.</p>
        <div className="a-actions">
          <Button busy={busy} onClick={() => run(null)}>{busy ? progress || 'Working…' : `Copy the website menu into the dashboard (${plan.missingItems.length} items to add)`}</Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card title="Some website menu items are not in the database">
        <p className="a-hint">{plan.missingItems.length} item{plan.missingItems.length === 1 ? '' : 's'} from the website's original menu {plan.missingItems.length === 1 ? 'is' : 'are'} missing{plan.missingCategories.length ? ` and ${plan.missingCategories.length} categor${plan.missingCategories.length === 1 ? 'y' : 'ies'}` : ''}.</p>
        <div className="a-actions">
          <Button small onClick={() => (plan.missingItems.length ? setRestoring(true) : run(null))}>{plan.missingItems.length ? 'Review and restore' : 'Add the missing categories'}</Button>
        </div>
      </Card>
      {restoring && <RestoreModal plan={plan} busy={busy} onClose={() => setRestoring(false)} onRestore={(ids) => run(ids)} />}
    </>
  );
}

export default function MenuPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { loading, error, data, reload } = useLoad(loadAll);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [editing, setEditing] = useState(null);

  const [managing, setManaging] = useState(false);
  const index = useMemo(() => buildIndex(data?.subs || []), [data]);

  // Subcategories of the chosen category (for the filter), in website order.
  const sectionList = useMemo(() => (data && category !== 'all' ? flattenTree(index, category) : []), [data, index, category]);
  const legacyHeadings = useMemo(() => {
    if (!data || category === 'all' || data.structureReady) return [];
    return [...new Set(data.items.filter((i) => i.category_key === category && pathKey(i)).map(pathKey))];
  }, [data, category]);

  // Items in the order the website shows them: category order, then subcategory order, then the item's own order.
  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const rank = new Map(data.cats.map((c, i) => [c.key, i]));
    const placed = new Map(data.items.map((i) => [i.id, placeItem(data.structureReady ? index : null, i)]));
    const inFilter = (i) => {
      if (sectionFilter === 'all' || category === 'all') return true;
      if (sectionFilter === '__none__') return !i.subcategory_id && !pathKey(i);
      return data.structureReady ? i.subcategory_id === sectionFilter : pathKey(i) === sectionFilter;
    };
    return data.items
      .filter(
        (i) =>
          (category === 'all' || i.category_key === category) &&
          inFilter(i) &&
          (!q || i.name.toLowerCase().includes(q) || (placed.get(i.id).path.join(SEP)).toLowerCase().includes(q) || (i.price_text || '').toLowerCase().includes(q))
      )
      .sort(
        (a, b) =>
          (rank.get(a.category_key) ?? 99) - (rank.get(b.category_key) ?? 99) ||
          compareOrderKeys(placed.get(a.id).orderKey, placed.get(b.id).orderKey) ||
          (a.sort_order || 0) - (b.sort_order || 0)
      );
  }, [data, index, category, query, sectionFilter]);

  const labelOf = (item) => (data.structureReady ? placeItem(index, item).path.join(SEP) : pathKey(item));

  const chooseCategory = (key) => {
    setCategory(key);
    setSectionFilter('all');
  };

  const remove = async (item) => {
    const ok = await confirm({ title: 'Delete this menu item?', message: `“${item.name}” will be deleted permanently from the website and the database, together with its photo and video. To keep it but take it off the menu for now, use Disable instead.`, confirmLabel: 'Delete item' });
    if (!ok) return;
    try {
      // the database row first: if that fails, the item keeps its photo and video
      const { error: e } = await supabase.from('menu_items').delete().eq('id', item.id);
      if (e) throw e;
      await removeAllMedia('menu_item', item.id);
      await rememberDeleted([item.id]); // so "restore website items" never brings back what you deleted on purpose
      await refreshContent();
      toast.success(`“${item.name}” deleted.`);
      reload();
    } catch (e) {
      toast.error(`Not deleted. ${errorText(e)}`);
    }
  };

  const toggleAvailable = async (item) => {
    const { error: e } = await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id);
    if (e) return toast.error(errorText(e));
    await refreshContent();
    toast.success(item.available ? `“${item.name}” disabled: it is no longer on the website.` : `“${item.name}” enabled: it is back on the website.`);
    reload();
  };

  // Switch ONE item between Available and Temporarily unavailable (only this item's own row is changed).
  const toggleAvailability = async (item) => {
    const goingOff = item.availability !== 'unavailable';
    const { error: e } = await supabase
      .from('menu_items')
      .update({ availability: goingOff ? 'unavailable' : 'available', unavailable_until: null })
      .eq('id', item.id);
    if (e) return toast.error(errorText(e));
    await refreshContent();
    toast.success(goingOff ? `“${item.name}” now shows “Currently Unavailable” on the website.` : `“${item.name}” is available again.`);
    reload();
  };

  // Move one item up or down inside its own section (the other sections keep their order).
  // The two neighbours swap their order numbers. If they happen to share a number, the category is renumbered first.
  const move = async (item, direction) => {
    const inCategory = data.items.filter((i) => i.category_key === item.category_key);
    const inSection = inCategory.filter((i) => groupKey(i) === groupKey(item)).sort((x, y) => (x.sort_order || 0) - (y.sort_order || 0));
    const index = inSection.findIndex((i) => i.id === item.id);
    const neighbour = inSection[index + direction];
    if (!neighbour) return;
    try {
      let updates;
      if ((item.sort_order || 0) !== (neighbour.sort_order || 0)) {
        updates = [
          [item.id, neighbour.sort_order],
          [neighbour.id, item.sort_order],
        ];
      } else {
        const order = inCategory.slice();
        const i1 = order.findIndex((i) => i.id === item.id);
        const i2 = order.findIndex((i) => i.id === neighbour.id);
        [order[i1], order[i2]] = [order[i2], order[i1]];
        updates = order.map((row, i) => [row.id, i + 1]);
      }
      const results = await Promise.all(updates.map(([id, value]) => supabase.from('menu_items').update({ sort_order: value }).eq('id', id)));
      const failed = results.find((r) => r && r.error);
      if (failed) throw failed.error;
      await refreshContent();
      reload();
    } catch (e) {
      toast.error(`Order not changed. ${errorText(e)}`);
    }
  };

  return (
    <>
      <div className="a-pagehead">
        <div>
          <h1>Menu management</h1>
          <p>Add, edit or delete any food or drink in every category: name, price, description, photo, video, category and subcategory. Disable an item to take it off the website, or mark it Temporarily unavailable. Changes appear on the website immediately.</p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY, category_key: category === 'all' ? 'chai' : category })}>+ Add food item</Button>
      </div>

      <SyncPanel onDone={reload} />
      {data && !data.structureReady && <StructureSetup />}

      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="a-toolbar">
              <div className="a-tabs" role="tablist">
                <button type="button" className={category === 'all' ? 'is-on' : ''} onClick={() => chooseCategory('all')}>
                  All ({data.items.length})
                </button>
                {data.cats.map((c) => (
                  <button key={c.key} type="button" className={category === c.key ? 'is-on' : ''} onClick={() => chooseCategory(c.key)}>
                    {c.label} ({data.items.filter((i) => i.category_key === c.key).length})
                  </button>
                ))}
              </div>
              <TextInput type="search" placeholder="Search items…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search items" />
            </div>
            {category !== 'all' && (
              <div className="a-toolbar">
                {(sectionList.length > 0 || legacyHeadings.length > 0) && (
                  <Select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} aria-label="Filter by subcategory">
                    <option value="all">All subcategories</option>
                    <option value="__none__">No subcategory</option>
                    {sectionList.map(({ node, label, depth }) => (
                      <option key={node.id} value={node.id}>{'\u00A0\u00A0'.repeat(depth)}{label}</option>
                    ))}
                    {legacyHeadings.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </Select>
                )}
                {data.structureReady && <Button small variant="ghost" onClick={() => setManaging((v) => !v)}>{managing ? 'Close subcategories' : 'Manage subcategories'}</Button>}
              </div>
            )}
            {managing && data.structureReady && category !== 'all' && (
              <Card title={`Subcategories of ${data.cats.find((c) => c.key === category)?.label}`}>
                <SubcategoryManager category={data.cats.find((c) => c.key === category)} subs={data.subs.filter((x) => x.category_key === category)} items={data.items} onChanged={reload} />
              </Card>
            )}

            {rows.length === 0 ? (
              <Card>
                <p className="a-hint">No items found.</p>
              </Card>
            ) : (
              <div className="a-list">
                {rows.map((item) => (
                  <div key={item.id} className={`a-row ${item.available ? '' : 'is-off'} ${isRowUnavailable(item) ? 'is-unavail' : ''}`}>
                    <div className="a-thumb">{data.thumbs[item.id] ? <img src={data.thumbs[item.id]} alt="" loading="lazy" /> : <span>No photo</span>}</div>
                    <div className="a-row-main">
                      <strong>{item.name}</strong>
                      <span>
                        {data.cats.find((c) => c.key === item.category_key)?.label} · {labelOf(item) || 'No subcategory'} · {item.price_text || `₹${Number(item.price)}`}
                      </span>
                      <span className="a-tags">
                        {!item.available && <em className="is-warn">Disabled (not on website)</em>}
                        {isRowUnavailable(item) && <em className="is-warn">Currently unavailable{item.availability === 'unavailable' && item.unavailable_until ? ` until ${formatRestaurantDateTime(item.unavailable_until)}` : ''}</em>}
                        {item.availability === 'unavailable' && item.unavailable_until && !isRowUnavailable(item) && <em className="is-muted">Unavailable period ended</em>}
                        {item.available_from && item.available_to && <em>Served {item.available_from.slice(0, 5)}–{item.available_to.slice(0, 5)}</em>}
                        {item.featured && <em>Featured</em>}
                        {data.clips.has(item.id) ? <em>Video</em> : <em className="is-muted">No video</em>}
                      </span>
                    </div>
                    <div className="a-row-actions">
                      <Button small onClick={() => setEditing(item)}>
                        Edit
                      </Button>
                      <Button small variant="ghost" onClick={() => toggleAvailability(item)}>
                        {item.availability === 'unavailable' ? 'Make available' : 'Mark unavailable'}
                      </Button>
                      <Button small variant="ghost" onClick={() => toggleAvailable(item)}>
                        {item.available ? 'Disable' : 'Enable'}
                      </Button>
                      <Button small variant="ghost" onClick={() => move(item, -1)} aria-label={`Move ${item.name} up`}>↑</Button>
                      <Button small variant="ghost" onClick={() => move(item, 1)} aria-label={`Move ${item.name} down`}>↓</Button>
                      <Button small variant="danger" onClick={() => remove(item)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </LoadState>

      {editing && data && <ItemForm key={editing.id || 'new'} initial={editing} cats={data.cats} items={data.items} subs={data.subs} structureReady={data.structureReady} onSaved={reload} onClose={() => { setEditing(null); reload(); }} />}
    </>
  );
}
