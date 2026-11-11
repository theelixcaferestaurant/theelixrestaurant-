# Multi-level colour theme system

Source of truth: `src/themes/palettes.js` (all palettes, title -> theme mapping, `themeIdForPath`).
`npm run themes:build` compiles it to `src/styles/themes.generated.css` (also runs before `dev` and `build`).
A theme is applied with `data-theme="<id>"` on `<html>` (page), a section, a choice card, a search result or the modal;
the nearest ancestor wins, so child themes override parents and Back restores the parent.

Modified: package.json, src/main.jsx, src/styles/themes.css, src/styles/components.css, src/styles/pages.css,
src/themes/themeConfig.js (comment), src/pages/Food.jsx, src/components/CategoryPage.jsx,
src/components/FoodModal.jsx, src/components/SearchOverlay.jsx.
New: src/themes/palettes.js, src/styles/themes.generated.css, tools/generate-themes.mjs, this file.
Menu data, prices, images, layouts and admin pages are unchanged.

Notes: values the brief did not supply (muted/border for some groups; everything except the primary for third-level
sections) are derived from the supplied primary. Text roles (--accent, --muted) are auto-darkened only when the
supplied colour is under 4.5:1; buttons, badges and borders keep the exact supplied colours.
`applyThemeOverrides()` allows admin-configurable palettes at runtime; no admin UI was added (no colour columns in the DB).
