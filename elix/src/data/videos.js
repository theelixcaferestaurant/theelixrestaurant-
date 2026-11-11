// Central video registry for the food hover / tap clips. Works exactly like images.js:
//
// 1. Save a short clip into  src/assets/videos/  named after the menu item id, e.g.
//      irani-chai.mp4   masala-dosa.mp4   chocolate-truffle-cake.mp4
//    (MP4 / H.264 is enough; add a same-named .webm as an optional smaller alternative.)
// 2. Restart the dev server. No code changes are needed.
//
// An item with no clip simply keeps its photograph (no hover effect, no broken player).
// Clips are never downloaded until a visitor actually hovers (desktop) or opens the item (mobile).

import { getLocalVideo } from '../lib/localMedia';

const files = import.meta.glob('../assets/videos/**/*.{mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byName = {};
Object.entries(files).forEach(([path, url]) => {
  const file = path.split('/').pop();
  const name = file.replace(/\.[^.]+$/, '').toLowerCase();
  const ext = file.split('.').pop().toLowerCase();
  byName[name] = { ...(byName[name] || {}), [ext]: url };
});

// Optional manual overrides (for example clips hosted in /public or on a CDN):
//   'irani-chai': { mp4: '/video/food/irani-chai.mp4' },
export const MANUAL_VIDEOS = {};

// Clips uploaded through the admin dashboard (filled in by src/lib/content.js). They take priority.
const remote = {};
export function setRemoteVideos(map) {
  Object.keys(remote).forEach((key) => delete remote[key]);
  Object.assign(remote, map);
}

export function getVideo(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    if (!key) continue;
    const found = remote[String(key).toLowerCase()] || getLocalVideo(key) || MANUAL_VIDEOS[key] || byName[String(key).toLowerCase()];
    if (found) return found;
  }
  return null;
}
