// THE ELIX: SEO post-build step. Runs automatically after `vite build` (see "build" in package.json).
//
// What it does (it only adds files / rewrites <head> tags inside dist/; no source file is touched):
//   1. Writes one HTML file per public page (dist/<route>/index.html) whose <head> already contains that page's
//      own title, description, canonical URL and Open Graph / Twitter tags. Search engines and link previews
//      (WhatsApp, Facebook, ...) read these without running JavaScript. The React app loads exactly as before.
//   2. Writes dist/sitemap.xml and dist/robots.txt.
//   3. Adds Restaurant (schema.org LocalBusiness) structured data to the home and contact pages, built ONLY from
//      the details already stored in src/data/siteData.js (name, address, phone, e-mail, hours, Instagram).
//
// The site's public address is needed for canonical URLs and the sitemap. It is read from, in this order:
//   SITE_URL                          (set this in Vercel > Settings > Environment Variables to your live address)
//   VERCEL_PROJECT_PRODUCTION_URL     (provided automatically by Vercel)
// If neither exists the script still writes the per-page titles/descriptions, but skips canonical URLs, the
// sitemap and structured-data URLs rather than guessing an address, and prints a warning.
//
// The script never fails the build: any problem is reported as a warning and the normal build output is kept.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const warn = (msg) => console.warn(`[seo] WARNING: ${msg}`);
const info = (msg) => console.log(`[seo] ${msg}`);

// ---- public address ------------------------------------------------------------------------------------------
function resolveSiteUrl() {
  let raw = (process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    return new URL(raw).origin; // no trailing slash, no path
  } catch {
    warn(`"${raw}" is not a valid address; ignoring it.`);
    return '';
  }
}

// ---- pages ---------------------------------------------------------------------------------------------------
// Titles match the ones the app sets in the browser (usePageTitle). Descriptions only restate facts already on the
// site (menu categories, Take Away / Dine In / Party Orders, the official address and contact options).
const PLACE = 'Mokila, Hyderabad';
const ROUTES = [
  { path: '/', title: `The Elix | Cafe & Restaurant in ${PLACE}`, priority: '1.0',
    description: `The Elix is a cafe and restaurant in ${PLACE}. Chai and beverages, South Indian tiffins, restaurant food, mandi, shawarma and a bakery, with dine in and take away.` },
  { path: '/explore', title: 'Explore Menu | The Elix', priority: '0.9',
    description: 'Explore the menu at The Elix: chai and beverages, South Indian tiffins, restaurant food, mandi, shawarma and bakery. Choose dine in or take away.' },
  { path: '/explore/dine', title: 'Dine In | The Elix', priority: '0.7',
    description: `Dine in at The Elix, ${PLACE}. Browse chai, tiffins, restaurant food, mandi, shawarma and bakery menus.` },
  { path: '/explore/take', title: 'Take Away | The Elix', priority: '0.7',
    description: `Take away from The Elix, ${PLACE}. Browse the take away menu and party order packages, or contact us on WhatsApp or by phone.` },
  { path: '/explore/take/menu', title: 'Take Away Menu | The Elix', priority: '0.8',
    description: 'The Elix take away menu, page by page: chai and beverages, South Indian tiffins, restaurant food, shawarma and bakery.' },
  { path: '/explore/take/party', title: 'Party Orders | The Elix', priority: '0.7',
    description: 'Handi biryani packages for small parties and get-togethers, by number of members, from The Elix.' },
  { path: '/chai', title: 'Chai & Beverages | The Elix', priority: '0.8',
    description: 'Comforting teas, refreshing beverages and carefully crafted drinks at The Elix, Mokila, Hyderabad.' },
  { path: '/tiffins', title: 'South Indian Tiffins | The Elix', priority: '0.8',
    description: 'Traditional South Indian breakfast and tiffins at The Elix, Mokila, Hyderabad: idli, dosa, vada and more.' },
  { path: '/food', title: 'Restaurant Food | The Elix', priority: '0.8',
    description: 'Restaurant food at The Elix, Mokila, Hyderabad: vegetarian, non-vegetarian, egg and common dishes.' },
  { path: '/mandi', title: 'Mandi | The Elix', priority: '0.6',
    description: `Mandi at The Elix, ${PLACE}.` },
  { path: '/shawarma', title: 'Shawarma | The Elix', priority: '0.7',
    description: 'Chicken, veg, paneer and mushroom shawarma at The Elix, Mokila, Hyderabad.' },
  { path: '/bakery', title: 'Bakery | The Elix', priority: '0.8',
    description: 'Cakes, pastries, brownies and desserts at the bakery of The Elix, Mokila, Hyderabad.' },
  { path: '/about', title: 'About Us | The Elix', priority: '0.6',
    description: `About The Elix, a cafe and restaurant in ${PLACE}.` },
  { path: '/gallery', title: 'Gallery | The Elix', priority: '0.6',
    description: `Photo gallery of The Elix, ${PLACE}: the restaurant, the food and the atmosphere.` },
  { path: '/reviews', title: 'Reviews | The Elix', priority: '0.6',
    description: 'What guests say about The Elix, and how to share your own review.' },
  { path: '/contact', title: 'Contact | The Elix', priority: '0.9',
    description: `Contact The Elix: address, phone, WhatsApp, opening hours and directions to ${PLACE}.` },
];
const STRUCTURED_DATA_PATHS = new Set(['/', '/contact']);

// ---- helpers -------------------------------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function to24h(text) {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(text);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

