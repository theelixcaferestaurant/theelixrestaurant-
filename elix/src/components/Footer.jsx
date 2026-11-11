import { Link } from 'react-router-dom';
import { MapPin, Phone } from 'lucide-react';
import Logo from './Logo';
import PaymentLogos from './PaymentLogos';
import WhatsAppIcon from './WhatsAppIcon';
import OpeningHours from './OpeningHours';
import {
  BUSINESS,
  DEMO_NOTICE,
  FOOTER_WHATSAPP_URL,
  MAPS_URL,
  telHref,
} from '../data/siteData';
import { CATEGORY_ORDER, THEMES } from '../themes/themeConfig';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <p className="footer-brand">
            <Logo size={44} />
            <span>THE ELIX</span>
          </p>
          <p className="footer-tag">{BUSINESS.tagline}</p>
          <PaymentLogos />
        </div>

        <div>
          <h2 className="footer-title">Visit</h2>
          <p className="footer-venue">THE ELIX</p>
          <address className="footer-address">{BUSINESS.address}</address>
          <a className="footer-action" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
            <MapPin size={18} aria-hidden="true" />
            <span>GET DIRECTIONS</span>
          </a>

          <h2 className="footer-title footer-title-contact">Opening hours</h2>
          <OpeningHours variant="footer" />

          <h2 className="footer-title footer-title-contact">Contact</h2>
          <p>
            <a className="footer-phone" href={telHref(BUSINESS.phone)}>
              {BUSINESS.phone}
            </a>
          </p>
          <div className="footer-actions">
            <a className="footer-action" href={FOOTER_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon size={18} />
              <span>WHATSAPP</span>
            </a>
            <a className="footer-action" href={telHref(BUSINESS.phone)}>
              <Phone size={18} aria-hidden="true" />
              <span>CALL NOW</span>
            </a>
          </div>
        </div>

        <nav aria-label="Footer">
          <h2 className="footer-title">Explore</h2>
          {CATEGORY_ORDER.map((key) => (
            <Link key={key} to={THEMES[key].path}>
              {THEMES[key].label}
            </Link>
          ))}
          <Link to="/gallery">Gallery</Link>
          <Link to="/reviews">Reviews</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </div>

      <div className="container">
        <p className="footer-demo">{DEMO_NOTICE}</p>
      </div>
    </footer>
  );
}
