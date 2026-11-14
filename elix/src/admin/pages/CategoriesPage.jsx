import { useState } from 'react';
import { Link } from 'react-router-dom';
import MediaField from '../MediaField';
import StructureSetup from '../StructureSetup';
import SubcategoryManager from '../SubcategoryManager';
import { categoryKeyFor, createCategory, deleteCategory, isBuiltInCategory, loadStructure, moveCategory, setCategoryEnabled, updateCategory } from '../menuStructure';
import { Button, Card, Check, Field, LoadState, Modal, TextArea, TextInput, errorText, useLoad, useToast } from '../ui';

// ---- add / edit one category (text + banner photograph) ----
function CategoryEditor({ category, cats, canCreate, onSaved, onClose }) {
  const toast = useToast();
  const isNew = !category;
  const [savedKey, setSavedKey] = useState(category?.key || null); // the banner can be uploaded once the category exists
  const [form, setForm] = useState({
    label: category?.label || '',
    heading: category?.heading || '',
    intro: category?.intro || '',
    short_text: category?.short_text || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      if (savedKey) {
        await updateCategory(savedKey, form);
        toast.success(`${form.label.trim()} saved and live on the website.`);
      } else {
        const row = await createCategory(form, cats);
        setSavedKey(row.key);
        toast.success(`${row.label} added. You can now upload its banner photograph and add subcategories and dishes.`);
      }
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={savedKey ? `Edit: ${form.label || savedKey}` : 'Add category'} onClose={onClose}>
      <div className="a-grid">
        <Field label="Category name *" hint={!savedKey && form.label.trim() ? `Website address: /menu/${categoryKeyFor(form.label, cats.map((c) => c.key))}` : undefined}>
          <TextInput value={form.label} onChange={(e) => set('label', e.target.value)} maxLength={60} placeholder="e.g. Desserts" />
        </Field>
        <Field label="Page heading" hint="Large title on the category page. Left empty it uses the category name.">
          <TextInput value={form.heading} onChange={(e) => set('heading', e.target.value)} />
        </Field>
        <Field label="Introduction (category page)" wide>
          <TextArea value={form.intro} onChange={(e) => set('intro', e.target.value)} />
        </Field>
        <Field label="Short description (Dine In cards)" wide>
          <TextArea value={form.short_text} onChange={(e) => set('short_text', e.target.value)} />
        </Field>
      </div>
      <div className="a-actions">
        <Button busy={saving} disabled={!form.label.trim() || (isNew && !savedKey && !canCreate)} onClick={save}>
          {savedKey ? 'Save changes' : 'Add category'}
        </Button>
        <Button variant="ghost" onClick={onClose}>{savedKey ? 'Close' : 'Cancel'}</Button>
      </div>
      <div className="a-media-grid">
        {savedKey ? (
          <MediaField ownerType="site" ownerId={`category-${savedKey}`} kind="image" label="Category banner photograph" hint="Wide landscape image (about 21:9). Used on the category page and Dine In." />
        ) : (
          <p className="a-hint">Add the category first, then you can upload its banner photograph.</p>
        )}
      </div>
    </Modal>
  );
}

// ---- delete a dashboard-created category ----
function DeleteCategoryDialog({ category, itemCount, subCount, onClose, onDone }) {
  const toast = useToast();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const result = await deleteCategory(category);
      toast.success(`${category.label} deleted${result.items ? ` with ${result.items} dish${result.items === 1 ? '' : 'es'}` : ''}.`);
      onDone();
    } catch (e) {
      toast.error(`Not deleted. ${errorText(e)}`);
      setBusy(false);
    }
  };
  return (
    <Modal title={`Delete “${category.label}”?`} onClose={onClose}>
      <p>
        This deletes the category permanently from the website and the database
        {subCount > 0 && <>, together with its <strong>{subCount}</strong> subcategor{subCount === 1 ? 'y' : 'ies'}</>}
        {itemCount > 0 && <> and its <strong>{itemCount}</strong> dish{itemCount === 1 ? '' : 'es'} (with their photos and videos)</>}. To keep it but take it off the website for now, use Hide instead.
      </p>
      {itemCount > 0 && <Check label={`I understand that ${itemCount} dish${itemCount === 1 ? '' : 'es'} will be deleted permanently.`} checked={sure} onChange={setSure} />}
      <div className="a-actions">
        <Button variant="danger" busy={busy} disabled={itemCount > 0 && !sure} onClick={go}>Delete category</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

export default function CategoriesPage() {
  const toast = useToast();
  const { loading, error, data, reload } = useLoad(loadStructure);
  const [editing, setEditing] = useState(null); // a category row, or 'new'
  const [removing, setRemoving] = useState(null);
  const [open, setOpen] = useState(null); // key of the category whose subcategories are shown
  const [busyKey, setBusyKey] = useState(null);

  const act = async (key, work, success) => {
    setBusyKey(key);
    try {
      await work();
      if (success) toast.success(success);
      reload();
    } catch (e) {
      toast.error(`Not changed. ${errorText(e)}`);
    } finally {
      setBusyKey(null);
    }
  };

  const itemCount = (key) => data.items.filter((i) => i.category_key === key).length;
  const subCount = (key) => data.subs.filter((s) => s.category_key === key).length;
  const movable = data ? data.cats.filter((c) => c.key !== 'party') : [];

  return (
    <>
      <div className="a-pagehead">
        <div>
          <h1>Categories</h1>
          <p>
            Create, rename, reorder, hide or delete the menu categories, and manage the subcategories inside each one. The order below is the order of the Dine In page. Colours and page designs stay as designed;
            a new category uses the website's standard colours. Add, move or delete the dishes in <Link to="/admin/menu">Menu management</Link>.
          </p>
        </div>
        {data?.ready && <Button onClick={() => setEditing('new')}>+ Add category</Button>}
      </div>

      {data && !data.ready && <StructureSetup />}

      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="a-list">
            {data.cats.map((cat) => {
              const builtIn = isBuiltInCategory(cat.key);
              const hidden = data.ready && cat.enabled === false;
              const position = movable.findIndex((c) => c.key === cat.key);
              const busy = busyKey === cat.key;
              return (
                <div key={cat.key}>
                  <div className={`a-row ${hidden ? 'is-off' : ''}`}>
                    <div className="a-row-main">
                      <strong>{cat.label}</strong>
                      <span>
                        <code>{cat.key === 'party' ? '/explore/take/party' : builtIn ? `/${cat.key}` : `/menu/${cat.key}`}</code> · {itemCount(cat.key)} dish{itemCount(cat.key) === 1 ? '' : 'es'}
                        {data.ready && <> · {subCount(cat.key)} subcategor{subCount(cat.key) === 1 ? 'y' : 'ies'}</>}
                      </span>
                      <span className="a-tags">
                        {hidden && <em className="is-warn">Hidden from website</em>}
                        {builtIn ? <em className="is-muted">Built-in page</em> : <em>Created in dashboard</em>}
                      </span>
                    </div>
                    <div className="a-row-actions">
                      {data.ready && cat.key !== 'party' && (
                        <>
                          <Button small variant="ghost" disabled={busy || position <= 0} onClick={() => act(cat.key, () => moveCategory(data.cats, cat.key, -1))} aria-label={`Move ${cat.label} up`}>↑</Button>
                          <Button small variant="ghost" disabled={busy || position < 0 || position >= movable.length - 1} onClick={() => act(cat.key, () => moveCategory(data.cats, cat.key, 1))} aria-label={`Move ${cat.label} down`}>↓</Button>
                        </>
                      )}
                      <Button small onClick={() => setEditing(cat)}>Edit</Button>
                      {data.ready && (
                        <Button small variant="ghost" onClick={() => setOpen(open === cat.key ? null : cat.key)} aria-expanded={open === cat.key}>
                          {open === cat.key ? 'Close subcategories' : 'Subcategories'}
                        </Button>
                      )}
                      {data.ready && (
                        <Button
                          small
                          variant="ghost"
                          busy={busy}
                          onClick={() => act(cat.key, () => setCategoryEnabled(cat.key, hidden), hidden ? `${cat.label} is back on the website.` : `${cat.label} hidden from the website.`)}
                        >
                          {hidden ? 'Show' : 'Hide'}
                        </Button>
                      )}
                      {data.ready && !builtIn && (
                        <Button small variant="danger" onClick={() => setRemoving(cat)}>Delete</Button>
                      )}
                    </div>
                  </div>
                  {data.ready && open === cat.key && (
                    <SubcategoryManager category={cat} subs={data.subs.filter((s) => s.category_key === cat.key)} items={data.items} onChanged={reload} />
                  )}
                </div>
              );
            })}
            {data.cats.length === 0 && (
              <Card>
                <p className="a-hint">No categories found.</p>
              </Card>
            )}
          </div>
        )}
      </LoadState>

      {editing && data && (
        <CategoryEditor
          key={editing === 'new' ? 'new' : editing.key}
          category={editing === 'new' ? null : editing}
          cats={data.cats}
          canCreate={data.ready}
          onSaved={reload}
          onClose={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {removing && data && (
        <DeleteCategoryDialog
          category={removing}
          itemCount={itemCount(removing.key)}
          subCount={subCount(removing.key)}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            if (open === removing.key) setOpen(null);
            reload();
          }}
        />
      )}
    </>
  );
}
