# The Elix: Restaurant Website Demonstration

A frontend-only presentation prototype for owner approval.
**All menu items, prices, photographs, reviews and business details are sample content.**

Built with React, Vite, JavaScript, CSS, React Router DOM, Motion for React (`motion/react`) and Lucide React.

There is no backend, database, ordering, cart, checkout, payment, customer login, delivery,
Zomato or WhatsApp feature in this project.

---

## Run it on Windows 11 with VS Code

1. Install **Node.js LTS** (version 18 or newer) from https://nodejs.org and accept the defaults.
   Install **VS Code** from https://code.visualstudio.com if needed.
2. Unzip `the-elix.zip`. You should get a folder named `the-elix` that contains `package.json`.
3. In VS Code choose **File > Open Folder** and select that `the-elix` folder.
4. Open the terminal with **Terminal > New Terminal** (PowerShell).
5. Install the packages (needs internet, takes about a minute):

       npm install

   If PowerShell says *"running scripts is disabled on this system"*, run this once, answer `Y`, and repeat step 5:

       Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

   Or run `npm.cmd install` instead.
6. Start the site:

       npm run dev

   It opens `http://localhost:5173` in your browser. Press `Ctrl+C` in the terminal to stop it.
7. Check the production build:

       npm run build
       npm run preview

   A `dist` folder means the build succeeded.

Fonts (Cormorant Garamond and Jost) load from Google Fonts. Offline, the site falls back to Georgia and system fonts.

## Presenting to the owner

- The landing page plays the restaurant's logo animation (`public/video/elix-intro.mp4`, about 7 seconds) full
  screen on the site's own ivory background. It plays every time the home page is opened, cannot be skipped, and
  when it ends the home page opens automatically. To play it only once per browser session, set
  `frequency: 'session'` in `INTRO` in `src/data/siteData.js`.
- The video starts muted because browsers block autoplay with sound. The **Sound off** button at the
  top left turns the sound on.
- If a browser refuses to autoplay, a round Play button appears so the animation can still be watched.
  If the video file cannot load, the site opens straight away.
- Click the magnifying glass for search (try Biryani, Chai, Dosa, Cake, Coffee, Brownie).
- Open the three-line menu button for About, Gallery, Reviews and Contact.
- Click any dish to open its detail window. Press `Esc` to close.

## Replacing the placeholders

