import { useMemo, useSyncExternalStore } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { BUSINESS, SOCIAL, SOCIAL_DEFAULTS, SETTINGS, HERO_VIDEO, OPENING_HOURS, CLOSURE, setDemoNotice } from '../data/siteData';
import { MENU, getItemsByCategory } from '../data/menuData';
import { GALLERY } from '../data/galleryData';
import { CATEGORY_ORDER, CATEGORY_PATHS, THEMES } from '../themes/themeConfig';
import { setRemoteImages } from '../data/images';
import { setRemoteVideos } from '../data/videos';
import { isUnavailable } from './availability';
import { closureShown, summariseWeeklyHours, upcomingSpecialHours } from './hours';
import { DAILY_TIMINGS } from '../data/timings';
import { setTakeawaySlides } from './takeaway';
import { fetchAllRows } from './fetchAll';
import { buildIndex, compareOrderKeys, placeItem } from './menuStructure';

// ---------------------------------------------------------------------------------------------
// Live content layer.
// The public website reads its content from the same objects it always has (BUSINESS, SOCIAL, MENU,
// GALLERY, THEMES ...). This module fills those objects from Supabase and tells React to re-render.
// Until the database answers (or if Supabase is not configured or unreachable) the built-in sample
// data stays in place, so the public site never shows an empty page.
// ---------------------------------------------------------------------------------------------

// Built-in hero video paths, restored when the dashboard's hero video / cover photo is removed.
const HERO_DEFAULTS = { ...HERO_VIDEO };

// The built-in menu (src/data/menuData.js, restored from the backup) is the public menu: names, prices,
// descriptions, order and nested headings stay exactly as supplied. Taken before any database content is applied.
const LOCAL_MENU = [...MENU];

// The category order the website had before the dashboard could reorder categories (used only for built-in categories
// that are not in the database yet).
const DEFAULT_CATEGORY_ORDER = [...CATEGORY_ORDER];

// Sample items from supabase/migrations/0002_seed_content.sql. They are not part of the supplied menu,
// so they stay off the public site. Items added in the dashboard (any other id) are shown.
const SAMPLE_ITEM_IDS = new Set([
  'irani-chai', 'masala-chai', 'ginger-tea', 'lemon-tea', 'filter-coffee', 'cappuccino',
  'cold-coffee', 'chocolate-milkshake', 'fresh-lime-mojito', 'watermelon-juice', 'plain-idli',
  'ghee-idli', 'medu-vada', 'mysore-masala-dosa', 'ghee-karam-dosa', 'pongal',
  'chocolate-truffle-cake', 'red-velvet-pastry', 'black-forest-pastry', 'blueberry-cheesecake',
  'chocolate-brownie', 'butter-croissant', 'chocolate-donut', 'choco-chip-cookies',
  'walnut-brownie', 'chocolate-mousse', 'veg-dum-biryani', 'chicken-dum-biryani', 'chicken-65',
  'paneer-butter-masala', 'chicken-mandi', 'mutton-mandi'
]);


// ---------------------------------------------------------------------------------------------
// Image loading support (read-only; nothing here writes to Supabase).
// All photographs live in the database, so on a first visit the page paints BEFORE the picture addresses are known.
//  1. The last known picture addresses are kept in this browser (localStorage). A returning visitor therefore starts
//     downloading the photographs in parallel with the database request, not after it.
//  2. As soon as the database answers, the site's key photographs are fetched ahead of time (warmed) so they are
//     already in the browser cache when their section is drawn.
//  3. `contentSettled` tells picture slots when to stop showing the neutral loading state and fall back to the
//     labelled demo panel (database answered, failed, or took too long).
// ---------------------------------------------------------------------------------------------
const MEDIA_CACHE_KEY = 'elix-media-cache-v1';
const isUrl = (value) => typeof value === 'string' && /^(https?:)?\/\//i.test(value);

