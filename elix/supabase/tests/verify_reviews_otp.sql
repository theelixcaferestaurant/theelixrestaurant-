-- THE ELIX: database tests for the verified review system. Run in Supabase Dashboard > SQL Editor AFTER 0006_review_verification.sql.
-- Everything is rolled back at the end (no test data is kept). Every row must say PASS.
-- Covers the database half only. The email/SMS providers and Edge Functions need the live checks in REVIEWS-SETUP.md section 9.
begin;

create temp table _t (n serial, test text, result text);
grant all on _t to anon, authenticated, service_role;
grant usage on sequence _t_n_seq to anon, authenticated, service_role;

-- helper: run a full OTP cycle for a contact and leave a valid token (hash given) behind
create or replace function pg_temp.verify_contact(p_channel text, p_target text, p_hash text) returns void language plpgsql as $$
declare a jsonb;
begin
  update public.review_otps set created_at = created_at - interval '5 minutes' where channel = p_channel and target = p_target; -- skip the 60s cooldown (now() is frozen inside a transaction)
  perform public.review_otp_issue(p_channel, p_target, 'deadbeef', null, 600);
  a := public.review_otp_attempt(p_channel, p_target);
  perform public.review_otp_succeed((a->>'id')::uuid, p_hash, 1800);
end $$;
grant execute on function pg_temp.verify_contact(text, text, text) to public;

-- ===== A. visitors (anon) have no way in =====
set local role anon;
do $$
declare r jsonb; c int;
begin
  begin perform public.review_submit_verified('A','a@example.com','9876543210',5,'x', repeat('a',64), repeat('b',64), null, null);
        insert into _t(test,result) values ('anon cannot call review_submit_verified','FAIL');
  exception when insufficient_privilege then insert into _t(test,result) values ('anon cannot call review_submit_verified','PASS'); end;
  begin perform public.review_otp_issue('email','a@example.com','x',null,600);
        insert into _t(test,result) values ('anon cannot call review_otp_issue','FAIL');
  exception when insufficient_privilege then insert into _t(test,result) values ('anon cannot call review_otp_issue','PASS'); end;
  begin perform public.review_otp_attempt('email','a@example.com');
        insert into _t(test,result) values ('anon cannot call review_otp_attempt','FAIL');
  exception when insufficient_privilege then insert into _t(test,result) values ('anon cannot call review_otp_attempt','PASS'); end;
  begin perform public.review_otp_succeed(gen_random_uuid(), repeat('c',64), 1800);
        insert into _t(test,result) values ('anon cannot call review_otp_succeed','FAIL');
  exception when insufficient_privilege then insert into _t(test,result) values ('anon cannot call review_otp_succeed','PASS'); end;
  begin execute 'select count(*) from public.review_otps' into c;
        insert into _t(test,result) values ('anon cannot read OTP table','FAIL');
  exception when insufficient_privilege then insert into _t(test,result) values ('anon cannot read OTP table','PASS'); end;
  begin execute 'select count(*) from public.review_verifications' into c;
        insert into _t(test,result) values ('anon cannot read verification tokens','FAIL');
  exception when insufficient_privilege then insert into _t(test,result) values ('anon cannot read verification tokens','PASS'); end;
  begin execute 'select count(*) from public.reviews' into c;
        insert into _t(test,result) values ('anon cannot read reviews table', case when c = 0 then 'PASS' else 'FAIL' end);
  exception when insufficient_privilege then insert into _t(test,result) values ('anon cannot read reviews table','PASS'); end;
  begin execute $q$insert into public.reviews(name,email,mobile,rating,message) values ('X','x@example.com','+919876543210',5,'direct insert')$q$;
        insert into _t(test,result) values ('anon cannot insert directly into reviews','FAIL');
  exception when insufficient_privilege then insert into _t(test,result) values ('anon cannot insert directly into reviews','PASS'); end;
  begin execute 'update public.reviews set status = ''approved''';
        insert into _t(test,result) values ('anon cannot approve reviews','PASS (0 rows)');
  exception when insufficient_privilege then insert into _t(test,result) values ('anon cannot approve reviews','PASS'); end;
end $$;
reset role;

insert into _t(test,result) values ('old unverified submit_review() no longer exists',
  case when to_regprocedure('public.submit_review(text,text,text,integer,text,text)') is null then 'PASS' else 'FAIL' end);

