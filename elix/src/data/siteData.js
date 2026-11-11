// Placeholder business information. Nothing here is official restaurant detail.
// Replace every value once the owner supplies the real information.

export const BUSINESS = {
  name: 'The Elix',
  tagline: 'A Taste Beyond Expectations.',
  address: 'H 6-126, Kondakal – Shankarpally Road, Opp. Sri Sri Bramarambika Temple, Mokila, Hyderabad, Telangana – 501203.',
  phone: '+91 6262626466',
  email: 'theelixcaferestaurant@gmail.com',
  hours: [
    { days: 'Monday to Friday', time: 'Hours placeholder' },
    { days: 'Saturday and Sunday', time: 'Hours placeholder' },
  ],
};

// The restaurant's WhatsApp number and the message pre-filled when a visitor opens the chat.
const WHATSAPP_NUMBER = '916262626466'; // +91 6262626466 (country code, no spaces or plus sign)
const WHATSAPP_MESSAGE = 'Hello The Elix! I visited your website and would like to know more.';

// Replace "#" with real profile URLs. Links that are still "#" do nothing when clicked.
// WhatsApp opens a direct chat with the restaurant (wa.me opens the app on mobile, WhatsApp Web on desktop).
// The official Instagram profile of The Elix. Used whenever the dashboard has no Instagram link saved.
export const INSTAGRAM_URL = 'https://www.instagram.com/the_elix_family_restaurant/';

// Google Maps directions to The Elix (official address). Opens Google Maps with the restaurant as the destination.
// On phones the Google Maps app opens when it is installed; otherwise the browser opens Google Maps.
export const MAPS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=The%20Elix%2C%20H%206-126%2C%20Kondakal%20-%20Shankarpally%20Road%2C%20Opp.%20Sri%20Sri%20Bramarambika%20Temple%2C%20Mokila%2C%20Hyderabad%2C%20Telangana%20501203';

// Built-in value for each platform. A platform with no saved dashboard link falls back to this value.
export const SOCIAL_DEFAULTS = {
  instagram: INSTAGRAM_URL,
  facebook: '#',
  youtube: '#',
  maps: MAPS_URL,
};

export const SOCIAL = {
  whatsapp: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`,
  ...SOCIAL_DEFAULTS,
};

// DEMO_NOTICE is a live binding: src/lib/content.js updates it from the dashboard setting "demo_notice"
// (leave it empty in the dashboard to hide the notice at launch).
export let DEMO_NOTICE =
  'Demonstration website. Menu items, prices, photographs and business details are sample content for owner review.';
export function setDemoNotice(text) {
  DEMO_NOTICE = text;
}

// Editable homepage copy (dashboard > Homepage). The values below are the defaults used until the
// database answers, or when Supabase is not configured.
export const SETTINGS = {
  hero_lead: 'Chai, South Indian tiffins, a bakery and restaurant food, together in one destination.',
  welcome_heading: 'Welcome to The Elix.',
  welcome_text: "Welcome message placeholder. The owner's own words of greeting will appear here before launch.",
  brand_heading: 'One restaurant, four ways to enjoy it.',
  brand_text:
    'Brand introduction placeholder. The story, values and personality of The Elix will be written with the owner. For this demonstration, each of the four categories below has been given its own look.',
  ambience_title: 'The atmosphere',
  ambience_text: 'Ambience placeholder. Interior photography and a description of the space will replace this panel.',
  pillar_1_title: 'Four experiences',
  pillar_1_text: 'Chai, tiffins, bakery and restaurant food, each with its own identity, under one roof.',
  pillar_2_title: 'Warm hospitality',
  pillar_2_text: 'Placeholder copy: the owner will describe the service philosophy here.',
  pillar_3_title: 'Careful presentation',
  pillar_3_text: 'Placeholder copy: plating and quality standards will be confirmed by the owner.',
  pillar_4_title: 'An inviting space',
  pillar_4_text: 'Placeholder copy: the atmosphere of the restaurant will be described here.',
};

// Landing page video. To change it, replace the files in /public/video/ using the same names
// (or edit the paths below). The video's background must be the site's home background (--bg in themes.css)
// so its edges stay invisible. The first frame is shown while the video loads; the final frame is used
// when the visitor's device asks for reduced motion.
// frequency: 'always' = play every time the home page is opened (default), 'session' = once per browser session.
export const INTRO = {
  video: '/video/elix-intro.mp4',
  videoWebm: '/video/elix-intro.webm', // fallback for browsers without H.264 support
  firstFrame: '/video/elix-intro-first.jpg',
  finalFrame: '/video/elix-logo-final.jpg',
  frequency: 'always',
};

// Home page hero video (the cinematic food clip on the right of the first screen).
// To use your own footage, drop the files into /public/video/ with these names (or edit the paths):
//   hero-food.mp4   (H.264, muted-friendly, ~8-15s seamless loop, 1080x1350 or similar portrait / 4:5 crop)
//   hero-food.webm  (optional, smaller fallback)
//   hero-food-poster.jpg (optional, shown while the video loads)
// The files are checked before use. If they are missing (or not real video), the hero keeps showing the
// hero-main photograph (src/assets/images/hero-main.jpg) with the same cinematic lighting. Nothing breaks.
// The clip can also be uploaded from the dashboard (Homepage > hero video), which overrides these paths.
export const HERO_VIDEO = {
  mp4: '/video/hero-food.mp4',
  webm: '/video/hero-food.webm',
  poster: '/video/hero-food-poster.jpg',
};

// Direct-contact buttons (WHATSAPP and CALL NOW) shown in four places: Take Away, Take Away Menu, Party Orders, Contact.
// The floating social bar keeps using SOCIAL.whatsapp above; this is separate so that nothing there changes.
export const CONTACT_WHATSAPP_URL = `https://wa.me/916262626466?text=${encodeURIComponent(
  'Hello The Elix! I visited your website and would like to enquire about your restaurant.'
)}`;
export const CONTACT_TEL_URL = 'tel:+916262626466';
// tel: link built from whatever phone number is saved in the dashboard.
export const telHref = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

// Official details shown in the footer (VISIT and CONTACT). The address and number are written out in full here.
export const FOOTER_ADDRESS = 'H 6-126, Kondakal - Shankarpally Road, Opp. Sri Sri Bramarambika Temple, Mokila, Hyderabad, Telangana 501203.';
export const FOOTER_PHONE_DISPLAY = '+91 6262626466';
export const FOOTER_WHATSAPP_URL = 'https://wa.me/916262626466';

// Contact page: the embedded Google Map (an address search, so Google resolves the pin itself).
export const MAP_EMBED_URL =
  'https://maps.google.com/maps?q=The%20Elix%2C%20H%206-126%2C%20Kondakal%20-%20Shankarpally%20Road%2C%20Opp.%20Sri%20Sri%20Bramarambika%20Temple%2C%20Mokila%2C%20Hyderabad%2C%20Telangana%20501203&output=embed';

// Official opening hours, shown on the Contact page and in the footer. Open every day;
// the restaurant closes at 1:00 AM, which is after midnight on the following day.
export const OPENING_HOURS = {
  time: '5:00 AM – 1:00 AM',
  days: 'Sunday – Saturday',
  note: 'Open daily · Closes at 1:00 AM the following day.',
  // Filled from the dashboard (Opening Hours). The three lines above are the fallback until then.
  lines: [{ days: 'Sunday – Saturday', time: '5:00 AM – 1:00 AM' }],
  uniformOpen: true,
  special: [],
};

// Temporary closure notice, controlled from the dashboard (Opening Hours > Temporary closure notice).
export const CLOSURE = { active: false, text: '', until: '' };
