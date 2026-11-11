-- THE ELIX: EMERGENCY / UNDO. Puts public.is_admin() back to "password login is enough" (the original rule).
-- Use this only if you cannot complete the second step (lost phone, SMS not arriving) and need dashboard writes to work again.
-- The /admin screen will still ask for the second step. To also clear a lost second step, see "Lost your phone?" in TWO-STEP-LOGIN.md.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
