// THE ELIX: central colour-theme configuration (single source of truth).
//
// Every theme id below becomes a  [data-theme="<id>"]  block of CSS variables in
// src/styles/themes.generated.css (run `npm run themes:build`; it also runs before dev/build).
// Because they are plain attribute selectors, a theme can be placed on <html> (whole page),
// on a section, on a choice card or on a modal, and the nearest ancestor with data-theme wins.
// That is what lets a child theme override its parent and lets the parent return on Back.
//
// Palette fields (all hex):  primary, secondary, accent, bg, surface, text, muted,
//                            button, buttonText, price, priceText, border
//                            (+ optional dark, onDark, heading, highlight, panel, hover, heroBg, heroText:
//                             each emitted only when given)
// Palettes created with derive() fill the fields the brief did not specify from the supplied
// primary colour, so every nested section stays related to its parent family.

// ---------- colour helpers (pure, no dependencies) ----------
const toRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
export const mix = (a, b, t) => {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return toHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
};
const lum = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Builds a full palette from a primary colour (used only where the brief gives just a primary).
function derive(label, primary, over = {}) {
  let button = primary;
  while (contrast(button, '#FFFFFF') < 4.5) button = mix(button, '#000000', 0.08);
  let text = mix(primary, '#000000', 0.68);
  const bg = mix(primary, '#FFFFFF', 0.9);
  while (contrast(text, bg) < 9) text = mix(text, '#000000', 0.1);
  let muted = mix(primary, '#000000', 0.2);
  while (contrast(muted, bg) < 4.5) muted = mix(muted, '#000000', 0.1);
  return {
    label,
    primary,
    secondary: mix(primary, '#FFFFFF', 0.3),
    accent: mix(primary, '#FFFFFF', 0.55),
    bg,
    surface: mix(primary, '#FFFFFF', 0.8),
    text,
    muted,
    button,
    buttonText: '#FFFFFF',
    price: button,
    priceText: '#FFFFFF',
    border: mix(primary, '#FFFFFF', 0.68),
    ...over,
  };
}

// ---------- 1-6: the six main categories (values exactly as supplied) ----------
const MAIN = {
  chai: { label: 'Chai & Beverages: Coffee Brown & Antique Gold', primary: '#4B3028', secondary: '#795548', accent: '#C6A15B', bg: '#F5EBDD', surface: '#E9D9C5', text: '#30221C', muted: '#795548', button: '#4B3028', buttonText: '#FFFFFF', price: '#4B3028', priceText: '#FFFFFF', border: '#D8C4A8', dark: '#4B3028' },
  tiffins: { label: 'South Indian Tiffins: Natural Olive & Sage', primary: '#687A45', secondary: '#A3B18A', accent: '#D5AE55', bg: '#F5F3E9', surface: '#E8EBDD', text: '#35432B', muted: '#687A45', button: '#35432B', buttonText: '#FFFFFF', price: '#687A45', priceText: '#FFFFFF', border: '#D0D8C2' },
  food: { label: 'Restaurant Food: Rich Terracotta & Earth', primary: '#A94F35', secondary: '#C8754D', accent: '#D69A65', bg: '#F5E9DC', surface: '#EBD7C5', text: '#38251F', muted: '#80523F', button: '#A94F35', buttonText: '#FFFFFF', price: '#A94F35', priceText: '#FFFFFF', border: '#D9BCA5' },
  mandi: { label: 'Mandi: Arabian Charcoal & Desert Sand', primary: '#302B27', secondary: '#C7AD83', accent: '#D69A36', bg: '#F0E5D3', surface: '#E2D1B6', text: '#302B27', muted: '#74634D', button: '#302B27', buttonText: '#FFFFFF', price: '#302B27', priceText: '#D69A36', border: '#C7AD83' },
  shawarma: { label: 'Shawarma: Premium Sage & Tropical Green', primary: '#566B4D', secondary: '#87966A', accent: '#C2C982', bg: '#F3F0E3', surface: '#E6E8D4', text: '#283A2A', muted: '#566B4D', button: '#283A2A', buttonText: '#FFFFFF', price: '#566B4D', priceText: '#FFFFFF', border: '#C6CEB0' },
  bakery: { label: 'Bakery: Burgundy & Champagne', primary: '#713B46', secondary: '#B77C7D', accent: '#D3B47A', bg: '#F8EFE4', surface: '#EFE0D2', text: '#43252C', muted: '#713B46', button: '#713B46', buttonText: '#FFFFFF', price: '#713B46', priceText: '#FFFFFF', border: '#DEC5AD' },
};

