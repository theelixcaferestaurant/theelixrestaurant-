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
