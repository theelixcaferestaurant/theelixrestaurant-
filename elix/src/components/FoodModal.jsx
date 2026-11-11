import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import ImagePanel from './ImagePanel';
import Steam from './Steam';
import { UnavailableTag, VegMark } from './FoodCard';
import { isUnavailable } from '../lib/availability';
import { THEMES } from '../themes/themeConfig';
import { themeIdForItem } from '../themes/palettes';
import { useFocusTrap } from '../hooks/usePage';

function ModalContent({ item, onClose }) {
  const ref = useRef(null);
  useFocusTrap(ref, true, onClose);

  return (
    <motion.div
      className="modal-backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        ref={ref}
        className="modal"
        data-theme={themeIdForItem(item)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close details">
          <X size={20} />
        </button>

        <div className="modal-media">
          <ImagePanel imageKey={item.id} videoKey={item.id} videoMode="auto" label={item.name} tone={item.category} ratio={null} eager />
          {item.hot && !isUnavailable(item) && <Steam always />}
          {isUnavailable(item) && <UnavailableTag />}
        </div>

        <div className="modal-body">
          <span className="eyebrow">
            {THEMES[item.category].label}{item.sub ? `: ${item.sub}` : ''}
          </span>
          <h2 id="modal-title" className="modal-title">
            {item.name}
          </h2>
          <p>{item.desc}</p>
          <div className="featured-meta">
            <VegMark veg={item.veg} />
            <span className="featured-price">{item.price}</span>
          </div>
          <p className="sample-line">Prices as supplied by the restaurant.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Detail modal for a single sample item. It deliberately has no cart, order or payment controls.
export default function FoodModal({ item, onClose }) {
  return <AnimatePresence>{item && <ModalContent key={item.id} item={item} onClose={onClose} />}</AnimatePresence>;
}
