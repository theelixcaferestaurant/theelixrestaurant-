import { motion } from 'motion/react';
import { ArrowRight, Star } from 'lucide-react';
import ImagePanel from './ImagePanel';
import Steam from './Steam';
import { UnavailableTag, VegMark } from './FoodCard';
import { isUnavailable } from '../lib/availability';

// Editorial featured-dish presentation. The image takes about 58% of the width on desktop.
//   frame  "plain" | "gold" | "offset" | "arch"   decorative treatment of the image
export default function FeaturedFood({
  item,
  onSelect,
  steam = false,
  reverse = false,
  frame = 'plain',
  eyebrow = 'Featured',
}) {
  return (
    <div className={`featured ${reverse ? 'is-reverse' : ''}`} data-frame={frame}>
      <div className="featured-media">
        <ImagePanel imageKey={item.id} videoKey={item.id} label={item.name} tone={item.category} ratio="4 / 3" reveal eager />
        {steam && !isUnavailable(item) && <Steam always />}
        {isUnavailable(item) && <UnavailableTag />}
      </div>

      <motion.div
        className="featured-body"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="eyebrow">{eyebrow}</span>
        <h3 className="featured-name">{item.name}</h3>
        <p className="featured-desc">{item.desc}</p>
        <div className="featured-meta">
          <VegMark veg={item.veg} />
          <span className="featured-price">{item.price}</span>
          <span className="rating">
            <Star size={14} aria-hidden="true" /> {item.rating} <small>(sample rating)</small>
          </span>
        </div>
        <button type="button" className="btn" onClick={() => onSelect(item)} aria-haspopup="dialog">
          View Details <ArrowRight size={16} aria-hidden="true" />
        </button>
        <p className="sample-line">Sample item and price for demonstration.</p>
      </motion.div>
    </div>
  );
}
