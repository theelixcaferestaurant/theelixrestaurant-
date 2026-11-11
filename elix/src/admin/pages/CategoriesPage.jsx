import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { refreshContent } from '../../lib/content';
import { fetchAllRows } from '../../lib/fetchAll';
import MediaField from '../MediaField';
import { sortCategories } from '../menuSync';
import { Button, Card, Field, LoadState, TextArea, TextInput, errorText, useLoad, useToast } from '../ui';

function CategoryCard({ category, count, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...category, subs: (category.subcategories || []).join('\n') });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.label.trim()) return toast.error('The category name cannot be empty.');
    setSaving(true);
    try {
      const subcategories = form.subs.split('\n').map((s) => s.trim()).filter(Boolean);
      const { error } = await supabase
        .from('categories')
        .update({ label: form.label.trim(), heading: form.heading.trim(), intro: form.intro.trim(), short_text: form.short_text.trim(), subcategories })
        .eq('key', category.key);
      if (error) throw error;
      await refreshContent();
      toast.success(`${form.label} saved and live on the website.`);
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={category.label} actions={<><code>/{category.key}</code> <Link to="/admin/menu">{count} item{count === 1 ? '' : 's'} · manage</Link></>}>
      <div className="a-grid">
        <Field label="Category name"><TextInput value={form.label} onChange={(e) => set('label', e.target.value)} /></Field>
        <Field label="Page heading"><TextInput value={form.heading} onChange={(e) => set('heading', e.target.value)} /></Field>
        <Field label="Introduction (category page)" wide><TextArea value={form.intro} onChange={(e) => set('intro', e.target.value)} /></Field>
        <Field label="Short description (Explore Menu cards)" wide><TextArea value={form.short_text} onChange={(e) => set('short_text', e.target.value)} /></Field>
        <Field label="Subcategories (filter buttons)" hint="One per line, in the order they should appear." wide>
          <TextArea rows={5} value={form.subs} onChange={(e) => set('subs', e.target.value)} />
        </Field>
      </div>
      <div className="a-actions">
        <Button busy={saving} onClick={save}>Save {category.label}</Button>
      </div>
      <div className="a-media-grid">
        <MediaField ownerType="site" ownerId={`category-${category.key}`} kind="image" label="Category banner photograph" hint="Wide landscape image (about 21:9). Used on the category page and Explore Menu." />
      </div>
    </Card>
  );
}

export default function CategoriesPage() {
  const { loading, error, data, reload } = useLoad(async () => {
    const [cats, items] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      fetchAllRows(() => supabase.from('menu_items').select('id, category_key').order('id')),
    ]);
    if (cats.error) throw cats.error;
    if (items.error) throw items.error;
    const counts = {};
    items.data.forEach((i) => (counts[i.category_key] = (counts[i.category_key] || 0) + 1));
    return { rows: sortCategories(cats.data), counts };
  });
  return (
    <>
      <div className="a-pagehead">
        <div>
          <h1>Categories</h1>
          <p>Every menu category on the website (Chai, Tiffins, Restaurant Food, Mandi, Shawarma, Bakery and Party Orders). Colours and page designs stay as designed; names, text, subcategories and banner photos are editable. Add, move or delete the dishes of a category in Menu management.</p>
        </div>
      </div>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data?.rows.map((c) => <CategoryCard key={c.key} category={c} count={data.counts[c.key] || 0} onSaved={reload} />)}
      </LoadState>
    </>
  );
}