function hydrateMediaFromCache() {
  try {
    const raw = window.localStorage.getItem(MEDIA_CACHE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return;
    const images = {};
    Object.entries(saved.images || {}).forEach(([key, url]) => {
      if (isUrl(url)) images[key] = url;
    });
    if (Object.keys(images).length) setRemoteImages(images);
    if (isUrl(saved.heroPoster)) HERO_VIDEO.poster = saved.heroPoster;
  } catch {
    /* storage blocked or unreadable: the database answer will fill everything in */
  }
}

function saveMediaToCache(images, heroPoster) {
  try {
    window.localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify({ images, heroPoster: heroPoster || '' }));
  } catch {
    /* storage full or blocked: harmless, the cache is only a speed-up */
  }
}

const warmed = new Set();
function warmImages(urls) {
  if (typeof Image === 'undefined') return;
  urls.forEach((url) => {
    if (!isUrl(url) || warmed.has(url)) return;
    warmed.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  });
}

let contentSettled = false;
const settle = () => {
  if (contentSettled) return false;
  contentSettled = true;
  return true;
};

if (typeof window !== 'undefined' && isSupabaseConfigured) hydrateMediaFromCache();

let version = 0;
let lastLoadError = null;
let loadedOnce = false;
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const notify = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

// Re-renders the calling component whenever the content changes.
export const useContentVersion = () => useSyncExternalStore(subscribe, () => version, () => 0);

// Menu items of one category, recomputed whenever the content changes.
export function useCategoryItems(category) {
  const v = useContentVersion();
  return useMemo(() => getItemsByCategory(category), [category, v]);
}

export const getLoadError = () => lastLoadError;

// True once the database has answered (or failed, or is not configured), so a page for a dashboard-created category
// can tell "not loaded yet" from "does not exist".
export const hasLoadedContent = () => loadedOnce || Boolean(lastLoadError) || !isSupabaseConfigured;

// True once picture slots may stop waiting for the database: it answered, failed, or took too long (see startLiveContent).
export const isContentSettled = () => contentSettled || hasLoadedContent();

const clean = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
const rating = (price) => Number((4.4 + (price % 6) / 10).toFixed(1));
const formatPrice = (value) => (value === 'MRP' ? 'MRP' : `₹${Number(value)}`);
// The price exactly as shown on the website: the saved text (for example ₹200/380, ₹2,200 or MRP) or the number.
const displayPrice = (row) => (row.price_text && row.price_text.trim() ? row.price_text.trim() : formatPrice(row.price));

// Categories from the database. Built-in categories keep their own page, palette and address; a category created in the
// dashboard gets a page at /menu/<key> (see src/pages/MenuCategory.jsx) and the site's default colours.
function applyCategories(rows) {
  const present = new Set();
  rows.forEach((row) => {
    present.add(row.key);
    if (!THEMES[row.key]) {
      THEMES[row.key] = { code: '', letter: '•', path: `/menu/${row.key}`, custom: true };
    }
    const theme = THEMES[row.key];
    Object.assign(theme, {
      label: row.label,
      heading: theme.custom ? row.heading || row.label : row.heading,
      intro: row.intro,
      short: row.short_text,
      disabled: row.enabled === false,
    });
    if (theme.custom) theme.code = String(row.label || row.key).toUpperCase();
  });
  // a dashboard-created category that was deleted disappears
  Object.keys(THEMES).forEach((key) => {
    if (THEMES[key].custom && !present.has(key)) delete THEMES[key];
  });

  // Order, visibility and the lists that Explore, Dine In, Footer, Home and the navigation read. Only once migration 0014
  // has run (the rows then carry `enabled`); before that the built-in order stays exactly as it was.
  if (!rows.some((row) => 'enabled' in row)) return;
  const sorted = [...rows].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.label).localeCompare(String(b.label)));
  const keys = sorted.filter((row) => row.key !== 'party' && THEMES[row.key] && row.enabled !== false).map((row) => row.key);
  DEFAULT_CATEGORY_ORDER.forEach((key) => {
    if (!present.has(key)) keys.push(key); // a built-in category that is not in the table yet keeps its usual place
  });
  CATEGORY_ORDER.splice(0, CATEGORY_ORDER.length, ...keys);
  CATEGORY_PATHS.splice(0, CATEGORY_PATHS.length, ...keys.map((key) => THEMES[key].path));
}

