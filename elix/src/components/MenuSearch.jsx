import { useId } from 'react';
import { Search, X } from 'lucide-react';

// The search bar shown on every menu category and menu section.
// Controlled: the page owns the query and filters its own items with filterItems() from lib/menuFilter.js.
//   count: number of matches for the current query (announced to screen readers), or null to say nothing.
export default function MenuSearch({ value, onChange, placeholder = 'Search this menu', label = 'Search this menu', count = null }) {
  const id = useId();
  const trimmed = value.trim();

  return (
    <div className="menu-search" role="search">
      <label className="menu-search-box" htmlFor={id}>
        <Search size={18} aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && value) {
              event.preventDefault();
              onChange('');
            }
          }}
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="search"
        />
      </label>
      {value && (
        <button type="button" className="menu-search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <X size={16} aria-hidden="true" />
        </button>
      )}
      <p className="menu-search-status" aria-live="polite">
        {trimmed && count !== null ? `${count} ${count === 1 ? 'result' : 'results'} for “${trimmed}”` : ''}
      </p>
    </div>
  );
}

// Shown when a search matches nothing.
export function NoMatches({ query, onClear }) {
  return (
    <div className="menu-search-empty">
      <p className="menu-search-empty-title">No items match “{query.trim()}”</p>
      <p className="muted">Check the spelling or try another word.</p>
      <button type="button" className="btn btn-ghost" onClick={onClear}>
        Clear search
      </button>
    </div>
  );
}
