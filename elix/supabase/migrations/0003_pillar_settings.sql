-- THE ELIX: editable "Why The Elix" pillar texts. Safe to re-run (never overwrites your edits).
-- Projects that ran 0002 before this file existed need it; new projects get the same rows from here.
insert into public.site_settings (key, value) values
('pillar_1_title','Four experiences'),
('pillar_1_text','Chai, tiffins, bakery and restaurant food, each with its own identity, under one roof.'),
('pillar_2_title','Warm hospitality'),
('pillar_2_text','Placeholder copy: the owner will describe the service philosophy here.'),
('pillar_3_title','Careful presentation'),
('pillar_3_text','Placeholder copy: plating and quality standards will be confirmed by the owner.'),
('pillar_4_title','An inviting space'),
('pillar_4_text','Placeholder copy: the atmosphere of the restaurant will be described here.')
on conflict (key) do nothing;
