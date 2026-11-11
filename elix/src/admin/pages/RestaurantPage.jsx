import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { refreshContent } from '../../lib/content';
import { Button, Card, Field, LoadState, TextInput, errorText, useLoad, useToast } from '../ui';

const PLATFORMS = [
  ['instagram', 'Instagram', 'https://instagram.com/yourrestaurant'],
  ['facebook', 'Facebook', 'https://facebook.com/yourrestaurant'],
  ['youtube', 'YouTube', 'https://youtube.com/@yourrestaurant'],
  ['maps', 'Google Maps', 'https://maps.google.com/?q=…'],
];

async function loadAll() {
  const [info, social] = await Promise.all([
    supabase.from('restaurant_info').select('*').eq('id', 1).maybeSingle(),
    supabase.from('social_links').select('*'),
  ]);
  const failed = [info, social].find((r) => r.error);
  if (failed) throw failed.error;
  return { info: info.data || { name: 'The Elix', tagline: '', address: '', phone: '', email: '' }, social: Object.fromEntries(social.data.map((s) => [s.platform, s.url])) };
}

function InfoCard({ initial, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return toast.error('That email address does not look right.');
    setSaving(true);
    try {
      const { error } = await supabase.from('restaurant_info').upsert({ id: 1, name: form.name.trim() || 'The Elix', tagline: form.tagline.trim(), address: form.address.trim(), phone: form.phone.trim(), email: form.email.trim() });
      if (error) throw error;
      await refreshContent();
      toast.success('Restaurant details saved and live on the website.');
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Contact information">
      <div className="a-grid">
        <Field label="Restaurant name"><TextInput value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Tagline" hint="Shown on the home page and in the footer."><TextInput value={form.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
        <Field label="Address" wide><TextInput value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Phone number"><TextInput type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email address"><TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
      </div>
      <div className="a-actions"><Button busy={saving} onClick={save}>Save contact information</Button></div>
    </Card>
  );
}

function SocialCard({ initial, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const bad = PLATFORMS.find(([key]) => form[key]?.trim() && !/^https?:\/\//i.test(form[key].trim()));
    if (bad) return toast.error(`${bad[1]}: the link must start with https://`);
    setSaving(true);
    try {
      const { error } = await supabase.from('social_links').upsert(PLATFORMS.map(([platform]) => ({ platform, url: (form[platform] || '').trim() })), { onConflict: 'platform' });
      if (error) throw error;
      await refreshContent();
      toast.success('Social links saved and live on the website.');
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Social media and map links">
      <div className="a-grid">
        {PLATFORMS.map(([key, label, example]) => (
          <Field key={key} label={label} hint="Leave empty to keep the icon inactive.">
            <TextInput type="url" inputMode="url" placeholder={example} value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <div className="a-actions"><Button busy={saving} onClick={save}>Save social links</Button></div>
    </Card>
  );
}

export default function RestaurantPage() {
  const { loading, error, data, reload } = useLoad(loadAll);
  return (
    <>
      <div className="a-pagehead"><div><h1>Restaurant details</h1><p>Address, phone, email and social links. Opening hours now have their own page: Opening hours.</p></div></div>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <InfoCard initial={data.info} onSaved={reload} />
            <SocialCard initial={data.social} onSaved={reload} />
          </>
        )}
      </LoadState>
    </>
  );
}
