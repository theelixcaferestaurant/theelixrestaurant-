-- =====================================================================
-- THE ELIX: verified customer reviews (email OTP + mobile SMS OTP)
-- Run once in: Supabase Dashboard > SQL Editor > New query, AFTER 0001 and 0005. Safe to re-run.
-- Nothing is deleted: existing reviews keep every column and stay exactly as they were
-- (they are marked 'legacy_unverified'; approved ones remain public).
--
-- Security model
--   * Visitors can NO LONGER call submit_review(). It is dropped. The only way a review can be created is the
--     Edge Function "review-submit", which uses the service-role key (a server secret) to call
--     review_submit_verified(). That function is executable by service_role only.
--   * OTP codes are never readable by visitors: review_otps and review_verifications have RLS on, no policies,
--     and all privileges revoked from anon/authenticated.
--   * review_submit_verified() re-checks, inside ONE transaction, that a valid, unexpired, unused verification
--     exists for EXACTLY the submitted email and for EXACTLY the submitted mobile, then saves the review and burns
--     both verifications. A forged, reused, expired or mismatched token is refused by the database itself.
--   * Public display is unchanged: get_public_reviews() returns approved reviews only, public fields only.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. reviews: additive columns only (existing rows are preserved)
-- ---------------------------------------------------------------------
alter table public.reviews add column if not exists email_verified_at  timestamptz;
alter table public.reviews add column if not exists mobile_verified_at timestamptz;
alter table public.reviews add column if not exists verification_status text not null default 'legacy_unverified';
alter table public.reviews add column if not exists client_submission_id uuid;   -- makes a retried submit idempotent

alter table public.reviews drop constraint if exists reviews_verification_status_check;
alter table public.reviews add constraint reviews_verification_status_check
  check (verification_status in ('legacy_unverified', 'verified', 'unverified'));

-- A review marked 'verified' must carry proof of both verifications.
alter table public.reviews drop constraint if exists reviews_verified_has_proof;
alter table public.reviews add constraint reviews_verified_has_proof
  check (verification_status <> 'verified' or (email_verified_at is not null and mobile_verified_at is not null));

-- Duplicate protection enforced by the database itself.
create unique index if not exists reviews_client_submission_uidx
  on public.reviews (client_submission_id) where client_submission_id is not null;
create unique index if not exists reviews_verified_same_text_uidx
  on public.reviews (email, md5(lower(message))) where verification_status = 'verified';

