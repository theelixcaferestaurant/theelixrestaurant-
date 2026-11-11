-- =====================================================================
-- THE ELIX: review form with Name, Email, Phone (optional), Rating and Review. No verification codes.
-- Run once in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0007. Safe to re-run.
-- Nothing is deleted. Existing reviews stay exactly as they are.
--
--   * Every review is saved as 'pending'. It shows on the website only after the administrator approves it in /admin.
--   * Visitors can call only submit_review() and get_public_reviews(). Email and phone are never public.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Phone is optional and may be any normal phone number (7-15 digits, optional leading +).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reviews'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%mobile%' and pg_get_constraintdef(oid) ilike '%91%'
  loop
    execute format('alter table public.reviews drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.reviews drop constraint if exists reviews_mobile_format;
alter table public.reviews add constraint reviews_mobile_format
  check (mobile is null or mobile ~ '^\+?[0-9]{7,15}$');

alter table public.reviews alter column email  drop not null;
alter table public.reviews alter column mobile drop not null;

alter table public.reviews drop constraint if exists reviews_verification_status_check;
alter table public.reviews add constraint reviews_verification_status_check
  check (verification_status in ('legacy_unverified', 'verified', 'unverified'));

-- Replace the name-only function from 0007.
drop function if exists public.submit_review(text, integer, text, text);

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

  -- Phone is optional. A 10-digit Indian number gets +91 in front.
  v_digits := regexp_replace(coalesce(p_mobile, ''), '[\s\-().]', '', 'g');
  if v_digits = '' then
    v_mobile := null;
  elsif v_digits ~ '^[6-9][0-9]{9}$' then
    v_mobile := '+91' || v_digits;
  elsif v_digits ~ '^\+?[0-9]{7,15}$' then
    v_mobile := v_digits;
  else
    return jsonb_build_object('ok', false, 'field', 'mobile', 'error', 'Please enter a valid phone number, or leave it empty.');
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

  -- Basic abuse limits. The sender's network address is stored only as a one-way hash.
  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true)::json) ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_hash := case when btrim(v_ip) = '' then null else encode(digest('elix-reviews:' || btrim(v_ip), 'sha256'), 'hex') end;

  if v_hash is not null and (select count(*) from public.reviews where source_hash = v_hash and created_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'You have sent several reviews recently. Please try again later.');
  end if;
  if (select count(*) from public.reviews where (email = v_email or (v_mobile is not null and mobile = v_mobile)) and created_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Several reviews have already been sent with these details today. Please try again tomorrow.');
  end if;
  if exists (select 1 from public.reviews where lower(message) = lower(v_message) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'This review has already been received. Thank you.');
  end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'We are receiving a lot of reviews right now. Please try again in a little while.');
  end if;

  insert into public.reviews (name, email, mobile, rating, message, status, source_hash, verification_status)
  values (v_name, v_email, v_mobile, p_rating::smallint, v_message, 'pending', v_hash, 'unverified');

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Sorry, your review could not be saved. Please try again in a moment.');
end $$;

revoke all on function public.submit_review(text, text, text, integer, text, text) from public;
grant execute on function public.submit_review(text, text, text, integer, text, text) to anon, authenticated;
