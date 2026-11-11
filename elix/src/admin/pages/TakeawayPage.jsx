import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { refreshContent } from '../../lib/content';
import { rowToPage } from '../../lib/takeaway';
import TakeAwayMenuViewer from '../../components/TakeAwayMenuViewer';
import { SLIDE_LIMIT, removeStoredFile, uploadSlideImage } from '../media';
import { Button, Card, Check, Field, LoadState, Modal, TextInput, errorText, useConfirm, useLoad, useToast } from '../ui';

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function loadSlides() {
  const { data, error } = await supabase.from('takeaway_slides').select('*').order('sort_order').order('created_at');
  if (error) {
    if (/takeaway_slides|relation|schema cache/i.test(error.message || '')) {
      throw new Error('The Take Away slides table does not exist yet. Run supabase/migrations/0010_menu_and_takeaway_management.sql in the Supabase SQL Editor, then reload this page.');
    }
    throw error;
  }
  return data;
}

// Add a new slide, or edit one (title, image, published/draft). Choosing an image shows a preview first;
// nothing is stored until a Save button is pressed.
function SlideEditor({ slide, nextOrder, onDone, onClose }) {
  const toast = useToast();
  const input = useRef(null);
  const isNew = !slide;
  const [title, setTitle] = useState(slide?.title || '');
  const [published, setPublished] = useState(slide ? slide.published : true);
  const [draft, setDraft] = useState(null); // { file, url } chosen but not yet uploaded
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => draft && URL.revokeObjectURL(draft.url), [draft]);

  const pick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return toast.error('Please choose a JPG, PNG or WebP image.');
    if (file.size > SLIDE_LIMIT * 3) return toast.error(`That image is ${mb(file.size)}. Please use one under ${mb(SLIDE_LIMIT)}.`);
    setDraft({ file, url: URL.createObjectURL(file) });
  };

  const save = async (publishNow) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return toast.error('Please enter a slide title.');
    if (cleanTitle.length > 80) return toast.error('The title can be at most 80 characters.');
    if (isNew && !draft) return toast.error('Please choose the menu page image.');

    setBusy(true);
    setProgress(0);
    let uploaded = null;
    try {
      if (draft) uploaded = await uploadSlideImage({ slideKey: slide?.id || 'new', file: draft.file, onProgress: setProgress });
      const wantPublished = publishNow === undefined ? published : publishNow;

      if (isNew) {
        const { error } = await supabase.from('takeaway_slides').insert({
          title: cleanTitle,
          image_url: uploaded.url,
          storage_path: uploaded.path,
          width: uploaded.width,
          height: uploaded.height,
          sort_order: nextOrder,
          published: wantPublished,
        });
        if (error) throw error;
      } else {
        const patch = { title: cleanTitle, published: wantPublished };
        if (uploaded) Object.assign(patch, { image_url: uploaded.url, storage_path: uploaded.path, width: uploaded.width, height: uploaded.height });
        const { error } = await supabase.from('takeaway_slides').update(patch).eq('id', slide.id);
        if (error) throw error;
        if (uploaded && slide.storage_path) await removeStoredFile(slide.storage_path); // the replaced upload is no longer needed
      }
      await refreshContent();
      toast.success(
        isNew
          ? wantPublished
            ? `“${cleanTitle}” added and live on the Take Away menu.`
            : `“${cleanTitle}” saved as a draft. Use Preview, then Publish.`
          : 'Slide saved.'
      );
      onDone();
    } catch (e) {
      if (uploaded) await removeStoredFile(uploaded.path).catch(() => {}); // never leave an orphan file behind
      toast.error(`Not saved. ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const shown = draft ? draft.url : slide?.image_url;

  return (
    <Modal title={isNew ? 'Add Take Away slide' : `Edit slide: ${slide.title}`} onClose={busy ? () => {} : onClose}>
      <div className="a-grid">
        <Field label="Slide title *" hint="Shown to screen readers and in the dashboard. Maximum 80 characters." wide>
          <TextInput value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Restaurant Food – Desserts" />
        </Field>
      </div>

      <div className="a-media" style={{ marginTop: 14 }}>
        <div className="a-media-title">Menu page image {isNew ? '*' : ''}</div>
        <div className="a-media-preview a-slide-preview">
          {shown ? <img src={shown} alt={draft ? 'New image preview' : slide.title} /> : <span className="a-hint">No image chosen yet.</span>}
          {busy && (
            <div className="a-media-busy" role="status">
              <div className="a-progress" aria-label="Upload progress">
                <span style={{ width: `${progress}%` }} />
              </div>
              Uploading… {progress}%
            </div>
          )}
        </div>
        {draft && (
          <p className="a-hint">
            Preview only: not on the website yet. {draft.file.name} · {mb(draft.file.size)}
          </p>
        )}
        <div className="a-media-actions">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={pick} hidden />
          <Button small variant={draft ? 'ghost' : 'primary'} disabled={busy} onClick={() => input.current?.click()}>
            {isNew ? (draft ? 'Choose a different image' : 'Choose image') : draft ? 'Choose a different image' : 'Replace image'}
          </Button>
          {draft && (
            <Button small variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
              Undo
            </Button>
          )}
        </div>
        <span className="a-hint">Upload the whole menu page as one image (JPG, PNG or WebP, up to {mb(SLIDE_LIMIT)}). Large images are resized for fast loading, keeping the text sharp.</span>
      </div>

      {!isNew && (
        <div className="a-checks" style={{ marginTop: 14 }}>
          <Check label="Published" hint="Untick to keep this slide as a draft: it disappears from the website but stays here." checked={published} onChange={setPublished} />
        </div>
      )}

      <div className="a-actions">
        {isNew ? (
          <>
            <Button busy={busy} onClick={() => save(true)}>
              Publish now
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => save(false)}>
              Save as draft
            </Button>
          </>
        ) : (
          <Button busy={busy} onClick={() => save()}>
            Save slide
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

// The real Take Away menu viewer (same component, animations and gestures as the website) fed with the saved slides,
// so the order, titles and images can be checked before anything is published.
function PreviewModal({ slides, onClose }) {
  const [withDrafts, setWithDrafts] = useState(true);
  const pages = useMemo(() => slides.filter((s) => withDrafts || s.published).map(rowToPage), [slides, withDrafts]);
  const drafts = slides.filter((s) => !s.published).length;
  return (
    <Modal title="Preview: Take Away menu viewer" onClose={onClose}>
      <div className="a-checks" style={{ marginBottom: 12 }}>
        <Check
          label="Include draft slides"
          hint={drafts ? `${drafts} draft slide${drafts === 1 ? ' is' : 's are'} hidden on the website. Tick to see them in place.` : 'There are no draft slides.'}
          checked={withDrafts}
          onChange={setWithDrafts}
        />
      </div>
      <div className="tm-preview" data-theme="takeaway">
        <TakeAwayMenuViewer key={pages.map((p) => p.id).join('|')} pages={pages} />
      </div>
    </Modal>
  );
}

export default function TakeawayPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { loading, error, data: slides, reload } = useLoad(loadSlides);
  const [editing, setEditing] = useState(null); // null | 'new' | slide row
  const [previewing, setPreviewing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const nextOrder = (slides || []).reduce((m, s) => Math.max(m, s.sort_order || 0), 0) + 1;

  const done = () => {
    setEditing(null);
    reload();
  };

  // Moves a slide one place and renumbers 1, 2, 3 ... so the order is always clean.
  const move = async (slide, direction) => {
    const index = slides.findIndex((s) => s.id === slide.id);
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const order = slides.slice();
    [order[index], order[target]] = [order[target], order[index]];
    setBusyId(slide.id);
    try {
      const results = await Promise.all(order.map((row, i) => (row.sort_order === i + 1 ? null : supabase.from('takeaway_slides').update({ sort_order: i + 1 }).eq('id', row.id))));
      const failed = results.find((r) => r && r.error);
      if (failed) throw failed.error;
      await refreshContent();
      reload();
    } catch (e) {
      toast.error(`Order not changed. ${errorText(e)}`);
    } finally {
      setBusyId(null);
    }
  };

  const togglePublished = async (slide) => {
    setBusyId(slide.id);
    const { error: e } = await supabase.from('takeaway_slides').update({ published: !slide.published }).eq('id', slide.id);
    setBusyId(null);
    if (e) return toast.error(errorText(e));
    await refreshContent();
    toast.success(slide.published ? `“${slide.title}” unpublished (draft).` : `“${slide.title}” is live on the Take Away menu.`);
    reload();
  };

  const remove = async (slide) => {
    const ok = await confirm({
      title: 'Delete this slide?',
      message: `“${slide.title}” will be removed from the Take Away menu and from the database. To keep it for later, untick Published instead.`,
      confirmLabel: 'Delete slide',
    });
    if (!ok) return;
    setBusyId(slide.id);
    try {
      const { error: e } = await supabase.from('takeaway_slides').delete().eq('id', slide.id);
      if (e) throw e;
      if (slide.storage_path) await removeStoredFile(slide.storage_path).catch(() => {});
      // close the gap in the numbering
      const rest = slides.filter((s) => s.id !== slide.id);
      await Promise.all(rest.map((row, i) => (row.sort_order === i + 1 ? null : supabase.from('takeaway_slides').update({ sort_order: i + 1 }).eq('id', row.id))));
      await refreshContent();
      toast.success(`“${slide.title}” deleted.`);
      reload();
    } catch (e) {
      toast.error(`Not deleted. ${errorText(e)}`);
    } finally {
      setBusyId(null);
    }
  };

  const published = (slides || []).filter((s) => s.published).length;

  return (
    <>
      <div className="a-pagehead">
        <div>
          <h1>Take Away menu slides</h1>
          <p>Replace, add, rename, reorder or delete the pages of the Take Away menu. Published slides appear in the website’s menu viewer straight away; drafts stay hidden until you publish them.</p>
        </div>
        <div className="a-actions" style={{ marginTop: 0 }}>
          <Button variant="ghost" disabled={!slides || slides.length === 0} onClick={() => setPreviewing(true)}>
            Preview in viewer
          </Button>
          <Button onClick={() => setEditing('new')} disabled={!slides}>
            + Add slide
          </Button>
        </div>
      </div>

      <LoadState loading={loading} error={error} onRetry={reload}>
        {slides && (
          <>
            <p className="a-hint" style={{ marginBottom: 10 }}>
              {slides.length} slide{slides.length === 1 ? '' : 's'} · {published} published · {slides.length - published} draft
            </p>
            {slides.length === 0 ? (
              <Card>
                <p className="a-hint">There are no slides. The website shows “Take Away menu coming soon”. Add a slide to publish a menu page.</p>
              </Card>
            ) : (
              <div className="a-list">
                {slides.map((slide, i) => (
                  <div key={slide.id} className={`a-row ${slide.published ? '' : 'is-off'}`}>
                    <div className="a-thumb is-slide">
                      <img src={slide.image_url} alt="" loading="lazy" />
                    </div>
                    <div className="a-row-main">
                      <strong>
                        {i + 1}. {slide.title}
                      </strong>
                      <span className="a-tags">
                        {slide.published ? <em>Published</em> : <em className="is-warn">Draft (hidden)</em>}
                        {!slide.storage_path && <em className="is-muted">Original page</em>}
                        {slide.width && slide.height && <em className="is-muted">{slide.width}×{slide.height}</em>}
                      </span>
                    </div>
                    <div className="a-row-actions">
                      <Button small onClick={() => setEditing(slide)} disabled={busyId === slide.id}>
                        Edit / Replace
                      </Button>
                      <Button small variant="ghost" busy={busyId === slide.id} onClick={() => togglePublished(slide)}>
                        {slide.published ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button small variant="ghost" disabled={i === 0 || busyId === slide.id} onClick={() => move(slide, -1)} aria-label={`Move ${slide.title} earlier`}>
                        ↑
                      </Button>
                      <Button small variant="ghost" disabled={i === slides.length - 1 || busyId === slide.id} onClick={() => move(slide, 1)} aria-label={`Move ${slide.title} later`}>
                        ↓
                      </Button>
                      <Button small variant="danger" disabled={busyId === slide.id} onClick={() => remove(slide)}>
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

      {editing && slides && <SlideEditor key={editing === 'new' ? 'new' : editing.id} slide={editing === 'new' ? null : editing} nextOrder={nextOrder} onDone={done} onClose={() => setEditing(null)} />}
      {previewing && slides && <PreviewModal slides={slides} onClose={() => setPreviewing(false)} />}
    </>
  );
}
