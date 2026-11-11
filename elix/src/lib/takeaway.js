import { useSyncExternalStore } from 'react';
import { TAKEAWAY_MENU_PAGES } from '../data/takeawayMenuPages';

// Live Take Away menu pages.
// Until the database answers (or if Supabase is not configured or the takeaway_slides table has not been created yet)
// the built-in nine pages from src/data/takeawayMenuPages.js are shown, exactly as before.
// Once the table can be read, the slides saved in the dashboard (order, titles, images) are the Take Away menu.

let pages = TAKEAWAY_MENU_PAGES;
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const sameList = (a, b) =>
  a.length === b.length && a.every((p, i) => p.src === b[i].src && p.title === b[i].title && p.width === b[i].width && p.height === b[i].height);

// Maps database rows to the page objects the viewer already understands: { src, title, width, height }.
export const rowToPage = (row) => ({
  id: row.id,
  src: row.image_url,
  title: row.title,
  width: row.width || 1055,
  height: row.height || 1491,
});

export function setTakeawaySlides(rows) {
  const next = rows.map(rowToPage);
  if (sameList(pages, next)) return;
  pages = next;
  listeners.forEach((fn) => fn());
}

export const getTakeawayPages = () => pages;

// The pages the public viewer shows. Re-renders when the dashboard changes them.
export const useTakeawayPages = () => useSyncExternalStore(subscribe, getTakeawayPages, () => TAKEAWAY_MENU_PAGES);
