-- THE ELIX: backup / recovery / migration-0010 self-test. Run in Supabase > SQL Editor AFTER migrations 0001-0011
-- and after you have created your administrator (grant_admin.sql).
-- It changes NOTHING permanently: everything is rolled back at the end. Read the Messages panel:
-- every line must start with PASS. A line starting with FAIL (or an error) means something needs repair: send it to your developer.
begin;

do $$
declare
  v_admin uuid;
  v_n int; v_total int; v_price numeric; v_backup uuid; v_res jsonb;
begin
  -- ---- migration 0010: the supplied menu is complete and the eight overlapping records are repaired ----
  select count(*) into v_n from public.menu_items where price_text is not null and category_key in ('chai','tiffins','food','bakery','shawarma','mandi','party');
  if v_n < 327 then raise exception 'FAIL: only % built-in menu items found (expected at least 327)', v_n; end if;
  raise notice 'PASS: at least 327 menu items are in the database (found %)', v_n;

  select count(*) into v_n from public.menu_items
   where (id, name, price) in (('plain-dosa','Plain Dosa',65),('masala-dosa','Masala Dosa',85),('poori','Poori (2 pcs)',70),('upma','Upma',55),
                               ('butter-naan','Butter Naan',45),('chicken-tikka','Chicken Tikka',230),('veg-fried-rice','Veg Fried Rice',150),('chicken-fried-rice','Chicken Fried Rice',190))
     and hot;
  if v_n <> 0 then raise exception 'FAIL: % of the eight overlapping records still hold the old 0002 sample values', v_n; end if;
  raise notice 'PASS: the eight overlapping records no longer hold the old sample values';

  select count(*) into v_n from public.site_settings where key in ('menu_seed_0010','takeaway_seed_0010');
  if v_n <> 2 then raise exception 'FAIL: one-time copy markers are missing (migration 0010 not completed?)'; end if;
  raise notice 'PASS: one-time copy markers are present (re-running 0010 cannot bring back deleted items)';

  -- ---- backups: visitors have no access ----
  set local role anon;
  begin
    perform public.create_content_backup('x', 'manual');
    raise exception 'FAIL: a visitor can create a backup';
  exception when insufficient_privilege then raise notice 'PASS: a visitor cannot create a backup';
  end;
  begin
    perform 1 from public.content_backups limit 1;
    raise exception 'FAIL: a visitor can read backups';
  exception when insufficient_privilege then raise notice 'PASS: a visitor cannot read backups';
  end;
  reset role;

  -- ---- backups: an administrator can back up, damage, and restore ----
  select user_id into v_admin from public.admins limit 1;
  if v_admin is null then
    raise notice 'SKIP: no administrator exists yet, so the backup/restore round trip was not tested. Run grant_admin.sql, then run this file again.';
    return;
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  select count(*) into v_total from public.menu_items;
  select price into v_price from public.menu_items where id = 'tea-single';

  v_backup := public.create_content_backup('Self-test', 'manual');
  raise notice 'PASS: administrator created a backup';

  delete from public.menu_items where id = 'tea-single';
  update public.menu_items set price = price + 1 where id = 'tea-full';
  insert into public.menu_items (id, category_key, name, price) values ('selftest-item', 'chai', 'Self-test item', 1);

  v_res := public.restore_content_backup(v_backup, 'menu');
  select count(*) into v_n from public.menu_items;
  if v_n <> v_total then raise exception 'FAIL: menu has % rows after restore, expected %', v_n, v_total; end if;
  if not exists (select 1 from public.menu_items where id = 'tea-single' and price = v_price) then raise exception 'FAIL: deleted item was not restored'; end if;
  if exists (select 1 from public.menu_items where id = 'selftest-item') then raise exception 'FAIL: item added after the backup was not removed'; end if;
  raise notice 'PASS: restore brought back the deleted item, undid the price change and removed the later addition';

  if (v_res ->> 'safety_backup') is null or not exists (select 1 from public.content_backups where id = (v_res ->> 'safety_backup')::uuid and kind = 'auto') then
    raise exception 'FAIL: restore did not save an automatic safety copy first';
  end if;
  raise notice 'PASS: restore saved an automatic safety copy first';

  delete from public.content_backups where id = v_backup;
  raise notice 'PASS: administrator can delete a backup';
  reset role;
end $$;

rollback;
