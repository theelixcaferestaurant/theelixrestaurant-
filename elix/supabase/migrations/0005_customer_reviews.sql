-- =====================================================================
-- THE ELIX: customer reviews (submit, admin approval, public display)
-- Run once in: Supabase Dashboard > SQL Editor > New query. Safe to re-run.
--
-- Security model
--   * The reviews table has Row Level Security ON and NO policy for visitors, so the public (anon) key can
--     neither read nor write it directly. Email addresses and mobile numbers can never be fetched by visitors.
--   * Visitors can only call two functions: submit_review() and get_public_reviews().
--       - submit_review() validates and cleans everything again on the server, always saves the review as
--         'pending', and limits repeated requests (no OTP, no CAPTCHA, no verification of any kind).
--       - get_public_reviews() returns ONLY approved reviews and ONLY name, rating, message and date.
--   * Administrators (rows in public.admins, see README-BACKEND.md) can read, approve, reject and delete.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 1 and 80),
  email       text        not null check (char_length(email) between 3 and 254),
  mobile      text        not null check (mobile ~ '^\+91[6-9][0-9]{9}$'),
  rating      smallint    not null check (rating between 1 and 5),
  message     text        not null check (char_length(message) between 1 and 1000),
  status      text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source_hash text,                                   -- one-way hash of the sender's network address, for rate limiting only
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists reviews_status_created_idx on public.reviews (status, created_at desc);
create index if not exists reviews_source_idx on public.reviews (source_hash, created_at desc);

alter table public.reviews enable row level security;

-- Administrators only. There is deliberately no policy for anon or for ordinary signed-in users.
drop policy if exists "admin all" on public.reviews;
create policy "admin all" on public.reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.reviews from anon;
revoke all on public.reviews from public;

-- Stamp the moment a review is approved or rejected.
create or replace function public.reviews_stamp() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at = case when new.status = 'pending' then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists reviews_stamp on public.reviews;
create trigger reviews_stamp before update on public.reviews for each row execute function public.reviews_stamp();

-- ---------------------------------------------------------------------
-- submit_review: the only way a visitor can add a review.
-- Returns {"ok": true} or {"ok": false, "field": "...", "error": "..."}.
-- ---------------------------------------------------------------------
create or replace function public.submit_review(
  p_name    text,
  p_email   text,
  p_mobile  text,
  p_rating  integer,
  p_message text,
  p_website text default ''          -- hidden trap field: real visitors never fill it in
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name    text;
  v_email   text;
  v_mobile  text;
  v_message text;
  v_digits  text;
  v_ip      text;
  v_hash    text;
begin
  -- Spam trap: pretend it worked, save nothing.
  if coalesce(btrim(p_website), '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  -- Clean: remove control characters, trim, collapse repeated spaces in the name.
  v_name    := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[\x01-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g'));
  v_email   := lower(btrim(coalesce(p_email, '')));
  v_message := btrim(regexp_replace(coalesce(p_message, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));

  if v_name = '' then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please enter your name.');
  end if;
  if char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please keep your name to 80 characters.');
  end if;

  if v_email = '' then
    return jsonb_build_object('ok', false, 'field', 'email', 'error', 'Please enter your email address.');
  end if;
  if char_length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
     or v_email ~ '\.\.' then
    return jsonb_build_object('ok', false, 'field', 'email', 'error', 'Please enter an email address like name@example.com.');
  end if;

  -- Indian mobile: 10 digits starting 6-9, optional +91 in front. Saved as +91XXXXXXXXXX.
  v_digits := regexp_replace(coalesce(p_mobile, ''), '[\s\-()]', '', 'g');
  if v_digits = '' then
    return jsonb_build_object('ok', false, 'field', 'mobile', 'error', 'Please enter your mobile number.');
  end if;
  if v_digits ~ '^\+91[6-9][0-9]{9}$' then
    v_mobile := v_digits;
  elsif v_digits ~ '^[6-9][0-9]{9}$' then
    v_mobile := '+91' || v_digits;
  else
    return jsonb_build_object('ok', false, 'field', 'mobile', 'error', 'Please enter a valid 10-digit Indian mobile number (the +91 code is optional).');
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'field', 'rating', 'error', 'Please choose a star rating from 1 to 5.');
  end if;

  if v_message = '' then
    return jsonb_build_object('ok', false, 'field', 'message', 'error', 'Please write your review.');
  end if;
  if char_length(v_message) > 1000 then
    return jsonb_build_object('ok', false, 'field', 'message', 'error', 'Please keep your review to 1,000 characters.');
  end if;

  -- Basic abuse limits (no OTP, no CAPTCHA). The sender's address is stored only as a hash.
  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true)::json) ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_hash := case when btrim(v_ip) = '' then null else encode(digest('elix-reviews:' || btrim(v_ip), 'sha256'), 'hex') end;

  if v_hash is not null and (select count(*) from public.reviews where source_hash = v_hash and created_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'You have sent several reviews recently. Please try again later.');
  end if;
  if (select count(*) from public.reviews where (email = v_email or mobile = v_mobile) and created_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Several reviews have already been sent with these details today. Please try again tomorrow.');
  end if;
  if exists (select 1 from public.reviews where lower(message) = lower(v_message) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'This review has already been received. Thank you.');
  end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'We are receiving a lot of reviews right now. Please try again in a little while.');
  end if;

  insert into public.reviews (name, email, mobile, rating, message, status, source_hash)
  values (v_name, v_email, v_mobile, p_rating::smallint, v_message, 'pending', v_hash);

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Sorry, your review could not be saved. Please try again in a moment.');
end $$;

revoke all on function public.submit_review(text, text, text, integer, text, text) from public;
grant execute on function public.submit_review(text, text, text, integer, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- get_public_reviews: approved reviews only, newest first, public fields only.
-- ---------------------------------------------------------------------
create or replace function public.get_public_reviews(p_limit integer default 100)
returns table (id uuid, name text, rating smallint, message text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.rating, r.message, r.created_at
  from public.reviews r
  where r.status = 'approved'
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

revoke all on function public.get_public_reviews(integer) from public;
grant execute on function public.get_public_reviews(integer) to anon, authenticated;
