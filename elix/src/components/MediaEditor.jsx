import { Image as ImageIcon, Video, X } from 'lucide-react';
import { MENU } from '../data/menuData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { removeLocalMedia, saveLocalMedia, setStatus, useEditState } from '../lib/localMedia';

const LIMITS = { image: 15 * 1024 * 1024, video: 60 * 1024 * 1024 };
const ACCEPT = { image: 'image/*', video: 'video/mp4,video/webm,video/quicktime,.mov' };

// Which Supabase owner a slot belongs to (menu item, gallery entry, or a site image such as hero-main).
function ownerFor(key) {
  if (key.startsWith('gallery-')) return { ownerType: 'gallery', ownerId: key.slice(8) };
  if (MENU.some((item) => item.id === key)) return { ownerType: 'menu_item', ownerId: key };
  return { ownerType: 'site', ownerId: key };
}

// Also publish to the live site when the owner is signed in to /admin. Never blocks the local preview.
async function publishLive(key, kind, file) {
  if (!isSupabaseConfigured) return 'local';
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return 'local';
    const { uploadMedia } = await import('../admin/media');
    await uploadMedia({ ...ownerFor(key), kind, file });
    return 'live';
  } catch (error) {
    return `failed:${error?.message || 'upload error'}`;
  }
}

function pickFile(kind, onFile) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT[kind];
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  };
  input.click();
}

// Add / replace buttons that sit inside every picture slot (shown while edit mode is on).
export default function MediaEditor({ slotKey, label, hasImage, hasVideo, allowVideo, forceOn = false }) {
  const { allowed, on } = useEditState();
  // Visible only in the admin preview (Dashboard > View website); public visitors never get these buttons.
  // forceOn: inside the preview, this slot always offers its add-photo button (used for empty menu item pictures).
  if (!allowed || (!on && !forceOn) || !slotKey) return null;

  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const add = (kind) => (event) => {
    stop(event);
    pickFile(kind, async (file) => {
      const isMov = /\.mov$/i.test(file.name) || file.type === 'video/quicktime';
      if (kind === 'image' && !file.type.startsWith('image/')) return setStatus('Please choose an image file.');
      if (kind === 'video' && !(file.type.startsWith('video/') || isMov)) return setStatus('Please choose a video file (MP4 or WebM).');
      if (file.size > LIMITS[kind]) return setStatus(`That ${kind} is too large (max ${LIMITS[kind] / 1024 / 1024} MB).`);
      const blob = isMov ? new Blob([file], { type: 'video/mp4' }) : file;
      const saved = await saveLocalMedia(slotKey, kind, blob);
      const where = await publishLive(slotKey, kind, file);
      if (where === 'live') setStatus(`${label || slotKey}: ${kind} saved and live on the website.`);
      else if (where.startsWith('failed:')) setStatus(`${label || slotKey}: shown here, but live upload failed (${where.slice(7)}).`);
      else setStatus(`${label || slotKey}: ${kind} added on this device${saved ? '' : ' (this visit only)'}.`);
    });
  };

  const remove = (kind) => (event) => {
    stop(event);
    removeLocalMedia(slotKey, kind);
    setStatus(`${label || slotKey}: ${kind} removed from this device.`);
  };

  const key = (kind) => (event) => {
    if (event.key === 'Enter' || event.key === ' ') add(kind)(event);
  };

  return (
    <span className="media-edit" onPointerEnter={(e) => e.stopPropagation()} onClick={stop}>
      <span role="button" tabIndex={0} className="media-edit-btn" onClick={add('image')} onKeyDown={key('image')}>
        <ImageIcon size={14} aria-hidden="true" />
        {hasImage ? 'Replace image' : 'Add image'}
      </span>
      {allowVideo && (
        <span role="button" tabIndex={0} className="media-edit-btn" onClick={add('video')} onKeyDown={key('video')}>
          <Video size={14} aria-hidden="true" />
          {hasVideo ? 'Replace video' : 'Add video'}
        </span>
      )}
      {hasImage && (
        <span role="button" tabIndex={0} className="media-edit-x" aria-label="Remove image from this device" onClick={remove('image')}>
          <X size={13} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
