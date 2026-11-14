import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { refreshContent } from '../../lib/content';
import { SETTINGS } from '../../data/siteData';
import { Link } from 'react-router-dom';
import { Button, Card, Field, LoadState, TextArea, TextInput, errorText, useLoad, useToast } from '../ui';

const TEXTS = [
  ['hero_lead', 'Home page: text under the tagline', true],
  ['welcome_heading', 'Welcome section: heading', false],
  ['welcome_text', 'Welcome section: message', true],
  ['brand_heading', 'Brand introduction: heading', false],
  ['brand_text', 'Brand introduction: text', true],
  ['ambience_title', 'Atmosphere banner: heading', false],
  ['ambience_text', 'Atmosphere banner: text', true],
  ['explore_subtitle', 'Explore our menu: subtitle', false],
  ['pillar_1_title', 'Why The Elix, pillar 1: title', false],
  ['pillar_1_text', 'Why The Elix, pillar 1: text', true],
  ['pillar_2_title', 'Why The Elix, pillar 2: title', false],
  ['pillar_2_text', 'Why The Elix, pillar 2: text', true],
  ['pillar_3_title', 'Why The Elix, pillar 3: title', false],
  ['pillar_3_text', 'Why The Elix, pillar 3: text', true],
  ['pillar_4_title', 'Why The Elix, pillar 4: title', false],
  ['pillar_4_text', 'Why The Elix, pillar 4: text', true],
  ['demo_notice', 'Demonstration notice', true],
];

export default function HomepagePage() {
  const toast = useToast();
  const { loading, error, data, reload } = useLoad(async () => {
    const { data: rows, error: e } = await supabase.from('site_settings').select('*');
    if (e) throw e;
    return { ...SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  });
  return (
    <>
      <div className="a-pagehead"><div><h1>Website content</h1><p>Homepage, About and brand wording shown on the website.</p></div></div>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && <TextsCard initial={data} toast={toast} onSaved={reload} />}
      </LoadState>

      <Card title="Banners, backgrounds and videos">
        <p className="a-hint">The hero video, banners and page photographs are now managed on the <Link to="/admin/media">Website media</Link> page.</p>
      </Card>
    </>
  );
}

function TextsCard({ initial, toast, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('site_settings').upsert(TEXTS.map(([key]) => ({ key, value: (form[key] ?? '').trim() })), { onConflict: 'key' });
      if (error) throw error;
      await refreshContent();
      toast.success('Website content saved and live.');
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Website wording">
      <div className="a-grid">
        {TEXTS.map(([key, label, multi]) => (
          <Field key={key} label={label} wide hint={key === 'demo_notice' ? 'Leave empty to hide the demonstration notice before launch.' : undefined}>
            {multi ? <TextArea value={form[key] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} /> : <TextInput value={form[key] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />}
          </Field>
        ))}
      </div>
      <div className="a-actions"><Button busy={saving} onClick={save}>Save wording</Button></div>
    </Card>
  );
}
