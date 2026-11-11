import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { refreshContent } from '../../lib/content';
import MediaField from '../MediaField';
import { removeAllMedia } from '../media';
import { Button, Check, Field, LoadState, Modal, Select, TextInput, errorText, slugify, useLoad, useToast } from '../ui';

const GROUPS = ['Interiors', 'Food', 'Bakery', 'Beverages', 'Tiffins'];
const RATIOS = [['4 / 3', 'Landscape'], ['1 / 1', 'Square'], ['4 / 5', 'Portrait'], ['3 / 4', 'Tall portrait']];

async function loadAll() {
  const [g, items, media] = await Promise.all([
    supabase.from('gallery_items').select('*').order('sort_order').order('created_at'),
    supabase.from('menu_items').select('id, name').order('name'),
    supabase.from('media_assets').select('owner_id, kind, url').eq('owner_type', 'gallery'),
  ]);
  const failed = [g, items, media].find((r) => r.error);
  if (failed) throw failed.error;
  const thumbs = {};
  const clips = new Set();
  media.data.forEach((m) => (m.kind === 'image' ? (thumbs[m.owner_id] = m.url) : clips.add(m.owner_id)));
  return { gallery: g.data, menu: items.data, thumbs, clips };
}

function GalleryForm({ initial, menu, onSaved, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...initial, item_id: initial.item_id || '' });
  const [savedId, setSavedId] = useState(initial.created_at ? initial.id : null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const title = form.title.trim();
    if (!title) return toast.error('Please enter a title.');
    setSaving(true);
    try {
      const row = { title, grp: form.grp, ratio: form.ratio, item_id: form.item_id || null, visible: form.visible, sort_order: Number(form.sort_order) || 0 };
      const id = savedId || `${slugify(title) || 'entry'}-${Date.now().toString(36).slice(-4)}`;
      const { error } = savedId ? await supabase.from('gallery_items').update(row).eq('id', savedId) : await supabase.from('gallery_items').insert({ id, ...row });
      if (error) throw error;
      await refreshContent();
      toast.success(savedId ? 'Gallery entry saved and live.' : 'Gallery entry added. Now upload its photo or video.');
      setSavedId(id);
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={savedId ? 'Edit gallery entry' : 'Add gallery entry'} onClose={onClose}>
      <div className="a-grid">
        <Field label="Title / caption *"><TextInput value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Group">
          <Select value={form.grp} onChange={(e) => set('grp', e.target.value)}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</Select>
        </Field>
        <Field label="Shape in the gallery grid">
          <Select value={form.ratio} onChange={(e) => set('ratio', e.target.value)}>{RATIOS.map(([v, l]) => <option key={v} value={v}>{l} ({v})</option>)}</Select>
        </Field>
        <Field label="Linked menu item (optional)" hint="If no photo is uploaded here, the linked item's photo is shown.">
          <Select value={form.item_id} onChange={(e) => set('item_id', e.target.value)}>
            <option value="">None</option>
            {menu.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Display order" hint="Lower numbers appear first."><TextInput type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} /></Field>
        <div className="a-checks"><Check label="Visible on the website" checked={form.visible} onChange={(v) => set('visible', v)} /></div>
      </div>
      <div className="a-actions">
        <Button busy={saving} onClick={save}>{savedId ? 'Save changes' : 'Add entry'}</Button>
        <Button variant="ghost" onClick={onClose}>{savedId ? 'Close' : 'Cancel'}</Button>
      </div>
      <div className="a-media-grid">
        {savedId ? (
          <>
            <MediaField ownerType="gallery" ownerId={savedId} kind="image" label="Photograph" onChanged={onSaved} />
            <MediaField ownerType="gallery" ownerId={savedId} kind="video" label="Video (optional)" hint="Plays on hover and in the full-screen viewer." onChanged={onSaved} />
          </>
        ) : (
          <p className="a-hint">Add the entry first, then upload its photograph or video.</p>
        )}
      </div>
    </Modal>
  );
}

export default function GalleryPage() {
  const toast = useToast();
  const { loading, error, data, reload } = useLoad(loadAll);
  const [editing, setEditing] = useState(null);

  const remove = async (entry) => {
    if (!window.confirm(`Delete “${entry.title}” and its media permanently?`)) return;
    try {
      await removeAllMedia('gallery', entry.id);
      const { error: e } = await supabase.from('gallery_items').delete().eq('id', entry.id);
      if (e) throw e;
      await refreshContent();
      toast.success('Gallery entry deleted.');
      reload();
    } catch (e) {
      toast.error(`Not deleted. ${errorText(e)}`);
    }
  };

  return (
    <>
      <div className="a-pagehead">
        <div>
          <h1>Gallery</h1>
          <p>Photographs and videos shown on the Gallery page.</p>
        </div>
        <Button onClick={() => setEditing({ title: '', grp: 'Interiors', ratio: '4 / 3', item_id: '', visible: true, sort_order: (data?.gallery.length || 0) + 1 })}>+ Add entry</Button>
      </div>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="a-tiles">
            {data.gallery.map((g) => (
              <div key={g.id} className={`a-tile ${g.visible ? '' : 'is-off'}`}>
                <div className="a-thumb is-large">{data.thumbs[g.id] ? <img src={data.thumbs[g.id]} alt="" loading="lazy" /> : <span>{g.item_id ? 'Uses menu item photo' : 'No photo'}</span>}</div>
                <strong>{g.title}</strong>
                <span className="a-hint">{g.grp}{data.clips.has(g.id) ? ' · Video' : ''}{g.visible ? '' : ' · Hidden'}</span>
                <div className="a-row-actions">
                  <Button small onClick={() => setEditing(g)}>Edit</Button>
                  <Button small variant="danger" onClick={() => remove(g)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </LoadState>
      {editing && data && <GalleryForm key={editing.id || 'new'} initial={editing} menu={data.menu} onSaved={reload} onClose={() => { setEditing(null); reload(); }} />}
    </>
  );
}