// Items of the same category are laid out in subcategory order first (then by their own order number), so reordering
// subcategories in the dashboard changes the order of the sections on the website.
function orderByStructure(entries) {
  const buckets = new Map();
  entries.forEach((entry) => {
    const key = entry.row.category_key;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  });
  const out = [];
  buckets.forEach((list) => {
    out.push(
      ...list
        .map((entry, i) => ({ entry, i }))
        .sort((a, b) => compareOrderKeys(a.entry.place.orderKey, b.entry.place.orderKey) || a.i - b.i)
        .map(({ entry }) => entry)
    );
  });
  return out;
}

function applyContent({ info, hours, social, settings, categories, subcategories, items, gallery, media, weekly, special, timings, menuFromDatabase }) {
  if (info) {
    Object.assign(BUSINESS, {
      name: clean(info.name, BUSINESS.name),
      tagline: clean(info.tagline),
      address: clean(info.address),
      phone: clean(info.phone),
      email: clean(info.email),
    });
  }
  if (hours) BUSINESS.hours = hours.map((row) => ({ days: row.days, time: row.hours }));

  if (social) {
    social.forEach((row) => {
      // A saved link is used as typed. An empty one falls back to the built-in link (Instagram: the official profile;
      // the others stay '#', so their icons stay inactive as before).
      if (row.platform in SOCIAL) SOCIAL[row.platform] = (row.url && row.url.trim()) || SOCIAL_DEFAULTS[row.platform] || '#';
    });
  }

  if (settings) {
    settings.forEach((row) => {
      if (row.key === 'demo_notice') setDemoNotice(row.value);
      else if (row.key === 'closure_notice_active') CLOSURE.active = row.value === 'true';
      else if (row.key === 'closure_notice_text') CLOSURE.text = row.value;
      else if (row.key === 'closure_notice_until') CLOSURE.until = row.value;
      else if (row.key in SETTINGS) SETTINGS[row.key] = row.value;
    });
  }

  // Opening hours (weekly_hours + special_hours) and the Daily Timings list. Missing tables keep the built-in text.
  if (weekly && weekly.length) {
    const summary = summariseWeeklyHours(weekly);
    if (summary) Object.assign(OPENING_HOURS, summary, { time: summary.lines[0].time, days: summary.lines[0].days });
  }
  if (special) OPENING_HOURS.special = special;
  if (timings && timings.length) {
    DAILY_TIMINGS.splice(
      0,
      DAILY_TIMINGS.length,
      ...timings.map((row) => ({ key: row.key, label: row.label, open: row.open_text, close: row.close_text, closeNote: row.close_note || '' }))
    );
  }

  if (categories) applyCategories(categories);

  if (items) {
    const live = (row) => ({
      availability: row.availability || 'available',
      unavailableUntil: row.unavailable_until || null,
      availFrom: row.available_from || null,
      availTo: row.available_to || null,
    });
    // Subcategories (migration 0014). Without them every item keeps the heading text stored on the item itself.
    const index = subcategories ? buildIndex(subcategories) : null;
    const categoryShown = (key) => Boolean(THEMES[key]) && !THEMES[key].disabled;
    // The menu as the database holds it (every field editable in the dashboard).
    const fromRow = (row, place = placeItem(index, row)) => ({
      id: row.id,
      name: row.name,
      category: row.category_key,
      sub: place.sub,
      path: place.path,
      price: displayPrice(row),
      veg: row.veg,
      desc: row.description || '',
      featured: row.featured,
      hot: row.hot,
      ...live(row),
      rating: rating(Number(row.price)),
    });

    if (menuFromDatabase) {
      // Migration 0010 has copied the whole menu into the database: the database IS the menu now. Items deleted or
      // hidden in the dashboard disappear completely (no empty cards), new items and edits show straight away.
      const shown = items
        .filter((row) => categoryShown(row.category_key))
        .map((row) => ({ row, place: placeItem(index, row) }))
        .filter(({ place }) => !place.hidden);
      MENU.splice(0, MENU.length, ...orderByStructure(shown).map(({ row, place }) => fromRow(row, place)));
    } else {
      // Before the migration: the built-in menu stays as supplied, with live availability and dashboard-added items.
      const rowsById = new Map(items.map((row) => [row.id, row]));
      const builtInIds = new Set(LOCAL_MENU.map((item) => item.id));
      const merged = LOCAL_MENU.map((item) => {
        const row = rowsById.get(item.id);
        return row ? { ...item, ...live(row) } : item;
      }).filter((item) => categoryShown(item.category));
      items.forEach((row) => {
        if (builtInIds.has(row.id) || SAMPLE_ITEM_IDS.has(row.id) || !categoryShown(row.category_key)) return;
        merged.push(fromRow(row));
      });
      MENU.splice(0, MENU.length, ...merged);
    }
  }

  if (gallery) {
    GALLERY.splice(
      0,
      GALLERY.length,
      ...gallery.map((row) => ({
        id: row.id,
        title: row.title,
        group: row.grp,
        ratio: row.ratio,
        ...(row.item_id ? { itemId: row.item_id } : {}),
      }))
    );
  }

  if (media) {
    const images = {};
    const videos = {};
    let heroVideo = null;
    let heroPoster = null;
    media.forEach((row) => {
      const key =
        row.owner_type === 'gallery' ? `gallery-${row.owner_id}` : row.owner_id; // menu item id or site key
      if (row.owner_type === 'site' && row.owner_id === 'hero-video') heroVideo = row;
      else if (row.owner_type === 'site' && row.owner_id === 'hero-poster') heroPoster = row;
      else if (row.kind === 'image') images[key.toLowerCase()] = row.url;
      else if (row.kind === 'video') {
        videos[key.toLowerCase()] = row.mime === 'video/webm' ? { webm: row.url } : { mp4: row.url };
      }
    });
    setRemoteImages(images);
    setRemoteVideos(videos);
    saveMediaToCache(images, heroPoster ? heroPoster.url : '');
    // Site photographs (home, about, categories, hero) are fetched ahead of time; menu and gallery photos stay on demand.
    warmImages([
      heroPoster && heroPoster.url,
      ...media.filter((row) => row.kind === 'image' && row.owner_type === 'site').map((row) => row.url),
    ].slice(0, 30));
    // An uploaded clip replaces the built-in one; removing it in the dashboard restores the built-in paths.
    HERO_VIDEO.mp4 = heroVideo ? (heroVideo.mime === 'video/webm' ? '' : heroVideo.url) : HERO_DEFAULTS.mp4;
    HERO_VIDEO.webm = heroVideo ? (heroVideo.mime === 'video/webm' ? heroVideo.url : '') : HERO_DEFAULTS.webm;
    HERO_VIDEO.poster = heroPoster ? heroPoster.url : HERO_DEFAULTS.poster;
  }
}

