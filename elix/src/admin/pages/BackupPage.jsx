import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { refreshContent } from '../../lib/content';
import { Button, Card, Check, Modal, Pill, TextInput, errorText, useConfirm, useLoad, useToast } from '../ui';

// Backup and recovery (migration 0011). Restore points are saved in the database; a copy can be downloaded as a file
// and uploaded again. Restoring always saves an automatic copy of the current content first.

const SCOPES = [
  ['menu', 'Menu items', 'Every food and drink: names, prices, descriptions, sections, availability.'],
  ['takeaway', 'Take Away slides', 'The Take Away menu pages and their order.'],
  ['gallery', 'Gallery list', 'The gallery entries (titles, groups, order, visibility).'],
  ['site', 'Restaurant details and website texts', 'Address, phone, email, social links and the website texts.'],
];

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const missingMigration = (error) => /content_backups|schema cache|does not exist|could not find/i.test(error?.message || '');

async function loadBackups() {
  const { data, error } = await supabase
    .from('content_backups')
    .select('id, label, kind, created_at, created_by_email, item_count, slide_count')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const fileStamp = (iso) => new Date(iso).toISOString().slice(0, 16).replace(/[:T]/g, '-');

function RestoreDialog({ backup, onClose, onDone }) {
  const toast = useToast();
  const [chosen, setChosen] = useState({ menu: true, takeaway: false, gallery: false, site: false });
  const [busy, setBusy] = useState(false);
  const picked = SCOPES.filter(([key]) => chosen[key]);

  const run = async () => {
    if (!picked.length) return toast.error('Choose what to restore.');
    setBusy(true);
    try {
      // one call per part, each is all-or-nothing; an automatic safety copy is saved before every one
      for (const [key] of picked) {
        const { error } = await supabase.rpc('restore_content_backup', { p_backup_id: backup.id, p_scope: key });
        if (error) throw error;
      }
      await refreshContent();
      toast.success('Restored. The website now shows the restored content. The previous content was saved as an automatic copy.');
      onDone();
      onClose();
    } catch (e) {
      toast.error(`Not restored. Nothing was changed for the failed part. ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Restore from this backup" onClose={onClose}>
      <p style={{ marginTop: 0, overflowWrap: 'anywhere' }}>
        <strong>{backup.label}</strong>
        <br />
        <span className="a-hint">{when(backup.created_at)} · {backup.item_count} menu items · {backup.slide_count} slides</span>
      </p>
      <p className="a-hint">Choose what to put back. Anything added or changed after this backup, in the parts you choose, will be replaced. Photos and videos are not affected.</p>
      <div className="a-checks">
        {SCOPES.map(([key, label, hint]) => (
          <Check key={key} label={label} hint={hint} checked={chosen[key]} onChange={(v) => setChosen((c) => ({ ...c, [key]: v }))} />
        ))}
      </div>
      <div className="a-actions">
        <Button variant="danger" busy={busy} onClick={run}>Restore now</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

export default function BackupPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { loading, error, data, reload } = useLoad(loadBackups);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState('');
  const [restoring, setRestoring] = useState(null);
  const fileRef = useRef(null);

  const fetchData = async (id) => {
    const { data: row, error: e } = await supabase.from('content_backups').select('label, created_at, data').eq('id', id).single();
    if (e) throw e;
    return row;
  };

  const create = async () => {
    setBusy('create');
    try {
      const { error: e } = await supabase.rpc('create_content_backup', { p_label: label.trim() || `Backup ${new Date().toLocaleDateString('en-IN')}`, p_kind: 'manual' });
      if (e) throw e;
      setLabel('');
      toast.success('Restore point saved.');
      reload();
    } catch (e) {
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setBusy('');
    }
  };

  const save = async (backup) => {
    setBusy(backup.id);
    try {
      const row = await fetchData(backup.id);
      download(`the-elix-backup-${fileStamp(row.created_at)}.json`, JSON.stringify(row.data, null, 2));
    } catch (e) {
      toast.error(`Could not download. ${errorText(e)}`);
    } finally {
      setBusy('');
    }
  };

  // Creates a fresh backup of right now and downloads it in one step.
  const saveNow = async () => {
    setBusy('now');
    try {
      const { data: id, error: e } = await supabase.rpc('create_content_backup', { p_label: `Downloaded ${new Date().toLocaleString('en-IN')}`, p_kind: 'manual' });
      if (e) throw e;
      const row = await fetchData(id);
      download(`the-elix-backup-${fileStamp(row.created_at)}.json`, JSON.stringify(row.data, null, 2));
      toast.success('Backup file downloaded. Keep it somewhere safe (for example Google Drive).');
      reload();
    } catch (e) {
      toast.error(`Could not create the backup file. ${errorText(e)}`);
    } finally {
      setBusy('');
    }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('import');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('That file is too large to be a The Elix backup.');
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error('That file is not a valid backup file.');
      }
      const { error: e } = await supabase.rpc('import_content_backup', { p_label: `Imported: ${file.name}`.slice(0, 120), p_data: parsed });
      if (e) throw e;
      toast.success('Backup file added to the list. Choose Restore to use it.');
      reload();
    } catch (e) {
      toast.error(`Not imported. ${errorText(e)}`);
    } finally {
      setBusy('');
    }
  };

  const remove = async (backup) => {
    const ok = await confirm({ title: 'Delete this backup?', message: `“${backup.label}” (${when(backup.created_at)}) will be deleted. The website is not affected.`, confirmLabel: 'Delete backup' });
    if (!ok) return;
    const { error: e } = await supabase.from('content_backups').delete().eq('id', backup.id);
    if (e) return toast.error(errorText(e));
    toast.success('Backup deleted.');
    reload();
  };

  return (
    <>
      <div className="a-pagehead">
        <div>
          <h1>Backup &amp; recovery</h1>
          <p>Save restore points of your menu, Take Away slides, gallery, restaurant details and website texts, and bring them back if something is changed or deleted by mistake. A copy is also saved automatically once a day and before every restore.</p>
        </div>
      </div>

      {error && missingMigration(error) ? (
        <div className="a-alert is-error">
          <strong>Backups are not set up yet.</strong> Run <code>supabase/migrations/0011_backup_and_recovery.sql</code> in the Supabase SQL Editor, then reload this page.
        </div>
      ) : (
        <>
          <Card title="Save a restore point">
            <div className="a-grid">
              <TextInput value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Name it, for example “Before Diwali menu update”" aria-label="Backup name" />
            </div>
            <div className="a-actions">
              <Button busy={busy === 'create'} onClick={create}>Save restore point</Button>
              <Button variant="ghost" busy={busy === 'now'} onClick={saveNow}>Save and download a backup file</Button>
              <Button variant="ghost" busy={busy === 'import'} onClick={() => fileRef.current?.click()}>Upload a backup file…</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
            </div>
            <p className="a-hint">A backup holds text and settings. Photos and videos are files: deleting one in the dashboard deletes the file for good, so keep your original photos and videos too.</p>
          </Card>

          <Card title="Your backups">
            {loading && <p className="a-hint">Loading…</p>}
            {error && !missingMigration(error) && <div className="a-alert is-error">Could not load. {errorText(error)} <button type="button" className="a-btn a-btn-small" onClick={reload}>Try again</button></div>}
            {data && data.length === 0 && <p className="a-hint">No backups yet. Save your first restore point above.</p>}
            {data && data.length > 0 && (
              <div className="a-list">
                {data.map((b) => (
                  <div key={b.id} className="a-row">
                    <div className="a-row-main">
                      <strong style={{ overflowWrap: 'anywhere' }}>{b.label}</strong>
                      <span>
                        {when(b.created_at)} · {b.item_count} menu items · {b.slide_count} slides{b.created_by_email ? ` · ${b.created_by_email}` : ''}
                      </span>
                      <span className="a-tags">
                        <Pill tone={b.kind === 'auto' ? 'muted' : 'ok'}>{b.kind === 'auto' ? 'Automatic' : 'Saved by you'}</Pill>
                      </span>
                    </div>
                    <div className="a-row-actions">
                      <Button small onClick={() => setRestoring(b)}>Restore…</Button>
                      <Button small variant="ghost" busy={busy === b.id} onClick={() => save(b)}>Download</Button>
                      <Button small variant="danger" onClick={() => remove(b)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {restoring && <RestoreDialog backup={restoring} onClose={() => setRestoring(null)} onDone={reload} />}
    </>
  );
}
