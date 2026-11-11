import { Link } from 'react-router-dom';
import { DEMO_NOTICE } from '../data/siteData';
import { usePageTitle } from '../hooks/usePage';
import ImagePanel from '../components/ImagePanel';
import BackButton from '../components/BackButton';

const VALUES = [
  ['Vision', 'Placeholder text. Describe what The Elix aims to become for its guests and its neighbourhood.'],
  ['Food philosophy', 'Placeholder text. Describe how ingredients are chosen, how dishes are prepared and what quality means here.'],
  ['Hospitality', 'Placeholder text. Describe how guests are welcomed and looked after at every table and counter.'],
];

export default function About() {
  usePageTitle('About Us | The Elix');

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <BackButton to="/" />
          <h1 className="display-xl">About The Elix</h1>
          <p className="lead">A Taste Beyond Expectations.</p>
          <p className="demo-note">{DEMO_NOTICE} The text on this page is placeholder copy.</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container split">
          <ImagePanel imageKey="about-story" label="Our story" tone="interior" ratio="4 / 5" className="split-media" reveal />
          <div className="split-text">
            <h2>Our story</h2>
            <p className="lead">
              Brand story placeholder. The history of the restaurant, the people behind it and the reason it exists will
              be written together with the owner before launch.
            </p>
            <p className="muted">
              Four experiences share one roof: a chai lounge, a South Indian tiffin counter, a bakery and a restaurant
              kitchen. Each has its own personality, and together they form The Elix.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="pillars is-three">
            {VALUES.map(([title, text]) => (
              <div key={title} className="pillar">
                <h2 className="pillar-title">{title}</h2>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ambience">
        <ImagePanel imageKey="about-ambience" videoMode="auto" label="Restaurant ambience" tone="interior" ratio={null} className="ambience-media" />
        <div className="ambience-copy container">
          <h2>Restaurant ambience</h2>
          <p>Ambience placeholder. Interior photography and a description of the dining spaces will appear here.</p>
        </div>
      </section>

      <section className="section center">
        <div className="container">
          <h2>See what we serve</h2>
          <p className="lead centered-lead">Browse the four sample menus.</p>
          <Link className="btn" to="/explore">
            Explore Menu
          </Link>
        </div>
      </section>
    </>
  );
}
