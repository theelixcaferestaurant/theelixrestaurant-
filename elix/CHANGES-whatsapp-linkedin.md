# Changes: WhatsApp added, LinkedIn removed

## WhatsApp
- Number: +91 6262626466. Link: https://wa.me/916262626466 with the pre-filled message
  "Hello The Elix! I visited your website and would like to know more."
- Defined once in src/data/siteData.js (SOCIAL.whatsapp). Opens the WhatsApp app on mobile and WhatsApp Web on desktop.
- WhatsApp icon: src/components/WhatsAppIcon.jsx (inline SVG, because lucide-react has no WhatsApp icon).
- Floating right-side bar (SocialSidebar.jsx) and Contact page list (SocialLinks.jsx): WhatsApp is first, then Instagram, Facebook, YouTube, Google Maps.

## LinkedIn removed
- Removed from SocialSidebar.jsx, SocialLinks.jsx, siteData.js and the admin social form (RestaurantPage.jsx).
- Database: 0001 and 0002 no longer include LinkedIn. 0004_remove_linkedin.sql removes it from projects that already ran 0001 to 0003.

## Not changed
- Instagram, Facebook, YouTube and Google Maps links, their order (after WhatsApp), the contact form, opening hours, map area, admin dashboard layout and the visual design.
