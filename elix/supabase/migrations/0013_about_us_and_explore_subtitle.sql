-- THE ELIX: Phase 2. Editable About Us content + editable "Explore our menu" subtitle   (migration 0013)
-- No schema change: the content is stored as ordinary rows in public.site_settings (existing RLS: visitors read,
-- administrators write). This file only seeds the starting wording. Safe to re-run: existing rows are never overwritten.
insert into public.site_settings (key, value) values
('explore_subtitle','Six experiences. One destination.'),
('about_title','About The Elix'),
('about_lead','A Taste Beyond Expectations.'),
('about_note','The text on this page is placeholder copy.'),
('about_story_title','Our story'),
('about_story_lead','Brand story placeholder. The history of the restaurant, the people behind it and the reason it exists will be written together with the owner before launch.'),
('about_story_text','Four experiences share one roof: a chai lounge, a South Indian tiffin counter, a bakery and a restaurant kitchen. Each has its own personality, and together they form The Elix.'),
('about_value_1_title','Vision'),
('about_value_1_text','Placeholder text. Describe what The Elix aims to become for its guests and its neighbourhood.'),
('about_value_2_title','Food philosophy'),
('about_value_2_text','Placeholder text. Describe how ingredients are chosen, how dishes are prepared and what quality means here.'),
('about_value_3_title','Hospitality'),
('about_value_3_text','Placeholder text. Describe how guests are welcomed and looked after at every table and counter.'),
('about_ambience_title','Restaurant ambience'),
('about_ambience_text','Ambience placeholder. Interior photography and a description of the dining spaces will appear here.'),
('about_cta_title','See what we serve'),
('about_cta_text','Browse the four sample menus.'),
('about_cta_button','Explore Menu')
on conflict (key) do nothing;
