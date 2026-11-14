-- THE ELIX: ALL database setup in one file (0001 to 0013, in order). Paste into Supabase > SQL Editor > New query > Run. Safe to re-run.

-- ################ 0001_schema_rls_storage.sql ################
-- =====================================================================
-- THE ELIX: Supabase schema, Row Level Security and storage
-- Run this whole file once in:  Supabase Dashboard > SQL Editor > New query
-- Then run supabase/migrations/0002_seed_content.sql, then create your admin (see README-BACKEND.md).
-- Safe to re-run: every statement is idempotent.
-- =====================================================================

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- administrators ----------
-- Only users listed here can change anything. Rows are added by you in the SQL editor (never by the website).
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- restaurant information (exactly one row) ----------
create table if not exists public.restaurant_info (
  id         smallint primary key default 1 check (id = 1),
  name       text not null default 'The Elix',
  tagline    text not null default '',
  address    text not null default '',
  phone      text not null default '',
  email      text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- opening hours ----------
create table if not exists public.opening_hours (
  id         bigint generated always as identity primary key,
  days       text not null,
  hours      text not null,
  sort_order int  not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- social media links ----------
create table if not exists public.social_links (
  platform   text primary key check (platform in ('instagram','facebook','youtube','maps')),
  url        text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- website content and settings (key / value) ----------
create table if not exists public.site_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- the four food categories ----------
create table if not exists public.categories (
  key           text primary key check (key in ('chai','tiffins','bakery','food')),
  label         text not null,
  heading       text not null default '',
  intro         text not null default '',
  short_text    text not null default '',
  subcategories text[] not null default '{}',
  sort_order    int  not null default 0,
  updated_at    timestamptz not null default now()
);

-- ---------- menu items ----------
create table if not exists public.menu_items (
  id           text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_key text not null references public.categories (key) on update cascade,
  sub          text not null default '',
  name         text not null check (length(trim(name)) > 0),
  price        numeric(8,2) not null default 0 check (price >= 0),
  veg          boolean,                       -- true = veg, false = non-veg, null = no marker
  description  text not null default '',
  featured     boolean not null default false,
  hot          boolean not null default false, -- shows the steam effect
  available    boolean not null default true,  -- false hides it from the public site
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists menu_items_category_idx on public.menu_items (category_key, sort_order);

-- ---------- gallery entries ----------
create table if not exists public.gallery_items (
  id         text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title      text not null,
  grp        text not null check (grp in ('Interiors','Food','Bakery','Beverages','Tiffins')),
  ratio      text not null default '4 / 3' check (ratio in ('4 / 3','1 / 1','4 / 5','3 / 4')),
  item_id    text references public.menu_items (id) on update cascade on delete set null,
  visible    boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- photographs and videos (menu items, gallery entries and site images) ----------
-- owner_type 'menu_item' -> owner_id is the menu item id
-- owner_type 'gallery'   -> owner_id is the gallery entry id
-- owner_type 'site'      -> owner_id is a site image key (hero-main, ambience, category-chai, hero-video ...)
create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  owner_type   text not null check (owner_type in ('menu_item','gallery','site')),
  owner_id     text not null,
  kind         text not null check (kind in ('image','video')),
  storage_path text not null,
  url          text not null,
  mime         text not null default '',
  size_bytes   bigint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (owner_type, owner_id, kind)
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['restaurant_info','opening_hours','social_links','site_settings','categories','menu_items','gallery_items','media_assets']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- Row Level Security ----------
-- Visitors: read-only access to public website content. Administrators: full access. Everyone else: nothing.
do $$
declare t text;
begin
  foreach t in array array['restaurant_info','opening_hours','social_links','site_settings','categories','media_assets']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.menu_items enable row level security;
drop policy if exists "public read available" on public.menu_items;
create policy "public read available" on public.menu_items for select to anon, authenticated
  using (available or public.is_admin());
drop policy if exists "admin write" on public.menu_items;
create policy "admin write" on public.menu_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.gallery_items enable row level security;
drop policy if exists "public read visible" on public.gallery_items;
create policy "public read visible" on public.gallery_items for select to anon, authenticated
  using (visible or public.is_admin());
drop policy if exists "admin write" on public.gallery_items;
create policy "admin write" on public.gallery_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.admins enable row level security;
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins for select to authenticated using (user_id = auth.uid());
-- (no insert / update / delete policies: admins are managed only from the SQL editor)

-- ---------- storage bucket for photographs and videos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('elix-media', 'elix-media', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
on conflict (id) do update
  set public = true, file_size_limit = 52428800,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'];

drop policy if exists "elix media public read" on storage.objects;
create policy "elix media public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'elix-media');
drop policy if exists "elix media admin insert" on storage.objects;
create policy "elix media admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'elix-media' and public.is_admin());
drop policy if exists "elix media admin update" on storage.objects;
create policy "elix media admin update" on storage.objects for update to authenticated
  using (bucket_id = 'elix-media' and public.is_admin()) with check (bucket_id = 'elix-media' and public.is_admin());
drop policy if exists "elix media admin delete" on storage.objects;
create policy "elix media admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'elix-media' and public.is_admin());

-- ---------- realtime: open pages refresh when content changes ----------
do $$
declare t text;
begin
  foreach t in array array['restaurant_info','opening_hours','social_links','site_settings','categories','menu_items','gallery_items','media_assets']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ################ 0002_seed_content.sql ################
-- THE ELIX seed data: the current demonstration content. Run after 0001_schema_rls_storage.sql. Safe to re-run (never overwrites your edits).

insert into public.categories (key,label,heading,intro,short_text,subcategories,sort_order) values
('chai','Chai & Beverages','A Perfect Cup of Happiness.','Discover comforting teas, refreshing beverages and carefully crafted drinks.','Comforting teas, coffees and chilled drinks in a warm, golden lounge.',array['Tea','Coffee','Coolers','Juices and Shakes'],0),
('tiffins','South Indian Tiffins','Freshness in Every Bite.','Experience the comfort and flavour of traditional South Indian breakfast.','Idli, dosa, vada and breakfast favourites, fresh and natural.',array['Idli','Dosa','Vada','Breakfast Specials','Combos'],1),
('bakery','Bakery','A Little Sweetness in Every Moment.','Explore freshly presented pastries, cakes, desserts and bakery favourites.','Cakes, pastries, brownies and desserts, elegantly presented.',array['Cakes','Pastries','Brownies','Cookies','Donuts','Desserts'],2),
('food','Restaurant Food','Discover the Art of Flavour.','Explore rich flavours, carefully presented dishes and memorable restaurant favourites.','Biryani, mandi, tandoori and more, rich with flavour.',array['Biryani','Chinese','Tandoori','Mandi','Indian','Mughlai','Kebabs'],3)
on conflict (key) do nothing;

insert into public.restaurant_info (id,name,tagline,address,phone,email) values (1,'The Elix','A Taste Beyond Expectations.','H 6-126, Kondakal – Shankarpally Road, Opp. Sri Sri Bramarambika Temple, Mokila, Hyderabad, Telangana – 501203.','+91 6262626466','theelixcaferestaurant@gmail.com') on conflict (id) do nothing;

insert into public.opening_hours (days,hours,sort_order)
select * from (values ('Monday to Friday','Hours placeholder',1),('Saturday and Sunday','Hours placeholder',2)) v(days,hours,sort_order)
where not exists (select 1 from public.opening_hours);

insert into public.social_links (platform,url) values ('instagram',''),('facebook',''),('youtube',''),('maps','') on conflict (platform) do nothing;

insert into public.site_settings (key,value) values
('hero_lead','Chai, South Indian tiffins, a bakery and restaurant food, together in one destination.'),
('welcome_heading','Welcome to The Elix.'),
('welcome_text','Welcome message placeholder. The owner''s own words of greeting will appear here before launch.'),
('brand_heading','One restaurant, four ways to enjoy it.'),
('brand_text','Brand introduction placeholder. The story, values and personality of The Elix will be written with the owner. For this demonstration, each of the four categories below has been given its own look.'),
('ambience_title','The atmosphere'),
('ambience_text','Ambience placeholder. Interior photography and a description of the space will replace this panel.'),
('demo_notice','Demonstration website. Menu items, prices, photographs, reviews and business details are sample content for owner review.')
on conflict (key) do nothing;

insert into public.menu_items (id,category_key,sub,name,price,veg,description,featured,hot,sort_order) values
('irani-chai','chai','Tea','Irani Chai',40,true,'A slow-brewed, milk-rich tea with a warm, fragrant finish.',true,true,0),
('masala-chai','chai','Tea','Masala Chai',35,true,'Black tea simmered with aromatic spices and fresh milk.',false,true,1),
('ginger-tea','chai','Tea','Ginger Tea',30,true,'A clean, gently spiced tea with fresh ginger.',false,true,2),
('lemon-tea','chai','Tea','Lemon Tea',35,true,'A light, bright tea finished with fresh lemon.',false,true,3),
('filter-coffee','chai','Coffee','Filter Coffee',45,true,'Traditional filter coffee, strong and smooth.',false,true,4),
('cappuccino','chai','Coffee','Cappuccino',90,true,'Espresso topped with velvety steamed milk foam.',false,true,5),
('cold-coffee','chai','Coolers','Cold Coffee',110,true,'Chilled coffee blended to a rich, creamy texture.',false,false,6),
('chocolate-milkshake','chai','Juices and Shakes','Chocolate Milkshake',120,true,'A thick chocolate milkshake, served chilled.',false,false,7),
('fresh-lime-mojito','chai','Coolers','Fresh Lime Mojito',100,true,'A refreshing lime cooler with mint and soda.',false,false,8),
('watermelon-juice','chai','Juices and Shakes','Watermelon Juice',90,true,'Freshly pressed watermelon, lightly chilled.',false,false,9),
('plain-idli','tiffins','Idli','Plain Idli',40,true,'Soft steamed rice cakes served with chutney and sambar.',false,true,10),
('ghee-idli','tiffins','Idli','Ghee Idli',65,true,'Idli finished with a touch of ghee for a richer taste.',false,true,11),
('medu-vada','tiffins','Vada','Medu Vada',45,true,'Crisp, golden lentil fritters with a soft centre.',false,true,12),
('plain-dosa','tiffins','Dosa','Plain Dosa',65,true,'A thin, crisp fermented rice and lentil crepe.',false,true,13),
('masala-dosa','tiffins','Dosa','Masala Dosa',85,true,'A crisp dosa filled with spiced potato, served with chutneys.',true,true,14),
('mysore-masala-dosa','tiffins','Dosa','Mysore Masala Dosa',110,true,'Dosa spread with a spiced red chutney and filled with savoury potato.',false,true,15),
('ghee-karam-dosa','tiffins','Dosa','Ghee Karam Dosa',100,true,'Dosa brushed with ghee and a fiery spice powder.',false,true,16),
('poori','tiffins','Breakfast Specials','Poori (2 pcs)',70,true,'Two golden puffed breads served with potato masala.',false,true,17),
('upma','tiffins','Breakfast Specials','Upma',55,true,'Semolina cooked with vegetables and tempered with mustard seeds.',false,true,18),
('pongal','tiffins','Breakfast Specials','Pongal',75,true,'A creamy rice and lentil dish with black pepper and ghee.',false,true,19),
('chocolate-truffle-cake','bakery','Cakes','Chocolate Truffle Cake',120,null,'Layers of dark chocolate sponge with a silky truffle ganache.',true,false,20),
('red-velvet-pastry','bakery','Pastries','Red Velvet Pastry',110,null,'Red velvet sponge with a smooth cream cheese layer.',false,false,21),
('black-forest-pastry','bakery','Pastries','Black Forest Pastry',100,null,'Chocolate sponge layered with cherries and whipped cream.',false,false,22),
('blueberry-cheesecake','bakery','Desserts','Blueberry Cheesecake',160,null,'A baked cheesecake crowned with blueberry compote.',false,false,23),
('chocolate-brownie','bakery','Brownies','Chocolate Brownie',90,null,'A dense, fudgy brownie with a crackled top.',false,false,24),
('butter-croissant','bakery','Pastries','Butter Croissant',85,null,'Flaky, layered pastry with a buttery finish.',false,false,25),
('chocolate-donut','bakery','Donuts','Chocolate Donut',75,null,'A soft donut dipped in glossy chocolate.',false,false,26),
('choco-chip-cookies','bakery','Cookies','Choco Chip Cookies',60,null,'Crisp-edged cookies studded with chocolate chips.',false,false,27),
('walnut-brownie','bakery','Brownies','Walnut Brownie',110,null,'A rich brownie with toasted walnuts.',false,false,28),
('chocolate-mousse','bakery','Desserts','Chocolate Mousse',130,null,'A light, airy chocolate mousse.',false,false,29),
('veg-dum-biryani','food','Biryani','Veg Dum Biryani',180,true,'Fragrant basmati layered with seasonal vegetables and saffron.',false,true,30),
('chicken-dum-biryani','food','Biryani','Chicken Dum Biryani',240,false,'Slow-cooked dum biryani with tender chicken and fragrant rice.',true,true,31),
('chicken-65','food','Indian','Chicken 65',190,false,'Crisp, spiced fried chicken with curry leaves and green chilli.',false,true,32),
('paneer-butter-masala','food','Mughlai','Paneer Butter Masala',210,true,'Soft paneer simmered in a rich, creamy tomato gravy.',false,true,33),
('butter-naan','food','Tandoori','Butter Naan',45,true,'Leavened bread from the tandoor, brushed with butter.',false,true,34),
('chicken-tikka','food','Kebabs','Chicken Tikka',230,false,'Marinated chicken chargrilled in the tandoor.',false,true,35),
('chicken-mandi','food','Mandi','Chicken Mandi',320,false,'Smoky, slow-roasted chicken served over fragrant rice.',false,true,36),
('mutton-mandi','food','Mandi','Mutton Mandi',420,false,'Tender mutton with smoked rice and traditional spices.',false,true,37),
('veg-fried-rice','food','Chinese','Veg Fried Rice',150,true,'Wok-tossed rice with fresh vegetables and soy.',false,true,38),
('chicken-fried-rice','food','Chinese','Chicken Fried Rice',190,false,'Wok-tossed rice with chicken, spring onion and soy.',false,true,39)
on conflict (id) do nothing;

insert into public.gallery_items (id,title,grp,ratio,item_id,sort_order) values
('interior-1','Main dining area','Interiors','4 / 3',null,0),
('food-biryani','Chicken Dum Biryani','Food','4 / 5','chicken-dum-biryani',1),
('bakery-cake','Chocolate Truffle Cake','Bakery','1 / 1','chocolate-truffle-cake',2),
('bev-chai','Irani Chai','Beverages','4 / 5','irani-chai',3),
('tiffin-dosa','Masala Dosa','Tiffins','4 / 3','masala-dosa',4),
('interior-2','Tea lounge corner','Interiors','1 / 1',null,5),
('food-tikka','Chicken Tikka','Food','4 / 3','chicken-tikka',6),
('bakery-croissant','Butter Croissant','Bakery','4 / 5','butter-croissant',7),
('bev-coffee','Cold Coffee','Beverages','1 / 1','cold-coffee',8),
('tiffin-idli','Plain Idli','Tiffins','4 / 5','plain-idli',9),
('interior-3','Bakery counter','Interiors','4 / 3',null,10),
('food-paneer','Paneer Butter Masala','Food','1 / 1','paneer-butter-masala',11),
('bakery-cheesecake','Blueberry Cheesecake','Bakery','4 / 3','blueberry-cheesecake',12),
('bev-mojito','Fresh Lime Mojito','Beverages','4 / 5','fresh-lime-mojito',13),
('tiffin-vada','Medu Vada','Tiffins','1 / 1','medu-vada',14),
('food-mandi','Chicken Mandi','Food','4 / 3','chicken-mandi',15)
on conflict (id) do nothing;

-- ################ 0003_pillar_settings.sql ################
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

-- ################ 0004_remove_linkedin.sql ################
-- THE ELIX: LinkedIn has been removed from the website. Run once on projects that already ran 0001 to 0003.
-- Safe to re-run. WhatsApp is not stored here: its link is fixed in src/data/siteData.js.
delete from public.social_links where platform = 'linkedin';

alter table public.social_links drop constraint if exists social_links_platform_check;
alter table public.social_links
  add constraint social_links_platform_check check (platform in ('instagram','facebook','youtube','maps'));

-- ################ 0005_customer_reviews.sql ################
-- =====================================================================
-- THE ELIX: customer reviews (submit, admin approval, public display)
-- Run once in: Supabase Dashboard > SQL Editor > New query. Safe to re-run.
--
-- Security model
--   * The reviews table has Row Level Security ON and NO policy for visitors, so the public (anon) key can
--     neither read nor write it directly. Email addresses and mobile numbers can never be fetched by visitors.
--   * Visitors can only call two functions: submit_review() and get_public_reviews().
--       - submit_review() validates and cleans everything again on the server, always saves the review as
--         'pending', and limits repeated requests (no OTP, no CAPTCHA, no verification of any kind).
--       - get_public_reviews() returns ONLY approved reviews and ONLY name, rating, message and date.
--   * Administrators (rows in public.admins, see README-BACKEND.md) can read, approve, reject and delete.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 1 and 80),
  email       text        not null check (char_length(email) between 3 and 254),
  mobile      text        not null check (mobile ~ '^\+91[6-9][0-9]{9}$'),
  rating      smallint    not null check (rating between 1 and 5),
  message     text        not null check (char_length(message) between 1 and 1000),
  status      text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source_hash text,                                   -- one-way hash of the sender's network address, for rate limiting only
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists reviews_status_created_idx on public.reviews (status, created_at desc);
create index if not exists reviews_source_idx on public.reviews (source_hash, created_at desc);

alter table public.reviews enable row level security;

-- Administrators only. There is deliberately no policy for anon or for ordinary signed-in users.
drop policy if exists "admin all" on public.reviews;
create policy "admin all" on public.reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.reviews from anon;
revoke all on public.reviews from public;

-- Stamp the moment a review is approved or rejected.
create or replace function public.reviews_stamp() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at = case when new.status = 'pending' then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists reviews_stamp on public.reviews;
create trigger reviews_stamp before update on public.reviews for each row execute function public.reviews_stamp();

-- ---------------------------------------------------------------------
-- submit_review: the only way a visitor can add a review.
-- Returns {"ok": true} or {"ok": false, "field": "...", "error": "..."}.
-- ---------------------------------------------------------------------
create or replace function public.submit_review(
  p_name    text,
  p_email   text,
  p_mobile  text,
  p_rating  integer,
  p_message text,
  p_website text default ''          -- hidden trap field: real visitors never fill it in
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name    text;
  v_email   text;
  v_mobile  text;
  v_message text;
  v_digits  text;
  v_ip      text;
  v_hash    text;
begin
  -- Spam trap: pretend it worked, save nothing.
  if coalesce(btrim(p_website), '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  -- Clean: remove control characters, trim, collapse repeated spaces in the name.
  v_name    := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[\x01-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g'));
  v_email   := lower(btrim(coalesce(p_email, '')));
  v_message := btrim(regexp_replace(coalesce(p_message, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));

  if v_name = '' then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please enter your name.');
  end if;
  if char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please keep your name to 80 characters.');
  end if;

  if v_email = '' then
    return jsonb_build_object('ok', false, 'field', 'email', 'error', 'Please enter your email address.');
  end if;
  if char_length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
     or v_email ~ '\.\.' then
    return jsonb_build_object('ok', false, 'field', 'email', 'error', 'Please enter an email address like name@example.com.');
  end if;

  -- Indian mobile: 10 digits starting 6-9, optional +91 in front. Saved as +91XXXXXXXXXX.
  v_digits := regexp_replace(coalesce(p_mobile, ''), '[\s\-()]', '', 'g');
  if v_digits = '' then
    return jsonb_build_object('ok', false, 'field', 'mobile', 'error', 'Please enter your mobile number.');
  end if;
  if v_digits ~ '^\+91[6-9][0-9]{9}$' then
    v_mobile := v_digits;
  elsif v_digits ~ '^[6-9][0-9]{9}$' then
    v_mobile := '+91' || v_digits;
  else
    return jsonb_build_object('ok', false, 'field', 'mobile', 'error', 'Please enter a valid 10-digit Indian mobile number (the +91 code is optional).');
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'field', 'rating', 'error', 'Please choose a star rating from 1 to 5.');
  end if;

  if v_message = '' then
    return jsonb_build_object('ok', false, 'field', 'message', 'error', 'Please write your review.');
  end if;
  if char_length(v_message) > 1000 then
    return jsonb_build_object('ok', false, 'field', 'message', 'error', 'Please keep your review to 1,000 characters.');
  end if;

  -- Basic abuse limits (no OTP, no CAPTCHA). The sender's address is stored only as a hash.
  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true)::json) ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_hash := case when btrim(v_ip) = '' then null else encode(digest('elix-reviews:' || btrim(v_ip), 'sha256'), 'hex') end;

  if v_hash is not null and (select count(*) from public.reviews where source_hash = v_hash and created_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'You have sent several reviews recently. Please try again later.');
  end if;
  if (select count(*) from public.reviews where (email = v_email or mobile = v_mobile) and created_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Several reviews have already been sent with these details today. Please try again tomorrow.');
  end if;
  if exists (select 1 from public.reviews where lower(message) = lower(v_message) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'This review has already been received. Thank you.');
  end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'We are receiving a lot of reviews right now. Please try again in a little while.');
  end if;

  insert into public.reviews (name, email, mobile, rating, message, status, source_hash)
  values (v_name, v_email, v_mobile, p_rating::smallint, v_message, 'pending', v_hash);

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Sorry, your review could not be saved. Please try again in a moment.');
end $$;

revoke all on function public.submit_review(text, text, text, integer, text, text) from public;
grant execute on function public.submit_review(text, text, text, integer, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- get_public_reviews: approved reviews only, newest first, public fields only.
-- ---------------------------------------------------------------------
create or replace function public.get_public_reviews(p_limit integer default 100)
returns table (id uuid, name text, rating smallint, message text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.rating, r.message, r.created_at
  from public.reviews r
  where r.status = 'approved'
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

revoke all on function public.get_public_reviews(integer) from public;
grant execute on function public.get_public_reviews(integer) to anon, authenticated;

-- ################ 0006_review_verification.sql ################
-- =====================================================================
-- THE ELIX: verified customer reviews (email OTP + mobile SMS OTP)
-- Run once in: Supabase Dashboard > SQL Editor > New query, AFTER 0001 and 0005. Safe to re-run.
-- Nothing is deleted: existing reviews keep every column and stay exactly as they were
-- (they are marked 'legacy_unverified'; approved ones remain public).
--
-- Security model
--   * Visitors can NO LONGER call submit_review(). It is dropped. The only way a review can be created is the
--     Edge Function "review-submit", which uses the service-role key (a server secret) to call
--     review_submit_verified(). That function is executable by service_role only.
--   * OTP codes are never readable by visitors: review_otps and review_verifications have RLS on, no policies,
--     and all privileges revoked from anon/authenticated.
--   * review_submit_verified() re-checks, inside ONE transaction, that a valid, unexpired, unused verification
--     exists for EXACTLY the submitted email and for EXACTLY the submitted mobile, then saves the review and burns
--     both verifications. A forged, reused, expired or mismatched token is refused by the database itself.
--   * Public display is unchanged: get_public_reviews() returns approved reviews only, public fields only.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. reviews: additive columns only (existing rows are preserved)
-- ---------------------------------------------------------------------
alter table public.reviews add column if not exists email_verified_at  timestamptz;
alter table public.reviews add column if not exists mobile_verified_at timestamptz;
alter table public.reviews add column if not exists verification_status text not null default 'legacy_unverified';
alter table public.reviews add column if not exists client_submission_id uuid;   -- makes a retried submit idempotent

alter table public.reviews drop constraint if exists reviews_verification_status_check;
alter table public.reviews add constraint reviews_verification_status_check
  check (verification_status in ('legacy_unverified', 'verified', 'unverified'));

-- A review marked 'verified' must carry proof of both verifications.
alter table public.reviews drop constraint if exists reviews_verified_has_proof;
alter table public.reviews add constraint reviews_verified_has_proof
  check (verification_status <> 'verified' or (email_verified_at is not null and mobile_verified_at is not null));

-- Duplicate protection enforced by the database itself.
create unique index if not exists reviews_client_submission_uidx
  on public.reviews (client_submission_id) where client_submission_id is not null;
create unique index if not exists reviews_verified_same_text_uidx
  on public.reviews (email, md5(lower(message))) where verification_status = 'verified';

-- ---------------------------------------------------------------------
-- 2. OTP sessions and verification tokens (server-only tables)
-- ---------------------------------------------------------------------
create table if not exists public.review_otps (
  id            uuid primary key default gen_random_uuid(),
  channel       text        not null check (channel in ('email', 'mobile')),
  target        text        not null,                 -- normalised email, or +91XXXXXXXXXX
  code_hash     text,                                 -- HMAC of the code (email). NULL for mobile: the SMS provider holds that code.
  ip_hash       text,                                 -- one-way hash, for rate limiting only
  attempts      smallint    not null default 0,
  max_attempts  smallint    not null default 5,
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  superseded_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists review_otps_target_idx on public.review_otps (channel, target, created_at desc);
create index if not exists review_otps_ip_idx     on public.review_otps (ip_hash, created_at desc);

create table if not exists public.review_verifications (
  id          uuid primary key default gen_random_uuid(),
  channel     text        not null check (channel in ('email', 'mobile')),
  target      text        not null,
  token_hash  text        not null unique,            -- SHA-256 of the token; the token itself is never stored
  otp_id      uuid,
  verified_at timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  review_id   uuid
);
create index if not exists review_verifications_target_idx on public.review_verifications (channel, target);

alter table public.review_otps          enable row level security;
alter table public.review_verifications enable row level security;
-- Deliberately NO policies: only the service role (Edge Functions) can touch these tables.
revoke all on public.review_otps          from anon, authenticated, public;
revoke all on public.review_verifications from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- 3. review_otp_issue: create a new OTP session (rate limits + cooldown enforced here)
-- ---------------------------------------------------------------------
create or replace function public.review_otp_issue(
  p_channel text, p_target text, p_code_hash text, p_ip_hash text, p_ttl_seconds integer default 600
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_last   timestamptz;
  v_n      integer;
  v_oldest timestamptz;
  v_id     uuid;
  v_exp    timestamptz;
begin
  if p_channel not in ('email', 'mobile') then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if p_channel = 'email' and (char_length(p_target) > 254 or p_target !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' or p_target ~ '\.\.') then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if p_channel = 'mobile' and p_target !~ '^\+91[6-9][0-9]{9}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtext('review-otp:' || p_channel || ':' || p_target));

  -- housekeeping: remove old OTP sessions and spent/expired tokens
  delete from public.review_otps where created_at < now() - interval '2 days';
  delete from public.review_verifications where expires_at < now() - interval '1 day';

  -- resend cooldown: 60 seconds between codes to the same address
  select max(created_at) into v_last from public.review_otps where channel = p_channel and target = p_target;
  if v_last is not null and v_last > now() - interval '60 seconds' then
    return jsonb_build_object('ok', false, 'code', 'cooldown',
      'retry_after', greatest(1, ceil(extract(epoch from (v_last + interval '60 seconds' - now())))::int));
  end if;

  -- at most 5 codes per hour to one address
  select count(*), min(created_at) into v_n, v_oldest
  from public.review_otps where channel = p_channel and target = p_target and created_at > now() - interval '1 hour';
  if v_n >= 5 then
    return jsonb_build_object('ok', false, 'code', 'too_many',
      'retry_after', greatest(60, ceil(extract(epoch from (v_oldest + interval '1 hour' - now())))::int));
  end if;

  -- at most 10 SMS to one number per day
  if p_channel = 'mobile' then
    select count(*) into v_n from public.review_otps where channel = 'mobile' and target = p_target and created_at > now() - interval '1 day';
    if v_n >= 10 then
      return jsonb_build_object('ok', false, 'code', 'too_many', 'retry_after', 3600);
    end if;
  end if;

  -- per network address: 15 emails or 5 SMS per hour (protects your SMS bill from abuse)
  if p_ip_hash is not null then
    select count(*) into v_n from public.review_otps
    where ip_hash = p_ip_hash and channel = p_channel and created_at > now() - interval '1 hour';
    if v_n >= 15 or (p_channel = 'mobile' and v_n >= 5) then
      return jsonb_build_object('ok', false, 'code', 'too_many', 'retry_after', 900);
    end if;
  end if;

  -- global ceiling on SMS per day (cost protection)
  if p_channel = 'mobile' then
    select count(*) into v_n from public.review_otps where channel = 'mobile' and created_at > now() - interval '1 day';
    if v_n >= 300 then
      return jsonb_build_object('ok', false, 'code', 'busy', 'retry_after', 3600);
    end if;
  end if;

  -- a new code replaces any earlier unused one
  update public.review_otps set superseded_at = now()
  where channel = p_channel and target = p_target and consumed_at is null and superseded_at is null;

  v_exp := now() + make_interval(secs => greatest(60, least(coalesce(p_ttl_seconds, 600), 900)));
  insert into public.review_otps (channel, target, code_hash, ip_hash, expires_at)
  values (p_channel, p_target, p_code_hash, p_ip_hash, v_exp)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'expires_at', v_exp);
end $$;

-- If the email/SMS could not be delivered, the session is removed so the customer can retry at once.
create or replace function public.review_otp_void(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.review_otps where id = p_id and consumed_at is null;
$$;

-- ---------------------------------------------------------------------
-- 4. review_otp_attempt: count one verification attempt (BEFORE the code is checked)
-- ---------------------------------------------------------------------
create or replace function public.review_otp_attempt(p_channel text, p_target text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.review_otps;
begin
  perform pg_advisory_xact_lock(hashtext('review-otp:' || p_channel || ':' || p_target));

  select * into r from public.review_otps
  where channel = p_channel and target = p_target and consumed_at is null and superseded_at is null
  order by created_at desc limit 1 for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_code');
  end if;
  if r.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if r.attempts >= r.max_attempts then
    return jsonb_build_object('ok', false, 'code', 'locked');
  end if;

  update public.review_otps set attempts = attempts + 1 where id = r.id;
  return jsonb_build_object('ok', true, 'id', r.id, 'code_hash', r.code_hash,
                            'attempts_left', r.max_attempts - r.attempts - 1);
end $$;

-- ---------------------------------------------------------------------
-- 5. review_otp_succeed: burn the OTP and mint a short-lived token bound to this exact address
-- ---------------------------------------------------------------------
create or replace function public.review_otp_succeed(p_otp_id uuid, p_token_hash text, p_ttl_seconds integer default 1800)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r   public.review_otps;
  v_exp timestamptz;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  -- single use: only one caller can flip consumed_at from NULL
  update public.review_otps set consumed_at = now()
  where id = p_otp_id and consumed_at is null and superseded_at is null and expires_at > now()
  returning * into r;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  -- earlier unused tokens for this address stop working
  update public.review_verifications set used_at = now()
  where channel = r.channel and target = r.target and used_at is null;

  v_exp := now() + make_interval(secs => greatest(300, least(coalesce(p_ttl_seconds, 1800), 3600)));
  insert into public.review_verifications (channel, target, token_hash, otp_id, expires_at)
  values (r.channel, r.target, p_token_hash, r.id, v_exp);

  return jsonb_build_object('ok', true, 'expires_at', v_exp);
end $$;

-- ---------------------------------------------------------------------
-- 6. review_submit_verified: the ONLY way a customer review is created
-- ---------------------------------------------------------------------
create or replace function public.review_submit_verified(
  p_name text, p_email text, p_mobile text, p_rating integer, p_message text,
  p_email_token_hash text, p_mobile_token_hash text, p_submission_id uuid, p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name    text;
  v_email   text;
  v_mobile  text;
  v_message text;
  v_digits  text;
  ve        public.review_verifications;
  vm        public.review_verifications;
  ex        public.reviews;
  v_id      uuid;
begin
  v_name    := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[\x01-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g'));
  v_email   := lower(btrim(coalesce(p_email, '')));
  v_message := btrim(regexp_replace(coalesce(p_message, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));

  if v_name = '' then
    return jsonb_build_object('ok', false, 'field', 'name', 'code', 'invalid', 'error', 'Please enter your name.');
  end if;
  if char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'field', 'name', 'code', 'invalid', 'error', 'Please keep your name to 80 characters.');
  end if;
  if v_email = '' or char_length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' or v_email ~ '\.\.' then
    return jsonb_build_object('ok', false, 'field', 'email', 'code', 'invalid', 'error', 'Please enter an email address like name@example.com.');
  end if;
  v_digits := regexp_replace(coalesce(p_mobile, ''), '[\s\-()]', '', 'g');
  if v_digits ~ '^\+91[6-9][0-9]{9}$' then
    v_mobile := v_digits;
  elsif v_digits ~ '^[6-9][0-9]{9}$' then
    v_mobile := '+91' || v_digits;
  else
    return jsonb_build_object('ok', false, 'field', 'mobile', 'code', 'invalid', 'error', 'Please enter a valid 10-digit Indian mobile number (the +91 code is optional).');
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'field', 'rating', 'code', 'invalid', 'error', 'Please choose a star rating from 1 to 5.');
  end if;
  if v_message = '' then
    return jsonb_build_object('ok', false, 'field', 'message', 'code', 'invalid', 'error', 'Please write your review.');
  end if;
  if char_length(v_message) > 1000 then
    return jsonb_build_object('ok', false, 'field', 'message', 'code', 'invalid', 'error', 'Please keep your review to 1,000 characters.');
  end if;

  perform pg_advisory_xact_lock(hashtext('review-submit:' || v_email));

  -- Retried request (e.g. the network dropped after the review was saved): report the saved review, never duplicate it.
  if p_submission_id is not null then
    select * into ex from public.reviews where client_submission_id = p_submission_id;
    if found then
      if ex.email = v_email and ex.mobile = v_mobile then
        return jsonb_build_object('ok', true, 'id', ex.id, 'duplicate', true);
      end if;
      return jsonb_build_object('ok', false, 'field', 'form', 'code', 'invalid', 'error', 'This submission could not be processed. Please reload the page and try again.');
    end if;
  end if;

  -- Both verifications must exist, belong to EXACTLY these contact details, be unexpired and unused.
  select * into ve from public.review_verifications
  where token_hash = coalesce(p_email_token_hash, '') and channel = 'email' for update;
  if not found or ve.target <> v_email or ve.used_at is not null or ve.expires_at <= now() then
    return jsonb_build_object('ok', false, 'field', 'email', 'code', 'email_not_verified',
      'error', 'Your email address is not verified (or the verification has expired). Please verify it again.');
  end if;
  select * into vm from public.review_verifications
  where token_hash = coalesce(p_mobile_token_hash, '') and channel = 'mobile' for update;
  if not found or vm.target <> v_mobile or vm.used_at is not null or vm.expires_at <= now() then
    return jsonb_build_object('ok', false, 'field', 'mobile', 'code', 'mobile_not_verified',
      'error', 'Your mobile number is not verified (or the verification has expired). Please verify it again.');
  end if;

  -- Abuse limits
  if p_ip_hash is not null and (select count(*) from public.reviews where source_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'rate_limited', 'error', 'You have sent several reviews recently. Please try again later.');
  end if;
  if (select count(*) from public.reviews where (email = v_email or mobile = v_mobile) and created_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'rate_limited', 'error', 'Several reviews have already been sent with these details today. Please try again tomorrow.');
  end if;
  if exists (select 1 from public.reviews where lower(message) = lower(v_message) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'duplicate', 'error', 'This review has already been received. Thank you.');
  end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'busy', 'error', 'We are receiving a lot of reviews right now. Please try again in a little while.');
  end if;

  insert into public.reviews (name, email, mobile, rating, message, status, source_hash,
                              email_verified_at, mobile_verified_at, verification_status, client_submission_id)
  values (v_name, v_email, v_mobile, p_rating::smallint, v_message, 'pending', p_ip_hash,
          ve.verified_at, vm.verified_at, 'verified', p_submission_id)
  returning id into v_id;

  -- Burn both verifications: they can never be used for a second review.
  update public.review_verifications set used_at = now(), review_id = v_id where id in (ve.id, vm.id);

  return jsonb_build_object('ok', true, 'id', v_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'duplicate', 'error', 'This review has already been received. Thank you.');
  when others then
    raise log 'review_submit_verified failed: % %', sqlstate, sqlerrm;
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'server', 'error', 'Sorry, your review could not be saved. Please try again in a moment.');
end $$;

-- ---------------------------------------------------------------------
-- 7. Lock the doors: server-only functions, and the old unverified entry point is removed
-- ---------------------------------------------------------------------
drop function if exists public.submit_review(text, text, text, integer, text, text);

revoke all on function public.review_otp_issue(text, text, text, text, integer)           from public, anon, authenticated;
revoke all on function public.review_otp_void(uuid)                                       from public, anon, authenticated;
revoke all on function public.review_otp_attempt(text, text)                              from public, anon, authenticated;
revoke all on function public.review_otp_succeed(uuid, text, integer)                     from public, anon, authenticated;
revoke all on function public.review_submit_verified(text, text, text, integer, text, text, text, uuid, text)
                                                                                          from public, anon, authenticated;
grant execute on function public.review_otp_issue(text, text, text, text, integer)        to service_role;
grant execute on function public.review_otp_void(uuid)                                    to service_role;
grant execute on function public.review_otp_attempt(text, text)                           to service_role;
grant execute on function public.review_otp_succeed(uuid, text, integer)                  to service_role;
grant execute on function public.review_submit_verified(text, text, text, integer, text, text, text, uuid, text)
                                                                                          to service_role;

-- Public read stays exactly as in 0005 (approved only; name, rating, message, date). Re-asserted for safety.
revoke all on public.reviews from anon;
revoke all on function public.get_public_reviews(integer) from public;
grant execute on function public.get_public_reviews(integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Realtime: tell open public pages "approved reviews changed" WITHOUT sending any review data.
--    (Putting the reviews table itself in the realtime publication would stream email/mobile to subscribers.)
--    The page receives a content-free ping on the public channel 'public-reviews' and re-fetches via get_public_reviews().
-- ---------------------------------------------------------------------
create or replace function public.reviews_notify_public() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.status = 'approved')
     or (tg_op = 'UPDATE' and (old.status = 'approved' or new.status = 'approved'))
     or (tg_op = 'DELETE' and old.status = 'approved') then
    begin
      perform realtime.send(jsonb_build_object('changed_at', now()), 'reviews_changed', 'public-reviews', false);
    exception when others then
      null;   -- never block a moderation action because the realtime ping failed
    end;
  end if;
  return null;
end $$;
revoke all on function public.reviews_notify_public() from public, anon, authenticated;

drop trigger if exists reviews_notify_public on public.reviews;
create trigger reviews_notify_public after insert or update or delete on public.reviews
  for each row execute function public.reviews_notify_public();

-- ################ 0007_simple_reviews.sql ################
-- =====================================================================
-- THE ELIX: simple reviews (NO email code, NO SMS code, NO Edge Functions)
-- Run once in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0006. Safe to re-run.
-- Nothing is deleted. Existing reviews stay exactly as they are.
--
--   * A visitor sends only: name, star rating, review text.
--   * The review is ALWAYS saved as 'pending'. It appears on the website only after the administrator
--     approves it in /admin (the admin dashboard and its login are unchanged).
--   * The public (anon) key can call only submit_review() and get_public_reviews(). The reviews table itself
--     is still locked by Row Level Security.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Email and mobile are no longer collected, so they may be empty for new reviews.
alter table public.reviews alter column email  drop not null;
alter table public.reviews alter column mobile drop not null;

-- Allow a third verification state for reviews sent without any verification.
alter table public.reviews drop constraint if exists reviews_verification_status_check;
alter table public.reviews add constraint reviews_verification_status_check
  check (verification_status in ('legacy_unverified', 'verified', 'unverified'));

create or replace function public.submit_review(
  p_name    text,
  p_rating  integer,
  p_message text,
  p_website text default ''          -- hidden trap field: real visitors never fill it in
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name    text;
  v_message text;
  v_ip      text;
  v_hash    text;
begin
  -- Spam trap: pretend it worked, save nothing.
  if coalesce(btrim(p_website), '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  v_name    := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[\x01-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g'));
  v_message := btrim(regexp_replace(coalesce(p_message, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));

  if v_name = '' then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please enter your name.');
  end if;
  if char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please keep your name to 80 characters.');
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'field', 'rating', 'error', 'Please choose a star rating from 1 to 5.');
  end if;
  if v_message = '' then
    return jsonb_build_object('ok', false, 'field', 'message', 'error', 'Please write your review.');
  end if;
  if char_length(v_message) > 1000 then
    return jsonb_build_object('ok', false, 'field', 'message', 'error', 'Please keep your review to 1,000 characters.');
  end if;

  -- Basic abuse limits. The sender's network address is stored only as a one-way hash.
  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true)::json) ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_hash := case when btrim(v_ip) = '' then null else encode(digest('elix-reviews:' || btrim(v_ip), 'sha256'), 'hex') end;

  if v_hash is not null and (select count(*) from public.reviews where source_hash = v_hash and created_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'You have sent several reviews recently. Please try again later.');
  end if;
  if exists (select 1 from public.reviews where lower(message) = lower(v_message) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'This review has already been received. Thank you.');
  end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'We are receiving a lot of reviews right now. Please try again in a little while.');
  end if;

  insert into public.reviews (name, email, mobile, rating, message, status, source_hash, verification_status)
  values (v_name, null, null, p_rating::smallint, v_message, 'pending', v_hash, 'unverified');

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Sorry, your review could not be saved. Please try again in a moment.');
end $$;

revoke all on function public.submit_review(text, integer, text, text) from public;
grant execute on function public.submit_review(text, integer, text, text) to anon, authenticated;

-- ################ 0008_review_form_fields.sql ################
-- =====================================================================
-- THE ELIX: review form with Name, Email, Phone (optional), Rating and Review. No verification codes.
-- Run once in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0007. Safe to re-run.
-- Nothing is deleted. Existing reviews stay exactly as they are.
--
--   * Every review is saved as 'pending'. It shows on the website only after the administrator approves it in /admin.
--   * Visitors can call only submit_review() and get_public_reviews(). Email and phone are never public.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Phone is optional and may be any normal phone number (7-15 digits, optional leading +).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reviews'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%mobile%' and pg_get_constraintdef(oid) ilike '%91%'
  loop
    execute format('alter table public.reviews drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.reviews drop constraint if exists reviews_mobile_format;
alter table public.reviews add constraint reviews_mobile_format
  check (mobile is null or mobile ~ '^\+?[0-9]{7,15}$');

alter table public.reviews alter column email  drop not null;
alter table public.reviews alter column mobile drop not null;

alter table public.reviews drop constraint if exists reviews_verification_status_check;
alter table public.reviews add constraint reviews_verification_status_check
  check (verification_status in ('legacy_unverified', 'verified', 'unverified'));

-- Replace the name-only function from 0007.
drop function if exists public.submit_review(text, integer, text, text);

create or replace function public.submit_review(
  p_name    text,
  p_email   text,
  p_mobile  text,
  p_rating  integer,
  p_message text,
  p_website text default ''          -- hidden trap field: real visitors never fill it in
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name    text;
  v_email   text;
  v_mobile  text;
  v_message text;
  v_digits  text;
  v_ip      text;
  v_hash    text;
begin
  -- Spam trap: pretend it worked, save nothing.
  if coalesce(btrim(p_website), '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  v_name    := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[\x01-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g'));
  v_email   := lower(btrim(coalesce(p_email, '')));
  v_message := btrim(regexp_replace(coalesce(p_message, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));

  if v_name = '' then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please enter your name.');
  end if;
  if char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please keep your name to 80 characters.');
  end if;

  if v_email = '' then
    return jsonb_build_object('ok', false, 'field', 'email', 'error', 'Please enter your email address.');
  end if;
  if char_length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
     or v_email ~ '\.\.' then
    return jsonb_build_object('ok', false, 'field', 'email', 'error', 'Please enter an email address like name@example.com.');
  end if;

  -- Phone is optional. A 10-digit Indian number gets +91 in front.
  v_digits := regexp_replace(coalesce(p_mobile, ''), '[\s\-().]', '', 'g');
  if v_digits = '' then
    v_mobile := null;
  elsif v_digits ~ '^[6-9][0-9]{9}$' then
    v_mobile := '+91' || v_digits;
  elsif v_digits ~ '^\+?[0-9]{7,15}$' then
    v_mobile := v_digits;
  else
    return jsonb_build_object('ok', false, 'field', 'mobile', 'error', 'Please enter a valid phone number, or leave it empty.');
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'field', 'rating', 'error', 'Please choose a star rating from 1 to 5.');
  end if;

  if v_message = '' then
    return jsonb_build_object('ok', false, 'field', 'message', 'error', 'Please write your review.');
  end if;
  if char_length(v_message) > 1000 then
    return jsonb_build_object('ok', false, 'field', 'message', 'error', 'Please keep your review to 1,000 characters.');
  end if;

  -- Basic abuse limits. The sender's network address is stored only as a one-way hash.
  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true)::json) ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_hash := case when btrim(v_ip) = '' then null else encode(digest('elix-reviews:' || btrim(v_ip), 'sha256'), 'hex') end;

  if v_hash is not null and (select count(*) from public.reviews where source_hash = v_hash and created_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'You have sent several reviews recently. Please try again later.');
  end if;
  if (select count(*) from public.reviews where (email = v_email or (v_mobile is not null and mobile = v_mobile)) and created_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Several reviews have already been sent with these details today. Please try again tomorrow.');
  end if;
  if exists (select 1 from public.reviews where lower(message) = lower(v_message) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'This review has already been received. Thank you.');
  end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'We are receiving a lot of reviews right now. Please try again in a little while.');
  end if;

  insert into public.reviews (name, email, mobile, rating, message, status, source_hash, verification_status)
  values (v_name, v_email, v_mobile, p_rating::smallint, v_message, 'pending', v_hash, 'unverified');

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Sorry, your review could not be saved. Please try again in a moment.');
end $$;

revoke all on function public.submit_review(text, text, text, integer, text, text) from public;
grant execute on function public.submit_review(text, text, text, integer, text, text) to anon, authenticated;

-- ################ 0009_dashboard.sql ################
-- =====================================================================
-- THE ELIX: admin dashboard additions
-- Run once in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0008. Safe to re-run.
-- Nothing is deleted. Existing menu items, reviews and settings stay exactly as they are.
--
--   1. menu_items: "Temporarily unavailable" status (item stays visible on the website with a label),
--      optional "unavailable until" date/time and optional daily serving hours.
--      (The existing column menu_items.available keeps its old meaning: false = item is hidden from the website.)
--   2. reviews: new status 'hidden' (an approved review taken off the website without deleting it).
--   3. weekly_hours, special_hours, service_timings: opening hours per day, holiday hours, and the category timings.
--      Temporary closure notice: three keys in site_settings.
--   4. admin_activity: automatic log of what administrators change (written by database triggers, not by the browser).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Menu availability
-- ---------------------------------------------------------------------
alter table public.menu_items add column if not exists availability      text not null default 'available';
alter table public.menu_items add column if not exists unavailable_until  timestamptz;
alter table public.menu_items add column if not exists available_from     time;
alter table public.menu_items add column if not exists available_to       time;

alter table public.menu_items drop constraint if exists menu_items_availability_check;
alter table public.menu_items add constraint menu_items_availability_check check (availability in ('available', 'unavailable'));

alter table public.menu_items drop constraint if exists menu_items_serving_hours_check;
alter table public.menu_items add constraint menu_items_serving_hours_check check ((available_from is null) = (available_to is null));

-- ---------------------------------------------------------------------
-- 2. Reviews: allow the 'hidden' status (get_public_reviews() already returns approved reviews only)
-- ---------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reviews'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%' and pg_get_constraintdef(oid) ilike '%pending%'
      and pg_get_constraintdef(oid) not ilike '%verification%'
  loop
    execute format('alter table public.reviews drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.reviews drop constraint if exists reviews_status_check;
alter table public.reviews add constraint reviews_status_check check (status in ('pending', 'approved', 'hidden', 'rejected'));

-- ---------------------------------------------------------------------
-- 3. Opening hours
-- ---------------------------------------------------------------------
-- weekly_hours: one row per weekday (0 = Sunday ... 6 = Saturday). "closes" earlier than "opens" means after midnight.
create table if not exists public.weekly_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  is_closed   boolean not null default false,
  opens       time,
  closes      time,
  updated_at  timestamptz not null default now(),
  check (is_closed or (opens is not null and closes is not null))
);

-- special_hours: a holiday, a festival or any one-off date with its own hours (or closed all day).
create table if not exists public.special_hours (
  id         bigint generated always as identity primary key,
  on_date    date not null unique,
  label      text not null default '' check (char_length(label) <= 80),
  is_closed  boolean not null default true,
  opens      time,
  closes     time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_closed or (opens is not null and closes is not null))
);

-- service_timings: the "Daily Timings" list on the website (Chai, Tiffins, Lunch ...). Text is shown exactly as typed.
create table if not exists public.service_timings (
  key        text primary key check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label      text not null check (char_length(label) between 1 and 40),
  open_text  text not null check (char_length(open_text) between 1 and 20),
  close_text text not null check (char_length(close_text) between 1 and 20),
  close_note text not null default '' check (char_length(close_note) <= 30),
  sort_order int  not null default 0,
  updated_at timestamptz not null default now()
);

-- Starting values = what the website showed before (open every day 5:00 AM to 1:00 AM; the five category timings).
insert into public.weekly_hours (day_of_week, is_closed, opens, closes)
select d, false, time '05:00', time '01:00' from generate_series(0, 6) as d
on conflict (day_of_week) do nothing;

insert into public.service_timings (key, label, open_text, close_text, close_note, sort_order) values
  ('chai',     'Chai',     '5:00 AM',  '12:00 PM', '',         0),
  ('tiffins',  'Tiffins',  '6:00 AM',  '12:00 PM', '',         1),
  ('lunch',    'Lunch',    '12:00 PM', '1:00 AM',  'next day', 2),
  ('bakery',   'Bakery',   '5:00 AM',  '1:00 PM',  '',         3),
  ('shawarma', 'Shawarma', '12:00 PM', '12:00 AM', '',         4)
on conflict (key) do nothing;

-- Temporary closure notice (shown as a banner on the website). Stored as ordinary settings.
insert into public.site_settings (key, value) values
  ('closure_notice_active', 'false'),
  ('closure_notice_text',   ''),
  ('closure_notice_until',  '')
on conflict (key) do nothing;

-- updated_at triggers, RLS (visitors read, administrators write), realtime
do $$
declare t text;
begin
  foreach t in array array['weekly_hours', 'special_hours', 'service_timings']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Administrator activity log
-- Rows are written ONLY by the trigger below (security definer), and only when the person making the change is an
-- administrator. The browser cannot insert, edit or delete log rows. Only administrators can read them.
-- ---------------------------------------------------------------------
create table if not exists public.admin_activity (
  id          bigint generated always as identity primary key,
  admin_id    uuid,
  admin_email text,
  action      text not null,          -- created | updated | deleted
  entity      text not null,          -- table name
  entity_id   text,
  summary     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists admin_activity_created_idx on public.admin_activity (created_at desc);

alter table public.admin_activity enable row level security;
drop policy if exists "admin read" on public.admin_activity;
create policy "admin read" on public.admin_activity for select to authenticated using (public.is_admin());
revoke all on public.admin_activity from anon, public;
revoke insert, update, delete, truncate on public.admin_activity from authenticated;

create or replace function public.log_admin_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row    jsonb;
  v_old    jsonb;
  v_id     text;
  v_name   text;
  v_what   text;
  v_action text;
  v_text   text;
begin
  if not public.is_admin() then
    return null;                                  -- visitors (for example submitting a review) are never logged
  end if;

  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    if (v_old - 'updated_at') = (v_row - 'updated_at') then
      return null;                                -- nothing really changed (for example a save with the same values)
    end if;
  end if;

  v_id   := coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'platform', v_row ->> 'day_of_week', v_row ->> 'on_date', '');
  v_name := coalesce(nullif(v_row ->> 'name', ''), nullif(v_row ->> 'title', ''), nullif(v_row ->> 'label', ''), nullif(v_row ->> 'key', ''), nullif(v_row ->> 'owner_id', ''), v_id);
  v_what := case tg_table_name
    when 'menu_items'      then 'menu item'
    when 'reviews'         then 'review'
    when 'gallery_items'   then 'gallery entry'
    when 'media_assets'    then 'website ' || coalesce(v_row ->> 'kind', 'media')
    when 'categories'      then 'category'
    when 'site_settings'   then 'website setting'
    when 'social_links'    then 'social link'
    when 'restaurant_info' then 'restaurant details'
    when 'weekly_hours'    then 'weekly hours'
    when 'special_hours'   then 'special hours'
    when 'service_timings' then 'daily timing'
    else tg_table_name
  end;
  v_action := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;

  if tg_table_name = 'reviews' and tg_op = 'UPDATE' and (v_old ->> 'status') is distinct from (v_row ->> 'status') then
    v_text := format('Review from %s: %s to %s', v_name, v_old ->> 'status', v_row ->> 'status');
  elsif tg_table_name = 'menu_items' and tg_op = 'UPDATE' and (v_old ->> 'availability') is distinct from (v_row ->> 'availability') then
    v_text := format('Menu item "%s" marked %s', v_name, case when v_row ->> 'availability' = 'unavailable' then 'temporarily unavailable' else 'available' end);
  elsif tg_table_name = 'reviews' then
    v_text := format('%s review from %s', initcap(v_action), v_name);   -- never the email or phone
  else
    v_text := format('%s %s "%s"', initcap(v_action), v_what, v_name);
  end if;

  insert into public.admin_activity (admin_id, admin_email, action, entity, entity_id, summary)
  values (auth.uid(), nullif(auth.jwt() ->> 'email', ''), v_action, tg_table_name, v_id, left(v_text, 300));
  return null;
end $$;
revoke all on function public.log_admin_activity() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['menu_items', 'reviews', 'gallery_items', 'media_assets', 'categories', 'site_settings',
                           'social_links', 'restaurant_info', 'weekly_hours', 'special_hours', 'service_timings']
  loop
    execute format('drop trigger if exists activity_log on public.%I', t);
    execute format('create trigger activity_log after insert or update or delete on public.%I for each row execute function public.log_admin_activity()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Restaurant details: the website's footer now reads the address and phone saved here, so replace the old
--    seed placeholders (only if they are still untouched) with the real details already used on the website.
-- ---------------------------------------------------------------------
update public.restaurant_info set address = 'H 6-126, Kondakal – Shankarpally Road, Opp. Sri Sri Bramarambika Temple, Mokila, Hyderabad, Telangana – 501203.' where id = 1 and address like 'Address placeholder%';
update public.restaurant_info set phone   = '+91 6262626466'                  where id = 1 and phone   like '%(placeholder)';
update public.restaurant_info set email   = 'theelixcaferestaurant@gmail.com' where id = 1 and email   like '%(placeholder)';


-- ################ 0010_menu_and_takeaway_management.sql ################
-- =====================================================================
-- THE ELIX: complete live menu management + Take Away slide management   (REVISED: safe to re-run)
-- Run in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0009.
--
-- WHAT IT DOES
--   0. Makes a one-time safety copy of the current menu_items table (menu_items_backup_pre0010). Never overwritten.
--   1. categories: also allow shawarma, mandi and party (the website already uses them).
--   2. menu_items: new columns price_text (price exactly as shown, e.g. '₹200/380', 'MRP') and path (nested headings).
--   3. Copies EVERY built-in menu item (327) into menu_items, ONE TIME ONLY, so each can be edited, hidden, moved or deleted
--      from the dashboard. The 32 placeholder sample dishes from 0002 are hidden (they were never on the public site).
--   4. takeaway_slides: the Take Away menu pages (the original 9 are copied in, ONE TIME ONLY), admin-only editing.
--
-- WHAT CHANGED IN THIS REVISION (fixes)
--   * EIGHT OVERLAPPING RECORDS. 0002 created sample dishes whose ids are the same as eight real menu items
--     (plain-dosa, masala-dosa, poori, upma, butter-naan, chicken-tikka, veg-fried-rice, chicken-fried-rice).
--     The old script kept the sample values (wrong prices, headings, descriptions, steam flags) and only filled in the new
--     columns. Now each of those eight rows is replaced by the supplied menu values, but ONLY while it is still exactly the
--     untouched 0002 sample. A row you edited in the dashboard is never overwritten. This repair also runs on projects
--     that already ran the old 0010.
--   * UNSAFE RE-RUNS. The old script re-inserted every built-in item that was missing, so anything you deleted in the
--     dashboard came back, and it could move dashboard-added items again. Now the one-time copy (menu, and Take Away
--     slides) runs only when its marker row in site_settings is absent. After the first successful run, running this file
--     again changes nothing you edited, and never brings back what you deleted.
--   * The script stops with an error (nothing marked as done) if any of the 327 built-in items is missing at the end.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. One-time safety copy of the menu as it is right now (kept forever; admin read-only)
-- ---------------------------------------------------------------------
create table if not exists public.menu_items_backup_pre0010 as
  select now() as backed_up_at, m.* from public.menu_items m;
alter table public.menu_items_backup_pre0010 enable row level security;
drop policy if exists "admin read" on public.menu_items_backup_pre0010;
create policy "admin read" on public.menu_items_backup_pre0010 for select to authenticated using (public.is_admin());
revoke all on public.menu_items_backup_pre0010 from anon;

-- Has the one-time copy already been done? (measured BEFORE anything below creates or fills tables)
drop table if exists _elix_state;
create temp table _elix_state as
select
  exists (select 1 from public.site_settings where key in ('menu_seed_0010', 'menu_source'))               as menu_done,
  (exists (select 1 from public.site_settings where key = 'takeaway_seed_0010')
     or to_regclass('public.takeaway_slides') is not null)                                                  as slides_done;

-- ---------------------------------------------------------------------
-- 1. Categories
-- ---------------------------------------------------------------------
alter table public.categories drop constraint if exists categories_key_check;
alter table public.categories add constraint categories_key_check
  check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

insert into public.categories (key, label, heading, intro, short_text, subcategories, sort_order) values
('shawarma','Shawarma','Fresh, Modern Shawarma.','Chicken, veg, paneer and mushroom shawarma, freshly wrapped.','Chicken, paneer, mushroom and veg shawarma, fresh and modern.','{}',10),
('mandi','Mandi','The Mandi Table.','Our mandi menu will be presented here.','Premium mandi, served in a charcoal and desert-sand setting.','{}',11),
('party','Party Orders','Party Orders','Handi biryani packages for small parties and get-togethers, by number of members.','Handi biryani packages for small parties and get-togethers.','{}',12)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Menu item columns
-- ---------------------------------------------------------------------
alter table public.menu_items add column if not exists price_text text;
alter table public.menu_items add column if not exists path text[] not null default '{}';

-- ---------------------------------------------------------------------
-- 3. The built-in menu (exactly as supplied). Temporary tables: they vanish at the end of this script.
-- ---------------------------------------------------------------------
drop table if exists _elix_seed;
drop table if exists _elix_samples;
drop table if exists _elix_sample_originals;
create temp table _elix_seed (
  id text, category_key text, sub text, path text[], name text,
  price numeric, price_text text, veg boolean, description text, sort_order int
);

insert into _elix_seed (id, category_key, sub, path, name, price, price_text, veg, description, sort_order) values
('tea-single','chai','',array[]::text[],'Tea – Single',20,'₹20',null,'',1),
('tea-full','chai','',array[]::text[],'Tea – Full',30,'₹30',null,'',2),
('tea-parcel','chai','',array[]::text[],'Tea – Parcel',35,'₹35',null,'',3),
('zafrani-tea','chai','',array[]::text[],'Zafrani Tea',40,'₹40',null,'',4),
('coffee','chai','',array[]::text[],'Coffee',40,'₹40',null,'',5),
('milk','chai','',array[]::text[],'Milk',40,'₹40',null,'',6),
('blue-lagoon','chai','',array[]::text[],'Blue Lagoon',199,'₹199',null,'',7),
('kiwi-lemonade','chai','',array[]::text[],'Kiwi Lemonade',199,'₹199',null,'',8),
('peach-mojito','chai','',array[]::text[],'Peach Mojito',199,'₹199',null,'',9),
('virgin-mojito','chai','',array[]::text[],'Virgin Mojito',199,'₹199',null,'',10),
('watermelon-mojito','chai','',array[]::text[],'Watermelon Mojito',199,'₹199',null,'',11),
('blueberry-mojito','chai','',array[]::text[],'Blueberry Mojito',219,'₹219',null,'',12),
('virgin-pina-colada','chai','',array[]::text[],'Virgin Pina Colada',219,'₹219',null,'',13),
('orange-twist-mojito','chai','',array[]::text[],'Orange Twist Mojito',239,'₹239',null,'',14),
('big-bull-mango-bellini','chai','',array[]::text[],'Big Bull Mango Bellini',239,'₹239',null,'',15),
('soft-drink','chai','',array[]::text[],'Soft Drink',0,'MRP',null,'',16),
('mineral-water','chai','',array[]::text[],'Mineral Water',0,'MRP',null,'',17),
('kurbani-ka-meetha','chai','',array[]::text[],'Kurbani Ka Meetha',110,'₹110',null,'',18),
('double-ka-meetha','chai','',array[]::text[],'Double Ka Meetha',100,'₹100',null,'',19),
('apricot-delight','chai','',array[]::text[],'Apricot Delight',150,'₹150',null,'',20),
('idly','tiffins','',array[]::text[],'Idly',60,'₹60',null,'',1),
('vada','tiffins','',array[]::text[],'Vada',70,'₹70',null,'',2),
('mysore-bonda','tiffins','',array[]::text[],'Mysore Bonda',70,'₹70',null,'',3),
('poori','tiffins','',array[]::text[],'Poori',80,'₹80',null,'',4),
('masala-dosa','tiffins','',array[]::text[],'Masala Dosa',80,'₹80',null,'',5),
('onion-dosa','tiffins','',array[]::text[],'Onion Dosa',60,'₹60',null,'',6),
('plain-dosa','tiffins','',array[]::text[],'Plain Dosa',60,'₹60',null,'',7),
('upma-dosa','tiffins','',array[]::text[],'Upma Dosa',70,'₹70',null,'',8),
('ragi-dosa','tiffins','',array[]::text[],'Ragi Dosa',70,'₹70',null,'',9),
('pesara-attu','tiffins','',array[]::text[],'Pesara Attu',70,'₹70',null,'',10),
('uttapam','tiffins','',array[]::text[],'Uttapam',70,'₹70',null,'',11),
('rava-dosa','tiffins','',array[]::text[],'Rava Dosa',80,'₹80',null,'',12),
('idly-sambar','tiffins','',array[]::text[],'Idly Sambar',70,'₹70',null,'',13),
('sambar-vada','tiffins','',array[]::text[],'Sambar Vada',80,'₹80',null,'',14),
('upma','tiffins','',array[]::text[],'Upma',50,'₹50',null,'',15),
('set-dosa','tiffins','',array[]::text[],'Set Dosa',100,'₹100',null,'',16),
('70-mm-dosa','tiffins','',array[]::text[],'70 MM Dosa',100,'₹100',null,'',17),
('mla-dosa','tiffins','',array[]::text[],'MLA Dosa',100,'₹100',null,'',18),
('tomato-soup','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Tomato Soup',110,'₹110',true,'',1),
('cream-of-veg-soup','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Cream of Veg. Soup',110,'₹110',true,'',2),
('veg-corn-soup','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Veg. Corn Soup',110,'₹110',true,'',3),
('veg-hot-and-sour-soup','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Veg. Hot & Sour Soup',110,'₹110',true,'',4),
('veg-manchow-soup','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Veg. Manchow Soup',110,'₹110',true,'',5),
('french-fries','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'French Fries',240,'₹240',true,'',6),
('veg-manchuria','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Veg. Manchuria',260,'₹260',true,'',7),
('chilli-veg','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chilli Veg',260,'₹260',true,'',8),
('green-peas-fry','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Green Peas Fry',220,'₹220',true,'',9),
('sezwan-veg','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Sezwan Veg',280,'₹280',true,'',10),
('ginger-vegetable','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Ginger Vegetable',260,'₹260',true,'',11),
('veg-65','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Veg 65',280,'₹280',true,'',12),
('aloo-65','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Aloo 65',240,'₹240',true,'',13),
('gobi-65','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Gobi 65',240,'₹240',true,'',14),
('gobi-manchurian','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Gobi Manchurian',260,'₹260',true,'',15),
('gobi-chilli','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Gobi Chilli',260,'₹260',true,'',16),
('chilli-paneer','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chilli Paneer',260,'₹260',true,'',17),
('hot-garlic-paneer','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Hot Garlic Paneer',300,'₹300',true,'',18),
('paneer-manchuria','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Paneer Manchuria',300,'₹300',true,'',19),
('paneer-65','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Paneer 65',300,'₹300',true,'',20),
('paneer-majestic','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Paneer Majestic',300,'₹300',true,'',21),
('ginger-paneer','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Ginger Paneer',300,'₹300',true,'',22),
('mushroom-manchuria','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Mushroom Manchuria',300,'₹300',true,'',23),
('mushroom-chilli','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Mushroom Chilli',300,'₹300',true,'',24),
('mushroom-65','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Mushroom 65',300,'₹300',true,'',25),
('pepper-mushroom','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Pepper Mushroom',310,'₹310',true,'',26),
('babycorn-manchuria','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Babycorn Manchuria',280,'₹280',true,'',27),
('babycorn-chilli','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Babycorn Chilli',280,'₹280',true,'',28),
('babycorn-65','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Babycorn 65',280,'₹280',true,'',29),
('babycorn-majestic','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Babycorn Majestic',280,'₹280',true,'',30),
('crispy-corn','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Crispy Corn',280,'₹280',true,'',31),
('paneer-tikka','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Paneer Tikka',340,'₹340',true,'',32),
('paneer-hariyali-tikka','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Paneer Hariyali Tikka',340,'₹340',true,'',33),
('paneer-sarson-tikka','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Paneer Sarson Tikka',340,'₹340',true,'',34),
('paneer-jafrani-tikka','food','Veg Soups & Starters (Including Kebabs & Tandoori)',array['VEG','Veg Soups & Starters (Including Kebabs & Tandoori)']::text[],'Paneer Jafrani Tikka',340,'₹340',true,'',35),
('dal-fry','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Dal Fry',200,'₹200',true,'',36),
('dal-tomato','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Dal Tomato',200,'₹200',true,'',37),
('dal-moghalai','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Dal Moghalai',200,'₹200',true,'',38),
('dal-alu','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Dal Alu',200,'₹200',true,'',39),
('dal-palak','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Dal Palak',200,'₹200',true,'',40),
('aloo-gobi','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Aloo Gobi',260,'₹260',true,'',41),
('aloo-butter','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Aloo Butter',260,'₹260',true,'',42),
('aloo-palak','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Aloo Palak',260,'₹260',true,'',43),
('gobi-masala','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Gobi Masala',260,'₹260',true,'',44),
('green-peas-masala','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Green Peas Masala',260,'₹260',true,'',45),
('zeera-aloo','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Zeera Aloo',260,'₹260',true,'',46),
('mutter-gobi','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Mutter Gobi',260,'₹260',true,'',47),
('mixed-veg-curry','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Mixed Veg. Curry',260,'₹260',true,'',48),
('veg-dahiwala','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Veg. Dahiwala',260,'₹260',true,'',49),
('veg-jaipuri','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Veg. Jaipuri',260,'₹260',true,'',50),
('kadhai-veg','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Kadhai Veg.',260,'₹260',true,'',51),
('malai-kofta','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Malai Kofta',290,'₹290',true,'',52),
('veg-kofta','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Veg Kofta',290,'₹290',true,'',53),
('mutter-paneer','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Mutter Paneer',290,'₹290',true,'',54),
('palak-paneer','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Palak Paneer',290,'₹290',true,'',55),
('butter-paneer-masala','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Butter Paneer Masala',290,'₹290',true,'',56),
('kadai-paneer','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Kadai Paneer',290,'₹290',true,'',57),
('shahi-paneer','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Shahi Paneer',290,'₹290',true,'',58),
('paneer-tikka-masala','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Paneer Tikka Masala',290,'₹290',true,'',59),
('kaju-paneer','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Kaju Paneer',310,'₹310',true,'',60),
('kaju-masala','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'Kaju Masala',310,'₹310',true,'',61),
('the-elix-spl-veg','food','Veg Indian Main Course',array['VEG','Veg Indian Main Course']::text[],'The Elix. SPL. Veg.',380,'₹380',true,'',62),
('veg-biryani','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Veg Biryani',260,'₹260',true,'',63),
('paneer-biryani','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Paneer Biryani',280,'₹280',true,'',64),
('mushroom-biryani','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Mushroom Biryani',260,'₹260',true,'',65),
('plain-rice','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Plain Rice',100,'₹100',true,'',66),
('plain-fried-rice','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Plain Fried Rice',110,'₹110',true,'',67),
('zeera-fried-rice','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Zeera Fried Rice',190,'₹190',true,'',68),
('curd-rice','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Curd Rice',190,'₹190',true,'',69),
('schezwan-veg-fried-rice','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Schezwan Veg Fried Rice',240,'₹240',true,'',70),
('veg-fried-rice','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Veg Fried Rice',200,'₹200',true,'',71),
('veg-pulao','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Veg Pulao',210,'₹210',true,'',72),
('paneer-fried-rice','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Paneer Fried Rice',240,'₹240',true,'',73),
('peas-pulao','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Peas Pulao',210,'₹210',true,'',74),
('peas-fried-price','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Peas Fried Price',210,'₹210',true,'',75),
('kashmiri-pulao','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Kashmiri Pulao',210,'₹210',true,'',76),
('ghee-rice','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Ghee Rice',210,'₹210',true,'',77),
('veg-soft-noodles','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Veg Soft Noodles',190,'₹190',true,'',78),
('schezwan-noodles','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Schezwan Noodles',240,'₹240',true,'',79),
('kaju-fried-rice','food','Veg Biryani, Rice & Noodles',array['VEG','Veg Biryani, Rice & Noodles']::text[],'Kaju Fried Rice',250,'₹250',true,'',80),
('chicken-corn-soup','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken Corn Soup',140,'₹140',false,'',81),
('chicken-manchow-soup','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken Manchow Soup',140,'₹140',false,'',82),
('chicken-hot-n-sour-soup','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken Hot N Sour Soup',140,'₹140',false,'',83),
('chicken-manchurian-boneless','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken Manchurian Boneless',370,'₹370',false,'',84),
('hot-garlic-chicken','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Hot Garlic Chicken',370,'₹370',false,'',85),
('chilly-chicken-boneless','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chilly Chicken Boneless',370,'₹370',false,'',86),
('chicken-roast','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken Roast',370,'₹370',false,'',87),
('chicken-65-boneless','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken 65 Boneless',370,'₹370',false,'',88),
('garlic-chicken','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Garlic Chicken',370,'₹370',false,'',89),
('ginger-chicken','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Ginger Chicken',370,'₹370',false,'',90),
('pepper-chicken','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Pepper Chicken',370,'₹370',false,'',91),
('chicken-drum-stick','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken Drum Stick',390,'₹390',false,'',92),
('chicken-lolli-pop','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken Lolli Pop',390,'₹390',false,'',93),
('onion-chicken','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Onion Chicken',390,'₹390',false,'',94),
('fried-chicken','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Fried Chicken',390,'₹390',false,'',95),
('chicken-majestic','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken Majestic',390,'₹390',false,'',96),
('chicken-555','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken 555',390,'₹390',false,'',97),
('dragon-chicken','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Dragon Chicken',390,'₹390',false,'',98),
('chicken-tikka','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Chicken Tikka',380,'₹380',false,'',99),
('reshmi-kabab','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Reshmi Kabab',380,'₹380',false,'',100),
('malai-kabab','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Malai Kabab',380,'₹380',false,'',101),
('irani-kabab','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Irani Kabab',380,'₹380',false,'',102),
('kalmi-kabab','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Kalmi Kabab',380,'₹380',false,'',103),
('hariyali-kabab','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Hariyali Kabab',380,'₹380',false,'',104),
('lemon-tikka','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Lemon Tikka',380,'₹380',false,'',105),
('jafrani-kabab','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Jafrani Kabab',380,'₹380',false,'',106),
('navabi-kabab','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Navabi Kabab',380,'₹380',false,'',107),
('tangi-kabab-half-full','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Tangi Kabab Half/ Full',200,'₹200/380',false,'',108),
('tandoori-chicken-half-full','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Tandoori Chicken Half/ Full',270,'₹270/550',false,'',109),
('grill-chicken-half-full','food','Chicken Soups & Starters (Including Kebabs & Tandoori)',array['NON-VEG','Chicken','Chicken Soups & Starters (Including Kebabs & Tandoori)']::text[],'Grill Chicken Half / full',280,'₹280/550',false,'',110),
('chicken-curry','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Curry',380,'₹380',false,'',111),
('chicken-masala','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Masala',390,'₹390',false,'',112),
('kadai-chicken','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Kadai Chicken',390,'₹390',false,'',113),
('chicken-tikka-masala','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Tikka Masala',390,'₹390',false,'',114),
('butter-chicken','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Butter Chicken',390,'₹390',false,'',115),
('chicken-mogalai','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Mogalai',390,'₹390',false,'',116),
('chicken-dahiwala','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Dahiwala',390,'₹390',false,'',117),
('punjabi-chicken','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Punjabi Chicken',390,'₹390',false,'',118),
('chicken-kolhapuri','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Kolhapuri',390,'₹390',false,'',119),
('chicken-chatpat','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Chatpat',390,'₹390',false,'',120),
('chicken-peswari','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Peswari',390,'₹390',false,'',121),
('chicken-bharta','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Bharta',390,'₹390',false,'',122),
('chicken-kassa','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Kassa',390,'₹390',false,'',123),
('chicken-do-pyaza','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Chicken Do Pyaza',390,'₹390',false,'',124),
('methi-chicken','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Methi Chicken',390,'₹390',false,'',125),
('andhra-chicken','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Andhra Chicken',390,'₹390',false,'',126),
('tangdi-masala','food','Chicken Main Course',array['NON-VEG','Chicken','Chicken Main Course']::text[],'Tangdi Masala',390,'₹390',false,'',127),
('mini-chicken-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Mini Chicken Biryani',190,'₹190',false,'',128),
('full-chicken-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Full Chicken Biryani',360,'₹360',false,'',129),
('elix-spl-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Elix. Spl. Biryani',450,'₹450',false,'',130),
('chicken-family-pack','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Chicken Family Pack',700,'₹700',false,'',131),
('chicken-jumbo-pack','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Chicken Jumbo Pack',950,'₹950',false,'',132),
('boneless-chicken-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Boneless Chicken Biryani',450,'₹450',false,'',133),
('chicken-65-boneless-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Chicken 65 Boneless Biryani',450,'₹450',false,'',134),
('chicken-lollipop-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Chicken Lollipop Biryani',420,'₹420',false,'',135),
('chicken-fry-piece-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Chicken Fry Piece Biryani',420,'₹420',false,'',136),
('gongura-chicken-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Gongura Chicken Biryani',450,'₹450',false,'',137),
('tandoori-chicken-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Tandoori Chicken Biryani',450,'₹450',false,'',138),
('tangdi-kabab-biryani','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Tangdi Kabab Biryani',450,'₹450',false,'',139),
('chicken-fried-rice','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Chicken Fried Rice',290,'₹290',false,'',140),
('schezwan-chicken-fried-rice','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Schezwan Chicken Fried Rice',320,'₹320',false,'',141),
('chicken-soft-noodles','food','Chicken Biryani, Rice & Noodles',array['NON-VEG','Chicken','Chicken Biryani, Rice & Noodles']::text[],'Chicken Soft Noodles',240,'₹240',false,'',142),
('mutton-manchurian','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Mutton Manchurian',550,'₹550',false,'',143),
('mutton-65','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Mutton 65',550,'₹550',false,'',144),
('hot-garlic-mutton','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Hot Garlic Mutton',550,'₹550',false,'',145),
('ginger-mutton','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Ginger Mutton',550,'₹550',false,'',146),
('mutton-bowl','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Mutton Bowl',550,'₹550',false,'',147),
('mutton-bhuna','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Mutton Bhuna',550,'₹550',false,'',148),
('hot-garlic-mutton-2','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Hot Garlic Mutton',550,'₹550',false,'',149),
('ginger-mutton-2','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Ginger Mutton',550,'₹550',false,'',150),
('chilli-mutton','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Chilli Mutton',550,'₹550',false,'',151),
('mutton-roast','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Mutton Roast',550,'₹550',false,'',152),
('mutton-sheekh-kabab','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Mutton Sheekh Kabab',510,'₹510',false,'',153),
('mutton-shami-kabab','food','Mutton Soups & Starters',array['NON-VEG','Mutton','Mutton Soups & Starters']::text[],'Mutton Shami Kabab',510,'₹510',false,'',154),
('mutton-masala','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Masala',460,'₹460',false,'',155),
('dum-ka-mutton','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Dum Ka Mutton',460,'₹460',false,'',156),
('mutton-kassa','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Kassa',460,'₹460',false,'',157),
('hara-daniya-mutton','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Hara Daniya Mutton',460,'₹460',false,'',158),
('kadai-mutton','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Kadai Mutton',460,'₹460',false,'',159),
('mutton-ashiyana','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Ashiyana',460,'₹460',false,'',160),
('mutton-do-pyaza','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Do Pyaza',460,'₹460',false,'',161),
('mutton-khandari','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Khandari',460,'₹460',false,'',162),
('mutton-korma','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Korma',460,'₹460',false,'',163),
('mutton-moghlai','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Moghlai',460,'₹460',false,'',164),
('mutton-shahi-korma','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Shahi Korma',460,'₹460',false,'',165),
('hyderabadi-mutton','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Hyderabadi Mutton',460,'₹460',false,'',166),
('mutton-sagawa','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Sagawa',460,'₹460',false,'',167),
('kheema-curry','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Kheema Curry',460,'₹460',false,'',168),
('kheema-masala','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Kheema Masala',460,'₹460',false,'',169),
('mutton-rogan-josh','food','Mutton Main Course',array['NON-VEG','Mutton','Mutton Main Course']::text[],'Mutton Rogan Josh',480,'₹480',false,'',170),
('mini-mutton-biryani','food','Mutton Biryani & Rice',array['NON-VEG','Mutton','Mutton Biryani & Rice']::text[],'Mini Mutton Biryani',280,'₹280',false,'',171),
('full-mutton-biryani','food','Mutton Biryani & Rice',array['NON-VEG','Mutton','Mutton Biryani & Rice']::text[],'Full Mutton Biryani',480,'₹480',false,'',172),
('mutton-family-pack','food','Mutton Biryani & Rice',array['NON-VEG','Mutton','Mutton Biryani & Rice']::text[],'Mutton Family Pack',950,'₹950',false,'',173),
('mutton-jumbo-pack','food','Mutton Biryani & Rice',array['NON-VEG','Mutton','Mutton Biryani & Rice']::text[],'Mutton Jumbo Pack',1400,'₹1400',false,'',174),
('elix-spl-mutton-biryani','food','Mutton Biryani & Rice',array['NON-VEG','Mutton','Mutton Biryani & Rice']::text[],'Elix. Spl. Mutton Biryani',550,'₹550',false,'',175),
('mutton-bouble-ghose','food','Mutton Biryani & Rice',array['NON-VEG','Mutton','Mutton Biryani & Rice']::text[],'Mutton Bouble Ghose',750,'₹750',false,'',176),
('gongura-mutton-biryani','food','Mutton Biryani & Rice',array['NON-VEG','Mutton','Mutton Biryani & Rice']::text[],'Gongura Mutton Biryani',520,'₹520',false,'',177),
('mutton-khima-biryani','food','Mutton Biryani & Rice',array['NON-VEG','Mutton','Mutton Biryani & Rice']::text[],'Mutton Khima Biryani',550,'₹550',false,'',178),
('mutton-fried-rice','food','Mutton Biryani & Rice',array['NON-VEG','Mutton','Mutton Biryani & Rice']::text[],'Mutton Fried Rice',320,'₹320',false,'',179),
('chilly-prawn','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Chilly Prawn',450,'₹450',false,'',180),
('garlic-prawn','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Garlic Prawn',450,'₹450',false,'',181),
('prawn-manchurian','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Prawn Manchurian',450,'₹450',false,'',182),
('pepper-prawn','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Pepper Prawn',450,'₹450',false,'',183),
('fried-prawn','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Fried Prawn',450,'₹450',false,'',184),
('loose-prawn','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Loose Prawn',450,'₹450',false,'',185),
('ginger-prawn','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Ginger Prawn',450,'₹450',false,'',186),
('apollo-fish','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Apollo Fish',450,'₹450',false,'',187),
('chilly-fish','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Chilly Fish',450,'₹450',false,'',188),
('fish-manchurian','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Fish Manchurian',450,'₹450',false,'',189),
('hot-garlic-fish','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Hot Garlic Fish',450,'₹450',false,'',190),
('fried-fish','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Fried Fish',450,'₹450',false,'',191),
('finger-fish','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Finger Fish',450,'₹450',false,'',192),
('ginger-fish','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Ginger Fish',450,'₹450',false,'',193),
('pepper-fish','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Pepper Fish',450,'₹450',false,'',194),
('golden-fish','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Golden Fish',450,'₹450',false,'',195),
('fish-tikka','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Fish Tikka',490,'₹490',false,'',196),
('fish-ajwani-tikka','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Fish Ajwani Tikka',490,'₹490',false,'',197),
('tandoori-prawns','food','Sea Starters & Tandoori',array['NON-VEG','Seafood','Sea Starters & Tandoori']::text[],'Tandoori Prawns',490,'₹490',false,'',198),
('prawn-curry','food','Seafood Main Course',array['NON-VEG','Seafood','Seafood Main Course']::text[],'Prawn Curry',450,'₹450',false,'',199),
('fish-masala','food','Seafood Main Course',array['NON-VEG','Seafood','Seafood Main Course']::text[],'Fish Masala',450,'₹450',false,'',200),
('fish-biryani','food','Seafood Biryani, Rice & Noodles',array['NON-VEG','Seafood','Seafood Biryani, Rice & Noodles']::text[],'Fish Biryani',490,'₹490',false,'',201),
('prawns-biryani','food','Seafood Biryani, Rice & Noodles',array['NON-VEG','Seafood','Seafood Biryani, Rice & Noodles']::text[],'Prawns Biryani',490,'₹490',false,'',202),
('prawns-fried-rice','food','Seafood Biryani, Rice & Noodles',array['NON-VEG','Seafood','Seafood Biryani, Rice & Noodles']::text[],'Prawns Fried Rice',310,'₹310',false,'',203),
('prawns-soft-noodles','food','Seafood Biryani, Rice & Noodles',array['NON-VEG','Seafood','Seafood Biryani, Rice & Noodles']::text[],'Prawns Soft Noodles',260,'₹260',false,'',204),
('spl-fish-platters-4-persons','food','Seafood Platters',array['NON-VEG','Seafood','Seafood Platters']::text[],'SPL FISH PLATTERS (4 Persons)',2200,'₹2,200',false,'Components: Fish Tikka, Fish Ajwain Tikka, Jafrani Fish Tikka',205),
('elix-spl-platter-4-persons','food','Mixed Non-Veg Platters',array['NON-VEG','Mixed Non-Veg','Mixed Non-Veg Platters']::text[],'ELIX. SPL. Platter (4 Persons)',1560,'₹1,560',false,'Components: 4 Chicken Kabab, 1 Mutton Kabab, 2 Seafood',206),
('elix-spl-platter-6-persons','food','Mixed Non-Veg Platters',array['NON-VEG','Mixed Non-Veg','Mixed Non-Veg Platters']::text[],'ELIX. SPL. Platter (6 Persons)',2420,'₹2,420',false,'Components: 4 Chicken Kabab, 1 Mutton Kabab, 3 Seafood',207),
('mix-fried-rice','food','Mixed Non-Veg Rice & Noodles',array['NON-VEG','Mixed Non-Veg','Mixed Non-Veg Rice & Noodles']::text[],'Mix Fried Rice',310,'₹310',false,'',208),
('mix-soft-noodles','food','Mixed Non-Veg Rice & Noodles',array['NON-VEG','Mixed Non-Veg','Mixed Non-Veg Rice & Noodles']::text[],'Mix Soft Noodles',290,'₹290',false,'',209),
('egg-masala','food','Egg Items',array['EGG','Egg Items']::text[],'Egg Masala',200,'₹200',null,'',210),
('egg-curry','food','Egg Items',array['EGG','Egg Items']::text[],'Egg Curry',180,'₹180',null,'',211),
('egg-burgi','food','Egg Items',array['EGG','Egg Items']::text[],'Egg Burgi',190,'₹190',null,'',212),
('egg-65','food','Egg Items',array['EGG','Egg Items']::text[],'Egg 65',190,'₹190',null,'',213),
('egg-manchuria','food','Egg Items',array['EGG','Egg Items']::text[],'Egg Manchuria',190,'₹190',null,'',214),
('egg-chilly','food','Egg Items',array['EGG','Egg Items']::text[],'Egg Chilly',190,'₹190',null,'',215),
('egg-omlet','food','Egg Items',array['EGG','Egg Items']::text[],'Egg Omlet',70,'₹70',null,'',216),
('boiled-egg','food','Egg Items',array['EGG','Egg Items']::text[],'Boiled Egg',15,'₹15',null,'',217),
('egg-biryani','food','Egg Items',array['EGG','Egg Items']::text[],'Egg Biryani',260,'₹260',null,'',218),
('egg-fried-rice','food','Egg Items',array['EGG','Egg Items']::text[],'Egg Fried Rice',210,'₹210',null,'',219),
('egg-soft-noodles','food','Egg Items',array['EGG','Egg Items']::text[],'Egg Soft Noodles',190,'₹190',null,'',220),
('green-salad','food','COMMON',array['COMMON']::text[],'Green Salad',100,'₹100',null,'',221),
('onion-salad','food','COMMON',array['COMMON']::text[],'Onion Salad',50,'₹50',null,'',222),
('cucumber-salad','food','COMMON',array['COMMON']::text[],'Cucumber Salad',80,'₹80',null,'',223),
('roasted-papad','food','COMMON',array['COMMON']::text[],'Roasted Papad',50,'₹50',null,'',224),
('fry-papad','food','COMMON',array['COMMON']::text[],'Fry Papad',50,'₹50',null,'',225),
('masala-papad','food','COMMON',array['COMMON']::text[],'Masala Papad',90,'₹90',null,'',226),
('roasted-masala-papad','food','COMMON',array['COMMON']::text[],'Roasted Masala Papad',80,'₹80',null,'',227),
('onion-raitha','food','COMMON',array['COMMON']::text[],'Onion Raitha',120,'₹120',null,'',228),
('mix-raitha','food','COMMON',array['COMMON']::text[],'Mix Raitha',130,'₹130',null,'',229),
('boondi-raitha','food','COMMON',array['COMMON']::text[],'Boondi Raitha',120,'₹120',null,'',230),
('rumali-roti','food','COMMON',array['COMMON']::text[],'Rumali Roti',25,'₹25',null,'',231),
('tandoori-roti','food','COMMON',array['COMMON']::text[],'Tandoori Roti',25,'₹25',null,'',232),
('tandoori-butter-roti','food','COMMON',array['COMMON']::text[],'Tandoori Butter Roti',35,'₹35',null,'',233),
('plain-naan','food','COMMON',array['COMMON']::text[],'Plain Naan',35,'₹35',null,'',234),
('butter-naan','food','COMMON',array['COMMON']::text[],'Butter Naan',45,'₹45',null,'',235),
('garlic-naan','food','COMMON',array['COMMON']::text[],'Garlic Naan',60,'₹60',null,'',236),
('kothmir-naan','food','COMMON',array['COMMON']::text[],'Kothmir Naan',60,'₹60',null,'',237),
('lacha-paratha','food','COMMON',array['COMMON']::text[],'Lacha Paratha',60,'₹60',null,'',238),
('pudina-paratha','food','COMMON',array['COMMON']::text[],'Pudina Paratha',60,'₹60',null,'',239),
('plain-kulcha','food','COMMON',array['COMMON']::text[],'Plain Kulcha',50,'₹50',null,'',240),
('masala-kulcha','food','COMMON',array['COMMON']::text[],'Masala Kulcha',65,'₹65',null,'',241),
('alu-paratha','food','COMMON',array['COMMON']::text[],'Alu Paratha',65,'₹65',null,'',242),
('paneer-paratha','food','COMMON',array['COMMON']::text[],'Paneer Paratha',60,'₹60',null,'',243),
('chicken-kheema-paratha','food','COMMON',array['COMMON']::text[],'Chicken Kheema Paratha',80,'₹80',null,'',244),
('mutton-kheema-paratha','food','COMMON',array['COMMON']::text[],'Mutton Kheema Paratha',120,'₹120',null,'',245),
('chicken-shawarma-with-salad','shawarma','',array[]::text[],'Chicken Shawarma with Salad',120,'₹120',false,'',1),
('special-chicken-shawarma','shawarma','',array[]::text[],'Special Chicken Shawarma',150,'₹150',false,'',2),
('chicken-65-shawarma','shawarma','',array[]::text[],'Chicken 65 Shawarma',150,'₹150',false,'',3),
('veg-shawarma','shawarma','',array[]::text[],'Veg Shawarma',120,'₹120',true,'',4),
('paneer-shawarma','shawarma','',array[]::text[],'Paneer Shawarma',120,'₹120',true,'',5),
('mushroom-shawarma','shawarma','',array[]::text[],'Mushroom Shawarma',120,'₹120',true,'',6),
('yizwan-biscuits','bakery','',array[]::text[],'Yizwan Biscuits',10,'₹10',null,'',1),
('ghee-biscuits','bakery','',array[]::text[],'Ghee Biscuits',10,'₹10',null,'',2),
('black-and-white','bakery','',array[]::text[],'Black & White',15,'₹15',null,'',3),
('fine-biscuits','bakery','',array[]::text[],'Fine Biscuits',20,'₹20',null,'',4),
('methi-biscuits','bakery','',array[]::text[],'Methi Biscuits',15,'₹15',null,'',5),
('pista-badam','bakery','',array[]::text[],'Pista Badam',15,'₹15',null,'',6),
('coconut-biscuits-small','bakery','',array[]::text[],'Coconut Biscuits (Small)',15,'₹15',null,'',7),
('fruit-biscuits','bakery','',array[]::text[],'Fruit Biscuits',15,'₹15',null,'',8),
('choco-vanilla-biscuits','bakery','',array[]::text[],'Choco Vanilla Biscuits',15,'₹15',null,'',9),
('coconut-pista','bakery','',array[]::text[],'Coconut Pista',15,'₹15',null,'',10),
('osmani-biscuits','bakery','',array[]::text[],'Osmani Biscuits',10,'₹10',null,'',11),
('moon-biscuits','bakery','',array[]::text[],'Moon Biscuits',10,'₹10',null,'',12),
('coconut-big','bakery','',array[]::text[],'Coconut (Big)',30,'₹30',null,'',13),
('badam-biscuits','bakery','',array[]::text[],'Badam Biscuits',15,'₹15',null,'',14),
('jemes-cake','bakery','',array[]::text[],'Jemes Cake',25,'₹25',null,'',15),
('paneer-puff','bakery','',array[]::text[],'Paneer Puff',20,'₹20',null,'',16),
('veg-puff','bakery','',array[]::text[],'Veg Puff',20,'₹20',null,'',17),
('cream-roll','bakery','',array[]::text[],'Cream Roll',20,'₹20',null,'',18),
('fruit-roll','bakery','',array[]::text[],'Fruit Roll',20,'₹20',null,'',19),
('veg-roll','bakery','',array[]::text[],'Veg Roll',20,'₹20',null,'',20),
('paneer-burger','bakery','',array[]::text[],'Paneer Burger',60,'₹60',null,'',21),
('chicken-burger','bakery','',array[]::text[],'Chicken Burger',60,'₹60',null,'',22),
('chicken-roll','bakery','',array[]::text[],'Chicken Roll',70,'₹70',null,'',23),
('chicken-puff','bakery','',array[]::text[],'Chicken Puff',25,'₹25',null,'',24),
('chicken-hotdog','bakery','',array[]::text[],'Chicken Hotdog',75,'₹75',null,'',25),
('dil-pasand-small','bakery','',array[]::text[],'Dil Pasand (Small)',20,'₹20',null,'',26),
('dilkhush','bakery','',array[]::text[],'Dilkhush',20,'₹20',null,'',27),
('dil-pasand-big','bakery','',array[]::text[],'Dil Pasand (Big)',30,'₹30',null,'',28),
('party-30-veg-handi-biryani','party','Approximately 30 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 30 Members']::text[],'Veg Handi Biryani',4000,'₹4,000',null,'',1),
('party-30-chicken-handi-biryani','party','Approximately 30 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 30 Members']::text[],'Chicken Handi Biryani',5400,'₹5,400',null,'',2),
('party-30-mutton-handi-biryani','party','Approximately 30 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 30 Members']::text[],'Mutton Handi Biryani',7500,'₹7,500',null,'',3),
('party-30-1kg-chicken-piece-extra','party','Approximately 30 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 30 Members']::text[],'1Kg Chicken Piece Extra',350,'₹350',null,'',4),
('party-30-1kg-mutton-piece-extra','party','Approximately 30 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 30 Members']::text[],'1Kg Mutton Piece Extra',1000,'₹1,000',null,'',5),
('party-40-veg-handi-biryani','party','Approximately 40 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 40 Members']::text[],'Veg Handi Biryani',5000,'₹5,000',null,'',6),
('party-40-chicken-handi-biryani','party','Approximately 40 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 40 Members']::text[],'Chicken Handi Biryani',7200,'₹7,200',null,'',7),
('party-40-mutton-handi-biryani','party','Approximately 40 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 40 Members']::text[],'Mutton Handi Biryani',9900,'₹9,900',null,'',8),
('party-40-1kg-chicken-piece-extra','party','Approximately 40 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 40 Members']::text[],'1Kg Chicken Piece Extra',350,'₹350',null,'',9),
('party-40-1kg-mutton-piece-extra','party','Approximately 40 Members',array['FOR SMALL PARTIES & GET TOGETHERS','Approximately 40 Members']::text[],'1Kg Mutton Piece Extra',1000,'₹1,000',null,'',10);


