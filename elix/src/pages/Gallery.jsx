import { useState } from 'react';
import { motion } from 'motion/react';
import { DEMO_NOTICE } from '../data/siteData';
import { GALLERY, GALLERY_GROUPS, GROUP_TONE, galleryImageKeys, galleryVideoKeys } from '../data/galleryData';
import { usePageTitle } from '../hooks/usePage';
import ImagePanel from '../components/ImagePanel';
import Lightbox from '../components/Lightbox';
import BackButton from '../components/BackButton';

export default function Gallery() {
  usePageTitle('Gallery | The Elix');
  const [group, setGroup] = useState('All');
  const [index, setIndex] = useState(null);

  const visible = group === 'All' ? GALLERY : GALLERY.filter((entry) => entry.group === group);

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <BackButton to="/" />
          <h1 className="display-xl">Gallery</h1>
          <p className="lead">Interiors, food, bakery, beverages and tiffins.</p>
          <p className="demo-note">{DEMO_NOTICE}</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="filter-row" role="group" aria-label="Filter the gallery">
            {['All', ...GALLERY_GROUPS].map((label) => (
              <button
                key={label}
                type="button"
                className={`chip ${group === label ? 'is-active' : ''}`}
                aria-pressed={group === label}
                onClick={() => setGroup(label)}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="result-count" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'image' : 'images'} shown
          </p>

          <div className="gallery-grid">
            {visible.map((entry, position) => (
              <motion.button
                key={entry.id}
                type="button"
                className="gallery-item"
                onClick={() => setIndex(position)}
                aria-label={`Open image: ${entry.title}`}
                aria-haspopup="dialog"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5 }}
              >
                <ImagePanel
                  imageKey={galleryImageKeys(entry)}
                  videoKey={entry.group === 'Interiors' ? null : galleryVideoKeys(entry)}
                  label={entry.title}
                  tone={GROUP_TONE[entry.group]}
                  ratio={entry.ratio}
                />
                <span className="gallery-caption">
                  {entry.title}
                  <small>{entry.group}</small>
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <Lightbox items={visible} index={index} onClose={() => setIndex(null)} onChange={setIndex} />
    </>
  );
}
