# Performance, SEO and caching update

Safe, targeted changes only. No design, content, Supabase, admin, authentication or environment change.
Originals are untouched: nothing was deleted, renamed or overwritten except the lines listed below.

## Added files
- `tools/seo-postbuild.mjs`: runs after `npm run build`; writes per-page HTML heads, `sitemap.xml`, `robots.txt`, Restaurant JSON-LD
- `public/robots.txt`: fallback (replaced at build time by a version that also lists the sitemap)
- `public/assets/brand/og-image.jpg`: 1200x630 social-share image cut from the existing `elix-logo-final.jpg`
- `public/takeaway/menu/*.webp`: 9 WebP copies of the take away menu pages (20.5 MB -> 2.8 MB). The PNG originals stay.

## Edited files
- `index.html`: non-blocking Google Fonts (same URL, same swap), SEO block (markers for the build step), no-JS navigation
- `package.json`: one new line, `"postbuild": "node tools/seo-postbuild.mjs"`
- `vercel.json`: `/admin` is `no-store` + `noindex`; favicon cache. Existing rules unchanged.
- `src/App.jsx`: public pages except Home are code-split and prefetched when idle; canonical tag follows the shown page
- `src/main.jsx`: preconnect hint to the Supabase origin (read from the existing env var)
- `src/components/ImagePanel.jsx`: `fetchpriority="high"` on the eager (hero) image
- `src/data/takeawayMenuPages.js`, `src/components/TakeAwayMenuViewer.jsx`: viewer shows WebP; "Open at full size" still opens the PNG
- `src/pages/Home.jsx`: browser tab title matches the new SEO title
- `src/pages/NotFound.jsx`: adds `noindex` so unknown addresses are not indexed

## Needs one setting on Vercel
Set `SITE_URL` (for example `https://your-live-address`) in Vercel > Settings > Environment Variables if the site is on a
custom domain. Without it the build uses Vercel's production URL automatically; if neither exists, canonical URLs and
sitemap.xml are skipped (with a warning in the build log) instead of guessing an address.

## Revert
Everything is plain files: restore any file from Git to undo it. Removing the `postbuild` line disables the SEO step.
