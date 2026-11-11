-- THE ELIX: security and review-lifecycle self-test. Run in Supabase > SQL Editor AFTER migrations 0001-0009.
-- It changes NOTHING permanently: everything is rolled back at the end. Read the "Results" / Messages panel:
-- every line must start with PASS. If any line says FAIL (or the script stops with an error), copy it and send it for repair.
begin;

do $$
declare
  v_n int; v_test text := 'Selftest ' || substr(gen_random_uuid()::text, 1, 8); v_uid text := gen_random_uuid()::text;
begin
  -- 1. A visitor submits a review (anon role): accepted, stored as pending
  set local role anon;
  if not ((public.submit_review(v_test, 'selftest@example.com', '', 5, 'Self-test review text ' || v_test, ''))->>'ok')::boolean then
    raise exception 'FAIL: visitor could not submit a review';
  end if;
  raise notice 'PASS: visitor can submit a review';

  -- 2. A visitor cannot read the reviews table (emails/phones stay private)
  begin
    perform 1 from public.reviews limit 1;
    raise exception 'FAIL: visitor can read the reviews table';
  exception when insufficient_privilege then raise notice 'PASS: visitor cannot read the reviews table';
  end;

  -- 3. Pending reviews are not public
  select count(*) into v_n from public.get_public_reviews(200) where name = v_test;
  if v_n <> 0 then raise exception 'FAIL: a pending review is public'; end if;
  raise notice 'PASS: pending review is not public';
  reset role;

  -- 4. Status lifecycle (done here as the database owner, which is what an admin''s allowed update amounts to)
  select count(*) into v_n from public.reviews where name = v_test and status = 'pending';
  if v_n <> 1 then raise exception 'FAIL: new review is not stored as pending'; end if;
  raise notice 'PASS: new review is stored as pending';

  update public.reviews set status = 'approved' where name = v_test;
  set local role anon;
  select count(*) into v_n from public.get_public_reviews(200) where name = v_test;
  if v_n <> 1 then raise exception 'FAIL: approved review is not public'; end if;
  raise notice 'PASS: approved review is public';
  reset role;

  update public.reviews set status = 'hidden' where name = v_test;
  set local role anon;
  select count(*) into v_n from public.get_public_reviews(200) where name = v_test;
  if v_n <> 0 then raise exception 'FAIL: hidden review is still public'; end if;
  raise notice 'PASS: hidden review is not public (status hidden is accepted)';
  reset role;

  update public.reviews set status = 'rejected' where name = v_test;
  set local role anon;
  select count(*) into v_n from public.get_public_reviews(200) where name = v_test;
  if v_n <> 0 then raise exception 'FAIL: rejected review is public'; end if;
  raise notice 'PASS: rejected review is not public';
  reset role;

  -- 5. A signed-in user who is NOT an administrator
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_uid, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  if public.is_admin() then raise exception 'FAIL: random user counts as admin'; end if;
  select count(*) into v_n from public.reviews;
  if v_n <> 0 then raise exception 'FAIL: non-admin can see reviews'; end if;
  update public.reviews set status = 'approved' where name = v_test;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: non-admin can approve reviews'; end if;
  raise notice 'PASS: a normal signed-in user cannot see or approve reviews';

  begin
    insert into public.admins (user_id, email) values (v_uid::uuid, 'x@example.com');
    raise exception 'FAIL: a normal user can make themselves admin';
  exception when insufficient_privilege or foreign_key_violation then raise notice 'PASS: a normal user cannot add themselves to admins';
  end;

  begin
    perform 1 from public.admin_activity limit 1;
    select count(*) into v_n from public.admin_activity;
    if v_n <> 0 then raise exception 'FAIL: non-admin can read the activity log'; end if;
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: a normal user cannot read the admin activity log';
  reset role;

  -- 6. Visitors can read public website content but cannot change it
  set local role anon;
  select count(*) into v_n from public.weekly_hours;
  if v_n = 0 then raise exception 'FAIL: visitors cannot read weekly_hours (or the table is empty)'; end if;
  raise notice 'PASS: visitors can read opening hours';
  begin
    update public.menu_items set price = 1;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'FAIL: visitor changed menu prices'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.menu_items (id, category_key, name) values ('selftest-item', 'chai', 'x');
    raise exception 'FAIL: visitor can add menu items';
  exception when insufficient_privilege then raise notice 'PASS: visitors cannot change the menu';
  end;
  reset role;

  -- 7. Storage bucket exists and is limited to administrators for writing
  select count(*) into v_n from storage.buckets where id = 'elix-media';
  if v_n <> 1 then raise exception 'FAIL: storage bucket elix-media is missing'; end if;
  select count(*) into v_n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('elix media admin insert', 'elix media admin update', 'elix media admin delete');
  if v_n <> 3 then raise exception 'FAIL: storage admin policies are missing'; end if;
  raise notice 'PASS: storage bucket and admin-only upload/replace/delete policies exist';
end $$;

rollback;   -- nothing above is kept