async function buildRestaurantJsonLd(site) {
  const data = await import(pathToFileURL(path.join(root, 'src/data/siteData.js')).href);
  const { BUSINESS, OPENING_HOURS, INSTAGRAM_URL, MAPS_URL, FOOTER_ADDRESS } = data;

  // Safety check: only publish the address if it still matches the verified one (Mokila, Hyderabad 501203).
  if (!/Mokila/i.test(FOOTER_ADDRESS) || !/501203/.test(FOOTER_ADDRESS)) {
    warn('The address in siteData.js changed; structured data was skipped. Update tools/seo-postbuild.mjs to match.');
    return null;
  }

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: BUSINESS.name,
    description: ROUTES[0].description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'H 6-126, Kondakal - Shankarpally Road, Opp. Sri Sri Bramarambika Temple, Mokila',
      addressLocality: 'Hyderabad',
      addressRegion: 'Telangana',
      postalCode: '501203',
      addressCountry: 'IN',
    },
  };
  if (site) {
    ld.url = `${site}/`;
    ld.image = `${site}/assets/brand/og-image.jpg`;
    ld['@id'] = `${site}/#restaurant`;
  }
  if (BUSINESS.phone) ld.telephone = BUSINESS.phone.replace(/[^\d+]/g, '');
  if (BUSINESS.email) ld.email = BUSINESS.email;
  if (MAPS_URL) ld.hasMap = MAPS_URL;
  if (INSTAGRAM_URL) ld.sameAs = [INSTAGRAM_URL];

  // Opening hours: only when the site's hours are one uniform "open daily" range (the verified setup).
  const [openText, closeText] = String(OPENING_HOURS?.time || '').split(/[–-]/);
  const opens = to24h(openText || '');
  const closes = to24h(closeText || '');
  if (OPENING_HOURS?.uniformOpen && opens && closes) {
    ld.openingHoursSpecification = [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens,
        closes,
      },
    ];
  }
  return ld;
}

function headBlock(route, site, jsonLd) {
  const url = site ? `${site}${route.path === '/' ? '/' : route.path}` : '';
  const image = site ? `${site}/assets/brand/og-image.jpg` : '';
  const lines = [
    `<title>${esc(route.title)}</title>`,
    `<meta name="description" content="${esc(route.description)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    url && `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="The Elix" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:title" content="${esc(route.title)}" />`,
    `<meta property="og:description" content="${esc(route.description)}" />`,
    url && `<meta property="og:url" content="${esc(url)}" />`,
    image && `<meta property="og:image" content="${esc(image)}" />`,
    image && `<meta property="og:image:width" content="1200" />`,
    image && `<meta property="og:image:height" content="630" />`,
    image && `<meta property="og:image:alt" content="The Elix cafe and restaurant logo" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(route.title)}" />`,
    `<meta name="twitter:description" content="${esc(route.description)}" />`,
    image && `<meta name="twitter:image" content="${esc(image)}" />`,
  ];
  // Home only: the logo-animation poster is the first thing painted, so fetch it early.
  if (route.path === '/') {
    lines.push(`<link rel="preload" as="image" href="/video/elix-intro-first.jpg" fetchpriority="high" />`);
  }
  if (jsonLd && STRUCTURED_DATA_PATHS.has(route.path)) {
    lines.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  return lines.filter(Boolean).map((l) => `    ${l}`).join('\n');
}

// ---- main ----------------------------------------------------------------------------------------------------
async function main() {
  const indexPath = path.join(dist, 'index.html');
  if (!fs.existsSync(indexPath)) {
    warn('dist/index.html not found; nothing to do.');
    return;
  }
  const shell = fs.readFileSync(indexPath, 'utf8');
  const START = '<!--seo:start-->';
  const END = '<!--seo:end-->';
  if (!shell.includes(START) || !shell.includes(END)) {
    warn('SEO markers missing in index.html; per-page metadata was skipped.');
    return;
  }

  const site = resolveSiteUrl();
  if (!site) {
    warn('No site address found (set SITE_URL, or deploy on Vercel). Canonical URLs, sitemap.xml and structured-data URLs are skipped.');
  } else {
    info(`Site address: ${site}`);
  }

  let jsonLd = null;
  try {
    jsonLd = await buildRestaurantJsonLd(site);
  } catch (error) {
    warn(`Structured data skipped: ${error.message}`);
  }

  const blockRe = new RegExp(`${START}[\\s\\S]*?${END}`);
  let written = 0;
  for (const route of ROUTES) {
    const html = shell.replace(blockRe, () => `${START}\n${headBlock(route, site, jsonLd)}\n    ${END}`);
    const target = route.path === '/' ? indexPath : path.join(dist, route.path, 'index.html');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
    written += 1;
  }
  info(`Wrote ${written} page heads.`);

  // robots.txt: public pages are open; the private dashboard is not indexed.
  const robots = ['User-agent: *', 'Allow: /', 'Disallow: /admin', ''];
  if (site) robots.push(`Sitemap: ${site}/sitemap.xml`, '');
  fs.writeFileSync(path.join(dist, 'robots.txt'), robots.join('\n'));

  if (site) {
    const urls = ROUTES.map(
      (r) => `  <url>\n    <loc>${escXml(`${site}${r.path === '/' ? '/' : r.path}`)}</loc>\n    <priority>${r.priority}</priority>\n  </url>`
    ).join('\n');
    fs.writeFileSync(
      path.join(dist, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
    );
    info(`Wrote sitemap.xml (${ROUTES.length} URLs) and robots.txt.`);
  } else {
    info('Wrote robots.txt (without a Sitemap line).');
  }
}

main().catch((error) => warn(`SEO step skipped: ${error.message}`));
