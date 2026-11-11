# Take Away: Midnight Black & Royal Gold

## Scope
Applied only to the Take Away hub (Take Away Menu and Party Orders choices) and the Take Away Menu page.
Party Orders keeps its Orchid & Slate theme. DINE IN, all six category pages and the admin dashboard are unchanged.

## Theme
- New palette `takeaway` in `src/themes/palettes.js`, using the exact hex codes supplied:
  Midnight Black #090909 (page), Deep Charcoal #151515 (menu panels, footer), Graphite Black #202020 (cards),
  Royal Gold #C5A04B (buttons, prices, accent), Champagne Gold #E4BD69 (section titles, ornaments),
  Antique Gold #A98236 (secondary), Warm Ivory #F5EBD7 (headings), Soft Beige #E9DFC9 (body),
  Muted Gold #80652F (borders), Gold Black #302719 (hover).
- Optional palette fields `heroBg`, `heroText`, `onDark`, `highlight`, `panel` added. Only palettes that set them emit them.
- `hover` is now emitted as the shared `--hover` variable (previously `--row-hover`). Party Orders keeps the same hover colour.
- `src/styles/themes.generated.css` regenerated with `npm run themes:build`.

## Behaviour
- The Take Away hub and Take Away Menu pages set the `takeaway` theme on the page, so navigation, headings,
  buttons and footer follow it, as they already do for each category.
- Take Away Menu category blocks use the Midnight theme instead of each category's own colours. Their pictures,
  layout and images are unchanged.
- Hover: choice cards use Gold Black; gallery pictures get a thin gold outline on hover and keyboard focus.

## Files modified
- `src/themes/palettes.js`: Midnight Black & Royal Gold palette; optional-field emission; shared `--hover`.
- `src/styles/themes.generated.css`: regenerated.
- `src/styles/components.css`: shared row hover uses `--hover`; new `[data-theme="takeaway"]` rules at the end.
- `src/pages/TakeAway.jsx`: hub and menu page set the Take Away theme.
- `src/components/TakeAwayPanel.jsx`: category blocks use the Take Away theme.