-- the placeholder dishes created by 0002 (they are not part of the supplied menu)
create temp table _elix_samples (id text);
insert into _elix_samples (id) values
('irani-chai'),('masala-chai'),('ginger-tea'),('lemon-tea'),('filter-coffee'),('cappuccino'),
('cold-coffee'),('chocolate-milkshake'),('fresh-lime-mojito'),('watermelon-juice'),('plain-idli'),
('ghee-idli'),('medu-vada'),('mysore-masala-dosa'),('ghee-karam-dosa'),('pongal'),
('chocolate-truffle-cake'),('red-velvet-pastry'),('black-forest-pastry'),('blueberry-cheesecake'),
('chocolate-brownie'),('butter-croissant'),('chocolate-donut'),('choco-chip-cookies'),
('walnut-brownie'),('chocolate-mousse'),('veg-dum-biryani'),('chicken-dum-biryani'),('chicken-65'),
('paneer-butter-masala'),('chicken-mandi'),('mutton-mandi');

-- The eight 0002 sample rows that share an id with a real menu item, exactly as 0002 created them.
create temp table _elix_sample_originals (
  id text, category_key text, sub text, name text, price numeric, description text, featured boolean, hot boolean
);
insert into _elix_sample_originals values
('plain-dosa','tiffins','Dosa','Plain Dosa',65,'A thin, crisp fermented rice and lentil crepe.',false,true),
('masala-dosa','tiffins','Dosa','Masala Dosa',85,'A crisp dosa filled with spiced potato, served with chutneys.',true,true),
('poori','tiffins','Breakfast Specials','Poori (2 pcs)',70,'Two golden puffed breads served with potato masala.',false,true),
('upma','tiffins','Breakfast Specials','Upma',55,'Semolina cooked with vegetables and tempered with mustard seeds.',false,true),
('butter-naan','food','Tandoori','Butter Naan',45,'Leavened bread from the tandoor, brushed with butter.',false,true),
('chicken-tikka','food','Kebabs','Chicken Tikka',230,'Marinated chicken chargrilled in the tandoor.',false,true),
('veg-fried-rice','food','Chinese','Veg Fried Rice',150,'Wok-tossed rice with fresh vegetables and soy.',false,true),
('chicken-fried-rice','food','Chinese','Chicken Fried Rice',190,'Wok-tossed rice with chicken, spring onion and soy.',false,true);

