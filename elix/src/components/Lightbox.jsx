import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import ImagePanel from './ImagePanel';
import { GROUP_TONE, galleryImageKeys, galleryVideoKeys } from '../data/galleryData';
import { useFocusTrap } from '../hooks/usePage';

function LightboxContent({ items, index, onClose, onChange }) {
  const ref = useRef(null);
  useFocusTrap(ref, true, onClose);
  const entry = items[index];
  const count = items.length;

  const go = (step) => onChange((index + step + count) % count);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <motion.div
      className="lightbox"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        ref={ref}
        className="lightbox-inner"
        role="dialog"
        aria-modal="true"
        aria-label="Image viewer"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="icon-btn lightbox-close" onClick={onClose} aria-label="Close image viewer">
          <X size={22} />
        </button>

        <motion.div
          key={entry.id}
          className="lightbox-stage"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          <ImagePanel
            imageKey={galleryImageKeys(entry)}
            videoKey={entry.group === 'Interiors' ? null : galleryVideoKeys(entry)}
            videoMode="auto"
            label={entry.title}
            tone={GROUP_TONE[entry.group]}
            ratio="4 / 3"
            className="lightbox-image"
            eager
          />
        </motion.div>

        <div className="lightbox-bar">
          <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Previous image">
            <ChevronLeft size={24} />
          </button>
          <p className="lightbox-caption" aria-live="polite">
            {entry.title}: {entry.group} ({index + 1} of {count}, sample image)
          </p>
          <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Next image">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Lightbox({ items, index, onClose, onChange }) {
  return (
    <AnimatePresence>
      {index !== null && items[index] && (
        <LightboxContent key="lightbox" items={items} index={index} onClose={onClose} onChange={onChange} />
      )}
    </AnimatePresence>
  );
}
