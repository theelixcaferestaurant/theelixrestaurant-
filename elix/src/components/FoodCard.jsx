import { motion } from 'motion/react';
import ImagePanel from './ImagePanel';
import Steam from './Steam';
import { UNAVAILABLE_LABEL, isUnavailable } from '../lib/availability';

// Vegetarian / non-vegetarian marker. Renders nothing when veg is null (no marker).
export function VegMark({ veg }) {
  if (veg === null || veg === undefined) return null;
  const text = veg ? 'Vegetarian (sample marker)' : 'Non-vegetarian (sample marker)';
  return <span className={`veg-mark ${veg ? '' : 'is-nonveg'}`} role="img" aria-label={text} title={text} />;
}

// Shown on items the restaurant has marked temporarily unavailable (or that are outside their serving hours).
export function UnavailableTag() {
  return <span className="unavail-tag">{UNAVAILABLE_LABEL}</span>;
}

const MASONRY_RATIOS = ['4 / 5', '1 / 1', '3 / 4', '4 / 3'];

// Gentle staggered reveal: items that scroll in together (one grid row) follow each other by a few hundredths of a second.
const fade = (index) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -8% 0px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: (index % 4) * 0.07 },
});

// One menu item. variant: "card" (portrait image, text below), "row" (list line with
// thumbnail), or "tile" (varied image heights for the bakery pastry gallery).
export default function FoodCard({ item, onSelect, index = 0, variant = 'card' }) {
  const off = isUnavailable(item);
  const label = `View details for ${item.name}, price ${item.price}${off ? `. ${UNAVAILABLE_LABEL}` : ''}`;
  const off_class = off ? ' is-unavailable' : '';

  if (variant === 'row') {
    return (
      <motion.button
        type="button"
        className={`food-row${off_class}`}
        onClick={() => onSelect(item)}
        aria-label={label}
        aria-haspopup="dialog"
        {...fade(index)}
      >
        <span className="card-media food-row-media">
          <ImagePanel imageKey={item.id} videoKey={item.id} label={item.name} tone={item.category} ratio="1 / 1" forceEdit />
          {item.hot && !off && <Steam />}
          {off && <UnavailableTag />}
        </span>
        <span className="food-row-body">
          <span className="food-row-head">
            <VegMark veg={item.veg} />
            <span className="food-row-name">{item.name}</span>
            <span className="food-row-dots" aria-hidden="true" />
            <span className="price-tag">{item.price}</span>
          </span>
          {item.desc && <span className="food-row-desc">{item.desc}</span>}
        </span>
      </motion.button>
    );
  }

  if (variant === 'tile') {
    return (
      <motion.button
        type="button"
        className={`food-tile${off_class}`}
        onClick={() => onSelect(item)}
        aria-label={label}
        aria-haspopup="dialog"
        {...fade(index)}
      >
        <ImagePanel
          imageKey={item.id}
          videoKey={item.id}
          label={item.name}
          tone={item.category}
          ratio={MASONRY_RATIOS[index % MASONRY_RATIOS.length]}
          reveal
        />
        {off && <UnavailableTag />}
        <span className="food-tile-body">
          <span className="food-tile-name">{item.name}</span>
          <span className="price-tag">{item.price}</span>
        </span>
        <span className="food-tile-desc">{item.desc}</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      className={`food-card${off_class}`}
      onClick={() => onSelect(item)}
      aria-label={label}
      aria-haspopup="dialog"
      {...fade(index)}
    >
      <span className="card-media">
        <ImagePanel imageKey={item.id} videoKey={item.id} label={item.name} tone={item.category} ratio="4 / 5" />
        {item.hot && !off && <Steam />}
        {off && <UnavailableTag />}
      </span>
      <span className="food-card-body">
        <span className="food-card-sub">
          <VegMark veg={item.veg} />
          {item.sub}
        </span>
        <span className="food-card-name">{item.name}</span>
        <span className="food-card-desc">{item.desc}</span>
        <span className="food-card-foot">
          <span className="price-tag">{item.price}</span>
          <span className="link-inline">View details</span>
        </span>
      </span>
    </motion.button>
  );
}