-- 3a. FIRST RUN ONLY. Placeholder samples that are not part of the supplied menu: hide them (never public; delete later if you wish).
update public.menu_items
   set available = false
 where id in (select id from _elix_samples)
   and id not in (select id from _elix_seed)
   and not (select menu_done from _elix_state);

-- 3b. FIRST RUN ONLY. Items you added yourself before this migration: keep them, after the built-in items,
--     with their heading as path. (Runs once, so it can never move them a second time.)
update public.menu_items
   set sort_order = 1000 + sort_order,
       path = case when sub <> '' then array[sub] else '{}'::text[] end
 where id not in (select id from _elix_seed)
   and id not in (select id from _elix_samples)
   and id not in (select id from _elix_sample_originals)
   and sort_order < 1000
   and not (select menu_done from _elix_state);

-- 3c. FIRST RUN ONLY. Insert every built-in item that is not there yet (never overwrites an existing row).
insert into public.menu_items (id, category_key, sub, path, name, price, price_text, veg, description, sort_order)
select id, category_key, sub, path, name, price, price_text, veg, description, sort_order from _elix_seed
where not (select menu_done from _elix_state)
on conflict (id) do nothing;

-- 3d. REPAIR OF THE EIGHT OVERLAPPING RECORDS (also safe on any later run).
--     A row is replaced by the supplied menu values only while it is STILL EXACTLY the untouched 0002 sample
--     (same name, price, heading, description, featured/steam flags, shown and available). Any dashboard edit protects it.
update public.menu_items m
   set category_key = s.category_key, sub = s.sub, path = s.path, name = s.name, price = s.price,
       price_text = s.price_text, veg = s.veg, description = s.description, featured = false, hot = false,
       sort_order = s.sort_order, available = true, availability = 'available',
       unavailable_until = null, available_from = null, available_to = null
  from _elix_seed s
  join _elix_sample_originals o on o.id = s.id
 where m.id = s.id
   and m.category_key = o.category_key and m.sub = o.sub and m.name = o.name and m.price = o.price
   and m.description = o.description and m.featured = o.featured and m.hot = o.hot
   and m.available and m.availability = 'available';

