import { useSyncExternalStore } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';

// Photos and clips picked from the visitor's own device (the "Add image / Add video" buttons that sit
// on every picture slot). They are kept in this browser (IndexedDB) so they replace the demo images
// straight away and survive a page refresh. To make them public for every visitor, sign in to /admin
// (Supabase) first: the same buttons then upload to the live site as well.

const DB_NAME = 'elix-local-media';
const STORE = 'media';

const images = {}; // key -> object URL
const videos = {}; // key -> { mp4 | webm: object URL }
let version = 0;
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const notify = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};
export const useLocalMediaVersion = () => useSyncExternalStore(subscribe, () => version, () => 0);

export const getLocalImage = (key) => images[String(key).toLowerCase()] || null;
export const getLocalVideo = (key) => videos[String(key).toLowerCase()] || null;

// ---- IndexedDB helpers (every call fails soft: the buttons still work for the current visit) ----
const openDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = async (mode, work) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
  });
};

const dbKey = (kind, key) => `${kind}:${String(key).toLowerCase()}`;

function apply(kind, key, blob) {
  const k = String(key).toLowerCase();
  if (kind === 'image') {
    if (images[k]) URL.revokeObjectURL(images[k]);
    images[k] = URL.createObjectURL(blob);
  } else {
    const isWebm = blob.type === 'video/webm';
    const old = videos[k];
    if (old) Object.values(old).forEach((url) => URL.revokeObjectURL(url));
    const url = URL.createObjectURL(blob);
    videos[k] = isWebm ? { webm: url } : { mp4: url };
  }
}

let started = false;
export async function loadLocalMedia() {
  if (started) return;
  started = true;
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const keys = store.getAllKeys();
      const values = store.getAll();
      tx.oncomplete = () => {
        keys.result.forEach((fullKey, i) => {
          const [kind, ...rest] = String(fullKey).split(':');
          if (values.result[i]) apply(kind, rest.join(':'), values.result[i]);
        });
        resolve();
      };
      tx.onerror = () => resolve();
    });
    notify();
  } catch {
    /* private browsing or storage blocked: nothing saved from earlier visits */
  }
}

export async function saveLocalMedia(key, kind, file) {
  apply(kind, key, file);
  notify();
  try {
    await run('readwrite', (store) => store.put(file, dbKey(kind, key)));
    return true;
  } catch {
    return false; // shown for this visit only
  }
}

export async function removeLocalMedia(key, kind) {
  const k = String(key).toLowerCase();
  if (kind === 'image' && images[k]) {
    URL.revokeObjectURL(images[k]);
    delete images[k];
  }
  if (kind === 'video' && videos[k]) {
    Object.values(videos[k]).forEach((url) => URL.revokeObjectURL(url));
    delete videos[k];
  }
  notify();
  try {
    await run('readwrite', (store) => store.delete(dbKey(kind, key)));
  } catch {
    /* nothing to clean */
  }
}

// ---- admin preview: the Add image / Add video buttons and the Show/Hide switch ----
// These controls exist ONLY in the preview opened from Admin Dashboard > "View website". That link adds
// ?adminPreview=1, which is remembered for that browser tab only. The controls then appear only after the
// browser also proves it holds a signed-in administrator session (the same check the dashboard itself uses),
// so a public visitor who types the address by hand still sees nothing, and signing out removes them again.
const EDIT_FLAG = 'elix-edit-media';
const PREVIEW_FLAG = 'elix-admin-preview';
const PREVIEW_PARAM = 'adminPreview';
const featureOn = import.meta.env.VITE_EDIT_MEDIA !== 'false';

let adminPreview = false;
let editOn = true;
try {
  if (localStorage.getItem(EDIT_FLAG) === 'off') editOn = false;
} catch {
  /* default stays on */
}
let status = '';
const editListeners = new Set();
const editSubscribe = (fn) => {
  editListeners.add(fn);
  return () => editListeners.delete(fn);
};
const editNotify = () => editListeners.forEach((fn) => fn());
let editVersion = 0;
const bump = () => {
  editVersion += 1;
  editNotify();
};

function setAdminPreview(value) {
  if (adminPreview === value) return;
  adminPreview = value;
  if (!value) status = '';
  bump();
}

// Remembers the preview flag for this tab and removes ?adminPreview=1 from the address bar.
function readPreviewFlag() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(PREVIEW_PARAM) === '1') {
      sessionStorage.setItem(PREVIEW_FLAG, '1');
      url.searchParams.delete(PREVIEW_PARAM);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
    return sessionStorage.getItem(PREVIEW_FLAG) === '1';
  } catch {
    return false;
  }
}

// True only for a signed-in administrator who completed the second step (same rule as the dashboard).
async function isSignedInAdmin() {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) return false;
    const { data: row, error } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (error || !row) return false;
    const { data: level, error: levelError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return !levelError && level?.currentLevel === 'aal2';
  } catch {
    return false;
  }
}

let previewStarted = false;
export function startAdminPreview() {
  if (previewStarted || typeof window === 'undefined') return;
  previewStarted = true;
  const flagged = readPreviewFlag();
  if (!featureOn || !isSupabaseConfigured || !supabase) return;
  if (flagged) isSignedInAdmin().then(setAdminPreview);
  // Signing out (in any tab) immediately removes the controls.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') setAdminPreview(false);
  });
}

export const useEditState = () => {
  useSyncExternalStore(editSubscribe, () => editVersion, () => 0);
  return { allowed: adminPreview, on: adminPreview && editOn, status };
};
export function setEditMode(on) {
  editOn = on;
  try {
    localStorage.setItem(EDIT_FLAG, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  bump();
}
export function setStatus(text) {
  status = text;
  bump();
  if (text) setTimeout(() => status === text && setStatus(''), 6000);
}