-- ===== B. OTP rules (server role) =====
set local role service_role;
do $$
declare r jsonb; i int; id1 uuid; n int;
begin
  r := public.review_otp_issue('email','otp1@example.com','h1',null,600);
  insert into _t(test,result) values ('email OTP issued', case when (r->>'ok')::boolean then 'PASS' else 'FAIL' end);
  r := public.review_otp_issue('email','otp1@example.com','h2',null,600);
  insert into _t(test,result) values ('immediate resend refused (cooldown)', case when not (r->>'ok')::boolean and r->>'code'='cooldown' then 'PASS' else 'FAIL' end);
  r := public.review_otp_issue('email','not-an-email','h',null,600);
  insert into _t(test,result) values ('invalid email target refused', case when not (r->>'ok')::boolean then 'PASS' else 'FAIL' end);
  r := public.review_otp_issue('mobile','12345','h',null,600);
  insert into _t(test,result) values ('invalid mobile target refused', case when not (r->>'ok')::boolean then 'PASS' else 'FAIL' end);
  r := public.review_otp_issue('mobile','+915876543210','h',null,600);
  insert into _t(test,result) values ('mobile starting with 5 refused', case when not (r->>'ok')::boolean then 'PASS' else 'FAIL' end);
  r := public.review_otp_issue('mobile','+919876543210',null,null,600);
  insert into _t(test,result) values ('mobile OTP session issued', case when (r->>'ok')::boolean then 'PASS' else 'FAIL' end);

  -- wrong attempts are limited to 5, then locked
  for i in 1..5 loop r := public.review_otp_attempt('email','otp1@example.com'); end loop;
  insert into _t(test,result) values ('5 attempts allowed', case when (r->>'ok')::boolean and (r->>'attempts_left')::int = 0 then 'PASS' else 'FAIL' end);
  r := public.review_otp_attempt('email','otp1@example.com');
  insert into _t(test,result) values ('6th attempt locked out', case when not (r->>'ok')::boolean and r->>'code'='locked' then 'PASS' else 'FAIL' end);

  -- unknown address
  r := public.review_otp_attempt('email','nobody@example.com');
  insert into _t(test,result) values ('verify without a code refused', case when r->>'code'='no_code' then 'PASS' else 'FAIL' end);
end $$;
reset role;

do $$
declare r jsonb; a jsonb; i int;
begin
  -- expired OTP
  update public.review_otps set created_at = created_at - interval '5 minutes' where target = 'exp@example.com';
  perform public.review_otp_issue('email','exp@example.com','hx',null,600);
  update public.review_otps set expires_at = now() - interval '1 second' where target = 'exp@example.com';
  r := public.review_otp_attempt('email','exp@example.com');
  insert into _t(test,result) values ('expired OTP refused', case when r->>'code'='expired' then 'PASS' else 'FAIL' end);

  -- OTP can be consumed only once
  perform public.review_otp_issue('email','once@example.com','hy',null,600);
  a := public.review_otp_attempt('email','once@example.com');
  r := public.review_otp_succeed((a->>'id')::uuid, repeat('d',64), 1800);
  insert into _t(test,result) values ('correct OTP yields a token', case when (r->>'ok')::boolean then 'PASS' else 'FAIL' end);
  r := public.review_otp_succeed((a->>'id')::uuid, repeat('e',64), 1800);
  insert into _t(test,result) values ('OTP cannot be reused', case when not (r->>'ok')::boolean then 'PASS' else 'FAIL' end);

  -- a new code replaces the older one
  update public.review_otps set created_at = created_at - interval '5 minutes' where target = 'sup@example.com';
  perform public.review_otp_issue('email','sup@example.com','old',null,600);
  update public.review_otps set created_at = created_at - interval '5 minutes' where target = 'sup@example.com';
  perform public.review_otp_issue('email','sup@example.com','new',null,600);
  a := public.review_otp_attempt('email','sup@example.com');
  insert into _t(test,result) values ('resend invalidates the earlier code', case when a->>'code_hash'='new' then 'PASS' else 'FAIL' end);

  -- per-IP SMS ceiling (5 per hour)
  for i in 1..6 loop
    update public.review_otps set created_at = created_at - interval '5 minutes' where target = '+9187654321' || (10 + i)::text;
    r := public.review_otp_issue('mobile', '+9187654321' || (10 + i)::text, null, 'iphash-test', 600);
  end loop;
  insert into _t(test,result) values ('6th SMS from one network address refused', case when not (r->>'ok')::boolean and r->>'code'='too_many' then 'PASS' else 'FAIL' end);
end $$;

