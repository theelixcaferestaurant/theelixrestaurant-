-- =====================================================================
-- THE ELIX: simple reviews (NO email code, NO SMS code, NO Edge Functions)
-- Run once in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0006. Safe to re-run.
-- Nothing is deleted. Existing reviews stay exactly as they are.
--
--   * A visitor sends only: name, star rating, review text.
--   * The review is ALWAYS saved as 'pending'. It appears on the website only after the administrator
--     approves it in /admin (the admin dashboard and its login are unchanged).
--   * The public (anon) key can call only submit_review() and get_public_reviews(). The reviews table itself
--     is still locked by Row Level Security.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Email and mobile are no longer collected, so they may be empty for new reviews.
alter table public.reviews alter column email  drop not null;
alter table public.reviews alter column mobile drop not null;

-- Allow a third verification state for reviews sent without any verification.
alter table public.reviews drop constraint if exists reviews_verification_status_check;
alter table public.reviews add constraint reviews_verification_status_check
  check (verification_status in ('legacy_unverified', 'verified', 'unverified'));

create or replace function public.submit_review(
  p_name    text,
  p_rating  integer,
  p_message text,
  p_website text default ''          -- hidden trap field: real visitors never fill it in
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name    text;
  v_message text;
  v_ip      text;
  v_hash    text;
begin
  -- Spam trap: pretend it worked, save nothing.
  if coalesce(btrim(p_website), '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  v_name    := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[\x01-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g'));
  v_message := btrim(regexp_replace(coalesce(p_message, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));

  if v_name = '' then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please enter your name.');
  end if;
  if char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'field', 'name', 'error', 'Please keep your name to 80 characters.');
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
  if exists (select 1 from public.reviews where lower(message) = lower(v_message) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'This review has already been received. Thank you.');
  end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'field', 'form', 'error', 'We are receiving a lot of reviews right now. Please try again in a little while.');
  end if;

  insert into public.reviews (name, email, mobile, rating, message, status, source_hash, verification_status)
  values (v_name, null, null, p_rating::smallint, v_message, 'pending', v_hash, 'unverified');

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'field', 'form', 'error', 'Sorry, your review could not be saved. Please try again in a moment.');
end $$;

revoke all on function public.submit_review(text, integer, text, text) from public;
grant execute on function public.submit_review(text, integer, text, text) to anon, authenticated;