-- ---------------------------------------------------------------------
-- 2. OTP sessions and verification tokens (server-only tables)
-- ---------------------------------------------------------------------
create table if not exists public.review_otps (
  id            uuid primary key default gen_random_uuid(),
  channel       text        not null check (channel in ('email', 'mobile')),
  target        text        not null,                 -- normalised email, or +91XXXXXXXXXX
  code_hash     text,                                 -- HMAC of the code (email). NULL for mobile: the SMS provider holds that code.
  ip_hash       text,                                 -- one-way hash, for rate limiting only
  attempts      smallint    not null default 0,
  max_attempts  smallint    not null default 5,
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  superseded_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists review_otps_target_idx on public.review_otps (channel, target, created_at desc);
create index if not exists review_otps_ip_idx     on public.review_otps (ip_hash, created_at desc);

create table if not exists public.review_verifications (
  id          uuid primary key default gen_random_uuid(),
  channel     text        not null check (channel in ('email', 'mobile')),
  target      text        not null,
  token_hash  text        not null unique,            -- SHA-256 of the token; the token itself is never stored
  otp_id      uuid,
  verified_at timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  review_id   uuid
);
create index if not exists review_verifications_target_idx on public.review_verifications (channel, target);

alter table public.review_otps          enable row level security;
alter table public.review_verifications enable row level security;
-- Deliberately NO policies: only the service role (Edge Functions) can touch these tables.
revoke all on public.review_otps          from anon, authenticated, public;
revoke all on public.review_verifications from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- 3. review_otp_issue: create a new OTP session (rate limits + cooldown enforced here)
-- ---------------------------------------------------------------------
create or replace function public.review_otp_issue(
  p_channel text, p_target text, p_code_hash text, p_ip_hash text, p_ttl_seconds integer default 600
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_last   timestamptz;
  v_n      integer;
  v_oldest timestamptz;
  v_id     uuid;
  v_exp    timestamptz;
begin
  if p_channel not in ('email', 'mobile') then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if p_channel = 'email' and (char_length(p_target) > 254 or p_target !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' or p_target ~ '\.\.') then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  if p_channel = 'mobile' and p_target !~ '^\+91[6-9][0-9]{9}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtext('review-otp:' || p_channel || ':' || p_target));

  -- housekeeping: remove old OTP sessions and spent/expired tokens
  delete from public.review_otps where created_at < now() - interval '2 days';
  delete from public.review_verifications where expires_at < now() - interval '1 day';

  -- resend cooldown: 60 seconds between codes to the same address
  select max(created_at) into v_last from public.review_otps where channel = p_channel and target = p_target;
  if v_last is not null and v_last > now() - interval '60 seconds' then
    return jsonb_build_object('ok', false, 'code', 'cooldown',
      'retry_after', greatest(1, ceil(extract(epoch from (v_last + interval '60 seconds' - now())))::int));
  end if;

  -- at most 5 codes per hour to one address
  select count(*), min(created_at) into v_n, v_oldest
  from public.review_otps where channel = p_channel and target = p_target and created_at > now() - interval '1 hour';
  if v_n >= 5 then
    return jsonb_build_object('ok', false, 'code', 'too_many',
      'retry_after', greatest(60, ceil(extract(epoch from (v_oldest + interval '1 hour' - now())))::int));
  end if;

  -- at most 10 SMS to one number per day
  if p_channel = 'mobile' then
    select count(*) into v_n from public.review_otps where channel = 'mobile' and target = p_target and created_at > now() - interval '1 day';
    if v_n >= 10 then
      return jsonb_build_object('ok', false, 'code', 'too_many', 'retry_after', 3600);
    end if;
  end if;

  -- per network address: 15 emails or 5 SMS per hour (protects your SMS bill from abuse)
  if p_ip_hash is not null then
    select count(*) into v_n from public.review_otps
    where ip_hash = p_ip_hash and channel = p_channel and created_at > now() - interval '1 hour';
    if v_n >= 15 or (p_channel = 'mobile' and v_n >= 5) then
      return jsonb_build_object('ok', false, 'code', 'too_many', 'retry_after', 900);
    end if;
  end if;

  -- global ceiling on SMS per day (cost protection)
  if p_channel = 'mobile' then
    select count(*) into v_n from public.review_otps where channel = 'mobile' and created_at > now() - interval '1 day';
    if v_n >= 300 then
      return jsonb_build_object('ok', false, 'code', 'busy', 'retry_after', 3600);
    end if;
  end if;

  -- a new code replaces any earlier unused one
  update public.review_otps set superseded_at = now()
  where channel = p_channel and target = p_target and consumed_at is null and superseded_at is null;

  v_exp := now() + make_interval(secs => greatest(60, least(coalesce(p_ttl_seconds, 600), 900)));
  insert into public.review_otps (channel, target, code_hash, ip_hash, expires_at)
  values (p_channel, p_target, p_code_hash, p_ip_hash, v_exp)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'expires_at', v_exp);
end $$;

-- If the email/SMS could not be delivered, the session is removed so the customer can retry at once.
create or replace function public.review_otp_void(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.review_otps where id = p_id and consumed_at is null;
$$;

-- ---------------------------------------------------------------------
-- 4. review_otp_attempt: count one verification attempt (BEFORE the code is checked)
-- ---------------------------------------------------------------------
create or replace function public.review_otp_attempt(p_channel text, p_target text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.review_otps;
begin
  perform pg_advisory_xact_lock(hashtext('review-otp:' || p_channel || ':' || p_target));

  select * into r from public.review_otps
  where channel = p_channel and target = p_target and consumed_at is null and superseded_at is null
  order by created_at desc limit 1 for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_code');
  end if;
  if r.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if r.attempts >= r.max_attempts then
    return jsonb_build_object('ok', false, 'code', 'locked');
  end if;

  update public.review_otps set attempts = attempts + 1 where id = r.id;
  return jsonb_build_object('ok', true, 'id', r.id, 'code_hash', r.code_hash,
                            'attempts_left', r.max_attempts - r.attempts - 1);
end $$;

-- ---------------------------------------------------------------------
-- 5. review_otp_succeed: burn the OTP and mint a short-lived token bound to this exact address
-- ---------------------------------------------------------------------
create or replace function public.review_otp_succeed(p_otp_id uuid, p_token_hash text, p_ttl_seconds integer default 1800)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r   public.review_otps;
  v_exp timestamptz;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  -- single use: only one caller can flip consumed_at from NULL
  update public.review_otps set consumed_at = now()
  where id = p_otp_id and consumed_at is null and superseded_at is null and expires_at > now()
  returning * into r;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  -- earlier unused tokens for this address stop working
  update public.review_verifications set used_at = now()
  where channel = r.channel and target = r.target and used_at is null;

  v_exp := now() + make_interval(secs => greatest(300, least(coalesce(p_ttl_seconds, 1800), 3600)));
  insert into public.review_verifications (channel, target, token_hash, otp_id, expires_at)
  values (r.channel, r.target, p_token_hash, r.id, v_exp);

  return jsonb_build_object('ok', true, 'expires_at', v_exp);
end $$;

-- ---------------------------------------------------------------------
-- 6. review_submit_verified: the ONLY way a customer review is created
-- ---------------------------------------------------------------------
create or replace function public.review_submit_verified(
  p_name text, p_email text, p_mobile text, p_rating integer, p_message text,
  p_email_token_hash text, p_mobile_token_hash text, p_submission_id uuid, p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name    text;
  v_email   text;
  v_mobile  text;
  v_message text;
  v_digits  text;
  ve        public.review_verifications;
  vm        public.review_verifications;
  ex        public.reviews;
  v_id      uuid;
begin
  v_name    := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[\x01-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g'));
  v_email   := lower(btrim(coalesce(p_email, '')));
  v_message := btrim(regexp_replace(coalesce(p_message, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));

  if v_name = '' then
    return jsonb_build_object('ok', false, 'field', 'name', 'code', 'invalid', 'error', 'Please enter your name.');
  end if;
  if char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'field', 'name', 'code', 'invalid', 'error', 'Please keep your name to 80 characters.');
  end if;
  if v_email = '' or char_length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' or v_email ~ '\.\.' then
    return jsonb_build_object('ok', false, 'field', 'email', 'code', 'invalid', 'error', 'Please enter an email address like name@example.com.');
  end if;
  v_digits := regexp_replace(coalesce(p_mobile, ''), '[\s\-()]', '', 'g');
  if v_digits ~ '^\+91[6-9][0-9]{9}$' then
    v_mobile := v_digits;
  elsif v_digits ~ '^[6-9][0-9]{9}$' then
    v_mobile := '+91' || v_digits;
  else
    return jsonb_build_object('ok', false, 'field', 'mobile', 'code', 'invalid', 'error', 'Please enter a valid 10-digit Indian mobile number (the +91 code is optional).');
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'field', 'rating', 'code', 'invalid', 'error', 'Please choose a star rating from 1 to 5.');
  end if;
  if v_message = '' then
    return jsonb_build_object('ok', false, 'field', 'message', 'code', 'invalid', 'error', 'Please write your review.');
  end if;
  if char_length(v_message) > 1000 then
    return jsonb_build_object('ok', false, 'field', 'message', 'code', 'invalid', 'error', 'Please keep your review to 1,000 characters.');
  end if;

  perform pg_advisory_xact_lock(hashtext('review-submit:' || v_email));

  -- Retried request (e.g. the network dropped after the review was saved): report the saved review, never duplicate it.
  if p_submission_id is not null then
    select * into ex from public.reviews where client_submission_id = p_submission_id;
    if found then
      if ex.email = v_email and ex.mobile = v_mobile then
        return jsonb_build_object('ok', true, 'id', ex.id, 'duplicate', true);
      end if;
      return jsonb_build_object('ok', false, 'field', 'form', 'code', 'invalid', 'error', 'This submission could not be processed. Please reload the page and try again.');
    end if;
  end if;

  -- Both verifications must exist, belong to EXACTLY these contact details, be unexpired and unused.
  select * into ve from public.review_verifications
  where token_hash = coalesce(p_email_token_hash, '') and channel = 'email' for update;
  if not found or ve.target <> v_email or ve.used_at is not null or ve.expires_at <= now() then
    return jsonb_build_object('ok', false, 'field', 'email', 'code', 'email_not_verified',
      'error', 'Your email address is not verified (or the verification has expired). Please verify it again.');
  end if;
  select * into vm from public.review_verifications
  where token_hash = coalesce(p_mobile_token_hash, '') and channel = 'mobile' for update;
  if not found or vm.target <> v_mobile or vm.used_at is not null or vm.expires_at <= now() then
    return jsonb_build_object('ok', false, 'field', 'mobile', 'code', 'mobile_not_verified',
      'error', 'Your mobile number is not verified (or the verification has expired). Please verify it again.');
  end if;

  -- Abuse limits
  if p_ip_hash is not null and (select count(*) from public.reviews where source_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'rate_limited', 'error', 'You have sent several reviews recently. Please try again later.');
  end if;
  if (select count(*) from public.reviews where (email = v_email or mobile = v_mobile) and created_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'rate_limited', 'error', 'Several reviews have already been sent with these details today. Please try again tomorrow.');
  end if;
  if exists (select 1 from public.reviews where lower(message) = lower(v_message) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'duplicate', 'error', 'This review has already been received. Thank you.');
  end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'busy', 'error', 'We are receiving a lot of reviews right now. Please try again in a little while.');
  end if;

  insert into public.reviews (name, email, mobile, rating, message, status, source_hash,
                              email_verified_at, mobile_verified_at, verification_status, client_submission_id)
  values (v_name, v_email, v_mobile, p_rating::smallint, v_message, 'pending', p_ip_hash,
          ve.verified_at, vm.verified_at, 'verified', p_submission_id)
  returning id into v_id;

  -- Burn both verifications: they can never be used for a second review.
  update public.review_verifications set used_at = now(), review_id = v_id where id in (ve.id, vm.id);

  return jsonb_build_object('ok', true, 'id', v_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'duplicate', 'error', 'This review has already been received. Thank you.');
  when others then
    raise log 'review_submit_verified failed: % %', sqlstate, sqlerrm;
    return jsonb_build_object('ok', false, 'field', 'form', 'code', 'server', 'error', 'Sorry, your review could not be saved. Please try again in a moment.');
end $$;

-- ---------------------------------------------------------------------
-- 7. Lock the doors: server-only functions, and the old unverified entry point is removed
-- ---------------------------------------------------------------------
drop function if exists public.submit_review(text, text, text, integer, text, text);

revoke all on function public.review_otp_issue(text, text, text, text, integer)           from public, anon, authenticated;
revoke all on function public.review_otp_void(uuid)                                       from public, anon, authenticated;
revoke all on function public.review_otp_attempt(text, text)                              from public, anon, authenticated;
revoke all on function public.review_otp_succeed(uuid, text, integer)                     from public, anon, authenticated;
revoke all on function public.review_submit_verified(text, text, text, integer, text, text, text, uuid, text)
                                                                                          from public, anon, authenticated;
grant execute on function public.review_otp_issue(text, text, text, text, integer)        to service_role;
grant execute on function public.review_otp_void(uuid)                                    to service_role;
grant execute on function public.review_otp_attempt(text, text)                           to service_role;
grant execute on function public.review_otp_succeed(uuid, text, integer)                  to service_role;
grant execute on function public.review_submit_verified(text, text, text, integer, text, text, text, uuid, text)
                                                                                          to service_role;

-- Public read stays exactly as in 0005 (approved only; name, rating, message, date). Re-asserted for safety.
revoke all on public.reviews from anon;
revoke all on function public.get_public_reviews(integer) from public;
grant execute on function public.get_public_reviews(integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Realtime: tell open public pages "approved reviews changed" WITHOUT sending any review data.
--    (Putting the reviews table itself in the realtime publication would stream email/mobile to subscribers.)
--    The page receives a content-free ping on the public channel 'public-reviews' and re-fetches via get_public_reviews().
-- ---------------------------------------------------------------------
create or replace function public.reviews_notify_public() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.status = 'approved')
     or (tg_op = 'UPDATE' and (old.status = 'approved' or new.status = 'approved'))
     or (tg_op = 'DELETE' and old.status = 'approved') then
    begin
      perform realtime.send(jsonb_build_object('changed_at', now()), 'reviews_changed', 'public-reviews', false);
    exception when others then
      null;   -- never block a moderation action because the realtime ping failed
    end;
  end if;
  return null;
end $$;
revoke all on function public.reviews_notify_public() from public, anon, authenticated;

drop trigger if exists reviews_notify_public on public.reviews;
create trigger reviews_notify_public after insert or update or delete on public.reviews
  for each row execute function public.reviews_notify_public();
