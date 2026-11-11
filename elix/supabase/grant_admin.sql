-- THE ELIX: make ONE existing Supabase user an administrator.
-- 1. Create the user first: Supabase > Authentication > Users > Add user > Create new user (tick "Auto Confirm User").
-- 2. Replace YOUR-EMAIL@example.com below (keep the quotes) and run in Supabase > SQL Editor.
-- The real user id is looked up from auth.users by exact email. Nothing is invented. If the email is not found, it stops with an error.
do $$
declare
  v_email text := lower(btrim('YOUR-EMAIL@example.com'));
  v_id    uuid;
begin
  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    raise exception 'No Supabase user with the email % exists. Create it under Authentication > Users first.', v_email;
  end if;
  insert into public.admins (user_id, email) values (v_id, v_email)
  on conflict (user_id) do update set email = excluded.email;
  raise notice 'Administrator access granted to % (id %).', v_email, v_id;
end $$;

-- Check (should show one row with your email):
select a.user_id, a.email, a.created_at from public.admins a order by a.created_at;
