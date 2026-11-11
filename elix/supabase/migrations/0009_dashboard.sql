-- =====================================================================
-- THE ELIX: admin dashboard additions
-- Run once in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0008. Safe to re-run.
-- Nothing is deleted. Existing menu items, reviews and settings stay exactly as they are.
--
--   1. menu_items: "Temporarily unavailable" status (item stays visible on the website with a label),
--      optional "unavailable until" date/time and optional daily serving hours.
--      (The existing column menu_items.available keeps its old meaning: false = item is hidden from the website.)
--   2. reviews: new status 'hidden' (an approved review taken off the website without deleting it).
--   3. weekly_hours, special_hours, service_timings: opening hours per day, holiday hours, and the category timings.
--      Temporary closure notice: three keys in site_settings.
--   4. admin_activity: automatic log of what administrators change (written by database triggers, not by the browser).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Menu availability
-- ---------------------------------------------------------------------
alter table public.menu_items add column if not exists availability      text not null default 'available';
alter table public.menu_items add column if not exists unavailable_until  timestamptz;
alter table public.menu_items add column if not exists available_from     time;
alter table public.menu_items add column if not exists available_to       time;

alter table public.menu_items drop constraint if exists menu_items_availability_check;
alter table public.menu_items add constraint menu_items_availability_check check (availability in ('available', 'unavailable'));

alter table public.menu_items drop constraint if exists menu_items_serving_hours_check;
alter table public.menu_items add constraint menu_items_serving_hours_check check ((available_from is null) = (available_to is null));

-- ---------------------------------------------------------------------
-- 2. Reviews: allow the 'hidden' status (get_public_reviews() already returns approved reviews only)
-- ---------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reviews'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%' and pg_get_constraintdef(oid) ilike '%pending%'
      and pg_get_constraintdef(oid) not ilike '%verification%'
  loop
    execute format('alter table public.reviews drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.reviews drop constraint if exists reviews_status_check;
alter table public.reviews add constraint reviews_status_check check (status in ('pending', 'approved', 'hidden', 'rejected'));

-- ---------------------------------------------------------------------
-- 3. Opening hours
-- ---------------------------------------------------------------------
-- weekly_hours: one row per weekday (0 = Sunday ... 6 = Saturday). "closes" earlier than "opens" means after midnight.
create table if not exists public.weekly_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  is_closed   boolean not null default false,
  opens       time,
  closes      time,
  updated_at  timestamptz not null default now(),
  check (is_closed or (opens is not null and closes is not null))
);

-- special_hours: a holiday, a festival or any one-off date with its own hours (or closed all day).
create table if not exists public.special_hours (
  id         bigint generated always as identity primary key,
  on_date    date not null unique,
  label      text not null default '' check (char_length(label) <= 80),
  is_closed  boolean not null default true,
  opens      time,
  closes     time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_closed or (opens is not null and closes is not null))
);

-- service_timings: the "Daily Timings" list on the website (Chai, Tiffins, Lunch ...). Text is shown exactly as typed.
create table if not exists public.service_timings (
  key        text primary key check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label      text not null check (char_length(label) between 1 and 40),
  open_text  text not null check (char_length(open_text) between 1 and 20),
  close_text text not null check (char_length(close_text) between 1 and 20),
  close_note text not null default '' check (char_length(close_note) <= 30),
  sort_order int  not null default 0,
  updated_at timestamptz not null default now()
);

-- Starting values = what the website showed before (open every day 5:00 AM to 1:00 AM; the five category timings).
insert into public.weekly_hours (day_of_week, is_closed, opens, closes)
select d, false, time '05:00', time '01:00' from generate_series(0, 6) as d
on conflict (day_of_week) do nothing;

insert into public.service_timings (key, label, open_text, close_text, close_note, sort_order) values
  ('chai',     'Chai',     '5:00 AM',  '12:00 PM', '',         0),
  ('tiffins',  'Tiffins',  '6:00 AM',  '12:00 PM', '',         1),
  ('lunch',    'Lunch',    '12:00 PM', '1:00 AM',  'next day', 2),
  ('bakery',   'Bakery',   '5:00 AM',  '1:00 PM',  '',         3),
  ('shawarma', 'Shawarma', '12:00 PM', '12:00 AM', '',         4)
on conflict (key) do nothing;

-- Temporary closure notice (shown as a banner on the website). Stored as ordinary settings.
insert into public.site_settings (key, value) values
  ('closure_notice_active', 'false'),
  ('closure_notice_text',   ''),
  ('closure_notice_until',  '')
on conflict (key) do nothing;

