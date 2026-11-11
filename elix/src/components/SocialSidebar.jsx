import { useState } from 'react';
import { Facebook, Instagram, MapPin, Share2, X, Youtube } from 'lucide-react';
import { SOCIAL } from '../data/siteData';
import WhatsAppIcon from './WhatsAppIcon';

const LINKS = [
  { label: 'WhatsApp', href: SOCIAL.whatsapp, Icon: WhatsAppIcon },
  { label: 'Instagram', href: SOCIAL.instagram, Icon: Instagram },
  { label: 'Facebook', href: SOCIAL.facebook, Icon: Facebook },
  { label: 'YouTube', href: SOCIAL.youtube, Icon: Youtube },
  { label: 'Google Maps', href: SOCIAL.maps, Icon: MapPin },
];

// Fixed vertical social bar on the right of the viewport. On small screens it collapses
// behind a toggle button. All links are placeholders until real URLs are added in siteData.js.
export default function SocialSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="social-toggle"
        aria-expanded={open}
        aria-controls="social-bar"
        aria-label={open ? 'Hide social media links' : 'Show social media links'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={18} /> : <Share2 size={18} />}
      </button>

      <aside id="social-bar" className={`social-sidebar ${open ? 'is-open' : ''}`} aria-label="Social media links (placeholders)">
        {LINKS.map(({ label, href, Icon }) => {
          const placeholder = href === '#';
          return (
            <a
              key={label}
              href={href}
              className="social-icon"
              aria-label={placeholder ? `${label} (placeholder link)` : label}
              onClick={placeholder ? (event) => event.preventDefault() : undefined}
              target={placeholder ? undefined : '_blank'}
              rel={placeholder ? undefined : 'noopener noreferrer'}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="social-tip" aria-hidden="true">
                {label}
              </span>
            </a>
          );
        })}
      </aside>
    </>
  );
}