-- 3e. FIRST RUN ONLY. A same-id row you had already edited by hand keeps your edits; only the missing
--     display price and headings are filled in where they agree with your row.
update public.menu_items m
   set price_text = case when m.price_text is null and m.price = s.price then s.price_text else m.price_text end,
       path = case when cardinality(m.path) = 0 and m.category_key = s.category_key then s.path else m.path end,
       sort_order = case when m.sort_order = 0 and m.category_key = s.category_key then s.sort_order else m.sort_order end
  from _elix_seed s
 where m.id = s.id
   and not (select menu_done from _elix_state);

-- 3f. Check. On the first run every one of the 327 built-in items must now exist, otherwise the script stops here
--     (nothing is marked as done, so you can simply run it again after fixing the reported problem).
do $$
declare
  v_seed int; v_present int; v_total int;
begin
  select count(*) into v_seed from _elix_seed;
  select count(*) into v_present from _elix_seed s where exists (select 1 from public.menu_items m where m.id = s.id);
  select count(*) into v_total from public.menu_items;
  if (select not menu_done from _elix_state) and v_present <> v_seed then
    raise exception 'Menu copy incomplete: % of % built-in items are in menu_items. Nothing has been marked as done.', v_present, v_seed;
  end if;
  raise notice 'Menu check: % built-in items defined, % present now. menu_items holds % rows in total (including hidden placeholders and items you added).', v_seed, v_present, v_total;
