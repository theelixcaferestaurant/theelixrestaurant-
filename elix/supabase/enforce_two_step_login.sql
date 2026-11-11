-- THE ELIX: make the DATABASE require two-step sign in for every administrator change.
-- Run this ONLY AFTER you have signed in at /admin once, completed the two-step setup, and reached the dashboard.
-- It refuses to run until at least one administrator has a verified second step, so you cannot lock yourself out by accident.
-- After it runs, a session with only a password (even a stolen one) can no longer change anything.
-- Safe to re-run. To undo, run supabase/turn_off_two_step_login.sql.

do $$
begin
  if not exists (
    select 1 from auth.mfa_factors f
    join public.admins a on a.user_id = f.user_id
    where f.status = 'verified'
  ) then
    raise exception 'No administrator has a verified two-step method yet. Sign in at /admin, finish the setup, then run this file again.';
  end if;
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- Check: one row means the function is in place.
select proname, prosecdef as security_definer from pg_proc where proname = 'is_admin' and pronamespace = 'public'::regnamespace;