-- ===== C. review submission needs BOTH valid verifications for EXACTLY these contacts =====
do $$
declare r jsonb; c int; v record; ok_review uuid;
begin
  -- no verification at all
  r := public.review_submit_verified('Asha Rao','asha@example.com','9876543210',5,'Lovely biryani and warm service.',null,null,null,null);
  insert into _t(test,result) values ('submit with neither verification refused', case when not (r->>'ok')::boolean and r->>'code'='email_not_verified' then 'PASS' else 'FAIL' end);

  -- email verified only
  perform pg_temp.verify_contact('email','asha@example.com',repeat('1',64));
  r := public.review_submit_verified('Asha Rao','asha@example.com','9876543210',5,'Lovely biryani and warm service.',repeat('1',64),null,null,null);
  insert into _t(test,result) values ('submit without mobile verification refused', case when not (r->>'ok')::boolean and r->>'code'='mobile_not_verified' then 'PASS' else 'FAIL' end);

  -- mobile verified only (fresh email token missing)
  perform pg_temp.verify_contact('mobile','+919876543210',repeat('2',64));
  r := public.review_submit_verified('Asha Rao','asha@example.com','9876543210',5,'Lovely biryani and warm service.',null,repeat('2',64),null,null);
  insert into _t(test,result) values ('submit without email verification refused', case when not (r->>'ok')::boolean and r->>'code'='email_not_verified' then 'PASS' else 'FAIL' end);

  -- forged token
  r := public.review_submit_verified('Asha Rao','asha@example.com','9876543210',5,'Lovely biryani and warm service.',repeat('f',64),repeat('f',64),null,null);
  insert into _t(test,result) values ('forged tokens refused', case when not (r->>'ok')::boolean then 'PASS' else 'FAIL' end);

  -- email changed after verification
  r := public.review_submit_verified('Asha Rao','other@example.com','9876543210',5,'Lovely biryani and warm service.',repeat('1',64),repeat('2',64),null,null);
  insert into _t(test,result) values ('changed email invalidates verification', case when not (r->>'ok')::boolean and r->>'code'='email_not_verified' then 'PASS' else 'FAIL' end);

  -- mobile changed after verification
  r := public.review_submit_verified('Asha Rao','asha@example.com','9123456780',5,'Lovely biryani and warm service.',repeat('1',64),repeat('2',64),null,null);
  insert into _t(test,result) values ('changed mobile invalidates verification', case when not (r->>'ok')::boolean and r->>'code'='mobile_not_verified' then 'PASS' else 'FAIL' end);

  -- token of the wrong channel (mobile token used as email token)
  r := public.review_submit_verified('Asha Rao','asha@example.com','9876543210',5,'Lovely biryani and warm service.',repeat('2',64),repeat('1',64),null,null);
  insert into _t(test,result) values ('tokens cannot be swapped between channels', case when not (r->>'ok')::boolean then 'PASS' else 'FAIL' end);

  -- validation
  r := public.review_submit_verified('   ','asha@example.com','9876543210',5,'x',repeat('1',64),repeat('2',64),null,null);
  insert into _t(test,result) values ('blank name refused', case when r->>'field'='name' then 'PASS' else 'FAIL' end);
  r := public.review_submit_verified('Asha','asha@example.com','5876543210',5,'x',repeat('1',64),repeat('2',64),null,null);
  insert into _t(test,result) values ('invalid mobile refused', case when r->>'field'='mobile' then 'PASS' else 'FAIL' end);
  r := public.review_submit_verified('Asha','asha@example.com','9876543210',6,'x',repeat('1',64),repeat('2',64),null,null);
  insert into _t(test,result) values ('rating 6 refused', case when r->>'field'='rating' then 'PASS' else 'FAIL' end);
  r := public.review_submit_verified('Asha','asha@example.com','9876543210',4,repeat('a',1001),repeat('1',64),repeat('2',64),null,null);
  insert into _t(test,result) values ('1,001-character review refused', case when r->>'field'='message' then 'PASS' else 'FAIL' end);

  -- the happy path
  r := public.review_submit_verified('Asha Rao','Asha@Example.com',' +91 98765 43210 ',5,'Lovely biryani and warm service.'||E'\n'||'Will visit again.',repeat('1',64),repeat('2',64),'11111111-1111-4111-8111-111111111111','iphash-1');
  insert into _t(test,result) values ('valid verified review accepted', case when (r->>'ok')::boolean then 'PASS' else 'FAIL: ' || r::text end);
  ok_review := (r->>'id')::uuid;

  select * into v from public.reviews where id = ok_review;
  insert into _t(test,result) values ('saved as PENDING', case when v.status='pending' then 'PASS' else 'FAIL' end);
  insert into _t(test,result) values ('saved with verification audit data', case when v.verification_status='verified' and v.email_verified_at is not null and v.mobile_verified_at is not null then 'PASS' else 'FAIL' end);
  insert into _t(test,result) values ('email lower-cased and mobile normalised', case when v.email='asha@example.com' and v.mobile='+919876543210' then 'PASS' else 'FAIL' end);
  insert into _t(test,result) values ('name and full text stored as entered', case when v.name='Asha Rao' and v.message like '%Will visit again.' then 'PASS' else 'FAIL' end);

  -- retried request after a network failure: same submission id => reported as saved, NOT duplicated
  r := public.review_submit_verified('Asha Rao','asha@example.com','9876543210',5,'Lovely biryani and warm service.'||E'\n'||'Will visit again.',repeat('1',64),repeat('2',64),'11111111-1111-4111-8111-111111111111','iphash-1');
  select count(*) into c from public.reviews where email='asha@example.com';
  insert into _t(test,result) values ('retry with same submission id is idempotent', case when (r->>'ok')::boolean and (r->>'duplicate')::boolean and c=1 then 'PASS' else 'FAIL' end);

  -- tokens are single use
  r := public.review_submit_verified('Asha Rao','asha@example.com','9876543210',4,'A different second review.',repeat('1',64),repeat('2',64),null,null);
  insert into _t(test,result) values ('verification tokens cannot be reused', case when not (r->>'ok')::boolean and r->>'code'='email_not_verified' then 'PASS' else 'FAIL' end);

  -- expired token
  perform pg_temp.verify_contact('email','late@example.com',repeat('3',64));
  perform pg_temp.verify_contact('mobile','+919123456780',repeat('4',64));
  update public.review_verifications set expires_at = now() - interval '1 second' where token_hash = repeat('3',64);
  r := public.review_submit_verified('Late','late@example.com','9123456780',4,'Expired verification review.',repeat('3',64),repeat('4',64),null,null);
  insert into _t(test,result) values ('expired verification refused', case when not (r->>'ok')::boolean and r->>'code'='email_not_verified' then 'PASS' else 'FAIL' end);

  -- identical text is refused (duplicate protection)
  perform pg_temp.verify_contact('email','dup@example.com',repeat('5',64));
  perform pg_temp.verify_contact('mobile','+919123456781',repeat('6',64));
  r := public.review_submit_verified('Dup','dup@example.com','9123456781',4,'Lovely biryani and warm service.'||E'\n'||'Will visit again.',repeat('5',64),repeat('6',64),null,null);
  insert into _t(test,result) values ('same review text from someone else refused', case when not (r->>'ok')::boolean and r->>'code'='duplicate' then 'PASS' else 'FAIL' end);

  -- a verified row without proof cannot exist
  begin
    insert into public.reviews(name,email,mobile,rating,message,verification_status) values ('X','x@example.com','+919876543210',5,'no proof','verified');
    insert into _t(test,result) values ('verified row without proof blocked by constraint','FAIL');
  exception when check_violation then insert into _t(test,result) values ('verified row without proof blocked by constraint','PASS'); end;
