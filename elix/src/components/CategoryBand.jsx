import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { THEMES } from '../themes/themeConfig';
import ImagePanel from './ImagePanel';

// Alternating category band wearing its own palette via data-theme. Not currently used on Home (Phase 1),
// kept so the original category layout stays available for reuse.
export default function CategoryBand({ category, flip }) {
  const theme = THEMES[category];
  return (
    <section className={`band ${flip ? 'is-flip' : ''}`} data-theme={category}>
      <div className="container band-inner">
        <div className="band-media">
          <ImagePanel imageKey={`category-${category}`} label={theme.label} tone={category} ratio="5 / 4" reveal />
        </div>
        <div className="band-text">
          <span className="band-code">
            {theme.letter} – {theme.code}
          </span>
          <h3 className="band-title">{theme.heading}</h3>
          <p>{theme.intro}</p>
          <Link to={theme.path} className="btn">
            Explore {theme.label} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
