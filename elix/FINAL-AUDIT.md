# THE ELIX: final audit (status: NOT COMPLETE, no final release)
Environment limits during this audit: no network (npm registry, Supabase, stock sites unreachable), no browser,
no PostgreSQL, no image/video generation tool. Anything needing those is PENDING or FAIL, never PASS.

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1.1 | Logo animation preserved | PASS | Intro MP4/WebM unmodified from upload (1920x1080, H.264/VP9). |
| 1.2 | Theme-matching background | PASS | Frame corners sampled at 6 times = #f6f0e6 = `--bg`; `.intro` uses `var(--bg)`. |
| 1.3 | Duration 5-6 s | PASS | ffprobe: 5.80 s (MP4), 5.81 s (WebM). |
| 1.4 | Automatic transition | PENDING | `onEnded` + watchdog + blocked-autoplay timeout in code; not run in a browser. |
| 1.5 | Sound present | PASS (file) | AAC/Opus track, mean -18.3 dB, peak -5.3 dB, audible across the clip. |
| 1.6 | Premium, synchronized sound | PENDING | Needs human listening. |
| 1.7 | ON by default + top-left control + autoplay handling | PENDING | Logic reviewed (muted fallback, first-tap unlock, Play button); untested in real browsers. |
| 2.1 | Homepage sections incl. 5-7 | PENDING | Compared with the original ZIP: its Home has no sections 5-7 and no category bands (the band component is documented as deliberately unused on Home), so the bands I added earlier were REVERTED. Orphaned CSS (`.highlights`, `.highlight-row/-cat/-name`) shows a clickable rows list once existed; its content is unknowable, so nothing was invented. |
| 2.2 | Lettering/description/button/visual sequence | PENDING | Code sequenced; not viewed. |
| 2.3 | Hero video integrated, no player box | FAIL | `hero-food.mp4/.webm/-poster.jpg` do not exist; code verified to degrade safely. |
| 2.4 | Responsive desktop/mobile | PENDING | CSS breakpoints exist; never viewed. |
| 3.1 | 40 food photographs | FAIL | 0/40 (`src/assets/images` empty). |
| 3.2 | 40 matching videos | FAIL | 0/40 (`src/assets/videos` empty). |
| 4.1 | 4 category banners | FAIL | 0/4. |
| 4.2 | 16 gallery entries, 3 interior images | FAIL | 0/16; 0/3 interiors. |
| 4.3 | 13 site images | FAIL | 0/13. |
| 5.1 | No broken import/asset paths | PASS | Script: 0 unresolved relative imports; every /public reference resolves except the missing hero files above. |
| 5.2 | No demo placeholders or unrelated visuals | FAIL | Labelled "Demo image" panels still render because no media exists (correct fallback, but a FAIL). Fixed this pass: hard-coded "Demo image:" alt text on 4 category pages, CategoryCard alt, and a false "demo panels" line on Gallery. |
| 6.1 | Hover to video and back; tap on mobile | PENDING | Logic reviewed; nothing to play yet. |
| 6.2 | Interaction only on food/beverage items | PASS (code) | `videoKey` passed only by food cards, featured dish, item modal and non-Interior gallery entries. Fixed this pass: Interiors no longer eligible. |
| 7.1 | Tables, RLS, bucket SQL written | PASS (review) | `supabase/migrations/0001_*`: 9 tables, public read/admin write, `admins` not writable from the site. |
| 7.2 | Seed data | PASS (executed check) | 40 items identical to `menuData.js` (0 mismatches), 16 gallery, 4 categories. |
| 7.3 | SQL executes; RLS enforced; Auth; Storage; connection | PENDING | No database. `supabase/tests/verify_rls.sql` (24 checks) written but not executed. Needs your project. |
| 8 | Admin features (login, CRUD, uploads, categories, gallery, restaurant, hours, social, homepage) | PENDING | All pages exist; table/column usage cross-checked against schema; none run against a live backend. |
| 9 | Dashboard changes reach public site | PENDING | `refreshContent()` after saves + Realtime wired; untested. |
| 10.1 | Admin mobile/desktop layout | PENDING | CSS exists; not viewed. |
| 10.2 | Security: no secrets | PASS | Scan: no service_role key, JWT, DB URL or .env; `.env.example` placeholders only. |
| 10.3 | `npm install` and production build | PENDING | npm registry unreachable; all 80+ source files pass an esbuild syntax check, which is NOT a build. |
| - | Owner placeholder text (address, phone, hours, "Placeholder copy" pillars, reviews) | PENDING | Needs owner content. Most is editable in the dashboard; the four "Why The Elix" pillar texts are hard-coded. |
| - | No ordering/cart/payment features | PASS | None in source. |

Asset totals (`npm run assets:check`): 4 PASS, 112 PENDING of 116 required files.

## Code-level fixes in the latest pass (none browser-tested)
- Reverted the category bands (not in the original ZIP).
- Intro sound unlock now uses activation events only (pointerup/touchend/click/keydown), verifies the unmute, and falls back to silent playback; sound control has a stable accessible name, a 44 px touch target and notch safe-area offsets.
- Hero: probe results cached; `theme-color` meta now matches the ivory theme (was dark).
- "Why The Elix" pillars (8 texts) editable in Dashboard > Homepage; defaults unchanged; migration `0003_pillar_settings.sql`.
