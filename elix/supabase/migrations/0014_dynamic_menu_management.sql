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
