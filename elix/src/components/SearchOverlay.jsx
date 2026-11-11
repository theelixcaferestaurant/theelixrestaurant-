import { useMemo, useRef, useState } from 'react';
import { UNAVAILABLE_LABEL, isUnavailable } from '../lib/availability';
import { useContentVersion } from '../lib/content';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import ImagePanel from './ImagePanel';
import { VegMark } from './FoodCard';
import { SEARCH_SUGGESTIONS, searchMenu } from '../data/menuData';
import { THEMES } from '../themes/themeConfig';
import { themeIdForItem } from '../themes/palettes';
import { useFocusTrap } from '../hooks/usePage';

function SearchPanel({ onClose }) {
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);
  useFocusTrap(ref, true, onClose);

  const contentVersion = useContentVersion();
  const results = useMemo(() => searchMenu(query), [query, contentVersion]);
  const trimmed = query.trim();

  const clear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <motion.div
      className="search-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        ref={ref}
        className="search-panel container"
        role="dialog"
        aria-modal="true"
        aria-label="Search the menu"
        initial={{ y: -24 }}
        animate={{ y: 0 }}
        exit={{ y: -16 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="search-bar">
          <Search size={22} aria-hidden="true" />
          <input
            ref={inputRef}
            data-autofocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value.toUpperCase())}
            placeholder="SEARCH THE SAMPLE MENU"
            aria-label="Search the sample menu"
            autoComplete="off"
          />
          {query && (
            <button type="button" className="icon-btn" onClick={clear} aria-label="Clear search">
              <X size={18} />
            </button>
          )}
          <button type="button" className="btn btn-ghost search-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="search-body">
          {!trimmed && (
            <div>
              <p className="search-hint">Try one of these suggestions</p>
              <div className="filter-row">
                {SEARCH_SUGGESTIONS.map((word) => (
                  <button key={word} type="button" className="chip" onClick={() => setQuery(word.toUpperCase())}>
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}

          {trimmed && (
            <>
              <p className="search-hint" aria-live="polite">
                {results.length} {results.length === 1 ? 'result' : 'results'} for “{trimmed}”
              </p>

              {results.length > 0 ? (
                <ul className="search-results">
                  {results.map((item) => (
                    <li key={item.id}>
                      <Link to={`${THEMES[item.category].path}?item=${item.id}`} className="search-result" data-theme={themeIdForItem(item)} onClick={onClose}>
                        <ImagePanel imageKey={item.id} label={item.name} tone={item.category} ratio="1 / 1" className="search-thumb" editable={false} videoKey={null} />
                        <span className="search-result-text">
                          <span className="search-result-name">
                            <VegMark veg={item.veg} /> {item.name}
                          </span>
                          <span className="search-result-meta">
                            {THEMES[item.category].label}, {item.sub}
                            {isUnavailable(item) && <strong className="unavail-inline"> · {UNAVAILABLE_LABEL}</strong>}
                          </span>
                        </span>
                        <span className="price-tag">{item.price}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="search-empty">
                  <p>No sample items match “{trimmed}”. Check the spelling or try another word.</p>
                  <div className="filter-row">
                    {SEARCH_SUGGESTIONS.map((word) => (
                      <button key={word} type="button" className="chip" onClick={() => setQuery(word.toUpperCase())}>
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SearchOverlay({ open, onClose }) {
  return <AnimatePresence>{open && <SearchPanel key="search" onClose={onClose} />}</AnimatePresence>;
}
