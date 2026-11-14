import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { refreshContent } from '../../lib/content';
import { SETTINGS } from '../../data/siteData';
import MediaField from '../MediaField';
import { Button, Card, Field, LoadState, TextArea, TextInput, errorText, useLoad, useToast } from '../ui';

// Every piece of text on the public About Us page. Stored in site_settings (key / value), like the homepage wording.
const GROUPS = [
  ['Page heading', [
    ['about_title', 'Main heading', false],
    ['about_lead', 'Subheading', false],
    ['about_note', 'Note under the heading (shown after the demonstration notice)', true],
  ]],
  ['Our story section', [
    ['about_story_title', 'Section heading', false],
    ['about_story_lead', 'Story: main paragraph', true],
    ['about_story_text', 'Story: second paragraph', true],
  ]],
  ['Values: Vision, Food philosophy, Hospitality', [
    ['about_value_1_title', 'Value 1: title', false],
    ['about_value_1_text', 'Value 1: description', true],
    ['about_value_2_title', 'Value 2: title', false],
    ['about_value_2_text', 'Value 2: description', true],
    ['about_value_3_title', 'Value 3: title', false],
    ['about_value_3_text', 'Value 3: description', true],
  ]],
  ['Restaurant ambience section', [
    ['about_ambience_title', 'Heading', false],
    ['about_ambience_text', 'Description', true],
  ]],
  ['Bottom section (link to the menu)', [
    ['about_cta_title', 'Heading', false],
    ['about_cta_text', 'Text', false],
    ['about_cta_button', 'Button label', false],
  ]],
];
const KEYS = GROUPS.flatMap(([, fields]) => fields.map(([key]) => key));

export default function AboutPage() {
  const toast = useToast();
  const { loading, error, data, reload } = useLoad(async () => {
    const { data: rows, error: e } = await supabase.from('site_settings').select('*');
    if (e) throw e;
    return { ...SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  });
  return (
    <>
      <div className="a-pagehead"><div><h1>About Us</h1><p>Edit everything shown on the About Us page. Changes go live when you press Save.</p></div></div>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && <AboutForm initial={data} toast={toast} onSaved={reload} />}
      </LoadState>
      <Card title="About Us images">
        <p className="a-hint">Upload, replace or remove the two pictures on the About Us page.</p>
        <div className="a-media-grid">
          <MediaField ownerType="site" ownerId="about-story" kind="image" label="About page: our story image" hint="Recommended shape: 4:5 portrait." />
          <MediaField ownerType="site" ownerId="about-ambience" kind="image" label="About page: atmosphere banner" hint="Recommended shape: Wide landscape." />
        </div>
      </Card>
    </>
  );
}

function AboutForm({ initial, toast, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('site_settings').upsert(KEYS.map((key) => ({ key, value: (form[key] ?? '').trim() })), { onConflict: 'key' });
      if (error) throw error;
      await refreshContent();
      toast.success('About Us saved and live.');
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      {GROUPS.map(([title, fields]) => (
        <Card key={title} title={title}>
          <div className="a-grid">
            {fields.map(([key, label, multi]) => (
              <Field key={key} label={label} wide>
                {multi ? <TextArea value={form[key] ?? ''} onChange={set(key)} /> : <TextInput value={form[key] ?? ''} onChange={set(key)} />}
              </Field>
            ))}
          </div>
        </Card>
      ))}
      <div className="a-actions"><Button busy={saving} onClick={save}>Save About Us</Button></div>
    </>
  );
}
