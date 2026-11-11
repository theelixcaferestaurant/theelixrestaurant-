-- =====================================================================
-- THE ELIX: backup and recovery for everything you edit in the dashboard
-- Run in: Supabase Dashboard > SQL Editor > New query, AFTER 0001-0010. Safe to re-run (changes nothing you saved).
--
--   * content_backups: saved copies ("restore points") of the menu, the Take Away slides, the gallery list,
--     restaurant details, social links and website texts. Readable only by administrators.
--   * create_content_backup / import_content_backup / restore_content_backup / ensure_daily_content_backup:
--     the ONLY way to create or restore a backup. Each checks that the caller is an administrator (public.is_admin(),
--     which also requires the second sign-in step once enforce_two_step_login.sql has been run).
--   * Every restore first saves an automatic copy of the current content, and runs as ONE transaction:
--     if anything goes wrong nothing is changed.
--
-- What a backup holds: the text and settings (rows in the database). Photos and videos are files in Storage; a backup
-- keeps their web addresses, but a file you delete in the dashboard is deleted for good. Download the backup file
-- as well (Dashboard > Backup & recovery) and keep it somewhere safe.
-- =====================================================================

create table if not exists public.content_backups (
  id               uuid primary key default gen_random_uuid(),
  label            text not null check (char_length(btrim(label)) between 1 and 120),
  kind             text not null default 'manual' check (kind in ('manual', 'auto')),
  created_at       timestamptz not null default now(),
  created_by_email text,
  item_count       int not null default 0,
  slide_count      int not null default 0,
  data             jsonb not null
);
create index if not exists content_backups_created_idx on public.content_backups (created_at desc);

alter table public.content_backups enable row level security;
drop policy if exists "admin read" on public.content_backups;
create policy "admin read" on public.content_backups for select to authenticated using (public.is_admin());
drop policy if exists "admin delete" on public.content_backups;
create policy "admin delete" on public.content_backups for delete to authenticated using (public.is_admin());
-- no insert / update policy on purpose: backups are written only by the functions below
revoke all on public.content_backups from anon;

-- ---------------------------------------------------------------------
-- Create a backup of the current content
-- ---------------------------------------------------------------------
create or replace function public.create_content_backup(p_label text default 'Backup', p_kind text default 'manual')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_data  jsonb;
  v_label text := left(btrim(coalesce(nullif(p_label, ''), 'Backup')), 120);
  v_items int;
  v_slides int;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can create a backup.' using errcode = '42501';
  end if;
  if p_kind not in ('manual', 'auto') then p_kind := 'manual'; end if;

  v_data := jsonb_build_object(
    'format',          'elix-content-backup-1',
    'created_at',      now(),
    'menu_items',      coalesce((select jsonb_agg(to_jsonb(t) order by t.category_key, t.sort_order, t.id) from public.menu_items t), '[]'::jsonb),
    'takeaway_slides', coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.created_at) from public.takeaway_slides t), '[]'::jsonb),
    'gallery_items',   coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.id) from public.gallery_items t), '[]'::jsonb),
    'restaurant_info', coalesce((select jsonb_agg(to_jsonb(t)) from public.restaurant_info t), '[]'::jsonb),
    'social_links',    coalesce((select jsonb_agg(to_jsonb(t) order by t.platform) from public.social_links t), '[]'::jsonb),
    'site_settings',   coalesce((select jsonb_agg(to_jsonb(t) order by t.key) from public.site_settings t
                                  where t.key not in ('menu_source', 'menu_seed_0010', 'takeaway_seed_0010')), '[]'::jsonb),
    -- kept for reference only (a restore never touches them)
    'categories',      coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.key) from public.categories t), '[]'::jsonb),
    'media_assets',    coalesce((select jsonb_agg(to_jsonb(t) order by t.owner_type, t.owner_id, t.kind) from public.media_assets t), '[]'::jsonb)
  );
  v_items  := jsonb_array_length(v_data -> 'menu_items');
  v_slides := jsonb_array_length(v_data -> 'takeaway_slides');

  insert into public.content_backups (label, kind, created_by_email, item_count, slide_count, data)
  values (v_label, p_kind, nullif(auth.jwt() ->> 'email', ''), v_items, v_slides, v_data)
  returning id into v_id;

  -- keep the newest 20 automatic copies; manual restore points are never removed automatically
  delete from public.content_backups
   where kind = 'auto'
     and id not in (select id from public.content_backups where kind = 'auto' order by created_at desc limit 20);

  return v_id;
end $$;

-- An automatic copy at most once a day, taken when an administrator opens the dashboard.
create or replace function public.ensure_daily_content_backup()
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can create a backup.' using errcode = '42501';
  end if;
  if exists (select 1 from public.content_backups where kind = 'auto' and created_at > now() - interval '24 hours') then
    return null;
  end if;
  return public.create_content_backup('Automatic daily copy', 'auto');
end $$;

