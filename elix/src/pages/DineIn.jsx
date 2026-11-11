import { CATEGORY_ORDER } from '../themes/themeConfig';
import { DEMO_NOTICE } from '../data/siteData';
import { usePageTitle } from '../hooks/usePage';
import CategoryCard from '../components/CategoryCard';
import BackButton from '../components/BackButton';

// DINE IN: the six categories, in the supplied order. Each card opens its own category page.
export default function DineIn() {
  usePageTitle('Dine In | The Elix');

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <BackButton to="/explore" />
          <h1 className="display-xl">Dine In</h1>
          <p className="lead">Six experiences. One destination.</p>
          <p className="demo-note">{DEMO_NOTICE}</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="cat-grid" data-mode="dine">
            {CATEGORY_ORDER.map((key) => (
              <CategoryCard key={key} category={key} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
