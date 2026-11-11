import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Page-to-page Back used on every page except Home.
// - When the visitor reached this page from another page of the site, it goes back to exactly that page
//   (the same as the browser Back button, scroll position included).
// - When the page was opened directly (a bookmark, a shared link, a refresh), there is nothing to go back to,
//   so it opens the page one level up (`to`) instead of leaving the site.
// It is a real link, so "open in a new tab" and keyboard use keep working.
export default function BackButton({ to = '/', label = 'Back', className = '' }) {
  const navigate = useNavigate();

  const onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // React Router keeps the position in this tab's history in history.state.idx (0 = the first page opened).
    const position = typeof window !== 'undefined' ? window.history.state?.idx : 0;
    if (typeof position === 'number' && position > 0) {
      event.preventDefault();
      navigate(-1);
    }
  };

  return (
    <div className="back-row">
      <Link className={`back-link back-btn ${className}`.trim()} to={to} onClick={onClick}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    </div>
  );
}
