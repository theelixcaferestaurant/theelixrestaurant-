import { useMemo, useSyncExternalStore } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { BUSINESS, SOCIAL, SOCIAL_DEFAULTS, SETTINGS, HERO_VIDEO, OPENING_HOURS, CLOSURE, setDemoNotice } from '../data/siteData';
import { MENU, getItemsByCategory } from '../data/menuData';
import { GALLERY } from '../data/galleryData';
import { THEMES } from '../themes/themeConfig';
import { setRemoteImages } from '../data/images';
import { setRemoteVideos } from '../data/videos';
import { isUnavailable } from './availability';
import { closureShown, summariseWeeklyHours, upcomingSpecialHours } from './hours';
import { DAILY_TIMINGS } from '../data/timings';
import { setTakeawaySlides } from './takeaway';
import { fetchAllRows } from './fetchAll';

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

let version = 0;
let lastLoadError = null;
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

const clean = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
const rating = (price) => Number((4.4 + (price % 6) / 10).toFixed(1));
const formatPrice = (value) => (value === 'MRP' ? 'MRP' : `₹${Number(value)}`);
// The price exactly as shown on the website: the saved text (for example ₹200/380, ₹2,200 or MRP) or the number.
const displayPrice = (row) => (row.price_text && row.price_text.trim() ? row.price_text.trim() : formatPrice(row.price));

function applyContent({ info, hours, social, settings, categories, items, gallery, media, weekly, special, timings, menuFromDatabase }) {
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

  if (categories) {
    categories.forEach((row) => {
      if (!THEMES[row.key]) return;
      Object.assign(THEMES[row.key], {
        label: row.label,
        heading: row.heading,
        intro: row.intro,
        short: row.short_text,
      });
      // Subcategories come from the built-in menu only (Restaurant Food: VEG / NON-VEG / EGG / COMMON).
    });
  }

  if (items) {
    const live = (row) => ({
      availability: row.availability || 'available',
      unavailableUntil: row.unavailable_until || null,
      availFrom: row.available_from || null,
      availTo: row.available_to || null,
    });
    // The menu as the database holds it (every field editable in the dashboard).
    const fromRow = (row) => ({
      id: row.id,
      name: row.name,
      category: row.category_key,
      sub: row.sub || '',
      path: Array.isArray(row.path) && row.path.length ? row.path : row.sub ? [row.sub] : [],
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
      MENU.splice(0, MENU.length, ...items.filter((row) => THEMES[row.category_key]).map(fromRow));
    } else {
      // Before the migration: the built-in menu stays as supplied, with live availability and dashboard-added items.
      const rowsById = new Map(items.map((row) => [row.id, row]));
      const builtInIds = new Set(LOCAL_MENU.map((item) => item.id));
      const merged = LOCAL_MENU.map((item) => {
        const row = rowsById.get(item.id);
        return row ? { ...item, ...live(row) } : item;
      });
      items.forEach((row) => {
        if (builtInIds.has(row.id) || SAMPLE_ITEM_IDS.has(row.id) || !THEMES[row.category_key]) return;
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
    // An uploaded clip replaces the built-in one; removing it in the dashboard restores the built-in paths.
    HERO_VIDEO.mp4 = heroVideo ? (heroVideo.mime === 'video/webm' ? '' : heroVideo.url) : HERO_DEFAULTS.mp4;
    HERO_VIDEO.webm = heroVideo ? (heroVideo.mime === 'video/webm' ? heroVideo.url : '') : HERO_DEFAULTS.webm;
    HERO_VIDEO.poster = heroPoster ? heroPoster.url : HERO_DEFAULTS.poster;
  }
}

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
      const [weekly, special, timings, slides] = await Promise.all([
        supabase.from('weekly_hours').select('*'),
        supabase.from('special_hours').select('*'),
        supabase.from('service_timings').select('*').order('sort_order'),
        // Added by migration 0010. Until it is run, the built-in nine Take Away pages stay in place.
        supabase.from('takeaway_slides').select('*').eq('published', true).order('sort_order').order('created_at'),
      ]);
      const menuFromDatabase = (settings.data || []).some((row) => row.key === 'menu_source' && row.value === 'database');
      applyContent({
        info: info.data,
        hours: hours.data,
        social: social.data,
        settings: settings.data,
        categories: categories.data,
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
      notify();
      return true;
    } catch (error) {
      lastLoadError = error;
      console.warn('The Elix: could not load live content, showing built-in content.', error);
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
