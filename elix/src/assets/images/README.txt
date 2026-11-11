THE ELIX: PHOTOGRAPH FOLDER
===========================

Drop real photographs into this folder (JPG, PNG, WebP or AVIF). The site picks them up
automatically by FILE NAME. No code changes are needed. Restart "npm run dev" after adding files.

Menu items: use the item id from src/data/menuData.js
  irani-chai.jpg, masala-chai.webp, masala-dosa.jpg, chocolate-truffle-cake.jpg,
  chicken-dum-biryani.jpg ... (all 40 ids are listed in menuData.js)

Category banners:
  category-chai.jpg, category-tiffins.jpg, category-bakery.jpg, category-food.jpg

Home page and other pages:
  hero-main.jpg        (home hero, large)
  hero-accent.jpg      (home hero, small overlapping image)
  welcome.jpg          (brand introduction)
  ambience.jpg         (restaurant ambience banner)
  about-story.jpg      (About page)
  about-ambience.jpg   (About page)

Gallery page (interiors, plus optional overrides for food shots):
  gallery-interior-1.jpg, gallery-interior-2.jpg, gallery-interior-3.jpg
  gallery-<id>.jpg for any entry in src/data/galleryData.js

Images that are missing show a clearly labelled "Demo image" panel instead.
Recommended: landscape images at about 1600 px wide, portrait images at about 1000 px wide,
saved as WebP or AVIF where possible.
