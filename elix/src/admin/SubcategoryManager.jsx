import { useMemo, useState } from 'react';
import { MAX_DEPTH, buildIndex, depthOf, flattenTree, validateMove } from '../lib/menuStructure';
import { createSubcategory, deleteSubcategory, describeSubcategory, moveSubcategory, updateSubcategory } from './menuStructure';
import { Button, Check, Field, Modal, Select, TextInput, errorText, useLoad, useToast } from './ui';

// ---- delete dialog: keep the dishes (default) or delete everything inside ----
function DeleteDialog({ node, subs, onClose, onDone }) {
  const toast = useToast();
  const { loading, error, data } = useLoad(() => describeSubcategory(subs, node.id));
  const [mode, setMode] = useState('keep-items');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasInside = data && (data.itemsInside > 0 || data.subcategories > 0);

  const go = async () => {
    setBusy(true);
    try {
      const result = await deleteSubcategory(node.id, mode, subs);
      toast.success(
        mode === 'delete-all'
          ? `“${node.name}” deleted with ${result.items} dish${result.items === 1 ? '' : 'es'}.`
          : `“${node.name}” deleted. ${result.items} dish${result.items === 1 ? '' : 'es'} moved up one level.`
      );
      onDone();
    } catch (e) {
      toast.error(`Not deleted. ${errorText(e)}`);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Delete “${node.name}”?`} onClose={onClose}>
      {loading && <p className="a-hint">Checking what is inside…</p>}
      {error && <p className="a-hint">Could not check what is inside: {errorText(error)}</p>}
      {data && !hasInside && <p>This subcategory is empty. It will be deleted permanently.</p>}
      {data && hasInside && (
        <>
          <p>
            It holds <strong>{data.itemsInside}</strong> dish{data.itemsInside === 1 ? '' : 'es'}
            {data.subcategories > 0 && <> and has <strong>{data.subcategories}</strong> subcategor{data.subcategories === 1 ? 'y' : 'ies'} inside it</>}. What should happen to them?
          </p>
          <div className="a-radios">
            <label className="a-check">
              <input type="radio" name="del-mode" checked={mode === 'keep-items'} onChange={() => setMode('keep-items')} />
              <span>
                Delete only this subcategory
                <small>Its dishes and inner subcategories move up one level. Nothing else is lost.</small>
              </span>
            </label>
            <label className="a-check">
              <input type="radio" name="del-mode" checked={mode === 'delete-all'} onChange={() => setMode('delete-all')} />
              <span>
                Delete everything inside as well
                <small>The dishes and their photos and videos are deleted permanently.</small>
              </span>
            </label>
          </div>
          {mode === 'delete-all' && data.itemsInside > 0 && (
            <Check label={`I understand that ${data.itemsInside} dish${data.itemsInside === 1 ? '' : 'es'} will be deleted permanently.`} checked={sure} onChange={setSure} />
          )}
        </>
      )}
      <div className="a-actions">
        <Button variant="danger" busy={busy} disabled={loading || Boolean(error) || (mode === 'delete-all' && data?.itemsInside > 0 && !sure)} onClick={go}>
          {mode === 'delete-all' && hasInside ? 'Delete everything' : 'Delete subcategory'}
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

// ---- the panel shown under a category ----
// props: category (row), subs (all subcategory rows), items ([{ id, category_key, subcategory_id }]), onChanged () => reload
export default function SubcategoryManager({ category, subs, items, onChanged }) {
  const toast = useToast();
  const index = useMemo(() => buildIndex(subs), [subs]);
  const rows = useMemo(() => flattenTree(index, category.key), [index, category.key]);
  const counts = useMemo(() => {
    const map = new Map();
    items.forEach((item) => item.subcategory_id && map.set(item.subcategory_id, (map.get(item.subcategory_id) || 0) + 1));
    return map;
  }, [items]);
  const topLevelItems = items.filter((i) => i.category_key === category.key && !i.subcategory_id).length;

  const [adding, setAdding] = useState(null); // { parent_id, name }
  const [editing, setEditing] = useState(null); // { id, name, parent_id, enabled }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (work, success) => {
    setBusy(true);
    try {
      await work();
      if (success) toast.success(success);
      await onChanged();
      return true;
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const ok = await run(() => createSubcategory({ category_key: category.key, parent_id: adding.parent_id, name: adding.name }, subs), `“${adding.name.trim()}” added and live on the website.`);
    if (ok) setAdding(null);
  };

  const save = async () => {
    const original = index.byId.get(editing.id);
    const patch = {};
    if (editing.name !== original.name) patch.name = editing.name;
    if ((editing.parent_id || null) !== (original.parent_id || null)) patch.parent_id = editing.parent_id || null;
    if (editing.enabled !== original.enabled) patch.enabled = editing.enabled;
    if (!Object.keys(patch).length) return setEditing(null);
    const ok = await run(() => updateSubcategory(editing.id, patch, subs), 'Saved and live on the website.');
    if (ok) setEditing(null);
  };

  // where this subcategory could be moved to: top level or any other subcategory that is not inside it
  const parentChoices = (id) =>
    rows.filter(({ node }) => node.id !== id && !validateMove(index, id, node.id)).map(({ node, label, depth }) => ({ id: node.id, label: `${'\u00A0\u00A0'.repeat(depth)}${label}` }));

  const addForm = (parentId, depth) => (
    <div className="a-sub-form" style={{ marginLeft: depth * 22 }}>
      <TextInput
        autoFocus
        value={adding.name}
        onChange={(e) => setAdding({ ...adding, name: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && adding.name.trim() && add()}
        placeholder={parentId ? 'New inner subcategory name' : 'New subcategory name'}
        aria-label="Subcategory name"
        maxLength={120}
      />
      <Button small busy={busy} disabled={!adding.name.trim()} onClick={add}>Add</Button>
      <Button small variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
    </div>
  );

  return (
    <div className="a-sub-panel">
      <div className="a-toolbar">
        <p className="a-hint" style={{ margin: 0 }}>
          Subcategories group the dishes of {category.label} on the website. {topLevelItems} dish{topLevelItems === 1 ? '' : 'es'} sit directly in the category with no subcategory.
        </p>
        <Button small onClick={() => setAdding({ parent_id: null, name: '' })}>+ Add subcategory</Button>
      </div>
      {adding && adding.parent_id === null && addForm(null, 0)}

      {rows.length === 0 && !adding && <p className="a-hint">No subcategories yet. Dishes of this category are listed directly on its page.</p>}

      <div className="a-list">
        {rows.map(({ node, depth, label, position, siblingCount }) => (
          <div key={node.id}>
            <div className={`a-row a-sub-row ${node.enabled ? '' : 'is-off'}`} style={{ marginLeft: depth * 22 }}>
              {editing?.id === node.id ? (
                <div className="a-sub-edit">
                  <Field label="Name">
                    <TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={120} />
                  </Field>
                  <Field label="Sits inside">
                    <Select value={editing.parent_id || ''} onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || null })}>
                      <option value="">Top level of {category.label}</option>
                      {parentChoices(node.id).map((choice) => (
                        <option key={choice.id} value={choice.id}>{choice.label}</option>
                      ))}
                    </Select>
                  </Field>
                  <Check label="Show on website" checked={editing.enabled} onChange={(v) => setEditing({ ...editing, enabled: v })} hint="Switched off: this subcategory and everything inside it is hidden from the website." />
                  <div className="a-actions">
                    <Button small busy={busy} disabled={!editing.name.trim()} onClick={save}>Save</Button>
                    <Button small variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="a-row-main">
                    <strong>{node.name}</strong>
                    <span>
                      {counts.get(node.id) || 0} dish{(counts.get(node.id) || 0) === 1 ? '' : 'es'}
                      {depth > 0 && <> · inside {label.split(' › ').slice(0, -1).join(' › ')}</>}
                    </span>
                    <span className="a-tags">{!node.enabled && <em className="is-warn">Hidden from website</em>}</span>
                  </div>
                  <div className="a-row-actions">
                    <Button small variant="ghost" disabled={busy || position === 0} onClick={() => run(() => moveSubcategory(subs, node.id, -1))} aria-label={`Move ${node.name} up`}>↑</Button>
                    <Button small variant="ghost" disabled={busy || position >= siblingCount - 1} onClick={() => run(() => moveSubcategory(subs, node.id, 1))} aria-label={`Move ${node.name} down`}>↓</Button>
                    <Button small onClick={() => setEditing({ id: node.id, name: node.name, parent_id: node.parent_id || null, enabled: node.enabled })}>Edit</Button>
                    {depthOf(index, node.id) < MAX_DEPTH && (
                      <Button small variant="ghost" onClick={() => setAdding({ parent_id: node.id, name: '' })}>+ Inner</Button>
                    )}
                    <Button small variant="ghost" disabled={busy} onClick={() => run(() => updateSubcategory(node.id, { enabled: !node.enabled }, subs), node.enabled ? `“${node.name}” hidden from the website.` : `“${node.name}” is back on the website.`)}>
                      {node.enabled ? 'Hide' : 'Show'}
                    </Button>
                    <Button small variant="danger" onClick={() => setRemoving(node)}>Delete</Button>
                  </div>
                </>
              )}
            </div>
            {adding && adding.parent_id === node.id && addForm(node.id, depth + 1)}
          </div>
        ))}
      </div>

      {removing && (
        <DeleteDialog
          node={removing}
          subs={subs}
          onClose={() => setRemoving(null)}
          onDone={async () => {
            setRemoving(null);
            await onChanged();
          }}
        />
      )}
    </div>
  );
}
