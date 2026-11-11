-- SUPERSEDED by verify_reviews_otp.sql. This tests the old unverified submit_review() that migration 0006 removes; running it after 0006 will FAIL by design.
-- THE ELIX: check the customer review system. Run in Supabase Dashboard > SQL Editor after 0005_customer_reviews.sql.
-- It acts as an anonymous visitor, then rolls EVERYTHING back (no test review is kept). Every row must say PASS.
begin;

create temp table _t (n serial, test text, result text);
grant all on _t to anon, authenticated;
grant usage on sequence _t_n_seq to anon, authenticated;

set local role anon;

do $$
declare
  r jsonb;
  c int;
  ok text := 'PASS';
  bad text := 'FAIL';
  good_msg text := 'Lovely biryani and warm service.';
begin
  -- 1. valid review is accepted
  r := public.submit_review('Asha Rao', 'asha@example.com', '98765 43210', 5, good_msg, '');
  insert into _t(test, result) values ('valid review accepted', case when (r->>'ok')::boolean then ok else bad end);

  -- 2. rejected inputs
  r := public.submit_review('   ', 'asha@example.com', '9876543210', 5, 'x one', '');
  insert into _t(test, result) values ('whitespace-only name rejected', case when not (r->>'ok')::boolean and r->>'field' = 'name' then ok else bad end);
  r := public.submit_review('Asha', 'not-an-email', '9876543210', 5, 'x two', '');
  insert into _t(test, result) values ('invalid email rejected', case when not (r->>'ok')::boolean and r->>'field' = 'email' then ok else bad end);
  r := public.submit_review('Asha', 'a@b', '9876543210', 5, 'x three', '');
  insert into _t(test, result) values ('email without a domain ending rejected', case when not (r->>'ok')::boolean and r->>'field' = 'email' then ok else bad end);
  r := public.submit_review('Asha', 'asha@example.com', '12345', 5, 'x four', '');
  insert into _t(test, result) values ('short mobile rejected', case when not (r->>'ok')::boolean and r->>'field' = 'mobile' then ok else bad end);
  r := public.submit_review('Asha', 'asha@example.com', '5876543210', 5, 'x five', '');
  insert into _t(test, result) values ('mobile starting with 5 rejected', case when not (r->>'ok')::boolean and r->>'field' = 'mobile' then ok else bad end);
  r := public.submit_review('Asha', 'asha@example.com', '+91 87654 32109', 0, 'x six', '');
  insert into _t(test, result) values ('rating 0 rejected', case when not (r->>'ok')::boolean and r->>'field' = 'rating' then ok else bad end);
  r := public.submit_review('Asha', 'asha@example.com', '+91 87654 32109', 6, 'x seven', '');
  insert into _t(test, result) values ('rating 6 rejected', case when not (r->>'ok')::boolean and r->>'field' = 'rating' then ok else bad end);
  r := public.submit_review('Asha', 'asha@example.com', '+91 87654 32109', 4, '   ', '');
  insert into _t(test, result) values ('whitespace-only review rejected', case when not (r->>'ok')::boolean and r->>'field' = 'message' then ok else bad end);
  r := public.submit_review('Asha', 'asha@example.com', '+91 87654 32109', 4, repeat('a', 1001), '');
  insert into _t(test, result) values ('1,001-character review rejected', case when not (r->>'ok')::boolean and r->>'field' = 'message' then ok else bad end);

  -- 3. +91 number accepted and normalised (checked later as admin)
  r := public.submit_review('Ravi', 'ravi@example.com', '+91 87654 32109', 4, 'Good chai.', '');
  insert into _t(test, result) values ('+91 mobile accepted', case when (r->>'ok')::boolean then ok else bad end);

  -- 4. spam trap saves nothing
  r := public.submit_review('Bot', 'bot@example.com', '9876543210', 5, 'Buy now', 'http://spam');
  insert into _t(test, result) values ('hidden spam field: reported ok but saved nothing (checked later)', case when (r->>'ok')::boolean then ok else bad end);

  -- 5. repeat limit: a 4th review with the same email within a day is refused
  perform public.submit_review('Meena', 'meena@example.com', '9123456780', 5, 'Review one', '');
  perform public.submit_review('Meena', 'meena@example.com', '9123456780', 5, 'Review two', '');
  perform public.submit_review('Meena', 'meena@example.com', '9123456780', 5, 'Review three', '');
  r := public.submit_review('Meena', 'meena@example.com', '9123456780', 5, 'Review four', '');
  insert into _t(test, result) values ('4th review from one email in a day refused', case when not (r->>'ok')::boolean and r->>'field' = 'form' then ok else bad end);

  -- 6. a visitor cannot read the table or see pending reviews
  begin
    execute 'select count(*) from public.reviews' into c;
    insert into _t(test, result) values ('visitor cannot read the reviews table directly', case when c = 0 then ok else bad end);
  exception when insufficient_privilege then
    insert into _t(test, result) values ('visitor cannot read the reviews table directly', ok);
  end;
  begin
    execute 'delete from public.reviews';
    insert into _t(test, result) values ('visitor cannot delete reviews', ok || ' (0 rows affected)');
  exception when insufficient_privilege then
    insert into _t(test, result) values ('visitor cannot delete reviews', ok);
  end;
  select count(*) into c from public.get_public_reviews(100);
  insert into _t(test, result) values ('pending reviews are not public', case when c = 0 then ok else bad end);
end $$;

reset role;

do $$
declare
  c int;
  m text;
  ok text := 'PASS';
  bad text := 'FAIL';
begin
  select count(*) into c from public.reviews where status = 'pending' and name = 'Asha Rao';
  insert into _t(test, result) values ('new review saved with PENDING status', case when c = 1 then ok else bad end);
  select mobile into m from public.reviews where name = 'Ravi';
  insert into _t(test, result) values ('mobile normalised to +91XXXXXXXXXX', case when m = '+918765432109' then ok else bad end);
  select count(*) into c from public.reviews where name = 'Bot';
  insert into _t(test, result) values ('spam-trap submission was not saved', case when c = 0 then ok else bad end);

  update public.reviews set status = 'approved' where name = 'Asha Rao';
end $$;

set local role anon;
do $$
declare
  c int;
  ok text := 'PASS';
  bad text := 'FAIL';
begin
  select count(*) into c from public.get_public_reviews(100);
  insert into _t(test, result) values ('approved review becomes public', case when c = 1 then ok else bad end);
  insert into _t(test, result) values ('public result has no email or mobile columns',
    case when not exists (
      select 1 from pg_proc p, unnest(p.proargnames) as n
      where p.proname = 'get_public_reviews' and n in ('email', 'mobile', 'source_hash')
    ) then ok else bad end);
end $$;
reset role;

select test, result from _t order by n;
rollback;
