import { useMemo, useState } from 'react';
import { DEMO_NOTICE } from '../data/siteData';
import { useCategoryItems } from '../lib/content';
import { THEMES } from '../themes/themeConfig';
import { themeIdForPath } from '../themes/palettes';
import { useCategoryTheme, useItemModal, usePageTitle } from '../hooks/usePage';
import ImagePanel from './ImagePanel';
import FoodCard from './FoodCard';
import FoodModal from './FoodModal';
import MenuSearch, { NoMatches } from './MenuSearch';
import BackButton from './BackButton';
import { filterItems } from '../lib/menuFilter';

function Wave({ className = '' }) {
  return (
    <svg className={`wave ${className}`} viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0,46 C180,96 360,6 540,46 C720,86 900,10 1080,46 C1260,82 1380,30 1440,46 L1440,90 L0,90 Z" />
    </svg>
  );
}

// Builds a tree from each item's path of headings. Items with an empty path sit at the top level.
export function buildTree(items) {
  const root = { title: null, children: new Map(), items: [] };
  items.forEach((item) => {
    let node = root;
    (item.path || []).forEach((title) => {
      if (!node.children.has(title)) node.children.set(title, { title, children: new Map(), items: [] });
      node = node.children.get(title);
    });
    node.items.push(item);
  });
  return root;
}

// Renders the menu: groups (h2), sections (h3), subsections (h4), then compact item rows.
export function MenuTree({ node, depth = 0, onSelect, category, trail = [] }) {
  return (
    <>
      {node.items.length > 0 && (
        <div className="food-list">
          {node.items.map((item, index) => (
            <FoodCard key={item.id} item={item} index={index} variant="row" onSelect={onSelect} />
          ))}
        </div>
      )}
      {[...node.children.values()].map((child) => {
        const isGroup = depth === 0;
        const childTrail = [...trail, child.title];
        const Heading = depth === 0 ? 'h2' : depth === 1 ? 'h3' : 'h4';
        const headingClass = depth === 0 ? 'menu-group-title' : depth === 1 ? 'menu-section-title' : 'menu-sub-title';
        return (
          <section
            key={child.title}
            className={isGroup ? 'menu-group' : 'menu-branch'}
            data-theme={category === 'food' ? themeIdForPath('food', childTrail) : undefined}
          >
            <Heading className={headingClass}>{child.title}</Heading>
            <MenuTree node={child} depth={depth + 1} onSelect={onSelect} category={category} trail={childTrail} />
          </section>
        );
      })}
    </>
  );
}

// Shared category page: hero and the item menu. The Dine In / Take Away choice is made once,
// on the Explore Menu page, so categories and their nested menus never repeat it.
//   hero: "centered" | "split" | "block" | "arch"   (layouts from the original site)
export default function CategoryPage({ category, hero = 'split', heroRatio = '4 / 3', menuTitle = 'The menu', menu = null, footer = null }) {
  const theme = THEMES[category];
  const ITEMS = useCategoryItems(category);
  usePageTitle(`${theme.label} | The Elix`);
  useCategoryTheme(category);
  const [active, setActive, close] = useItemModal(ITEMS);
  const tree = buildTree(ITEMS);

  // Search bar: filters this category's items (keeping their section headings) as the customer types.
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const matches = useMemo(() => filterItems(ITEMS, query), [ITEMS, query]);
  const matchTree = useMemo(() => buildTree(matches), [matches]);

  const heroImage = (ratio, className) => (
    <ImagePanel
      imageKey={`category-${category}`}
      label={theme.label}
      tone={category}
      ratio={ratio}
      className={className}
      alt={`${theme.label} at The Elix`}
      eager
    />
  );

  const intro = (
    <>
      <BackButton to={category === 'party' ? '/explore/take' : '/explore/dine'} />
      {/* The lettered labels (A – CHAI ... F – SHAWARMA) are hidden; Party Orders has no letter and keeps its label. */}
      {!theme.letter && (
        <span className="eyebrow">{[theme.letter, theme.code].filter(Boolean).join(' – ')}</span>
      )}
      <h1 className="display-xl">{theme.heading}</h1>
      <p className="lead">{theme.intro}</p>
      <p className="demo-note">{DEMO_NOTICE}</p>
    </>
  );

  return (
    <>
      {hero === 'centered' && (
        <section className="category-hero is-centered">
          <div className="container">
            {intro}
            <div className="hero-frame">{heroImage('21 / 9', '')}</div>
          </div>
        </section>
      )}
      {hero === 'split' && (
        <section className="category-hero is-split">
          <div className="container hero-split">
            <div>{intro}</div>
            {heroImage(heroRatio, 'hero-split-media')}
          </div>
        </section>
      )}
      {hero === 'block' && (
        <section className="category-hero is-block">
          <div className="container hero-split">
            <div>{intro}</div>
            {heroImage(heroRatio, 'hero-block-media')}
          </div>
        </section>
      )}
      {hero === 'arch' && (
        <section className="category-hero is-arch">
          <div className="container hero-split">
            <div>{intro}</div>
            {heroImage(heroRatio, 'hero-arch-media')}
          </div>
          <Wave />
        </section>
      )}

      <section className="section">
        <div className="container">
          <h2>{menuTitle}</h2>
          <MenuSearch
            value={query}
            onChange={setQuery}
            placeholder={`Search ${theme.label}`}
            label={`Search ${theme.label}`}
            count={searching ? matches.length : null}
          />
          <div className="category-menu">
            {searching ? (
              matches.length > 0 ? (
                <MenuTree node={matchTree} onSelect={setActive} category={category} />
              ) : (
                <NoMatches query={query} onClear={() => setQuery('')} />
              )
            ) : (
              menu ?? (ITEMS.length === 0 ? (
              <div className="takeaway-placeholder">
                <p className="takeaway-placeholder-title">{theme.label} menu not yet supplied</p>
                <p className="muted">Items and prices will appear here once the restaurant supplies them.</p>
              </div>
            ) : (
              <MenuTree node={tree} onSelect={setActive} category={category} />
            ))
            )}
          </div>
          {footer}
        </div>
      </section>

      <FoodModal item={active} onClose={close} />
    </>
  );
}