-- Add a backup file you downloaded earlier (JSON) to the list of restore points.
create or replace function public.import_content_backup(p_label text, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id  uuid;
  v_key text;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can import a backup.' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or p_data ->> 'format' is distinct from 'elix-content-backup-1' then
    raise exception 'This file is not a The Elix backup file.';
  end if;
  foreach v_key in array array['menu_items', 'takeaway_slides', 'gallery_items', 'restaurant_info', 'social_links', 'site_settings']
  loop
    if jsonb_typeof(p_data -> v_key) is distinct from 'array' then
      raise exception 'The backup file is incomplete: section "%" is missing.', v_key;
    end if;
  end loop;

  insert into public.content_backups (label, kind, created_by_email, item_count, slide_count, data)
  values (left(btrim(coalesce(nullif(p_label, ''), 'Imported backup')), 120), 'manual', nullif(auth.jwt() ->> 'email', ''),
          jsonb_array_length(p_data -> 'menu_items'), jsonb_array_length(p_data -> 'takeaway_slides'), p_data)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Restore (internal helper + the public function)
-- Makes a table match the backup: rows in the backup are put back / corrected, rows that are not in the backup are removed.
-- ---------------------------------------------------------------------
create or replace function public._elix_sync_rows(p_table text, p_key text, p_rows jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_cols text;
begin
  if p_table not in ('menu_items', 'takeaway_slides', 'gallery_items', 'restaurant_info', 'social_links') then
    raise exception 'Table % cannot be restored.', p_table;
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'The backup has no "%" section.', p_table;
  end if;

  -- rows that are not in the backup
  execute format('delete from public.%I where %I::text not in (select r ->> %L from jsonb_array_elements($1) r)', p_table, p_key, p_key)
    using p_rows;

  if jsonb_array_length(p_rows) = 0 then return; end if;

  -- only the columns the backup actually contains are overwritten
  select string_agg(format('%I = excluded.%I', c.column_name, c.column_name), ', ')
    into v_cols
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table and c.column_name <> p_key
     and exists (select 1 from jsonb_object_keys(p_rows -> 0) k where k = c.column_name);

  execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1) on conflict (%I) do %s',
                 p_table, p_table, p_key, case when v_cols is null then 'nothing' else 'update set ' || v_cols end)
    using p_rows;
end $$;
revoke all on function public._elix_sync_rows(text, text, jsonb) from public, anon, authenticated;

-- p_scope: 'menu' (all menu items), 'takeaway' (Take Away slides), 'gallery' (gallery list),
--          'site' (restaurant details, social links and website texts)
create or replace function public.restore_content_backup(p_backup_id uuid, p_scope text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row    public.content_backups%rowtype;
  v_safety uuid;
  v_marker text[] := array['menu_source', 'menu_seed_0010', 'takeaway_seed_0010'];
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can restore a backup.' using errcode = '42501';
  end if;
  if p_scope not in ('menu', 'takeaway', 'gallery', 'site') then
    raise exception 'Unknown restore scope "%".', p_scope;
  end if;
  select * into v_row from public.content_backups where id = p_backup_id;
  if not found then
    raise exception 'That backup no longer exists.';
  end if;

  -- 1. a safety copy of what is there right now
  v_safety := public.create_content_backup('Automatic copy before restoring "' || left(v_row.label, 60) || '"', 'auto');

  -- 2. put the chosen part back
  if p_scope = 'menu' then
    perform public._elix_sync_rows('menu_items', 'id', v_row.data -> 'menu_items');
  elsif p_scope = 'takeaway' then
    perform public._elix_sync_rows('takeaway_slides', 'id', v_row.data -> 'takeaway_slides');
  elsif p_scope = 'gallery' then
    perform public._elix_sync_rows('gallery_items', 'id', v_row.data -> 'gallery_items');
  else
    perform public._elix_sync_rows('restaurant_info', 'id', v_row.data -> 'restaurant_info');
    perform public._elix_sync_rows('social_links', 'platform', v_row.data -> 'social_links');
    delete from public.site_settings
     where key <> all (v_marker)
       and key not in (select s ->> 'key' from jsonb_array_elements(v_row.data -> 'site_settings') s);
    insert into public.site_settings
      select * from jsonb_populate_recordset(null::public.site_settings,
        (select coalesce(jsonb_agg(s), '[]'::jsonb) from jsonb_array_elements(v_row.data -> 'site_settings') s where s ->> 'key' <> all (v_marker)))
    on conflict (key) do update set value = excluded.value;
  end if;

  return jsonb_build_object('ok', true, 'scope', p_scope, 'safety_backup', v_safety);
end $$;

-- who may call what: signed-in users only (the functions themselves then require an administrator)
revoke all on function public.create_content_backup(text, text) from public, anon;
revoke all on function public.ensure_daily_content_backup() from public, anon;
revoke all on function public.import_content_backup(text, jsonb) from public, anon;
revoke all on function public.restore_content_backup(uuid, text) from public, anon;
grant execute on function public.create_content_backup(text, text) to authenticated;
grant execute on function public.ensure_daily_content_backup() to authenticated;
grant execute on function public.import_content_backup(text, jsonb) to authenticated;
grant execute on function public.restore_content_backup(uuid, text) to authenticated;
