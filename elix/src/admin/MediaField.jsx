import { useEffect, useRef, useState } from 'react';
import { ACCEPT, LIMITS, getMedia, removeMedia, uploadMedia } from './media';
import { Button, Spinner, errorText, useConfirm, useLoad, useToast } from './ui';

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Upload / replace / remove one photograph or one video for one owner.
// Choosing a file first shows a preview; nothing goes live until "Publish" is pressed. Uploads show a progress bar.
// Works from a laptop (file picker) and from a phone (camera roll, camera or files).
export default function MediaField({ ownerType, ownerId, kind, label, hint, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draft, setDraft] = useState(null); // { file, url } chosen but not yet published
  const { loading, error, data: media, reload } = useLoad(() => getMedia(ownerType, ownerId, kind), [ownerType, ownerId, kind]);

  useEffect(() => () => draft && URL.revokeObjectURL(draft.url), [draft]);

  const pick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    if (file.size > LIMITS[kind] * 1.0 && kind === 'video') {
      return toast.error(`That video is ${mb(file.size)}. The limit is ${mb(LIMITS[kind])}.`);
    }
    setDraft({ file, url: URL.createObjectURL(file) });
  };

  const publish = async () => {
    setBusy(true);
    setProgress(0);
    try {
      await uploadMedia({ ownerType, ownerId, kind, file: draft.file, onProgress: setProgress });
      toast.success(`${label} saved. It is now live on the website.`);
      setDraft(null);
      reload();
      onChanged?.();
    } catch (e) {
      toast.error(`${label} was not saved. ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: `Remove this ${kind}?`, message: `The website will go back to its default ${kind} for “${label}”.`, confirmLabel: `Remove ${kind}` });
    if (!ok) return;
    setBusy(true);
    try {
      await removeMedia({ ownerType, ownerId, kind });
      toast.success(`${label} removed.`);
      reload();
      onChanged?.();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const shownUrl = draft ? draft.url : media?.url;

  return (
    <div className="a-media">
      <div className="a-media-title">{label}</div>
      <div className="a-media-preview">
        {loading && !draft ? (
          <Spinner />
        ) : error && !draft ? (
          <span className="a-hint">{errorText(error)}</span>
        ) : shownUrl ? (
          kind === 'image' ? (
            <img src={shownUrl} alt={label} loading="lazy" />
          ) : (
            <video src={shownUrl} controls muted playsInline preload="metadata" />
          )
        ) : (
          <span className="a-hint">No {kind} uploaded yet. The website uses its default.</span>
        )}
        {busy && (
          <div className="a-media-busy" role="status">
            <div className="a-progress" aria-label="Upload progress"><span style={{ width: `${progress}%` }} /></div>
            Uploading… {progress}%
          </div>
        )}
      </div>

      {draft ? (
        <>
          <p className="a-hint">Preview only: not on the website yet. {draft.file.name} · {mb(draft.file.size)}</p>
          <div className="a-media-actions">
            <Button small busy={busy} onClick={publish}>Publish to website</Button>
            <Button small variant="ghost" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </>
      ) : (
        <div className="a-media-actions">
          <input ref={input} type="file" accept={ACCEPT[kind]} onChange={pick} hidden />
          <Button small busy={busy} onClick={() => input.current?.click()}>
            {media ? `Replace ${kind}` : `Upload ${kind}`}
          </Button>
          {media && (
            <Button small variant="ghost" disabled={busy} onClick={remove}>
              Remove
            </Button>
          )}
        </div>
      )}
      <span className="a-hint">
        {hint || (kind === 'image' ? 'JPG, PNG or WebP. Large photos are shrunk automatically.' : 'MP4 or WebM, 5–10 seconds, under 50 MB.')}{' '}
        Max {(LIMITS[kind] / 1024 / 1024).toFixed(0)} MB.
      </span>
    </div>
  );
}
