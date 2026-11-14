# Image loading fix (first visit blank images)

## Root cause
Every photograph lives in the database (media_assets), not in the bundle. On a first visit the page paints before the
picture addresses are known, then each slot swaps in an `<img>` whose bytes have not arrived yet:
- the slot showed an empty dark frame while the file downloaded (no loading state, the old demo panel was already gone);
- the image was `loading="lazy"` inside a clip-path reveal frame (Home / About "Our story"), which browsers can hold back;
- a single network hiccup (`onError`) switched the slot to the demo panel permanently;
- on a refresh the browser already had the bytes cached, so the same code looked fine.

## Changes (frontend only; no Supabase, database, auth or MFA change)
- `src/components/ImagePanel.jsx`: neutral skeleton under every photo until it has fully loaded, then a short fade-in;
  no "Demo image" flash while the database is still answering; cached-image check; forced eager load if a lazy image is
  held back; 2 automatic retries before the demo panel; reveal frames are eager and have an on-screen safety net.
- `src/lib/content.js`: last known picture addresses are remembered in localStorage and applied at start-up (returning
  visitors begin downloading in parallel with the database request); site photos are warmed as soon as the database
  answers; slots stop waiting after a failure or 6 s.
- `src/components/TakeAwayMenuViewer.jsx`: neighbouring menu pages are preloaded.
- `src/styles/components.css`: `.img-skel`, `.img-fade` (loaded photos keep their existing rules, e.g. dimmed unavailable dishes).

## Verification
Component test in headless Chromium against a deliberately slow / flaky / dead image server: skeleton, then fade-in with
no blank frame; 503-then-OK recovers; 404 falls back to the labelled demo panel. All source files pass a syntax sweep.
`npm run build` was NOT run in the preparation environment (no network to install dependencies): run `npm install && npm run build`.
