import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DEMO_NOTICE } from '../data/siteData';
import { usePageTitle } from '../hooks/usePage';
import BackButton from '../components/BackButton';

// The two main options of the Explore Menu. Each opens its own page, and neither option is
// shown again inside those pages.
const MAIN_OPTIONS = [
  { label: 'DINE IN', to: '/explore/dine' },
  { label: 'TAKE AWAY', to: '/explore/take' },
];

export default function Explore() {
  usePageTitle('Explore Menu | The Elix');

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <BackButton to="/" />
          <h1 className="display-xl">Explore our menu</h1>
          <p className="lead">Six experiences. One destination.</p>
          <p className="demo-note">{DEMO_NOTICE}</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="choice-grid">
            {MAIN_OPTIONS.map(({ label, to }) => (
              <Link key={to} to={to} className="choice-card">
                <span className="choice-name">{label}</span>
                <ArrowRight size={28} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
