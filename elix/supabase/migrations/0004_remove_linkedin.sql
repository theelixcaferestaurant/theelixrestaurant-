-- THE ELIX: LinkedIn has been removed from the website. Run once on projects that already ran 0001 to 0003.
-- Safe to re-run. WhatsApp is not stored here: its link is fixed in src/data/siteData.js.
delete from public.social_links where platform = 'linkedin';

alter table public.social_links drop constraint if exists social_links_platform_check;
alter table public.social_links
  add constraint social_links_platform_check check (platform in ('instagram','facebook','youtube','maps'));
