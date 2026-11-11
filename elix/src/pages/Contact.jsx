import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { BUSINESS, DEMO_NOTICE, telHref, MAPS_URL, MAP_EMBED_URL } from '../data/siteData';
import { usePageTitle } from '../hooks/usePage';
import SocialLinks from '../components/SocialLinks';
import ContactButtons from '../components/ContactButtons';
import OpeningHours from '../components/OpeningHours';
import ReviewForm from '../components/ReviewForm';
import BackButton from '../components/BackButton';
import { REVIEWS_AVAILABLE } from '../lib/reviews';

export default function Contact() {
  usePageTitle('Contact | The Elix');
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <BackButton to="/" />
          <h1 className="display-xl">Contact</h1>
          <p className="lead">We would love to hear from you.</p>
          <p className="demo-note">{DEMO_NOTICE}</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container contact-grid">
          <div className="contact-info">
            <ul className="contact-list">
              <li>
                <MapPin size={18} aria-hidden="true" />{' '}
                <a className="contact-link" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
                  {BUSINESS.address}
                </a>
              </li>
              <li>
                <Phone size={18} aria-hidden="true" />{' '}
                <a className="contact-link" href={telHref(BUSINESS.phone)}>
                  {BUSINESS.phone}
                </a>
              </li>
              <li>
                <Mail size={18} aria-hidden="true" />{' '}
                <a className="contact-link" href={`mailto:${BUSINESS.email}`}>
                  {BUSINESS.email}
                </a>
              </li>
            </ul>

            <h2 className="small-title">
              <Clock size={18} aria-hidden="true" /> Opening hours
            </h2>
            <OpeningHours variant="contact" />

            <h2 className="small-title">Social media (placeholder links)</h2>
            <SocialLinks />
            <ContactButtons variant="contact" />

            <div className="map-embed">
              <a className="map-embed-fallback" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
                Map not loading? Open The Elix in Google Maps
              </a>
              <iframe
                title="Map showing The Elix, Mokila, Hyderabad"
                src={MAP_EMBED_URL}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a className="map-directions" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
              <MapPin size={20} aria-hidden="true" />
              <span>GET DIRECTIONS</span>
            </a>
          </div>

          <div className="contact-form-wrap">
            {REVIEWS_AVAILABLE ? (
              <ReviewForm />
            ) : (
              <p className="muted" role="status">Reviews are not available on this website yet.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
