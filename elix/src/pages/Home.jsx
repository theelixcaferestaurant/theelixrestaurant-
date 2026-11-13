import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { MapPin, Phone } from 'lucide-react';
import { BUSINESS, DEMO_NOTICE, SETTINGS } from '../data/siteData';
import { EMPTY_REVIEWS_TEXT, useApprovedReviews } from '../lib/reviews';
import { CATEGORY_ORDER, THEMES } from '../themes/themeConfig';
import { usePageTitle } from '../hooks/usePage';
import ImagePanel from '../components/ImagePanel';
import HeroVideo from '../components/HeroVideo';
import { useIntroDone } from '../hooks/useIntro';
import ReviewCard from '../components/ReviewCard';

// The four "Why The Elix" pillars are editable in the dashboard (Homepage > Why The Elix).
const pillars = () => [1, 2, 3, 4].map((n) => [SETTINGS[`pillar_${n}_title`], SETTINGS[`pillar_${n}_text`]]);

// One coordinated entrance for the whole first screen: copy, button and visual share a single timeline.
const EASE = [0.22, 1, 0.36, 1];
const heroParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};
const heroItem = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 1.0, ease: EASE, delay: 0.45 } }, // after the lettering has begun
};
const letterParent = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const letter = {
  hidden: { opacity: 0, y: '0.35em', filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 1, ease: EASE } },
};
const heroVisual = {
  hidden: { opacity: 0, scale: 1.06, clipPath: 'inset(0 0 12% 0)' },
  show: { opacity: 1, scale: 1, clipPath: 'inset(0 0 0% 0)', transition: { duration: 1.6, ease: EASE, delay: 0.3 } }, // rises with the lettering
};

const MOSAIC = [
  { key: 'gallery-interior-1', label: 'Main dining area', tone: 'interior' },
  { key: 'chicken-dum-biryani', label: 'Chicken Dum Biryani', tone: 'food' },
  { key: 'chocolate-truffle-cake', label: 'Chocolate Truffle Cake', tone: 'bakery' },
  { key: 'irani-chai', label: 'Irani Chai', tone: 'chai' },
  { key: 'masala-dosa', label: 'Masala Dosa', tone: 'tiffins' },
];

export default function Home() {
  usePageTitle('The Elix | Cafe & Restaurant in Mokila, Hyderabad');
  const introDone = useIntroDone();
  const { reviews: approved } = useApprovedReviews(3);

  return (
    <>
      {/* 1. Hero */}
      <section className="hero">
        <div className="container hero-grid">
          <motion.div
            className="hero-copy"
            variants={heroParent}
            initial="hidden"
            animate={introDone ? 'show' : 'hidden'}
          >
            <motion.h1 className="hero-title" aria-label="The Elix" variants={letterParent}>
              {'The Elix'.split('').map((char, i) =>
                char === ' ' ? (
                  <span key={i} aria-hidden="true">{' '}</span>
                ) : (
                  <motion.span key={i} className="hero-letter" aria-hidden="true" variants={letter}>
                    {char}
                  </motion.span>
                )
              )}
            </motion.h1>
            <motion.p className="hero-tagline" variants={heroItem}>{BUSINESS.tagline}</motion.p>
            <motion.p className="lead" variants={heroItem}>
              {SETTINGS.hero_lead}
            </motion.p>
            <motion.div className="hero-actions" variants={heroItem}>
              <Link className="btn" to="/explore">
                Explore Menu
              </Link>
              <Link className="btn btn-ghost" to="/contact">
                Contact
              </Link>
            </motion.div>
            <motion.p className="demo-note" variants={heroItem}>{DEMO_NOTICE}</motion.p>
          </motion.div>

          <motion.div
            className="hero-visual"
            variants={heroVisual}
            initial="hidden"
            animate={introDone ? 'show' : 'hidden'}
          >
            <HeroVideo className="hero-tall" />
          </motion.div>
        </div>
      </section>

      {/* 2. Welcome */}
      <section className="section welcome">
        <div className="container">
          <h2 className="statement">{SETTINGS.welcome_heading}</h2>
          <p className="lead statement-lead">{SETTINGS.welcome_text}</p>
        </div>
      </section>

      {/* 3. Brand introduction */}
      <section className="section section-tint">
        <div className="container split">
          <ImagePanel imageKey="welcome" label="Our story" tone="interior" ratio="4 / 5" className="split-media" reveal />
          <div className="split-text">
            <h2>{SETTINGS.brand_heading}</h2>
            <p className="lead">{SETTINGS.brand_text}</p>
            <ul className="plain-list">
              {CATEGORY_ORDER.map((key) => (
                <li key={key}>
                  <Link to={THEMES[key].path}>{THEMES[key].label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Explore Our Menu */}
      <section className="section explore-intro">
        <div className="container explore-head">
          <h2>Explore our menu</h2>
          <p className="lead">Four experiences. One destination.</p>
          <Link className="btn btn-ghost" to="/explore">
            Open the full menu
          </Link>
        </div>
      </section>

      {/* 8. Why The Elix */}
      <section className="section">
        <div className="container">
          <h2>Why The Elix</h2>
          <div className="pillars">
            {pillars().map(([title, text]) => (
              <div key={title} className="pillar">
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Restaurant Ambience */}
      <section className="ambience">
        <ImagePanel imageKey="ambience" videoMode="auto" label="Restaurant ambience" tone="interior" ratio={null} className="ambience-media" />
        <div className="ambience-copy container">
          <h2>{SETTINGS.ambience_title}</h2>
          <p>{SETTINGS.ambience_text}</p>
        </div>
      </section>

      {/* 10. Gallery preview */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>From the gallery</h2>
            <Link className="link-inline" to="/gallery">
              View the full gallery
            </Link>
          </div>
          <div className="mosaic-home">
            {MOSAIC.map((tile) => (
              <ImagePanel key={tile.key} imageKey={tile.key} label={tile.label} tone={tile.tone} ratio={null} className="mosaic-tile" />
            ))}
          </div>
        </div>
      </section>

      {/* 11. Customer reviews preview */}
      <section className="section section-tint">
        <div className="container">
          <div className="section-head">
            <h2>What guests say</h2>
            <Link className="link-inline" to="/reviews">
              All reviews
            </Link>
          </div>
          {approved.length === 0 ? (
            <p className="reviews-empty">{EMPTY_REVIEWS_TEXT}</p>
          ) : (
            <div className="review-grid">
              {approved.slice(0, 3).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 12. Contact preview */}
      <section className="section">
        <div className="container contact-preview">
          <div>
            <h2>Visit The Elix</h2>
            <p className="lead">All details below are placeholders until the owner confirms them.</p>
          </div>
          <ul className="contact-list">
            <li>
              <MapPin size={18} aria-hidden="true" /> {BUSINESS.address}
            </li>
            <li>
              <Phone size={18} aria-hidden="true" /> {BUSINESS.phone}
            </li>
          </ul>
          <Link className="btn" to="/contact">
            Contact page
          </Link>
        </div>
      </section>

    </>
  );
}