**Landing video.** The video's background is the site's home background (#F6F0E6, `--bg` in `src/styles/themes.css`). If you replace it, use a video with exactly that background so the edges stay invisible. Replace `public/video/elix-intro.mp4` and `elix-intro.webm` (keep the file names; the WebM is a fallback for browsers without H.264), and optionally
`elix-intro-first.jpg` (first frame) and `elix-logo-final.jpg` (last frame). Paths are set in `INTRO` in `src/data/siteData.js`.
Keep the video under about 5 MB at 1080p so it loads quickly.

**Photographs.** Until real photos are added, each image space shows a clearly labelled "Demo image" panel.
Save photos into `src/assets/images/` and name them as listed in `src/assets/images/README.txt`:

- menu items by id, for example `irani-chai.jpg`, `masala-dosa.webp`, `chicken-dum-biryani.jpg`
- category banners: `category-chai.jpg`, `category-tiffins.jpg`, `category-bakery.jpg`, `category-food.jpg`
- page images: `hero-main.jpg`, `hero-accent.jpg`, `welcome.jpg`, `ambience.jpg`, `about-story.jpg`, `about-ambience.jpg`
- gallery: `gallery-interior-1.jpg` and so on

Restart `npm run dev` after adding files. No code changes are needed.

**Menu, prices and descriptions:** `src/data/menuData.js`
**Phone, address, hours, social links:** `src/data/siteData.js` (social links set to `#` stay inactive until real URLs are added)
**Reviews (sample):** `src/data/reviewsData.js`
**Gallery entries:** `src/data/galleryData.js`
**Colours:** `src/styles/themes.css` (the four fixed palettes use `[data-theme="chai"]`, `"tiffins"`, `"bakery"`, `"food"`)

## Project structure

    src/
      components/  Navbar, Footer, SocialSidebar, FoodCard, FeaturedFood, FoodGallery, CategoryCard,
                   FoodModal, SearchOverlay, Lightbox, IntroScreen, Logo, ImagePanel, Steam,
                   ReviewCard, SocialLinks
      pages/       Home, Explore, Chai, Tiffins, Bakery, Food, About, Gallery, Reviews, Contact, NotFound
      data/        menuData.js, siteData.js, galleryData.js, reviewsData.js, images.js
      themes/      themeConfig.js
      hooks/       usePage.js (page titles, category theme, item modal, focus trap)
      styles/      themes.css, global.css, components.css, pages.css, animations.css
      App.jsx, main.jsx

## Routes

`/` Home, `/explore`, `/chai`, `/tiffins`, `/bakery`, `/food`, `/about`, `/gallery`, `/reviews`, `/contact`.
Any other address shows a "Page not found" page.

---

## Update: intro sound, hero animation and hero video

- **Intro** (`src/components/IntroScreen.jsx`, `public/video/elix-intro.*`): the same logo animation, retimed to
  5.8 seconds, with a new subtle chime/shimmer soundtrack synced to the circle and logo reveal. Sound is on by
  default. If the browser blocks autoplay with sound, the animation plays and the top-left control reads
  "Tap for sound"; the first click, tap or key press turns sound on. The control toggles sound on/off.
- **Home hero** (`src/pages/Home.jsx`): THE ELIX lettering, tagline, description, buttons and visual animate in
  as one timeline when the intro finishes. Layout, text and styling are unchanged.
- **Hero food video** (`src/components/HeroVideo.jsx`): add your footage to `public/video/` as
  `hero-food.mp4` (and optionally `hero-food.webm`, `hero-food-poster.jpg`). It autoplays muted, loops,
  has no player box or controls, and pauses off-screen. Until the file is added, the original image panel is
  shown with the same cinematic lighting. Paths are set in `HERO_VIDEO` in `src/data/siteData.js`. The files are
  verified before use, so a missing clip never produces a broken player.

---

## Update: food photos and hover / tap clips

- **Photos**: name each file after the menu item id and drop it in `src/assets/images/`
  (e.g. `masala-dosa.webp`). Missing photos show the original labelled demo panel.
- **Hover clips**: drop a short clip named after the same id in `src/assets/videos/`
  (e.g. `masala-dosa.mp4`). On desktop, hovering the food image crossfades to the clip in the same area and
  back to the photo on leave. On phones, opening the item plays the clip (tap pauses / resumes).
  Items without a clip keep the photo only. Clips download only when first used, never on page load.
  Applies to menu cards, rows, tiles, the featured dish, the item detail view and food gallery entries only.
- **Checklist**: `npm run assets:check` lists every missing photo and clip and writes `ASSETS-CHECKLIST.md`.
- **Optimise**: `bash tools/optimize-media.sh <folder-of-originals>` converts originals to web-ready
  WebP / MP4 / WebM (needs ffmpeg).
- **Replacing later**: there is no admin dashboard in this project (it is frontend-only). Replacing a file with the
  same name replaces the asset everywhere; a future dashboard only needs to write to these two folders.

---

## Update: Supabase backend and admin dashboard

The site is now connected to Supabase (database, login, media storage) with a private dashboard at `/admin`.
See **README-BACKEND.md** for the setup steps. Without a `.env` the site runs on its built-in sample content as before.

## Media workflow (photos and clips)
1. `npm run assets:check` lists every required file as PASS or PENDING (`ASSETS-CHECKLIST.md`) and writes `tools/media-brief.json`
   with one prompt per menu item for a photographer or image/video generator.
2. Put originals in one folder, named by item id (`masala-dosa.jpg`, `masala-dosa.mov`, `hero-food.mov` ...), then run
   `bash tools/optimize-media.sh <folder>`. It produces web-ready WebP photos and small MP4/WebM clips.
3. `npm run assets:strict` fails until every file is PASS. Use it before a release.
