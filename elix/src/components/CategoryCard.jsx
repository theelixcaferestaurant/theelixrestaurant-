import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ImagePanel from './ImagePanel';
import { THEMES } from '../themes/themeConfig';

// A category presentation. data-theme scopes the category's full palette to this card,
// so each one wears its own colour identity before the visitor even opens it.
export default function CategoryCard({ category }) {
  const theme = THEMES[category];

  return (
    <Link to={theme.path} className="cat-card" data-theme={category}>
      <ImagePanel
        imageKey={`category-${category}`}
        label={theme.label}
        tone={category}
        ratio={null}
        className="cat-media"
        alt={`${theme.label} at The Elix`}
      />
      <span className="cat-body">
        <span className="cat-name">{theme.label}</span>
        <span className="cat-desc">{theme.short}</span>
        <span className="cat-cta">
          Explore category <ArrowRight size={16} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
