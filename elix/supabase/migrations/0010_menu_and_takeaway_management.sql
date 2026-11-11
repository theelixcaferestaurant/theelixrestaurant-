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
