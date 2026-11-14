-- THE ELIX Phase 3: checks for migration 0014. Run in Supabase SQL Editor AFTER 0014. Read-only: everything is rolled back.
-- NOTE: written for you to run; it has NOT been executed by the person who prepared it (no Postgres was available).
begin;
do $$
declare n int; r text := '';
begin
  -- 1 structure exists
  assert to_regclass('public.menu_subcategories') is not null, 'FAIL 1: menu_subcategories missing';
  assert exists (select 1 from information_schema.columns where table_name='categories' and column_name='enabled'), 'FAIL 1: categories.enabled missing';
  assert exists (select 1 from information_schema.columns where table_name='menu_items' and column_name='subcategory_id'), 'FAIL 1: menu_items.subcategory_id missing';
  -- 2 RLS on, public read, no public write
  assert (select relrowsecurity from pg_class where oid='public.menu_subcategories'::regclass), 'FAIL 2: RLS is off';
  assert exists (select 1 from pg_policies where tablename='menu_subcategories' and policyname='admin write'), 'FAIL 2: admin write policy missing';
  assert not exists (select 1 from pg_policies where tablename='menu_subcategories' and cmd in ('INSERT','UPDATE','DELETE','ALL') and 'anon' = any(roles)), 'FAIL 2: anon can write';
  -- 3 existing data linked, nothing lost
  select count(*) into n from public.menu_items where subcategory_id is null and cardinality(path) > 0 and available;
  raise notice 'check 3: % visible items have a heading but no subcategory link (should be 0 unless a heading was blank or > 120 chars)', n;
  select count(*) into n from public.menu_items;  raise notice 'check 3: menu_items rows = % (must equal the number before 0014)', n;
  -- 4 no duplicate siblings, no orphans
  assert not exists (select 1 from public.menu_subcategories s where s.parent_id is not null and not exists (select 1 from public.menu_subcategories p where p.id=s.parent_id)), 'FAIL 4: orphan subcategory';
  assert not exists (select 1 from public.menu_items i join public.menu_subcategories s on s.id=i.subcategory_id where s.category_key <> i.category_key), 'FAIL 4: item linked across categories';
  -- 5 guards exist
  assert exists (select 1 from pg_trigger where tgname='menu_subcategory_guard'), 'FAIL 5: subcategory guard missing';
  assert exists (select 1 from pg_trigger where tgname='menu_item_subcategory_guard'), 'FAIL 5: item guard missing';
  -- 6 guards work (inside this rolled-back transaction)
  begin
    insert into public.menu_subcategories (category_key, name) values ('chai','__t1');
    insert into public.menu_subcategories (category_key, name) values ('chai','__t1');
    raise exception 'FAIL 6: duplicate sibling name was accepted';
  exception when unique_violation then r := r || 'duplicate-name refused; ';
  end;
  raise notice 'check 6: %', r;
  raise notice 'ALL CHECKS FINISHED (look for FAIL above)';
end $$;
rollback;
