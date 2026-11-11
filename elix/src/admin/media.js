import { supabase, MEDIA_BUCKET, SUPABASE_URL, SUPABASE_PUBLIC_KEY } from '../lib/supabase';
import { refreshContent } from '../lib/content';

export const LIMITS = { image: 10 * 1024 * 1024, video: 50 * 1024 * 1024 };
export const ACCEPT = {
  image: 'image/jpeg,image/png,image/webp,image/avif',
  // .mov covers iPhone recordings
  video: 'video/mp4,video/webm,video/quicktime,.mov',
};

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Shrinks big photographs in the browser (max 1600 px wide, WebP) so the site loads fast on phones.
// Falls back to the original file if the browser cannot do it.
async function optimiseImage(file, { maxWidth = 1600, quality = 0.82 } = {}) {
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (blob && blob.size < file.size) return new File([blob], 'photo.webp', { type: 'image/webp' });
    return file;
  } catch {
    return file;
  }
}

const extensionFor = (mime) =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'video/mp4': 'mp4', 'video/webm': 'webm' })[mime] || 'bin';

const safe = (text) => String(text).replace(/[^a-zA-Z0-9_-]/g, '-');

export async function getMedia(ownerType, ownerId, kind) {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .eq('kind', kind)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Validates, uploads to Supabase Storage, saves the public URL in media_assets, removes the replaced
// file and refreshes the public site. Throws a readable Error on any problem.
// Uploads with a real progress percentage (XMLHttpRequest). If that route fails for a reason other than permissions or
// size, the normal Supabase client upload is used instead, so an upload never fails just because of the progress bar.
async function storeFile(path, body, contentType, onProgress) {
  const viaClient = async () => {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, body, { contentType, cacheControl: '31536000', upsert: false });
    if (error) throw error;
  };
  if (!onProgress || typeof XMLHttpRequest === 'undefined') return viaClient();

  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('You are signed out. Please sign in again.');
  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${data.session.access_token}`);
      xhr.setRequestHeader('apikey', SUPABASE_PUBLIC_KEY);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('Cache-Control', 'max-age=31536000');
      xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
      xhr.onerror = () => reject(Object.assign(new Error('Network problem during upload.'), { retryable: true }));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let message = `Upload failed (${xhr.status}).`;
        try {
          message = JSON.parse(xhr.responseText).message || message;
        } catch {
          /* keep the default message */
        }
        reject(Object.assign(new Error(message), { retryable: ![401, 403, 413].includes(xhr.status) && xhr.status !== 409 }));
      };
      xhr.send(body);
    });
    onProgress(100);
  } catch (error) {
    if (!error.retryable) throw error;
    onProgress(0);
    await viaClient();
    onProgress(100);
  }
}

export async function uploadMedia({ ownerType, ownerId, kind, file, onProgress }) {
  if (!file) throw new Error('No file selected.');
  const isMov = kind === 'video' && (file.type === 'video/quicktime' || /\.mov$/i.test(file.name));
  if (kind === 'image' && !file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG, WebP or AVIF).');
  if (kind === 'video' && !(file.type.startsWith('video/') || isMov)) throw new Error('Please choose a video file (MP4 or WebM).');

  const prepared = kind === 'image' ? await optimiseImage(file) : file;
  if (prepared.size > LIMITS[kind]) {
    throw new Error(`That file is ${mb(prepared.size)}. The limit for ${kind}s is ${mb(LIMITS[kind])}.`);
  }
  // QuickTime clips from iPhones are stored as MP4 (same H.264 video).
  const mime = isMov ? 'video/mp4' : prepared.type || (kind === 'image' ? 'image/jpeg' : 'video/mp4');
  const path = `${ownerType}/${safe(ownerId)}/${kind}-${Date.now()}.${extensionFor(mime)}`;

  const previous = await getMedia(ownerType, ownerId, kind);

  await storeFile(path, prepared, mime, onProgress);

  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const { data, error } = await supabase
    .from('media_assets')
    .upsert(
      { owner_type: ownerType, owner_id: ownerId, kind, storage_path: path, url: pub.publicUrl, mime, size_bytes: prepared.size },
      { onConflict: 'owner_type,owner_id,kind' }
    )
    .select()
    .single();
  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]); // do not leave an orphan file
    throw error;
  }
  if (previous && previous.storage_path !== path) {
    await supabase.storage.from(MEDIA_BUCKET).remove([previous.storage_path]); // old file replaced
  }
  await refreshContent();
  return data;
}

export async function removeMedia({ ownerType, ownerId, kind }) {
  const existing = await getMedia(ownerType, ownerId, kind);
  if (!existing) return;
  const { error } = await supabase.from('media_assets').delete().eq('id', existing.id);
  if (error) throw error;
  await supabase.storage.from(MEDIA_BUCKET).remove([existing.storage_path]);
  await refreshContent();
}

// Removes every photo and clip that belongs to one owner (used when an item or gallery entry is deleted).
export async function removeAllMedia(ownerType, ownerId) {
  const { data, error } = await supabase.from('media_assets').select('id, storage_path').eq('owner_type', ownerType).eq('owner_id', ownerId);
  if (error) throw error;
  if (!data || !data.length) return;
  await supabase.storage.from(MEDIA_BUCKET).remove(data.map((row) => row.storage_path));
  const { error: delError } = await supabase.from('media_assets').delete().in('id', data.map((row) => row.id));
  if (delError) throw delError;
}

// ---- Take Away menu slides ----
// Uploads one menu-page image to Storage (takeaway/<slide>/...) and returns { path, url, width, height }.
// Menu pages are text, so they are kept larger and sharper than food photos (up to 2400 px wide, high quality).
// The database row is written by the caller (TakeawayPage), which also removes the file it replaces.
export const SLIDE_LIMIT = 10 * 1024 * 1024;

const readSize = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

export async function uploadSlideImage({ slideKey, file, onProgress }) {
  if (!file) throw new Error('No file selected.');
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Error('Please choose a JPG, PNG or WebP image of the menu page.');
  const prepared = await optimiseImage(file, { maxWidth: 2400, quality: 0.9 });
  if (prepared.size > SLIDE_LIMIT) throw new Error(`That image is ${mb(prepared.size)}. The limit is ${mb(SLIDE_LIMIT)}.`);
  const size = await readSize(prepared);
  const mime = prepared.type || 'image/jpeg';
  const path = `takeaway/${safe(slideKey)}/page-${Date.now()}.${extensionFor(mime)}`;
  await storeFile(path, prepared, mime, onProgress);
  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { path, url: pub.publicUrl, width: size?.width || null, height: size?.height || null };
}

export async function removeStoredFile(path) {
  if (path) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}
