import { useMemo, useState } from 'react';
import FoodCard, { VegMark } from './FoodCard';

const DIETS = [
  { key: 'all', label: 'All' },
  { key: 'veg', label: 'Vegetarian', veg: true },
  { key: 'nonveg', label: 'Non-Vegetarian', veg: false },
];

// Filterable menu gallery.
//   variant   "card" | "row" | "tile"      how each item is drawn
//   grouped   show cuisine sections while "All" is selected
//   showDiet  show the vegetarian / non-vegetarian filter
export default function FoodGallery({
  items,
  subcategories = [],
  variant = 'card',
  grouped = false,
  showDiet = false,
  onSelect,
}) {
  const [sub, setSub] = useState('All');
  const [diet, setDiet] = useState('all');

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (diet === 'veg') return item.veg === true;
        if (diet === 'nonveg') return item.veg === false;
        return true;
      }),
    [items, diet]
  );

  const visible = sub === 'All' ? filtered : filtered.filter((item) => item.sub === sub);

  const sections =
    grouped && sub === 'All'
      ? subcategories
          .map((title) => ({ title, list: filtered.filter((item) => item.sub === title) }))
          .filter((section) => section.list.length > 0)
      : [{ title: null, list: visible }];

  const gridClass = variant === 'tile' ? 'food-masonry' : variant === 'row' ? 'food-grid is-rows' : 'food-grid';

  return (
    <div className="gallery-block">
      {subcategories.length > 0 && (
        <div className="filter-row" role="group" aria-label="Filter by subcategory">
          {['All', ...subcategories].map((label) => (
            <button
              key={label}
              type="button"
              className={`chip ${sub === label ? 'is-active' : ''}`}
              aria-pressed={sub === label}
              onClick={() => setSub(label)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {showDiet && (
        <div className="filter-row diet-row" role="group" aria-label="Filter by vegetarian or non-vegetarian">
          {DIETS.map(({ key, label, veg }) => (
            <button
              key={key}
              type="button"
              className={`chip ${diet === key ? 'is-active' : ''}`}
              aria-pressed={diet === key}
              onClick={() => setDiet(key)}
            >
              {veg !== undefined && <VegMark veg={veg} />}
              {label}
            </button>
          ))}
        </div>
      )}

      <p className="result-count" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'item' : 'items'} shown (sample menu)
      </p>

      {sections.map((section) => (
        <div key={section.title ?? 'all'} className="menu-section">
          {section.title && <h3 className="menu-section-title">{section.title}</h3>}
          <div className={gridClass}>
            {section.list.map((item, index) => (
              <FoodCard key={item.id} item={item} index={index} variant={variant} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}

      {visible.length === 0 && (
        <p className="empty">
          The sample menu has no items in this section yet. The owner can add them in src/data/menuData.js.
        </p>
      )}
    </div>
  );
}