// ---------- Party Orders: Orchid & Slate (approved theme, values exactly as supplied) ----------
// text = body copy, heading = headings, hover = menu row hover tint.
const PARTY = {
  party: { label: 'Party Orders: Orchid & Slate', primary: '#655078', secondary: '#9380A8', accent: '#B7A9C4', bg: '#F2EFF5', surface: '#E9E2EE', text: '#494451', muted: '#494451', heading: '#493858', hover: '#DED4E7', button: '#655078', buttonText: '#FFFFFF', price: '#493858', priceText: '#FFFFFF', border: '#D4CADB' },
};

// ---------- Take Away: Midnight Black & Royal Gold (exact hex values as supplied) ----------
// Used only on the Take Away hub and Take Away Menu pages. Party Orders keeps its own palette.
// bg = Midnight Black, panel = Deep Charcoal, surface = Graphite Black (cards), primary = Royal Gold,
// highlight = Champagne Gold, secondary = Antique Gold, heading = Warm Ivory, text = Soft Beige,
// border = Muted Gold, hover = Gold Black.
const TAKEAWAY = {
  takeaway: { label: 'Take Away: Midnight Black & Royal Gold', primary: '#C5A04B', secondary: '#A98236', accent: '#E4BD69', bg: '#090909', surface: '#202020', text: '#E9DFC9', muted: '#E9DFC9', heading: '#F5EBD7', highlight: '#E4BD69', panel: '#151515', dark: '#151515', onDark: '#E9DFC9', hover: '#302719', heroBg: '#C5A04B', heroText: '#090909', button: '#C5A04B', buttonText: '#090909', price: '#C5A04B', priceText: '#090909', border: '#80652F' },
};

// ---------- Restaurant Food: the four groups (VEG, NON-VEG, EGG, COMMON) ----------
const GROUPS = {
  'food-veg': { label: 'VEG: Emerald Forest Green', primary: '#245B45', secondary: '#36765B', accent: '#A5C58A', bg: '#EDF3EA', surface: '#DDE9DC', text: '#203A2D', muted: '#36765B', button: '#245B45', buttonText: '#FFFFFF', price: '#245B45', priceText: '#FFFFFF', border: '#C5D9C6' },
  'food-nonveg': { label: 'NON-VEG: Deep Chilli Red', primary: '#923F35', secondary: '#B9684F', accent: '#D18B68', bg: '#F5E8E2', surface: '#EBD6CE', text: '#48251F', muted: '#923F35', button: '#923F35', buttonText: '#FFFFFF', price: '#923F35', priceText: '#FFFFFF', border: '#DFC2B7' },
  'food-egg': { label: 'EGG: Golden Mustard', primary: '#A77D22', secondary: '#C69A35', accent: '#E7D49B', bg: '#F8F1DD', surface: '#F0E5C4', text: '#493817', muted: '#7A5B14', button: '#A77D22', buttonText: '#FFFFFF', price: '#A77D22', priceText: '#FFFFFF', border: '#E4D5A7' },
  'food-common': { label: 'COMMON: Warm Stone & Taupe', primary: '#89796A', secondary: '#A99785', accent: '#B2A18E', bg: '#F2EEE8', surface: '#E7DED4', text: '#40372F', muted: '#6B5D50', button: '#89796A', buttonText: '#FFFFFF', price: '#89796A', priceText: '#FFFFFF', border: '#D9CFC4' },
};

// ---------- VEG second level ----------
const VEG_SECTIONS = {
  'food-veg-starters': { label: 'VEG Soups & Starters: Botanical Green', primary: '#477A50', secondary: '#6E986F', accent: '#B6C99B', bg: '#EFF4E9', surface: '#E1EBD9', text: '#29472F', muted: '#477A50', button: '#477A50', buttonText: '#FFFFFF', price: '#477A50', priceText: '#FFFFFF', border: '#CBDCC4' },
  'food-veg-main': { label: 'VEG Indian Main Course: Deep Jade Green', primary: '#176B55', secondary: '#328B72', accent: '#8CC6A6', bg: '#EAF4EF', surface: '#D9EAE1', text: '#173D33', muted: '#176B55', button: '#176B55', buttonText: '#FFFFFF', price: '#176B55', priceText: '#FFFFFF', border: '#BED9CE' },
  'food-veg-rice': { label: 'VEG Biryani, Rice & Noodles: Moss Green', primary: '#829B58', secondary: '#A2B878', accent: '#D4DEA9', bg: '#F3F5E9', surface: '#E7EDD7', text: '#39472A', muted: '#55683A', button: '#647A42', buttonText: '#FFFFFF', price: '#647A42', priceText: '#FFFFFF', border: '#D0DDBB' },
};

