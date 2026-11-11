import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DEMO_NOTICE } from '../data/siteData';
import { useCategoryTheme, usePageTitle } from '../hooks/usePage';
import TakeAwayMenuViewer from '../components/TakeAwayMenuViewer';
import ContactButtons from '../components/ContactButtons';
import BackButton from '../components/BackButton';

const TAKE_AWAY_OPTIONS = [
  { label: 'Take Away Menu', to: '/explore/take/menu' },
  { label: 'Party Orders', to: '/explore/take/party' },
];

// TAKE AWAY: two options, Take Away Menu and Party Orders. Each opens its own page.
export default function TakeAway() {
  usePageTitle('Take Away | The Elix');
  useCategoryTheme('takeaway');

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <BackButton to="/explore" />
          <h1 className="display-xl">Take Away</h1>
          <p className="demo-note">{DEMO_NOTICE}</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="choice-grid">
            {TAKE_AWAY_OPTIONS.map(({ label, to }) => (
              <Link key={to} to={to} className="choice-card">
                <span className="choice-name">{label}</span>
                <ArrowRight size={28} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <ContactButtons variant="takeaway" />
        </div>
      </section>
    </>
  );
}

// Take Away Menu page: the original menu images, shown one page at a time in the supplied order.
export function TakeAwayPage() {
  usePageTitle('Take Away Menu | The Elix');
  return (
    <section className="tm-screen">
      <div className="container">
        <BackButton to="/explore/take" />
        <TakeAwayMenuViewer />
      </div>
    </section>
  );
}