end $$;

drop table if exists _elix_seed;
drop table if exists _elix_samples;
drop table if exists _elix_sample_originals;

-- the database is now the menu. The website reads this switch; the marker stops the one-time copy from ever running again.
insert into public.site_settings (key, value) values ('menu_source', 'database'), ('menu_seed_0010', 'applied')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 4. Take Away menu slides
-- ---------------------------------------------------------------------
create table if not exists public.takeaway_slides (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(trim(title)) between 1 and 80),
  image_url    text not null,               -- /takeaway/menu/xxxx.png for the original 9, or a Storage URL
  storage_path text,                        -- set only for images uploaded from the dashboard (so they can be cleaned up)
  width        int,
  height       int,
  sort_order   int not null default 0,
  published    boolean not null default true,  -- false = draft: visible only in the dashboard preview
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists takeaway_slides_order_idx on public.takeaway_slides (sort_order);

drop trigger if exists takeaway_slides_touch on public.takeaway_slides;
create trigger takeaway_slides_touch before update on public.takeaway_slides
  for each row execute function public.set_updated_at();

alter table public.takeaway_slides enable row level security;
drop policy if exists "public read published" on public.takeaway_slides;
create policy "public read published" on public.takeaway_slides for select to anon, authenticated
  using (published or public.is_admin());
