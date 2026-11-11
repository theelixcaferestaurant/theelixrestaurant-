import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import CategoryPage, { MenuTree, buildTree } from '../components/CategoryPage';
import BackButton from '../components/BackButton';
import MenuSearch, { NoMatches } from '../components/MenuSearch';
import { collectItems, filterItems } from '../lib/menuFilter';
import FoodModal from '../components/FoodModal';
import { DEMO_NOTICE } from '../data/siteData';
import { useCategoryItems } from '../lib/content';
import { useCategoryTheme, useItemModal, usePageTitle } from '../hooks/usePage';
import { themeIdForPath } from '../themes/palettes';

// B. Restaurant Food (category 3). The customer moves one step at a time:
//   Restaurant Food → VEG / NON-VEG / EGG / COMMON → subcategories → individual items.
// Every step has its own address (for example /food/non-veg/chicken/chicken-main-course), so the
// browser Back button and the links on each page work as expected. Dine In / Take Away is never shown here.

const BASE = '/food';

// Colours: every section's palette comes from src/themes/palettes.js (see themeIdForPath).

// URL-safe form of a menu heading: "NON-VEG" → "non-veg", "Mixed Non-Veg" → "mixed-non-veg".
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Follows the URL segments through the menu tree. Returns [root, ...matched nodes], or null if a segment does not exist.
function resolvePath(tree, segments) {
  const chain = [tree];
  let node = tree;
  for (const segment of segments) {
    const next = [...node.children.values()].find((child) => slugify(child.title) === segment);
    if (!next) return null;
    chain.push(next);
    node = next;
  }
  return chain;
}

// A row of large choice cards. Each card wears its own section's palette (data-theme), so the customer
// sees the colour of the section they are about to open. `trail` is the menu path of the current page.
function Choices({ nodes, prefix, trail = [] }) {
  return (
    <div className="choice-grid">
      {nodes.map((node) => (
        <Link
          key={node.title}
          to={`${prefix}/${slugify(node.title)}`}
          className="choice-card"
          data-theme={themeIdForPath('food', [...trail, node.title])}
        >
          <span className="choice-name">{node.title}</span>
          <ArrowRight size={28} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

export default function Food() {
  const ITEMS = useCategoryItems('food');
  const segments = (useParams()['*'] || '').split('/').filter(Boolean);
  const tree = useMemo(() => buildTree(ITEMS), [ITEMS]);

  // The top of Restaurant Food: the existing hero, then the four groups.
  if (segments.length === 0) {
    return (
      <CategoryPage
        category="food"
        hero="block"
        heroRatio="1 / 1"
        menuTitle="The restaurant menu"
        menu={<Choices nodes={[...tree.children.values()]} prefix={BASE} />}
      />
    );
  }

  return <FoodSection items={ITEMS} tree={tree} segments={segments} />;
}

// Any page below Restaurant Food: a group, a subcategory, or the individual items.
function FoodSection({ items, tree, segments }) {
  const [active, setActive, close] = useItemModal(items);
  const chain = resolvePath(tree, segments);
  const node = chain ? chain[chain.length - 1] : null;

  // A heading whose only content is one child section (EGG → Egg Items) shows that section's items directly.
  const leaf =
    node && node.items.length === 0 && node.children.size === 1 ? [...node.children.values()][0] : node;

  usePageTitle(`${leaf ? leaf.title : 'Menu not found'} | The Elix`);

  // Search bar: looks through everything at or below the section being shown (items keep their headings).
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const scopeItems = useMemo(() => collectItems(leaf), [leaf]);
  const matches = useMemo(() => filterItems(scopeItems, query), [scopeItems, query]);
  const matchTree = useMemo(() => buildTree(matches), [matches]);

  // The page takes the theme of the deepest section shown; going Back re-runs this with the parent's path.
  const trail = chain ? chain.slice(1).map((n) => n.title) : [];
  if (chain && leaf && leaf !== node) trail.push(leaf.title);
  const themeId = themeIdForPath('food', trail);
  useCategoryTheme(chain ? themeId : 'food');

  if (!chain) {
    return (
      <section className="section-tight">
        <div className="container">
          <BackButton to={BASE} />
          <h1 className="display-xl">Menu not found</h1>
          <p className="lead">This part of the menu does not exist. Start again from Restaurant Food.</p>
        </div>
      </section>
    );
  }

  const here = [BASE, ...segments].join('/');
  const parentPath = [BASE, ...segments.slice(0, -1)].join('/');

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <BackButton to={parentPath} />
          <h1 className="display-xl">{leaf.title}</h1>
          <p className="demo-note">{DEMO_NOTICE}</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <MenuSearch
            value={query}
            onChange={setQuery}
            placeholder={`Search ${leaf.title}`}
            label={`Search ${leaf.title}`}
            count={searching ? matches.length : null}
          />
          {searching ? (
            matches.length > 0 ? (
              <MenuTree node={matchTree} onSelect={setActive} category="food" />
            ) : (
              <NoMatches query={query} onClear={() => setQuery('')} />
            )
          ) : leaf.children.size > 0 ? (
            <Choices nodes={[...leaf.children.values()]} prefix={here} trail={trail} />
          ) : (
            <div className="menu-group" data-theme={themeId}>
              <MenuTree node={leaf} onSelect={setActive} category="food" trail={trail} />
            </div>
          )}
        </div>
      </section>

      <FoodModal item={active} onClose={close} />
    </>
  );
}