const isMissingTable = (error) =>
  Boolean(error) && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table|schema cache/i.test(error.message || ''));

let loading = null;
let reloadAfter = false;

// Reads everything the public site needs and applies it. Safe to call as often as needed.
// A call made while a load is already running is not dropped: it triggers one more load right after, so a change
// saved in the dashboard in that moment is never missed (the returned promise resolves after that fresh load).
export function refreshContent() {
  if (!isSupabaseConfigured) return Promise.resolve(false);
  if (loading) {
    reloadAfter = true;
    return loading;
  }
  const run = (async () => {
    try {
      const q = (table, build) => (build ? build(supabase.from(table).select('*')) : supabase.from(table).select('*'));
      const [info, hours, social, settings, categories, items, gallery, media] = await Promise.all([
        q('restaurant_info', (r) => r.eq('id', 1).maybeSingle()),
        q('opening_hours', (r) => r.order('sort_order')),
        q('social_links'),
        q('site_settings'),
        q('categories', (r) => r.order('sort_order')),
        fetchAllRows(() => supabase.from('menu_items').select('*').eq('available', true).order('sort_order').order('id')),
        q('gallery_items', (r) => r.eq('visible', true).order('sort_order')),
        q('media_assets'),
      ]);
      const failed = [info, hours, social, settings, categories, items, gallery, media].find((r) => r.error);
      if (failed) throw failed.error;
      // Added by migration 0009. If it has not been run yet these fail quietly and the built-in text stays.
      const [weekly, special, timings, slides, subcategories] = await Promise.all([
        supabase.from('weekly_hours').select('*'),
        supabase.from('special_hours').select('*'),
        supabase.from('service_timings').select('*').order('sort_order'),
        // Added by migration 0010. Until it is run, the built-in nine Take Away pages stay in place.
        supabase.from('takeaway_slides').select('*').eq('published', true).order('sort_order').order('created_at'),
        // Added by migration 0014. Until it is run, items keep the heading text stored on each item.
        fetchAllRows(() => supabase.from('menu_subcategories').select('*').order('id')),
      ]);
      // A missing table is fine (older database). Any other failure aborts this refresh, so a hiccup can never make
      // renamed or hidden subcategories flash back to their old state.
      if (subcategories.error && !isMissingTable(subcategories.error)) throw subcategories.error;
      const menuFromDatabase = (settings.data || []).some((row) => row.key === 'menu_source' && row.value === 'database');
      applyContent({
        info: info.data,
        hours: hours.data,
        social: social.data,
        settings: settings.data,
        categories: categories.data,
        subcategories: subcategories.error ? null : subcategories.data,
        // Before the menu has been copied into the database an empty table keeps the built-in menu.
        // After it (menu_source = database) the table is the menu, even when every item has been removed.
        items: menuFromDatabase || (items.data && items.data.length) ? items.data : null,
        menuFromDatabase,
        gallery: gallery.data && gallery.data.length ? gallery.data : null,
        media: media.data,
        weekly: weekly.error ? null : weekly.data,
        special: special.error ? null : special.data,
        timings: timings.error ? null : timings.data,
      });
      if (!slides.error && slides.data) setTakeawaySlides(slides.data);
      lastLoadError = null;
      loadedOnce = true;
      notify();
      return true;
    } catch (error) {
      lastLoadError = error;
      console.warn('The Elix: could not load live content, showing built-in content.', error);
      notify(); // picture slots stop waiting and show their built-in / demo state
      return false;
    } finally {
      loading = null;
    }
  })();
  loading = run.then((ok) => {
    if (!reloadAfter) return ok;
    reloadAfter = false;
    return refreshContent();
  });
  return loading;
}

