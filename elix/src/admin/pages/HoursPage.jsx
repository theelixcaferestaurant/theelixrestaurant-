import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { refreshContent } from '../../lib/content';
import { DAY_NAMES } from '../../lib/hours';
import { isoToLocalInput, localInputToIso, timeToMinutes, to12h } from '../../lib/availability';
import { Button, Card, Check, Field, LoadState, TextArea, TextInput, errorText, useConfirm, useLoad, useToast } from '../ui';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

async function loadAll() {
  const [weekly, special, timings, settings] = await Promise.all([
    supabase.from('weekly_hours').select('*'),
    supabase.from('special_hours').select('*').order('on_date'),
    supabase.from('service_timings').select('*').order('sort_order'),
    supabase.from('site_settings').select('*').in('key', ['closure_notice_active', 'closure_notice_text', 'closure_notice_until']),
  ]);
  const failed = [weekly, special, timings, settings].find((r) => r.error);
  if (failed) throw failed.error;
  return {
    weekly: Object.fromEntries(weekly.data.map((r) => [r.day_of_week, r])),
    special: special.data,
    timings: timings.data,
    closure: Object.fromEntries(settings.data.map((r) => [r.key, r.value])),
  };
}

// ---------- weekly hours ----------
function WeeklyCard({ initial, onSaved }) {
  const toast = useToast();
  const [rows, setRows] = useState(() =>
    Object.fromEntries(ORDER.map((d) => [d, { is_closed: initial[d]?.is_closed ?? false, opens: hhmm(initial[d]?.opens) || '05:00', closes: hhmm(initial[d]?.closes) || '01:00' }]))
  );
  const [saving, setSaving] = useState(false);
  const set = (d, k, v) => setRows((r) => ({ ...r, [d]: { ...r[d], [k]: v } }));

  const save = async () => {
    for (const d of ORDER) {
      const r = rows[d];
      if (!r.is_closed && (!r.opens || !r.closes)) return toast.error(`${DAY_NAMES[d]}: enter opening and closing times, or tick Closed.`);
      if (!r.is_closed && timeToMinutes(r.opens) === timeToMinutes(r.closes)) return toast.error(`${DAY_NAMES[d]}: opening and closing time cannot be the same.`);
    }
    setSaving(true);
    try {
      const payload = ORDER.map((d) => ({ day_of_week: d, is_closed: rows[d].is_closed, opens: rows[d].is_closed ? null : rows[d].opens, closes: rows[d].is_closed ? null : rows[d].closes }));
      const { error } = await supabase.from('weekly_hours').upsert(payload, { onConflict: 'day_of_week' });
      if (error) throw error;
      await refreshContent();
      toast.success('Weekly hours saved and live on the website.');
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Weekly opening hours">
      <p className="a-hint">A closing time earlier than the opening time means the restaurant closes after midnight (for example 5:00 AM to 1:00 AM). Tick Closed for a day off.</p>
      {ORDER.map((d) => (
        <div key={d} className="a-dayrow">
          <strong>{DAY_NAMES[d]}</strong>
          <Check label="Closed" checked={rows[d].is_closed} onChange={(v) => set(d, 'is_closed', v)} />
          <TextInput type="time" aria-label={`${DAY_NAMES[d]} opens`} disabled={rows[d].is_closed} value={rows[d].opens} onChange={(e) => set(d, 'opens', e.target.value)} />
          <TextInput type="time" aria-label={`${DAY_NAMES[d]} closes`} disabled={rows[d].is_closed} value={rows[d].closes} onChange={(e) => set(d, 'closes', e.target.value)} />
        </div>
      ))}
      <div className="a-actions"><Button busy={saving} onClick={save}>Save weekly hours</Button></div>
    </Card>
  );
}

// ---------- temporary closure notice ----------
function ClosureCard({ initial, onSaved }) {
  const toast = useToast();
  const [active, setActive] = useState(initial.closure_notice_active === 'true');
  const [text, setText] = useState(initial.closure_notice_text || '');
  const [until, setUntil] = useState(isoToLocalInput(initial.closure_notice_until));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (active && !text.trim()) return toast.error('Write the notice text, or switch the notice off.');
    if (until && !localInputToIso(until)) return toast.error('The end date is not valid.');
    setSaving(true);
    try {
      const { error } = await supabase.from('site_settings').upsert(
        [
          { key: 'closure_notice_active', value: active ? 'true' : 'false' },
          { key: 'closure_notice_text', value: text.trim() },
          { key: 'closure_notice_until', value: until ? localInputToIso(until) : '' },
        ],
        { onConflict: 'key' }
      );
      if (error) throw error;
      await refreshContent();
      toast.success(active ? 'Closure notice is live on the website.' : 'Closure notice is switched off.');
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Temporary closure notice">
      <p className="a-hint">Shows a banner under the website header on every page, for example “Closed today for a private event. Open again tomorrow at 5:00 AM.”</p>
      <div className="a-grid">
        <div className="a-checks is-wide"><Check label="Show the notice on the website" checked={active} onChange={setActive} /></div>
        <Field label="Notice text" wide><TextArea maxLength={200} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <Field label="Hide automatically at (optional)" hint="Restaurant time (India). Leave empty to keep the notice until you switch it off."><TextInput type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
      </div>
      <div className="a-actions"><Button busy={saving} onClick={save}>Save notice</Button></div>
    </Card>
  );
}

// ---------- special / holiday hours ----------
const EMPTY_SPECIAL = { on_date: '', label: '', is_closed: true, opens: '10:00', closes: '22:00' };

function SpecialCard({ rows, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(EMPTY_SPECIAL);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const add = async () => {
    if (!form.on_date) return toast.error('Choose the date.');
    if (!form.is_closed && (!form.opens || !form.closes)) return toast.error('Enter opening and closing times, or tick Closed all day.');
    setSaving(true);
    try {
      const { error } = await supabase.from('special_hours').upsert(
        { on_date: form.on_date, label: form.label.trim(), is_closed: form.is_closed, opens: form.is_closed ? null : form.opens, closes: form.is_closed ? null : form.closes },
        { onConflict: 'on_date' }
      );
      if (error) throw error;
      await refreshContent();
      toast.success('Special day saved. It shows on the website until the date has passed.');
      setForm(EMPTY_SPECIAL);
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const ok = await confirm({ title: 'Remove this special day?', message: `${row.on_date}${row.label ? ` (${row.label})` : ''} will be removed. The normal weekly hours apply on that date.`, confirmLabel: 'Remove' });
    if (!ok) return;
    const { error } = await supabase.from('special_hours').delete().eq('id', row.id);
    if (error) return toast.error(errorText(error));
    await refreshContent();
    toast.success('Special day removed.');
    onSaved();
  };

  return (
    <Card title="Holidays and special hours">
      <p className="a-hint">One-off dates with their own hours, or closed all day. They appear in the website’s opening hours until the date has passed.</p>
      {rows.length === 0 && <p className="a-hint">No special days yet.</p>}
      {rows.map((row) => (
        <div key={row.id} className="a-dayrow">
          <strong>{row.on_date}</strong>
          <span>{row.label || '—'}</span>
          <span>{row.is_closed ? 'Closed all day' : `${to12h(row.opens)} – ${to12h(row.closes)}`}</span>
          <Button small variant="danger" onClick={() => remove(row)}>Remove</Button>
        </div>
      ))}
      <h3 style={{ margin: '18px 0 8px' }}>Add a special day</h3>
      <div className="a-grid">
        <Field label="Date"><TextInput type="date" value={form.on_date} onChange={(e) => set('on_date', e.target.value)} /></Field>
        <Field label="Name (optional)"><TextInput maxLength={80} placeholder="e.g. Diwali" value={form.label} onChange={(e) => set('label', e.target.value)} /></Field>
        <div className="a-checks is-wide"><Check label="Closed all day" checked={form.is_closed} onChange={(v) => set('is_closed', v)} /></div>
        {!form.is_closed && (
          <>
            <Field label="Opens"><TextInput type="time" value={form.opens} onChange={(e) => set('opens', e.target.value)} /></Field>
            <Field label="Closes"><TextInput type="time" value={form.closes} onChange={(e) => set('closes', e.target.value)} /></Field>
          </>
        )}
      </div>
      <div className="a-actions"><Button busy={saving} onClick={add}>Save special day</Button></div>
    </Card>
  );
}

// ---------- the "Daily Timings" list (Chai, Tiffins, Lunch ...) ----------
function TimingsCard({ initial, onSaved }) {
  const toast = useToast();
  const [rows, setRows] = useState(initial.map((r) => ({ ...r })));
  const [saving, setSaving] = useState(false);
  const set = (i, k, v) => setRows((list) => list.map((r, n) => (n === i ? { ...r, [k]: v } : r)));

  const save = async () => {
    if (rows.some((r) => !r.label.trim() || !r.open_text.trim() || !r.close_text.trim())) return toast.error('Every row needs a name, an opening time and a closing time.');
    setSaving(true);
    try {
      const { error } = await supabase
        .from('service_timings')
        .upsert(rows.map((r, i) => ({ key: r.key, label: r.label.trim(), open_text: r.open_text.trim(), close_text: r.close_text.trim(), close_note: (r.close_note || '').trim(), sort_order: i })), { onConflict: 'key' });
      if (error) throw error;
      await refreshContent();
      toast.success('Daily timings saved and live on the website.');
      onSaved();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Daily timings by food category">
      <p className="a-hint">The “Daily Timings” list above the website footer. Type the times exactly as customers should read them, for example 5:00 AM.</p>
      {rows.map((r, i) => (
        <div key={r.key} className="a-dayrow">
          <TextInput aria-label="Name" value={r.label} onChange={(e) => set(i, 'label', e.target.value)} />
          <TextInput aria-label="Opens" placeholder="5:00 AM" value={r.open_text} onChange={(e) => set(i, 'open_text', e.target.value)} />
          <TextInput aria-label="Closes" placeholder="12:00 PM" value={r.close_text} onChange={(e) => set(i, 'close_text', e.target.value)} />
          <TextInput aria-label="Note" placeholder="Note, e.g. next day" value={r.close_note || ''} onChange={(e) => set(i, 'close_note', e.target.value)} />
        </div>
      ))}
      <div className="a-actions"><Button busy={saving} onClick={save}>Save daily timings</Button></div>
    </Card>
  );
}

export default function HoursPage() {
  const { loading, error, data, reload } = useLoad(loadAll);
  return (
    <>
      <div className="a-pagehead"><div><h1>Opening hours</h1><p>Weekly hours, closed days, holidays, a temporary closure notice and the daily timings. The website updates automatically.</p></div></div>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <WeeklyCard initial={data.weekly} onSaved={reload} />
            <ClosureCard initial={data.closure} onSaved={reload} />
            <SpecialCard rows={data.special} onSaved={reload} />
            <TimingsCard initial={data.timings} onSaved={reload} />
          </>
        )}
      </LoadState>
      {error && /weekly_hours|special_hours|service_timings|schema cache/i.test(error.message || '') && (
        <p className="a-hint">This page needs migration <code>0009_dashboard.sql</code>. Run it once in the Supabase SQL Editor, then press Try again.</p>
      )}
    </>
  );
}
