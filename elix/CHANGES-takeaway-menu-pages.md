# Changes: Take Away Menu shows the original menu pages

Route: EXPLORE MENU > TAKE AWAY > TAKE AWAY MENU (/explore/take/menu). Party Orders, Dine In and all other pages are unchanged.

## What the page does
- Shows each original menu image as one complete page, in the supplied order (Chai & Beverages, South Indian Tiffins, Restaurant Food: Veg, Chicken, Mutton, Seafood, Egg & Mixed Non-Veg, Restaurant Food: Shawarma).
- Images are the original files (public/takeaway/menu/140801.png to 140808.png), copied unchanged. Nothing is redrawn, cropped, filtered or retyped.
- Each page keeps its own proportions. It fits the screen width on phones and is capped at 760px on larger screens.
- Previous / Next buttons, a "Page n of 8" indicator, and the left and right arrow keys turn the pages.
- Zoom out / zoom in (100%, 150%, 200%). A zoomed page scrolls inside its frame. "Open this page at full size" opens the original image in a new tab.
- Controls sit above and below the image, never over it.

## Order and content
- Order is set in src/data/takeawayMenuPages.js.
- Removed: the digital menu (TakeAwayMenu.jsx, takeawayMenu.js, takeaway-menu.css) and its change note.

## Touch gestures (menu book)
- Swipe left for the next page, right for the previous page. A swipe has to pass 20% of the width, or be a quick flick, so small movements never turn a page. The first and last pages give way and do not turn past their ends.
- Vertical movement on a page at fit scrolls the website as normal (touch-action: pan-y).
- Double-tap: zoom to 250% around the tapped point; double-tap again to return to fit.
- Pinch with two fingers to zoom in and out (up to 400%). The midpoint moves the page with the fingers.
- Once zoomed, one-finger drag moves the page, clamped so it never leaves the frame. Dragging never turns the page. Use "Fit page" to return to the original size.
- Desktop: trackpad pinch and Ctrl + scroll zoom; mouse drag swipes at fit and pans when zoomed; double-click zooms.
- Arrow buttons and arrow keys still work and remain optional.
- Gesture geometry lives in src/lib/menuGestures.js (pure functions).

## Vertical scrolling on the menu image
- Cause: the menu frame was a scroll container with overscroll-behavior: contain, which stopped a vertical swipe from scrolling the page when the finger started on the image. The frame now uses overflow: clip (hidden on older browsers), so a vertical swipe anywhere on the image scrolls the page normally.
- Horizontal swipes still turn pages, and pinch and double-tap zoom are unchanged.

## OPEN FULL MENU
- The Take Away Menu screen has an OPEN FULL MENU button. It opens the same viewer full screen, on the page the customer is viewing. Close (or the Escape key) returns to the Take Away Menu screen on the same page.
- In full screen, swipes, vertical scrolling, double-tap, pinch and the arrows all work the same way.

## Instagram profile
- Official profile: https://www.instagram.com/the_elix_family_restaurant/ (@the_elix_family_restaurant), set as the built-in Instagram link in src/data/siteData.js (INSTAGRAM_URL, SOCIAL_DEFAULTS).
- The floating social bar and the Contact page both link to it. It opens in a new tab, like WhatsApp. On phones with the Instagram app installed, the link opens in the app; otherwise it opens in the browser.
- src/lib/content.js: a platform with no saved dashboard link now falls back to its built-in value. Instagram falls back to the official profile; Facebook, YouTube and Google Maps still fall back to '#' (inactive), as before.
- A link saved in the dashboard's Instagram field still overrides the official profile.

## Google Maps
- Directions to The Elix (H 6-126, Kondakal - Shankarpally Road, Opp. Sri Sri Bramarambika Temple, Mokila, Hyderabad, Telangana 501203) set as the built-in Google Maps link (MAPS_URL in src/data/siteData.js).
- The floating social bar and the Contact page both open the directions page. Google Maps opens with the restaurant as the destination; the customer's location is used as the start if they allow it.
- Empty dashboard Google Maps link falls back to this directions URL (same fallback rule as Instagram).
- The Contact page address text still comes from the dashboard's address field, which is still the placeholder until the owner enters the real address there.
