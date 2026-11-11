-- =====================================================================
-- THE ELIX: Row Level Security and setup verification
-- Run in Supabase Dashboard > SQL Editor AFTER the two migrations and AFTER creating your admin.
-- It simulates visitors (anon), a signed-in non-admin, and your admin, then shows one result table.
-- It writes nothing permanent: every test row is rolled back. Every verdict must read PASS.
-- =====================================================================
create or replace function pg_temp.elix_verify()
returns table (test text, expected text, got text, verdict text)
language plpgsql as $fn$
declare
  res jsonb := '[]'::jsonb;
  admin_uid uuid;
  stranger uuid := gen_random_uuid();

begin
  select user_id into admin_uid from public.admins limit 1;

  begin  -- everything in this block is rolled back at the end
    -- hidden rows that visitors must NOT see
    insert into public.menu_items (id, category_key, name, available) values ('zz-verify-hidden', 'chai', 'Hidden', false);
    insert into public.gallery_items (id, title, grp, visible) values ('zz-verify-hidden', 'Hidden', 'Food', false);

    declare
      t record;
      r text;
      n int;
      tests text[][] := array[
        -- name | role | uid-kind | statement | expected
        ['anon reads categories (4)',                 'anon','none',  'select 1 from public.categories',                          'rows:4'],
        ['anon reads available menu items',        'anon','none',  'select 1 from public.menu_items where available',         'rows:+'],
        ['anon cannot see hidden menu item',          'anon','none',  'select 1 from public.menu_items where id=''zz-verify-hidden''', 'rows:0'],
        ['anon cannot see hidden gallery entry',      'anon','none',  'select 1 from public.gallery_items where id=''zz-verify-hidden''', 'rows:0'],
        ['anon reads visible gallery entries',           'anon','none',  'select 1 from public.gallery_items where visible',        'rows:+'],
        ['anon reads restaurant_info',                'anon','none',  'select 1 from public.restaurant_info',                    'rows:1'],
        ['anon cannot read admins',                   'anon','none',  'select 1 from public.admins',                             'rows:0'],
        ['anon cannot insert menu item',              'anon','none',  'insert into public.menu_items (id,category_key,name) values (''zz-x'',''chai'',''x'')', 'denied'],
        ['anon cannot update menu item',              'anon','none',  'update public.menu_items set price = 1',                  'rows:0'],
        ['anon cannot delete menu item',              'anon','none',  'delete from public.menu_items',                           'rows:0'],
        ['anon cannot change site settings',          'anon','none',  'update public.site_settings set value = ''x''',           'rows:0'],
        ['anon cannot insert media record',           'anon','none',  'insert into public.media_assets (owner_type,owner_id,kind,storage_path,url) values (''site'',''zz'',''image'',''p'',''u'')', 'denied'],
        ['anon cannot make itself admin',             'anon','none',  'insert into public.admins (user_id) values (gen_random_uuid())', 'denied'],
        ['anon cannot upload to storage',             'anon','none',  'insert into storage.objects (bucket_id,name) values (''elix-media'',''zz-anon.jpg'')', 'denied'],
        ['non-admin user cannot insert menu item',    'authenticated','stranger', 'insert into public.menu_items (id,category_key,name) values (''zz-y'',''chai'',''y'')', 'denied'],
        ['non-admin user cannot update menu item',    'authenticated','stranger', 'update public.menu_items set price = 1',        'rows:0'],
        ['non-admin user cannot delete gallery entry','authenticated','stranger', 'delete from public.gallery_items',              'rows:0'],
        ['non-admin user cannot make itself admin',   'authenticated','stranger', 'insert into public.admins (user_id) values (auth.uid())', 'denied'],
        ['non-admin user cannot upload to storage',   'authenticated','stranger', 'insert into storage.objects (bucket_id,name) values (''elix-media'',''zz-user.jpg'')', 'denied'],
        ['admin sees hidden menu item',               'authenticated','admin',    'select 1 from public.menu_items where id=''zz-verify-hidden''', 'rows:1'],
        ['admin can update restaurant_info',          'authenticated','admin',    'update public.restaurant_info set tagline = tagline', 'rows:1'],
        ['admin can insert menu item',                'authenticated','admin',    'insert into public.menu_items (id,category_key,name) values (''zz-z'',''chai'',''z'')', 'rows:1'],
        ['admin can upload to storage',               'authenticated','admin',    'insert into storage.objects (bucket_id,name) values (''elix-media'',''zz-admin.jpg'')', 'rows:1'],
        ['admin cannot add admins from the website',  'authenticated','admin',    'insert into public.admins (user_id) values (gen_random_uuid())', 'denied']
      ];
      i int;
      uid uuid;
      outcome text;
    begin
      for i in 1 .. array_length(tests, 1) loop
        if tests[i][3] = 'admin' then uid := admin_uid; elsif tests[i][3] = 'none' then uid := null; else uid := stranger; end if;
        if tests[i][3] = 'admin' and admin_uid is null then
          res := res || jsonb_build_array(jsonb_build_object('t', tests[i][1], 'e', tests[i][5], 'g', 'no admin row yet', 'v', 'SKIPPED'));
          continue;
        end if;
        begin
          execute format('set local role %I', tests[i][2]);
          perform set_config('request.jwt.claims', json_build_object('sub', coalesce(uid::text, ''), 'role', tests[i][2])::text, true);
          execute tests[i][4];
          get diagnostics n = row_count;
          outcome := 'rows:' || n;
        exception when others then
          outcome := 'denied';
        end;
        reset role;
        res := res || jsonb_build_array(jsonb_build_object('t', tests[i][1], 'e', tests[i][5], 'g', outcome, 'v', case when outcome = tests[i][5] or (tests[i][5] = 'rows:+' and n > 0 and outcome <> 'denied') or (tests[i][5] = 'rows:0' and outcome = 'denied') then 'PASS' else 'FAIL' end));
      end loop;
    end;

    -- structure checks (as the SQL editor user)
    res := res || jsonb_build_array(jsonb_build_object('t','storage bucket elix-media exists and is public','e','true','g',
      coalesce((select public::text from storage.buckets where id='elix-media'),'missing'),'v',
      case when (select public from storage.buckets where id='elix-media') then 'PASS' else 'FAIL' end));
    res := res || jsonb_build_array(jsonb_build_object('t','RLS enabled on all 8 content tables + admins','e','9','g',
      (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity and c.relname in ('admins','restaurant_info','opening_hours','social_links','site_settings','categories','menu_items','gallery_items','media_assets')),
      'v', case when (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity and c.relname in ('admins','restaurant_info','opening_hours','social_links','site_settings','categories','menu_items','gallery_items','media_assets')) = 9 then 'PASS' else 'FAIL' end));
    res := res || jsonb_build_array(jsonb_build_object('t','at least one administrator exists','e','>=1','g',(select count(*)::text from public.admins),'v',case when exists(select 1 from public.admins) then 'PASS' else 'FAIL' end));

    raise exception 'elix_rollback' using errcode = 'P0001';  -- undo every test row
  exception when sqlstate 'P0001' then
    reset role;
  end;

  return query select e->>'t', e->>'e', e->>'g', e->>'v' from jsonb_array_elements(res) e;
end
$fn$;

select * from pg_temp.elix_verify();