end $$;

-- ===== D. public visibility =====
set local role anon;
do $$
declare c int;
begin
  select count(*) into c from public.get_public_reviews(200) where name = 'Asha Rao';
  insert into _t(test,result) values ('pending review is not public', case when c=0 then 'PASS' else 'FAIL' end);
end $$;
reset role;

update public.reviews set status = 'rejected' where email = 'asha@example.com';
set local role anon;
do $$ declare c int; begin
  select count(*) into c from public.get_public_reviews(200) where name = 'Asha Rao';
  insert into _t(test,result) values ('rejected review is not public', case when c=0 then 'PASS' else 'FAIL' end);
end $$;
reset role;

update public.reviews set status = 'approved' where email = 'asha@example.com';
set local role anon;
do $$ declare c int; m text; begin
  select count(*), max(message) into c, m from public.get_public_reviews(200) where name = 'Asha Rao';
  insert into _t(test,result) values ('approved review becomes public', case when c=1 then 'PASS' else 'FAIL' end);
  insert into _t(test,result) values ('public review text is complete (not truncated)', case when m like 'Lovely biryani%Will visit again.' then 'PASS' else 'FAIL' end);
  insert into _t(test,result) values ('public result has no email or mobile columns',
    case when not exists (select 1 from pg_proc p, unnest(p.proargnames) as n where p.proname='get_public_reviews' and n in ('email','mobile','source_hash','email_verified_at','mobile_verified_at')) then 'PASS' else 'FAIL' end);
end $$;
reset role;

select test, result from _t order by n;
rollback;