drop policy if exists "admin write" on public.takeaway_slides;
create policy "admin write" on public.takeaway_slides for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

do $$
begin
  begin
    alter publication supabase_realtime add table public.takeaway_slides;
  exception when duplicate_object then null;
  end;
end $$;

-- the original 9 slides: copied in ONE TIME ONLY (marker below), so slides you delete or replace never come back on a re-run
insert into public.takeaway_slides (title, image_url, width, height, sort_order)
select v.title, v.url, v.w, v.h, v.o
from (values
  ('Chai & Beverages',                        '/takeaway/menu/140801.png', 1055, 1491, 1),
  ('South Indian Tiffins',                    '/takeaway/menu/140802.png', 1055, 1491, 2),
  ('Restaurant Food – Veg',                   '/takeaway/menu/140803.png', 1182, 1330, 3),
  ('Restaurant Food – Chicken',               '/takeaway/menu/140804.png', 1182, 1330, 4),
  ('Restaurant Food – Mutton',                '/takeaway/menu/140805.png', 1182, 1330, 5),
  ('Restaurant Food – Seafood',               '/takeaway/menu/140806.png', 1199, 1312, 6),
  ('Restaurant Food – Egg & Mixed Non-Veg',   '/takeaway/menu/140807.png', 1199, 1312, 7),
  ('Restaurant Food – Shawarma',              '/takeaway/menu/140808.png', 1254, 1254, 8),
  ('Bakery',                                  '/takeaway/menu/140988.png', 1055, 1490, 9)
) as v(title, url, w, h, o)
where not (select slides_done from _elix_state)
  and not exists (select 1 from public.takeaway_slides);