// Starts the live connection: first load, then refresh on any database change (Realtime),
// when the tab becomes visible again, and every few minutes as a safety net.
let started = false;
export function startLiveContent() {
  if (started || !isSupabaseConfigured) return;
  started = true;
  refreshContent();
  // A slow or hanging database must never leave picture slots in their loading state for ever.
  setTimeout(() => {
    if (settle()) notify();
  }, 6000);

  let timer = null;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(refreshContent, 350);
  };
  supabase
    .channel('elix-public-content')
    .on('postgres_changes', { event: '*', schema: 'public' }, soon)
    .subscribe();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) soon();
  });
  window.addEventListener('online', soon);
  setInterval(() => {
    if (!document.hidden) refreshContent();
  }, 5 * 60 * 1000);

  // Scheduled availability and closure notices change with the clock, not with the database:
  // re-render once a minute, but only when something visible actually flips.
  const clockSignature = () => `${MENU.map((item) => (isUnavailable(item) ? '1' : '0')).join('')}|${closureShown(CLOSURE)}|${upcomingSpecialHours(OPENING_HOURS.special).length}`;
  let lastClock = clockSignature();
  setInterval(() => {
    const now = clockSignature();
    if (now !== lastClock) {
      lastClock = now;
      notify();
    }
  }, 60 * 1000);
}