// Reserve greens from the brief. No existing VEG section needs them today (VEG has exactly three
// subcategories), so they are registered for future VEG sections and are not applied to anything.
const VEG_RESERVE = {
  'veg-teal': derive('Teal Green', '#32866E'),
  'veg-pistachio': derive('Pistachio Green', '#A3B86A'),
  'veg-forest': derive('Forest Green', '#28563D'),
  'veg-sage': derive('Sage Green', '#91AA83'),
  'veg-mint': derive('Mint Green', '#72A993'),
  'veg-olive': derive('Deep Olive', '#596F37'),
};

// ---------- NON-VEG second level ----------
const NONVEG_SECTIONS = {
  'food-chicken': { label: 'Chicken: Rich Tomato Red', primary: '#A44B3B', secondary: '#C46D55', accent: '#D58A70', bg: '#F7EAE4', surface: '#EFD8CF', text: '#48251F', muted: '#A44B3B', button: '#A44B3B', buttonText: '#FFFFFF', price: '#A44B3B', priceText: '#FFFFFF', border: '#E3C6BA' },
  'food-mutton': { label: 'Mutton: Deep Mahogany', primary: '#684039', secondary: '#936052', accent: '#C29370', bg: '#F1E7DF', surface: '#E5D4C7', text: '#3C2924', muted: '#684039', button: '#684039', buttonText: '#FFFFFF', price: '#684039', priceText: '#FFFFFF', border: '#D7C2B3' },
  'food-seafood': { label: 'Seafood: Ocean Teal', primary: '#356B70', secondary: '#65969A', accent: '#A6C9C6', bg: '#EAF2F0', surface: '#D9E9E6', text: '#234448', muted: '#356B70', button: '#356B70', buttonText: '#FFFFFF', price: '#356B70', priceText: '#FFFFFF', border: '#BCD6D2' },
  'food-mixed': { label: 'Mixed Non-Veg: Burnt Sienna', primary: '#70452F', secondary: '#A16D49', accent: '#D0A477', bg: '#F3E9DD', surface: '#E8D6C2', text: '#432D21', muted: '#70452F', button: '#70452F', buttonText: '#FFFFFF', price: '#70452F', priceText: '#FFFFFF', border: '#DAC4AC' },
};

// ---------- Third level (only a primary was supplied; the rest is derived from it) ----------
const THIRD = {
  'food-chicken-starters': derive('Chicken Soups & Starters', '#A44B3B'),
  'food-chicken-main': derive('Chicken Main Course', '#813C32'),
  'food-chicken-rice': derive('Chicken Biryani, Rice & Noodles', '#A65A35'),
  'food-mutton-starters': derive('Mutton Soups & Starters', '#795044'),
  'food-mutton-main': derive('Mutton Main Course', '#684039'),
  'food-mutton-rice': derive('Mutton Biryani & Rice', '#85533A'),
  'food-seafood-starters': derive('Seafood Starters & Tandoori', '#39767B'),
  'food-seafood-main': derive('Seafood Main Course', '#315E68'),
  'food-seafood-rice': derive('Seafood Biryani, Rice & Noodles', '#467F7A'),
  'food-seafood-platters': derive('Seafood Platters', '#285B60'),
  'food-mixed-platters': derive('Mixed Non-Veg Platters', '#784832'),
  'food-mixed-rice': derive('Mixed Non-Veg Rice & Noodles', '#895638'),
};

export const PALETTES = { ...MAIN, ...PARTY, ...TAKEAWAY, ...GROUPS, ...VEG_SECTIONS, ...VEG_RESERVE, ...NONVEG_SECTIONS, ...THIRD };

// Which theme id a menu heading (as written in src/data/menuData.js) uses.
// Headings are unique across the menu, so the title alone identifies the section.
export const SECTION_THEME_BY_TITLE = {
  VEG: 'food-veg',
  'Veg Soups & Starters (Including Kebabs & Tandoori)': 'food-veg-starters',
  'Veg Indian Main Course': 'food-veg-main',
  'Veg Biryani, Rice & Noodles': 'food-veg-rice',
  'NON-VEG': 'food-nonveg',
  Chicken: 'food-chicken',
  'Chicken Soups & Starters (Including Kebabs & Tandoori)': 'food-chicken-starters',
  'Chicken Main Course': 'food-chicken-main',
  'Chicken Biryani, Rice & Noodles': 'food-chicken-rice',
  Mutton: 'food-mutton',
  'Mutton Soups & Starters': 'food-mutton-starters',
  'Mutton Main Course': 'food-mutton-main',
  'Mutton Biryani & Rice': 'food-mutton-rice',
  Seafood: 'food-seafood',
  'Sea Starters & Tandoori': 'food-seafood-starters',
  'Seafood Main Course': 'food-seafood-main',
  'Seafood Biryani, Rice & Noodles': 'food-seafood-rice',
  'Seafood Platters': 'food-seafood-platters',
  'Mixed Non-Veg': 'food-mixed',
  'Mixed Non-Veg Platters': 'food-mixed-platters',
  'Mixed Non-Veg Rice & Noodles': 'food-mixed-rice',
  EGG: 'food-egg',
  'Egg Items': 'food-egg',
  COMMON: 'food-common',
};