-- updated_at triggers, RLS (visitors read, administrators write), realtime
do $$
declare t text;
begin
  foreach t in array array['weekly_hours', 'special_hours', 'service_timings']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Administrator activity log
-- Rows are written ONLY by the trigger below (security definer), and only when the person making the change is an
-- administrator. The browser cannot insert, edit or delete log rows. Only administrators can read them.
-- ---------------------------------------------------------------------
create table if not exists public.admin_activity (
  id          bigint generated always as identity primary key,
  admin_id    uuid,
  admin_email text,
  action      text not null,          -- created | updated | deleted
  entity      text not null,          -- table name
  entity_id   text,
  summary     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists admin_activity_created_idx on public.admin_activity (created_at desc);

alter table public.admin_activity enable row level security;
drop policy if exists "admin read" on public.admin_activity;
create policy "admin read" on public.admin_activity for select to authenticated using (public.is_admin());
revoke all on public.admin_activity from anon, public;
revoke insert, update, delete, truncate on public.admin_activity from authenticated;

create or replace function public.log_admin_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row    jsonb;
  v_old    jsonb;
  v_id     text;
  v_name   text;
  v_what   text;
  v_action text;
  v_text   text;
begin
  if not public.is_admin() then
    return null;                                  -- visitors (for example submitting a review) are never logged
  end if;

  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    if (v_old - 'updated_at') = (v_row - 'updated_at') then
      return null;                                -- nothing really changed (for example a save with the same values)
    end if;
  end if;

  v_id   := coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'platform', v_row ->> 'day_of_week', v_row ->> 'on_date', '');
  v_name := coalesce(nullif(v_row ->> 'name', ''), nullif(v_row ->> 'title', ''), nullif(v_row ->> 'label', ''), nullif(v_row ->> 'key', ''), nullif(v_row ->> 'owner_id', ''), v_id);
  v_what := case tg_table_name
    when 'menu_items'      then 'menu item'
    when 'reviews'         then 'review'
    when 'gallery_items'   then 'gallery entry'
    when 'media_assets'    then 'website ' || coalesce(v_row ->> 'kind', 'media')
    when 'categories'      then 'category'
    when 'site_settings'   then 'website setting'
    when 'social_links'    then 'social link'
    when 'restaurant_info' then 'restaurant details'
    when 'weekly_hours'    then 'weekly hours'
    when 'special_hours'   then 'special hours'
    when 'service_timings' then 'daily timing'
    else tg_table_name
  end;
  v_action := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;

  if tg_table_name = 'reviews' and tg_op = 'UPDATE' and (v_old ->> 'status') is distinct from (v_row ->> 'status') then
    v_text := format('Review from %s: %s to %s', v_name, v_old ->> 'status', v_row ->> 'status');
  elsif tg_table_name = 'menu_items' and tg_op = 'UPDATE' and (v_old ->> 'availability') is distinct from (v_row ->> 'availability') then
    v_text := format('Menu item "%s" marked %s', v_name, case when v_row ->> 'availability' = 'unavailable' then 'temporarily unavailable' else 'available' end);
  elsif tg_table_name = 'reviews' then
    v_text := format('%s review from %s', initcap(v_action), v_name);   -- never the email or phone
  else
    v_text := format('%s %s "%s"', initcap(v_action), v_what, v_name);
  end if;

  insert into public.admin_activity (admin_id, admin_email, action, entity, entity_id, summary)
  values (auth.uid(), nullif(auth.jwt() ->> 'email', ''), v_action, tg_table_name, v_id, left(v_text, 300));
  return null;
end $$;
revoke all on function public.log_admin_activity() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['menu_items', 'reviews', 'gallery_items', 'media_assets', 'categories', 'site_settings',
                           'social_links', 'restaurant_info', 'weekly_hours', 'special_hours', 'service_timings']
  loop
    execute format('drop trigger if exists activity_log on public.%I', t);
    execute format('create trigger activity_log after insert or update or delete on public.%I for each row execute function public.log_admin_activity()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Restaurant details: the website's footer now reads the address and phone saved here, so replace the old
--    seed placeholders (only if they are still untouched) with the real details already used on the website.
-- ---------------------------------------------------------------------
update public.restaurant_info set address = 'H 6-126, Kondakal – Shankarpally Road, Opp. Sri Sri Bramarambika Temple, Mokila, Hyderabad, Telangana – 501203.' where id = 1 and address like 'Address placeholder%';
update public.restaurant_info set phone   = '+91 6262626466'                  where id = 1 and phone   like '%(placeholder)';
update public.restaurant_info set email   = 'theelixcaferestaurant@gmail.com' where id = 1 and email   like '%(placeholder)';
