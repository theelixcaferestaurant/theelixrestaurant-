// Central image registry.
//
// HOW TO ADD REAL PHOTOGRAPHS
// 1. Save photos into  src/assets/images/  (JPG, PNG, WebP or AVIF).
// 2. Name each file after the image key it should fill, for example:
//      irani-chai.jpg       fills the Irani Chai menu item (key = menu item id)
//      category-bakery.webp fills the Bakery category image
//      hero-main.jpg        fills the main home hero image
//    The full list of names is in src/assets/images/README.txt.
// 3. Restart the dev server. No code changes are needed.
//
// Photos that are not found show a clearly labelled "Demo image" panel instead.
//
// Optional: you can also point a key at any URL or at a file in /public using MANUAL_IMAGES.

import { getLocalImage } from '../lib/localMedia';

const files = import.meta.glob('../assets/images/**/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byName = {};
Object.entries(files).forEach(([path, url]) => {
  const name = path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
  byName[name] = url;
});

export const MANUAL_IMAGES = {
  // 'irani-chai': '/images/irani-chai.jpg',
};

// Images uploaded through the admin dashboard (filled in by src/lib/content.js from the database).
// They take priority over files in src/assets/images/, so the dashboard can always replace a photo.
const remote = {};
export function setRemoteImages(map) {
  Object.keys(remote).forEach((key) => delete remote[key]);
  Object.assign(remote, map);
}

// Accepts one key or an array of keys and returns the first image found, or null.
export function getImage(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    if (!key) continue;
    // A photo saved in the dashboard (database) wins over one that was only added on this device, so a replaced photo always shows.
    const found = remote[String(key).toLowerCase()] || getLocalImage(key) || MANUAL_IMAGES[key] || byName[String(key).toLowerCase()];
    if (found) return found;
  }
  return null;
}