insert into public.site_settings (key, value) values ('takeaway_seed_0010', 'applied')
on conflict (key) do nothing;

-- activity log (the trigger function from 0009 reads the title automatically)
drop trigger if exists activity_log on public.takeaway_slides;
create trigger activity_log after insert or update or delete on public.takeaway_slides
  for each row execute function public.log_admin_activity();

drop table if exists _elix_state;

-- ---------------------------------------------------------------------
-- 5. Storage: the existing elix-media bucket and its admin-only write policies (from 0001) are reused.
--    Re-asserted here so a fresh project is covered too.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('elix-media', 'elix-media', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
on conflict (id) do update
  set public = true, file_size_limit = 52428800,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'];


-- ################ 0011_backup_and_recovery.sql ################
-- =====================================================================
-- THE ELIX: backup and recovery for everything you edit in the dashboard
-- Run in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0010. Safe to re-run (changes nothing you saved).
--
--   * content_backups: saved copies ("restore points") of the menu, the Take Away slides, the gallery list,
--     restaurant details, social links and website texts. Readable only by administrators.
--   * create_content_backup / import_content_backup / restore_content_backup / ensure_daily_content_backup:
--     the ONLY way to create or restore a backup. Each checks that the caller is an administrator (public.is_admin(),
--     which also requires the second sign-in step once enforce_two_step_login.sql has been run).
--   * Every restore first saves an automatic copy of the current content, and runs as ONE transaction:
--     if anything goes wrong nothing is changed.
--
-- What a backup holds: the text and settings (rows in the database). Photos and videos are files in Storage; a backup
-- keeps their web addresses, but a file you delete in the dashboard is deleted for good. Download the backup file
-- as well (Dashboard > Backup & recovery) and keep it somewhere safe.
-- =====================================================================

create table if not exists public.content_backups (
  id               uuid primary key default gen_random_uuid(),
  label            text not null check (char_length(btrim(label)) between 1 and 120),
  kind             text not null default 'manual' check (kind in ('manual', 'auto')),
  created_at       timestamptz not null default now(),
  created_by_email text,
  item_count       int not null default 0,
  slide_count      int not null default 0,
  data             jsonb not null
);
create index if not exists content_backups_created_idx on public.content_backups (created_at desc);

alter table public.content_backups enable row level security;
drop policy if exists "admin read" on public.content_backups;
create policy "admin read" on public.content_backups for select to authenticated using (public.is_admin());
drop policy if exists "admin delete" on public.content_backups;
create policy "admin delete" on public.content_backups for delete to authenticated using (public.is_admin());
-- no insert / update policy on purpose: backups are written only by the functions below
revoke all on public.content_backups from anon;

-- ---------------------------------------------------------------------
-- Create a backup of the current content
-- ---------------------------------------------------------------------
create or replace function public.create_content_backup(p_label text default 'Backup', p_kind text default 'manual')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_data  jsonb;
  v_label text := left(btrim(coalesce(nullif(p_label, ''), 'Backup')), 120);
  v_items int;
  v_slides int;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can create a backup.' using errcode = '42501';
  end if;
  if p_kind not in ('manual', 'auto') then p_kind := 'manual'; end if;

  v_data := jsonb_build_object(
    'format',          'elix-content-backup-1',
    'created_at',      now(),
    'menu_items',      coalesce((select jsonb_agg(to_jsonb(t) order by t.category_key, t.sort_order, t.id) from public.menu_items t), '[]'::jsonb),
    'takeaway_slides', coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.created_at) from public.takeaway_slides t), '[]'::jsonb),
    'gallery_items',   coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.id) from public.gallery_items t), '[]'::jsonb),
    'restaurant_info', coalesce((select jsonb_agg(to_jsonb(t)) from public.restaurant_info t), '[]'::jsonb),
    'social_links',    coalesce((select jsonb_agg(to_jsonb(t) order by t.platform) from public.social_links t), '[]'::jsonb),
    'site_settings',   coalesce((select jsonb_agg(to_jsonb(t) order by t.key) from public.site_settings t
                                  where t.key not in ('menu_source', 'menu_seed_0010', 'takeaway_seed_0010')), '[]'::jsonb),
    -- kept for reference only (a restore never touches them)
    'categories',      coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.key) from public.categories t), '[]'::jsonb),
    'media_assets',    coalesce((select jsonb_agg(to_jsonb(t) order by t.owner_type, t.owner_id, t.kind) from public.media_assets t), '[]'::jsonb)
  );
  v_items  := jsonb_array_length(v_data -> 'menu_items');
  v_slides := jsonb_array_length(v_data -> 'takeaway_slides');

  insert into public.content_backups (label, kind, created_by_email, item_count, slide_count, data)
  values (v_label, p_kind, nullif(auth.jwt() ->> 'email', ''), v_items, v_slides, v_data)
  returning id into v_id;

  -- keep the newest 20 automatic copies; manual restore points are never removed automatically
  delete from public.content_backups
   where kind = 'auto'
     and id not in (select id from public.content_backups where kind = 'auto' order by created_at desc limit 20);

  return v_id;
end $$;

-- An automatic copy at most once a day, taken when an administrator opens the dashboard.
create or replace function public.ensure_daily_content_backup()
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can create a backup.' using errcode = '42501';
  end if;
  if exists (select 1 from public.content_backups where kind = 'auto' and created_at > now() - interval '24 hours') then
    return null;
  end if;
  return public.create_content_backup('Automatic daily copy', 'auto');
end $$;

-- Add a backup file you downloaded earlier (JSON) to the list of restore points.
create or replace function public.import_content_backup(p_label text, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id  uuid;
  v_key text;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can import a backup.' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or p_data ->> 'format' is distinct from 'elix-content-backup-1' then
    raise exception 'This file is not a The Elix backup file.';
  end if;
  foreach v_key in array array['menu_items', 'takeaway_slides', 'gallery_items', 'restaurant_info', 'social_links', 'site_settings']
  loop
    if jsonb_typeof(p_data -> v_key) is distinct from 'array' then
      raise exception 'The backup file is incomplete: section "%" is missing.', v_key;
    end if;
  end loop;

  insert into public.content_backups (label, kind, created_by_email, item_count, slide_count, data)
  values (left(btrim(coalesce(nullif(p_label, ''), 'Imported backup')), 120), 'manual', nullif(auth.jwt() ->> 'email', ''),
          jsonb_array_length(p_data -> 'menu_items'), jsonb_array_length(p_data -> 'takeaway_slides'), p_data)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Restore (internal helper + the public function)
-- Makes a table match the backup: rows in the backup are put back / corrected, rows that are not in the backup are removed.
-- ---------------------------------------------------------------------
create or replace function public._elix_sync_rows(p_table text, p_key text, p_rows jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_cols text;
begin
  if p_table not in ('menu_items', 'takeaway_slides', 'gallery_items', 'restaurant_info', 'social_links') then
    raise exception 'Table % cannot be restored.', p_table;
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'The backup has no "%" section.', p_table;
  end if;

  -- rows that are not in the backup
  execute format('delete from public.%I where %I::text not in (select r ->> %L from jsonb_array_elements($1) r)', p_table, p_key, p_key)
    using p_rows;

  if jsonb_array_length(p_rows) = 0 then return; end if;

  -- only the columns the backup actually contains are overwritten
  select string_agg(format('%I = excluded.%I', c.column_name, c.column_name), ', ')
    into v_cols
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table and c.column_name <> p_key
     and exists (select 1 from jsonb_object_keys(p_rows -> 0) k where k = c.column_name);

  execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1) on conflict (%I) do %s',
                 p_table, p_table, p_key, case when v_cols is null then 'nothing' else 'update set ' || v_cols end)
    using p_rows;
end $$;
revoke all on function public._elix_sync_rows(text, text, jsonb) from public, anon, authenticated;