// Theme id for a menu location. Walks from the deepest heading upwards, so a section with no theme
// of its own (including any section added to the menu later) inherits its nearest parent's theme.
export function themeIdForPath(category, path = []) {
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const id = SECTION_THEME_BY_TITLE[path[i]];
    if (id && category === 'food') return id;
  }
  return category;
}
export const themeIdForItem = (item) => themeIdForPath(item.category, item.path || []);

// ---------- palette -> CSS variables ----------
// Pairs a colour with the more readable of the candidates, so text on a brand colour stays legible.
const readable = (bg, ...candidates) => candidates.reduce((best, c) => (contrast(bg, c) > contrast(bg, best) ? c : best));

// Darkens a colour until it reads at 4.5:1 on every given background (used only for text roles).
const readableOn = (color, ...backgrounds) => {
  let c = color;
  for (let i = 0; i < 20 && backgrounds.some((b) => contrast(c, b) < 4.5); i += 1) c = mix(c, '#000000', 0.08);
  return c;
};

export function paletteVars(p) {
  // Text roles are kept legible: --accent (link-like text) uses the brief's primary when it reads on the
  // page background, otherwise the button colour, otherwise a darkened primary; --muted is darkened a
  // little only if the supplied muted colour would fall below 4.5:1 on the page or card background.
  // Brand fills (button, price badge, borders) always keep the exact supplied colours.
  const accent = [p.primary, p.button].find((c) => contrast(c, p.bg) >= 4.5) || readableOn(p.primary, p.bg);
  const muted = readableOn(p.muted, p.bg, p.surface);
  const heroBg = readableOn(p.primary, '#FFFFFF');
  return {
    '--bg': p.bg,
    '--surface': p.surface,
    '--text': p.text,
    '--muted': muted,
    '--primary': p.primary,
    '--secondary': p.secondary,
    '--accent': accent,
    '--ornament': p.accent,
    '--line': p.border,
    '--card': p.surface,
    '--card-text': p.text,
    '--price-bg': p.price,
    '--price-fg': p.priceText,
    '--btn-bg': p.button,
    '--btn-text': p.buttonText,
    '--hero-bg': heroBg,
    '--hero-text': readable(heroBg, p.bg, '#FFFFFF'),
    '--dark-bg': p.dark || p.text,
    '--on-dark': p.bg,
    '--error': '#A3322A',
    ...(p.heading ? { '--heading': p.heading } : {}),
    ...(p.highlight ? { '--highlight': p.highlight } : {}),
    ...(p.panel ? { '--panel': p.panel } : {}),
    ...(p.hover ? { '--hover': p.hover } : {}),
    ...(p.onDark ? { '--on-dark': p.onDark } : {}),
    ...(p.heroBg ? { '--hero-bg': p.heroBg } : {}),
    ...(p.heroText ? { '--hero-text': p.heroText } : {}),
  };
}

// ---------- CSS generation and runtime overrides ----------
const block = (id, vars) =>
  `[data-theme="${id}"],\n:root[data-theme="${id}"] {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;

export function buildThemeCss(palettes = PALETTES) {
  return Object.entries(palettes)
    .map(([id, p]) => `/* ${p.label} */\n${block(id, paletteVars(p))}`)
    .join('\n');
}

// Optional runtime overrides, for admin-configurable themes. Pass { themeId: { primary: '#...', ... } }
// (any subset of palette fields); the result is appended as a <style> that wins over the generated file.
// Existing admin pages do not call this yet because the categories table has no colour columns.
export function applyThemeOverrides(overrides = {}) {
  if (typeof document === 'undefined') return;
  const merged = {};
  Object.entries(overrides).forEach(([id, part]) => {
    if (PALETTES[id] && part) merged[id] = { ...PALETTES[id], ...part };
  });
  let tag = document.getElementById('elix-theme-overrides');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'elix-theme-overrides';
    document.head.appendChild(tag);
  }
  tag.textContent = buildThemeCss(merged);
}
