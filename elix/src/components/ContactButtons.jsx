import { Phone } from 'lucide-react';
import { CONTACT_TEL_URL, CONTACT_WHATSAPP_URL } from '../data/siteData';
import WhatsAppIcon from './WhatsAppIcon';
import '../styles/contact-buttons.css';

// WHATSAPP and CALL NOW. One component, four looks: variant is "takeaway", "menu", "party" or "contact",
// and each variant is styled in contact-buttons.css to match the page it sits on.
export default function ContactButtons({ variant = 'contact', className = '' }) {
  return (
    <div className={`cb cb--${variant} ${className}`.trim()} role="group" aria-label="Contact The Elix">
      <a className="cb-btn cb-whatsapp" href={CONTACT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon size={24} />
        <span>WHATSAPP</span>
      </a>
      <a className="cb-btn cb-call" href={CONTACT_TEL_URL}>
        <Phone size={22} aria-hidden="true" />
        <span>CALL NOW</span>
      </a>
    </div>
  );
}
