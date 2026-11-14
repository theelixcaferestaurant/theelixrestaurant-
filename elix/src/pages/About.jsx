import { Link } from 'react-router-dom';
import { DEMO_NOTICE, SETTINGS } from '../data/siteData';
import { usePageTitle } from '../hooks/usePage';
import ImagePanel from '../components/ImagePanel';
import BackButton from '../components/BackButton';

const VALUE_NUMBERS = [1, 2, 3];

export default function About() {
  usePageTitle('About Us | The Elix');

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <BackButton to="/" />
          <h1 className="display-xl">{SETTINGS.about_title}</h1>
          <p className="lead">{SETTINGS.about_lead}</p>
          {(DEMO_NOTICE || SETTINGS.about_note) && <p className="demo-note">{[DEMO_NOTICE, SETTINGS.about_note].filter(Boolean).join(' ')}</p>}
        </div>
      </section>

      <section className="section-tight">
        <div className="container split">
          <ImagePanel imageKey="about-story" label="Our story" tone="interior" ratio="4 / 5" className="split-media" reveal />
          <div className="split-text">
            <h2>{SETTINGS.about_story_title}</h2>
            <p className="lead">{SETTINGS.about_story_lead}</p>
            <p className="muted">{SETTINGS.about_story_text}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="pillars is-three">
            {VALUE_NUMBERS.map((n) => (
              <div key={n} className="pillar">
                <h2 className="pillar-title">{SETTINGS[`about_value_${n}_title`]}</h2>
                <p>{SETTINGS[`about_value_${n}_text`]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ambience">
        <ImagePanel imageKey="about-ambience" videoMode="auto" label="Restaurant ambience" tone="interior" ratio={null} className="ambience-media" />
        <div className="ambience-copy container">
          <h2>{SETTINGS.about_ambience_title}</h2>
          <p>{SETTINGS.about_ambience_text}</p>
        </div>
      </section>

      <section className="section center">
        <div className="container">
          <h2>{SETTINGS.about_cta_title}</h2>
          <p className="lead centered-lead">{SETTINGS.about_cta_text}</p>
          <Link className="btn" to="/explore">
            {SETTINGS.about_cta_button}
          </Link>
        </div>
      </section>
    </>
  );
}
