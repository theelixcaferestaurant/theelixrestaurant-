import { Facebook, Instagram, MapPin, Youtube } from 'lucide-react';
import { SOCIAL } from '../data/siteData';
import WhatsAppIcon from './WhatsAppIcon';

const LINKS = [
  { label: 'WhatsApp', href: SOCIAL.whatsapp, Icon: WhatsAppIcon },
  { label: 'Instagram', href: SOCIAL.instagram, Icon: Instagram },
  { label: 'Facebook', href: SOCIAL.facebook, Icon: Facebook },
  { label: 'YouTube', href: SOCIAL.youtube, Icon: Youtube },
  { label: 'Google Maps', href: SOCIAL.maps, Icon: MapPin },
];

// Inline row of social links for the Contact page. Links stay inactive until real URLs are set.
export default function SocialLinks() {
  return (
    <ul className="social-links">
      {LINKS.map(({ label, href, Icon }) => {
        const placeholder = href === '#';
        return (
          <li key={label}>
            <a
              href={href}
              aria-label={placeholder ? `${label} (placeholder link)` : label}
              onClick={placeholder ? (event) => event.preventDefault() : undefined}
              target={placeholder ? undefined : '_blank'}
              rel={placeholder ? undefined : 'noopener noreferrer'}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