-- p_scope: 'menu' (all menu items), 'takeaway' (Take Away slides), 'gallery' (gallery list),
--          'site' (restaurant details, social links and website texts)
create or replace function public.restore_content_backup(p_backup_id uuid, p_scope text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row    public.content_backups%rowtype;
  v_safety uuid;
  v_marker text[] := array['menu_source', 'menu_seed_0010', 'takeaway_seed_0010'];
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can restore a backup.' using errcode = '42501';
  end if;
  if p_scope not in ('menu', 'takeaway', 'gallery', 'site') then
    raise exception 'Unknown restore scope "%".', p_scope;
  end if;
  select * into v_row from public.content_backups where id = p_backup_id;
  if not found then
    raise exception 'That backup no longer exists.';
  end if;

  -- 1. a safety copy of what is there right now
  v_safety := public.create_content_backup('Automatic copy before restoring "' || left(v_row.label, 60) || '"', 'auto');

  -- 2. put the chosen part back
  if p_scope = 'menu' then
    perform public._elix_sync_rows('menu_items', 'id', v_row.data -> 'menu_items');
  elsif p_scope = 'takeaway' then
    perform public._elix_sync_rows('takeaway_slides', 'id', v_row.data -> 'takeaway_slides');
  elsif p_scope = 'gallery' then
    perform public._elix_sync_rows('gallery_items', 'id', v_row.data -> 'gallery_items');
  else
    perform public._elix_sync_rows('restaurant_info', 'id', v_row.data -> 'restaurant_info');
    perform public._elix_sync_rows('social_links', 'platform', v_row.data -> 'social_links');
    delete from public.site_settings
     where key <> all (v_marker)
       and key not in (select s ->> 'key' from jsonb_array_elements(v_row.data -> 'site_settings') s);
    insert into public.site_settings
      select * from jsonb_populate_recordset(null::public.site_settings,
        (select coalesce(jsonb_agg(s), '[]'::jsonb) from jsonb_array_elements(v_row.data -> 'site_settings') s where s ->> 'key' <> all (v_marker)))
    on conflict (key) do update set value = excluded.value;
  end if;

  return jsonb_build_object('ok', true, 'scope', p_scope, 'safety_backup', v_safety);
end $$;

-- who may call what: signed-in users only (the functions themselves then require an administrator)
revoke all on function public.create_content_backup(text, text) from public, anon;
revoke all on function public.ensure_daily_content_backup() from public, anon;
revoke all on function public.import_content_backup(text, jsonb) from public, anon;
revoke all on function public.restore_content_backup(uuid, text) from public, anon;
grant execute on function public.create_content_backup(text, text) to authenticated;
grant execute on function public.ensure_daily_content_backup() to authenticated;
grant execute on function public.import_content_backup(text, jsonb) to authenticated;
grant execute on function public.restore_content_backup(uuid, text) to authenticated;


-- ################ 0012_menu_categories_and_columns.sql ################
-- =====================================================================
-- THE ELIX: allow every website category in the database + two menu columns   (migration 0012)
-- Run in: Supabase Dashboard > SQL Editor > New query.  Safe to re-run any number of times.
--
-- WHY THIS EXISTS
--   The very first database setup (0001) only allowed four categories: chai, tiffins, bakery, food.
--   The website also has Mandi, Shawarma and Party Orders, so those could never exist in the database and therefore
--   never appeared in the dashboard. This file fixes only that, and nothing else:
--
--   1. lets the categories table hold any category key (the old four-key restriction is removed),
--   2. adds the two menu_items columns the dashboard needs: price_text (price exactly as shown, e.g. ₹200/380, MRP)
--      and path (the nested headings an item sits under, e.g. NON-VEG > Chicken > Chicken Main Course),
--   3. adds the three missing categories: Shawarma, Mandi and Party Orders.
--
-- WHAT IT NEVER DOES
--   It does not delete, rewrite or hide any menu item, category, photo or setting. Existing categories are left as they are.
--
-- AFTER RUNNING IT
--   Open the dashboard > Menu management. If the page offers "Copy the website menu into the dashboard", press it.
--   (That step copies the 327 built-in menu items into the database without touching anything already there.)
--   Running 0010_menu_and_takeaway_management.sql instead of this file also works; it includes this file's changes.
-- =====================================================================

-- 1. Remove the old "only four categories" restriction (whatever it happens to be called), keep a simple key-format rule.
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.categories'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%key%'
  loop
    execute format('alter table public.categories drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.categories drop constraint if exists categories_key_format_check;
alter table public.categories add constraint categories_key_format_check
  check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- 2. Menu item columns used by the dashboard and the website.
alter table public.menu_items add column if not exists price_text text;
alter table public.menu_items add column if not exists path text[] not null default '{}';

-- 3. The categories the website already has (existing rows are never changed).
insert into public.categories (key, label, heading, intro, short_text, subcategories, sort_order) values
('shawarma','Shawarma','Fresh, Modern Shawarma.','Chicken, veg, paneer and mushroom shawarma, freshly wrapped.','Chicken, paneer, mushroom and veg shawarma, fresh and modern.','{}',10),
('mandi','Mandi','The Mandi Table.','Our mandi menu will be presented here.','Premium mandi, served in a charcoal and desert-sand setting.','{}',11),
('party','Party Orders','Party Orders','Handi biryani packages for small parties and get-togethers, by number of members.','Handi biryani packages for small parties and get-togethers.','{}',12)
on conflict (key) do nothing;

-- Check
do $$
declare n int;
begin
  select count(*) into n from public.categories where key in ('shawarma','mandi','party');
  raise notice 'Categories shawarma / mandi / party present: % of 3', n;
  if n <> 3 then raise exception 'The three categories could not be added.'; end if;
end $$;

-- ################ 0013_about_us_and_explore_subtitle.sql ################
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


-- ################ 0014_dynamic_menu_management.sql ################
-- =====================================================================
-- THE ELIX: dynamic menu management (Phase 3)   (migration 0014)
-- Run in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0013.  Safe to re-run any number of times.
--
-- WHAT IT ADDS (nothing is removed, renamed or rewritten)
--   1. categories.enabled              : a category can be switched off (hidden from the website) without deleting it.
--   2. menu_subcategories (new table)  : real, orderable, nestable subcategories that belong to one category.
--                                        Until now a "subcategory" only existed as text inside each item (menu_items.path).
--   3. menu_items.subcategory_id       : the subcategory an item is assigned to (empty = top level of its category).
--   4. Integrity guards                : a subcategory cannot be its own ancestor, cannot be nested more than 6 levels
--                                        deep, and must stay in the same category as its parent; an item can only point
--                                        at a subcategory of its own category.
--   5. Row Level Security              : visitors read only. Only administrators (public.is_admin()) can write.
--   6. ONE-TIME copy of the structure the menu already has: every distinct heading path found in menu_items becomes a
--      subcategory (same names, same nesting, same order as today) and each item is linked to its own one.
--      menu_items.path / menu_items.sub are NOT changed: they stay as they are and remain the fallback.
--      The category order is also written down once, in the order the website already shows
--      (Chai, Tiffins, Restaurant Food, Mandi, Shawarma, Bakery, then Party Orders).
--
-- WHAT IT NEVER DOES
--   It does not delete, hide, move, rename or re-price any menu item, category or photograph.
--   The one-time copy (step 6) is guarded by the marker site_settings.menu_structure_0014, so running this file again
--   can never recreate a subcategory you deleted or undo a change you made in the dashboard.
--
-- REQUIRES: 0010, 0011, 0012 (menu_items.path, menu_items.price_text, site_settings.menu_source).
-- =====================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'menu_items' and column_name = 'path') then
    raise exception 'Run migration 0010 (or 0012) first: menu_items.path does not exist yet.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Categories: enabled flag
-- ---------------------------------------------------------------------
alter table public.categories add column if not exists enabled boolean not null default true;

-- ---------------------------------------------------------------------
-- 2. Subcategories
-- ---------------------------------------------------------------------
create table if not exists public.menu_subcategories (
  id           uuid primary key default gen_random_uuid(),
  category_key text not null references public.categories (key) on update cascade on delete cascade,
  parent_id    uuid references public.menu_subcategories (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 120),
  sort_order   int  not null default 0,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- two sibling subcategories cannot have the same name (the website groups items by this name)
create unique index if not exists menu_subcategories_unique_name
  on public.menu_subcategories (category_key, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name);
create index if not exists menu_subcategories_order_idx
  on public.menu_subcategories (category_key, parent_id, sort_order);

drop trigger if exists menu_subcategories_touch on public.menu_subcategories;
create trigger menu_subcategories_touch before update on public.menu_subcategories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Menu items: which subcategory an item sits in
-- ---------------------------------------------------------------------
alter table public.menu_items
  add column if not exists subcategory_id uuid references public.menu_subcategories (id) on delete set null;
create index if not exists menu_items_subcategory_idx on public.menu_items (subcategory_id);

-- ---------------------------------------------------------------------
-- 4. Integrity guards
-- ---------------------------------------------------------------------
create or replace function public.menu_subcategory_guard() returns trigger
language plpgsql as $$
declare
  v_parent_category text;
  v_cursor          uuid;
  v_depth           int := 1;
begin
  -- only when the parent is being set or changed (a category key rename cascades through here untouched)
  if new.parent_id is null or (tg_op = 'UPDATE' and new.parent_id is not distinct from old.parent_id) then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A subcategory cannot be its own parent.';
  end if;
  select category_key into v_parent_category from public.menu_subcategories where id = new.parent_id;
  if v_parent_category is null then
    raise exception 'The parent subcategory does not exist.';
  end if;
  if v_parent_category <> new.category_key then
    raise exception 'A subcategory must stay in the same category as its parent.';
  end if;
  v_cursor := new.parent_id;
  while v_cursor is not null loop
    v_depth := v_depth + 1;
    if v_cursor = new.id then
      raise exception 'A subcategory cannot be moved inside itself.';
    end if;
    if v_depth > 6 then
      raise exception 'Subcategories can be nested at most 6 levels deep.';
    end if;
    select parent_id into v_cursor from public.menu_subcategories where id = v_cursor;
  end loop;
  return new;
end $$;

drop trigger if exists menu_subcategory_guard on public.menu_subcategories;
create trigger menu_subcategory_guard before insert or update on public.menu_subcategories
  for each row execute function public.menu_subcategory_guard();

create or replace function public.menu_item_subcategory_guard() returns trigger
language plpgsql as $$
begin
  if new.subcategory_id is null then
    return new;
  end if;
  -- an item moved to another category (for example by restoring a backup) leaves its old subcategory behind;
  -- it then shows under the heading stored in menu_items.path, exactly as before this migration
  if tg_op = 'UPDATE' and new.category_key is distinct from old.category_key
     and new.subcategory_id is not distinct from old.subcategory_id then
    new.subcategory_id := null;
    return new;
  end if;
  if tg_op = 'INSERT' or new.subcategory_id is distinct from old.subcategory_id then
    if not exists (select 1 from public.menu_subcategories s
                    where s.id = new.subcategory_id and s.category_key = new.category_key) then
      raise exception 'That subcategory does not belong to the item''s category.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists menu_item_subcategory_guard on public.menu_items;
create trigger menu_item_subcategory_guard before insert or update on public.menu_items
  for each row execute function public.menu_item_subcategory_guard();

-- ---------------------------------------------------------------------
-- 5. Row Level Security (visitors: read only; administrators: everything)
-- ---------------------------------------------------------------------
alter table public.menu_subcategories enable row level security;
drop policy if exists "public read" on public.menu_subcategories;
create policy "public read" on public.menu_subcategories for select to anon, authenticated using (true);
drop policy if exists "admin write" on public.menu_subcategories;
create policy "admin write" on public.menu_subcategories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- the dashboard activity list (0009) and live updates for open pages
do $$
begin
  if to_regprocedure('public.log_admin_activity()') is not null then
    execute 'drop trigger if exists activity_log on public.menu_subcategories';
    execute 'create trigger activity_log after insert or update or delete on public.menu_subcategories for each row execute function public.log_admin_activity()';
  end if;
  begin
    alter publication supabase_realtime add table public.menu_subcategories;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------
-- 6. ONE-TIME copy of the structure the menu already has
-- ---------------------------------------------------------------------
do $$
declare
  d int;
  v_unlinked int;
  v_nodes int;
begin
  if exists (select 1 from public.site_settings where key = 'menu_structure_0014') then
    raise notice 'Menu structure already copied (marker menu_structure_0014): nothing changed.';
    return;
  end if;

  -- 6a. category order = the order the website already shows
  update public.categories c set sort_order = v.o
    from (values ('chai', 1), ('tiffins', 2), ('food', 3), ('mandi', 4), ('shawarma', 5), ('bakery', 6), ('party', 7)) as v(k, o)
   where c.key = v.k;
  update public.categories set sort_order = 100 + sort_order
   where key not in ('chai', 'tiffins', 'food', 'mandi', 'shawarma', 'bakery', 'party') and sort_order < 100;

  -- 6b. every item's heading path (the placeholder dishes from 0002 that are hidden are left out)
  drop table if exists _elix_paths;
  create temp table _elix_paths as
  select m.id as item_id, m.category_key,
         case when cardinality(m.path) > 0 then m.path
              when coalesce(m.sub, '') <> '' then array[m.sub]
              else '{}'::text[] end as eff
    from public.menu_items m
   where m.subcategory_id is null
     and not (m.available = false and m.id in (
       'irani-chai', 'masala-chai', 'ginger-tea', 'lemon-tea', 'filter-coffee', 'cappuccino',
       'cold-coffee', 'chocolate-milkshake', 'fresh-lime-mojito', 'watermelon-juice', 'plain-idli',
       'ghee-idli', 'medu-vada', 'mysore-masala-dosa', 'ghee-karam-dosa', 'pongal',
       'chocolate-truffle-cake', 'red-velvet-pastry', 'black-forest-pastry', 'blueberry-cheesecake',
       'chocolate-brownie', 'butter-croissant', 'chocolate-donut', 'choco-chip-cookies',
       'walnut-brownie', 'chocolate-mousse', 'veg-dum-biryani', 'chicken-dum-biryani', 'chicken-65',
       'paneer-butter-masala', 'chicken-mandi', 'mutton-mandi'));
  delete from _elix_paths where cardinality(eff) = 0 or cardinality(eff) > 6;
  -- a heading that is blank or longer than the 120 characters allowed is left on the old text path
  delete from _elix_paths p
   where exists (select 1 from unnest(p.eff) as e where char_length(trim(e)) = 0 or char_length(e) > 120);

  -- 6c. one subcategory per distinct heading prefix (so "NON-VEG > Chicken > Chicken Main Course" makes three)
  drop table if exists _elix_nodes;
  create temp table _elix_nodes (
    category_key text, pth text[], depth int, first_order int, id uuid not null default gen_random_uuid()
  );
  insert into _elix_nodes (category_key, pth, depth, first_order)
  select p.category_key, p.eff[1:g.d], g.d, min(m.sort_order)
    from _elix_paths p
    join public.menu_items m on m.id = p.item_id
    cross join lateral generate_series(1, cardinality(p.eff)) as g(d)
   group by p.category_key, p.eff[1:g.d], g.d;

  -- level by level, so a parent always exists before its children (and the guard above can check it)
  for d in 1..6 loop
    insert into public.menu_subcategories (id, category_key, parent_id, name, sort_order)
    select n.id, n.category_key, par.id, n.pth[n.depth],
           row_number() over (partition by n.category_key, par.id order by n.first_order, n.pth[n.depth])
      from _elix_nodes n
      left join _elix_nodes par
             on par.category_key = n.category_key and par.depth = n.depth - 1 and par.pth = n.pth[1:n.depth - 1]
     where n.depth = d;
  end loop;

  -- 6d. link every item to its own subcategory (the old path / sub text is left exactly as it is)
  update public.menu_items m set subcategory_id = n.id
    from _elix_paths p
    join _elix_nodes n on n.category_key = p.category_key and n.pth = p.eff and n.depth = cardinality(p.eff)
   where m.id = p.item_id
     and exists (select 1 from public.menu_subcategories s where s.id = n.id);

  -- 6e. check: every item that has a usable heading is now linked, otherwise nothing is kept (and nothing is marked done)
  select count(*) into v_unlinked
    from _elix_paths p
    join public.menu_items m on m.id = p.item_id
   where m.subcategory_id is null;
  select count(*) into v_nodes from public.menu_subcategories;
  if v_unlinked > 0 then
    raise exception 'Menu structure copy incomplete: % item(s) could not be linked. Nothing was changed.', v_unlinked;
  end if;
  raise notice 'Menu structure copied: % subcategories created, all items with a heading are linked.', v_nodes;

  insert into public.site_settings (key, value) values ('menu_structure_0014', 'applied')
  on conflict (key) do nothing;

  drop table if exists _elix_paths;
  drop table if exists _elix_nodes;
end $$;
